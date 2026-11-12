"""Transactional update for the owned API/Control Plane. Called under manager.exclusive.
Only pure-Python Hindsight distributions may change; CUDA dependencies remain pinned.
Database backup is cold and rollback restores it before restarting the old API.
"""
import ast
from datetime import datetime
import importlib.metadata as metadata
import json
import logging
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

import httpx
from dotenv import dotenv_values
from packaging.version import Version

ROOT = Path(__file__).resolve().parent
RESULT = ROOT / 'server-update-result.json'
DATABASE = Path.home() / '.pg0/instances/hindsight/data'


def run(command, **kwargs):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            encoding='utf-8', errors='replace', **kwargs)
    logging.info('Update command output: %s', result.stdout[-12000:])
    if result.returncode:
        raise RuntimeError('Update command failed; inspect logs/manager.log.')
    return result.stdout


def latest(client, package, registry):
    url = f'https://pypi.org/pypi/{package}/json' if registry == 'python' else f'https://registry.npmjs.org/{package}/latest'
    response = client.get(url)
    response.raise_for_status()
    version = response.json()['info']['version'] if registry == 'python' else response.json()['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise RuntimeError(f'{package}: expected a stable release, got {version!r}')
    return version


def patch_cuda(source):
    """Modify only the previously verified post-inference GC condition; reject drift."""
    old = 'if device_type not in ("cpu", "mlx"):\n        gc.collect()'
    new = 'if device_type not in ("cpu", "mlx", "cuda"):\n        gc.collect()'
    if new in source:
        return source
    if source.count(old) != 1:
        raise RuntimeError('CUDA GC patch no longer matches upstream. No service was stopped; review the new implementation first.')
    return source.replace(old, new)


def wheel_patch_check(path):
    with zipfile.ZipFile(path) as wheel:
        source = wheel.read('hindsight_api/engine/local_device.py').decode('utf-8')
    patch_cuda(source)


def write_result(data):
    RESULT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def update(manager, state):
    work = ROOT / 'updates' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    work.mkdir(parents=True)
    old_api = metadata.version('hindsight-api-slim')
    ui_package = ROOT / 'control-plane/package.json'
    old_ui = json.loads((ROOT / 'control-plane/node_modules/@vectorize-io/hindsight-control-plane/package.json').read_text(encoding='utf-8'))['version']
    info = {'status': 'checking', 'backup': str(work), 'before': {'api': old_api, 'ui': old_ui}}
    write_result(info)
    stopped_for_backup = False
    was_running = False
    try:
        with httpx.Client(timeout=40, follow_redirects=True) as client:
            api = latest(client, 'hindsight-api-slim', 'python')
            ui = latest(client, '@vectorize-io/hindsight-control-plane', 'node')
        api = api if Version(api) > Version(old_api) else old_api
        ui = ui if Version(ui) > Version(old_ui) else old_ui
        info['target'] = {'api': api, 'ui': ui}
        if api == old_api and ui == old_ui:
            info['status'] = 'up_to_date'
            write_result(info)
            return
        config = dotenv_values(ROOT / '.env')
        if config.get('HINDSIGHT_API_DATABASE_URL') != 'pg0://hindsight':
            raise RuntimeError('Automatic update supports only this deployment\'s pg0://hindsight database.')
        db = DATABASE
        if not (db / 'PG_VERSION').exists():
            raise RuntimeError('Expected embedded PostgreSQL data directory not found.')
        wheels = work / 'new-wheels'
        previous = work / 'old-wheels'
        wheels.mkdir(); previous.mkdir()
        constraints = work / 'constraints.txt'
        installed = {d.metadata['Name']: d.version for d in metadata.distributions() if d.metadata['Name']}
        constraints.write_text('\n'.join(f'{name}=={version}' for name, version in installed.items()
            if not name.lower().replace('_', '-').startswith('hindsight-')) + '\n', encoding='utf-8')
        report = work / 'pip-plan.json'
        if api != old_api:
            run([sys.executable, '-m', 'pip', 'install', '--dry-run', '--report', str(report), '--upgrade',
                 '--constraint', str(constraints), f'hindsight-api-slim[embedded-db]=={api}'], timeout=240)
            plan = json.loads(report.read_text(encoding='utf-8'))['install']
            for item in plan:
                name = item['metadata']['name']; version = item['metadata']['version']
                url = item['download_info']['url']
                if not name.lower().replace('_', '-').startswith('hindsight-') or not url.endswith('-py3-none-any.whl'):
                    raise RuntimeError(f'Update requires dependency review: {name}. CUDA/binary dependencies will not be changed automatically.')
                old_version = metadata.version(name)  # Do not silently introduce a new dependency.
                run([sys.executable, '-m', 'pip', 'download', '--no-deps', '--only-binary=:all:',
                     '--dest', str(wheels), f'{name}=={version}'], timeout=180)
                run([sys.executable, '-m', 'pip', 'download', '--no-deps', '--only-binary=:all:',
                     '--dest', str(previous), f'{name}=={old_version}'], timeout=180)
            core = list(wheels.glob('hindsight_api_slim-*.whl'))
            if len(core) != 1:
                raise RuntimeError('Expected exactly one API wheel.')
            wheel_patch_check(core[0])
        # Stage front end before any downtime; never mutate live node_modules.
        staged_ui = work / 'control-plane-new'
        if ui != old_ui:
            staged_ui.mkdir()
            (staged_ui / 'package.json').write_text(json.dumps({'private': True,
                'dependencies': {'@vectorize-io/hindsight-control-plane': ui}}), encoding='utf-8')
            pnpm = shutil.which('pnpm.cmd') or shutil.which('pnpm')
            if not pnpm:
                raise RuntimeError('pnpm is required for Control Plane updates.')
            run([pnpm, 'install', '--ignore-scripts'], cwd=staged_ui, timeout=360, shell=sys.platform == 'win32')
            if not (staged_ui / 'node_modules/@vectorize-io/hindsight-control-plane/bin/cli.js').exists():
                raise RuntimeError('Staged Control Plane entry missing.')
        shutil.copy2(ROOT / '.env', work / 'hindsight.env')
        patch_file = ROOT / 'venv/Lib/site-packages/hindsight_api/engine/local_device.py'
        shutil.copy2(patch_file, work / 'local_device.py')
        (work / 'pip-freeze.txt').write_text(run([sys.executable, '-m', 'pip', 'freeze'], timeout=30), encoding='utf-8')
        was_running = any(manager.owned(r) for r in state.get('services', {}).values())
        manager.stop(state)
        stopped_for_backup = True
        # Never back up or restore a running database.
        from pg0 import Pg0
        if Pg0(name='hindsight').info().running or (db / 'postmaster.pid').exists():
            raise RuntimeError('PostgreSQL has not fully stopped; update aborted before installation.')
        shutil.copytree(db, work / 'database')
        info['status'] = 'installing'; write_result(info)
        ui_changed = False
        api_attempted = False
        try:
            if api != old_api:
                api_attempted = True
                run([sys.executable, '-m', 'pip', 'install', '--no-deps', '--force-reinstall',
                    *map(str, wheels.glob('*.whl'))], timeout=180)
                patch_file.write_text(patch_cuda(patch_file.read_text(encoding='utf-8')), encoding='utf-8')
            if ui != old_ui:
                (ROOT / 'control-plane').rename(work / 'control-plane-old')
                try:
                    staged_ui.rename(ROOT / 'control-plane')
                except Exception:
                    (work / 'control-plane-old').rename(ROOT / 'control-plane')
                    raise
                ui_changed = True
            run([sys.executable, '-m', 'pip', 'check'], timeout=45)
            manager.start(state)
            verify(config)
            if not was_running:
                manager.stop(state)
            info['status'] = 'updated'
            info['verification'] = 'health, authenticated banks, GPU availability, UI HTTP 200; recall if HINDSIGHT_COMPANION_VERIFY_BANK configured'
        except Exception as error:
            logging.exception('Update failed; restoring packages and cold database')
            manager.stop(state)  # If stopping fails, do NOT touch database files.
            if Pg0(name='hindsight').info().running or (db / 'postmaster.pid').exists():
                raise RuntimeError(f'Recovery blocked: database still running. Backup: {work}') from error
            if api_attempted:
                run([sys.executable, '-m', 'pip', 'install', '--no-deps', '--force-reinstall',
                    *map(str, previous.glob('*.whl'))], timeout=180)
                shutil.copy2(work / 'local_device.py', patch_file)
            if ui_changed:
                (ROOT / 'control-plane').rename(work / 'control-plane-failed')
                (work / 'control-plane-old').rename(ROOT / 'control-plane')
            db.rename(work / 'database-failed')
            shutil.copytree(work / 'database', db)
            if was_running:
                manager.start(state)
                verify(config)
            info['status'] = 'rolled_back'
            info['error'] = str(error)
            write_result(info)
            return
        write_result(info)
    except Exception as error:
        if stopped_for_backup and info['status'] == 'checking' and was_running:
            try:
                manager.start(state)
            except Exception:
                logging.exception('Could not restart original services after backup failure')
        info.update(status='failed', error=str(error))
        write_result(info)
        raise


def verify(config):
    run([sys.executable, '-c', 'import torch; assert torch.cuda.is_available(), "CUDA unavailable"'], timeout=40)
    headers = {'Authorization': 'Bearer ' + config['HINDSIGHT_API_TENANT_API_KEY']}
    with httpx.Client(timeout=45, trust_env=False, headers=headers, follow_redirects=True) as client:
        response = client.get('http://127.0.0.1:8888/v1/default/banks')
        response.raise_for_status()
        client.get('http://127.0.0.1:8888/health').raise_for_status()
        bank = config.get('HINDSIGHT_COMPANION_VERIFY_BANK')
        if bank:
            from urllib.parse import quote
            response = client.post('http://127.0.0.1:8888/v1/default/banks/' + quote(bank, safe='') + '/memories/recall',
                json={'query': 'preferences', 'budget': 'low', 'max_tokens': 256})
            response.raise_for_status()
        client.get('http://127.0.0.1:9999/').raise_for_status()
