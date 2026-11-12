"""Own and manage hidden Hindsight processes for the Windows tray UI.
Only stops recorded processes whose creation times still match.
"""
from contextlib import contextmanager
import ctypes
from datetime import datetime, timezone
import json
import logging
import msvcrt
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

import httpx
import psutil

ROOT = Path(__file__).resolve().parent
LOGS = ROOT / 'logs'
STATE = ROOT / 'tray-services.json'
PYTHON = ROOT / 'venv/Scripts/python.exe'
UI = ROOT / 'control-plane/node_modules/@vectorize-io/hindsight-control-plane/bin/cli.js'
LOGS.mkdir(exist_ok=True)
logging.basicConfig(filename=LOGS/'manager.log',level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',encoding='utf-8')


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding='utf-8'))
    return {'phase':'stopped','services':{}}


def save(state):
    state['updated_at'] = datetime.now(timezone.utc).isoformat()
    temp = STATE.with_suffix(f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(temp, STATE)


@contextmanager
def exclusive():
    with (ROOT/'tray-services.lock').open('a+b') as lock:
        if not lock.seek(0,2):
            lock.write(b' ')
            lock.flush()
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
        except OSError:
            raise RuntimeError('Another start/stop action is already in progress.') from None
        try:
            yield
        finally:
            lock.seek(0)
            msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1)


def owned(record):
    if not record:
        return None
    try:
        process = psutil.Process(record['pid'])
        if abs(process.create_time()-record['created']) < 0.01:
            return process
    except psutil.NoSuchProcess:
        pass
    return None


def listening(port):
    with socket.socket() as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(('127.0.0.1',port)) == 0


def launch(name, command, state):
    env = os.environ.copy()
    env['PYTHONUTF8'] = '1'
    env['PYTHONIOENCODING'] = 'utf-8'
    if name == 'ui':
        from dotenv import dotenv_values
        config = dotenv_values(ROOT / '.env')
        env['HINDSIGHT_CP_DATAPLANE_API_KEY'] = config.get('HINDSIGHT_API_TENANT_API_KEY') or ''
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = subprocess.SW_HIDE
    with (LOGS/f'{name}.log').open('ab',buffering=0) as log:
        log.write(f'\n--- {datetime.now().isoformat()} start ---\n'.encode())
        process = subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,
            stdout=log,stderr=subprocess.STDOUT,startupinfo=startup,
            creationflags=subprocess.CREATE_NEW_CONSOLE)
    state['services'][name] = {'pid':process.pid,'created':psutil.Process(process.pid).create_time()}
    save(state)


def await_ready(name,url,state,timeout):
    deadline = time.monotonic()+timeout
    with httpx.Client(timeout=3,trust_env=False,follow_redirects=True) as client:
        while time.monotonic()<deadline:
            if not owned(state['services'].get(name)):
                raise RuntimeError(f'{name} exited; inspect logs/{name}.log.')
            try:
                response = client.get(url)
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.5)
    raise RuntimeError(f'{name} did not become ready within {timeout}s; inspect its log.')


def signal_console(pid):
    kernel = ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.FreeConsole()
    if not kernel.AttachConsole(int(pid)):
        raise ctypes.WinError(ctypes.get_last_error())
    # The helper shares the target console briefly; ignore both CTRL_C and
    # CTRL_BREAK here so the broadcast reaches the services, not this helper.
    handler_type = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_uint)
    ignore_control = handler_type(lambda event: 1)
    kernel.SetConsoleCtrlHandler.argtypes = [ctypes.c_void_p, ctypes.c_int]
    try:
        if not kernel.SetConsoleCtrlHandler(ctypes.cast(ignore_control, ctypes.c_void_p),True):
            raise ctypes.WinError(ctypes.get_last_error())
        if not kernel.GenerateConsoleCtrlEvent(1,0):
            raise ctypes.WinError(ctypes.get_last_error())
        time.sleep(0.3)
    finally:
        kernel.FreeConsole()


def stop_one(name, state):
    process = owned(state['services'].get(name))
    if not process:
        return
    children = process.children(recursive=True)
    targets = [process,*children]
    signal = subprocess.run([str(PYTHON),str(Path(__file__)), '_signal',str(process.pid)],
        capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW,timeout=10)
    if signal.returncode:
        # A permission error is a real blocker, not permission to kill by another route.
        raise RuntimeError(f'Could not send graceful stop to {name}; inspect manager.log. Detail: '+signal.stderr.decode('utf-8',errors='replace')[-1000:])
    _, remaining = psutil.wait_procs(targets,timeout=100 if name=='api' else 15)
    for target in remaining:
        logging.warning('Graceful shutdown timed out; terminating owned %s PID %s',name,target.pid)
        try:
            target.terminate()
        except psutil.NoSuchProcess:
            pass
    _, remaining = psutil.wait_procs(remaining,timeout=10)
    if remaining:
        raise RuntimeError(f'{name} processes have not stopped.')


def stop(state):
    api_was_owned = bool(owned(state.get('services', {}).get('api')))
    state['phase']='stopping'
    state.pop('error',None)
    save(state)
    for name in ['ui','api']:
        stop_one(name,state)
    if api_was_owned:
        # Native Hindsight normally stops pg0 itself; finish its named local instance if needed.
        from pg0 import Pg0
        from dotenv import dotenv_values
        database = dotenv_values(ROOT/'.env').get('HINDSIGHT_API_DATABASE_URL','pg0')
        if database in ('pg0','pg0://hindsight'):
            pg = Pg0(name='hindsight')
            if pg.info().running:
                pg.stop()
    state['services']={}
    state['phase']='stopped'
    save(state)


def start(state):
    state['services'] = {name:record for name,record in state.get('services',{}).items() if owned(record)}
    for name,port in [('api',8888),('ui',9999)]:
        if name not in state['services'] and listening(port):
            raise RuntimeError(f'Port {port} is already occupied by a process not owned by this tray. Close that instance first.')
    from dotenv import dotenv_values
    config=dotenv_values(ROOT/'.env')
    required = ['HINDSIGHT_API_LLM_MODEL','HINDSIGHT_API_LLM_API_KEY','HINDSIGHT_API_TENANT_API_KEY']
    missing=[key for key in required if not config.get(key) or config[key]=='YOUR_MODEL_ID']
    if missing:
        raise RuntimeError('Configure .env fields first: '+', '.join(missing))
    node=shutil.which('node')
    if not node or not UI.is_file():
        raise RuntimeError('Node.js or the installed Control Plane is missing.')
    state['phase']='starting'
    state.pop('error',None)
    save(state)
    if 'api' not in state['services']:
        launch('api',[str(PYTHON),str(ROOT/'tray-api.py')],state)
    await_ready('api','http://127.0.0.1:8888/health',state,180)
    api_key = config.get('HINDSIGHT_API_TENANT_API_KEY')
    headers = {'Authorization': f'Bearer {api_key}'} if api_key else {}
    with httpx.Client(timeout=10, trust_env=False, headers=headers) as client:
        client.get('http://127.0.0.1:8888/v1/default/banks').raise_for_status()
    if 'ui' not in state['services']:
        launch('ui',[node,str(UI),'--hostname','127.0.0.1','--port','9999','--api-url','http://127.0.0.1:8888'],state)
    await_ready('ui','http://127.0.0.1:9999/',state,90)
    state['phase']='running'
    save(state)


def main():
    action=sys.argv[1]
    if action=='_signal':
        signal_console(sys.argv[2])
        return
    if action=='status':
        print(json.dumps(load_state()))
        return
    with exclusive():
        state=load_state()
        try:
            if action=='start': start(state)
            elif action=='stop': stop(state)
            elif action=='update':
                import importlib.util
                spec = importlib.util.spec_from_file_location('hindsight_server_update', ROOT/'update-server.py')
                updater = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(updater)
                updater.update(sys.modules[__name__], state)
            else: raise ValueError('Unknown action: '+action)
        except Exception as error:
            logging.exception('Service action %s failed',action)
            if action == 'update' and state.get('phase') in ('running', 'stopped'):
                state['update_error'] = str(error)
            else:
                state['phase']='error'
                state['error']=str(error)
            save(state)
            raise
        logging.info('Action %s finished: %s',action,state['phase'])


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
