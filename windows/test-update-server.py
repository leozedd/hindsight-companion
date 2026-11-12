import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

spec=importlib.util.spec_from_file_location('updater',Path(__file__).with_name('update-server.py'))
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
SOURCE='def cleanup(device_type):\n    if device_type not in ("cpu", "mlx"):\n        gc.collect()\n'

class Manager:
    def __init__(self): self.calls=[]
    def owned(self,r): return True
    def stop(self,s): self.calls.append('stop');s.update(phase='stopped',services={})
    def start(self,s): self.calls.append('start');s.update(phase='running',services={'api':{'pid':1}})

class UpdateTests(unittest.TestCase):
    def test_patch_rejects_unknown(self):
        with self.assertRaises(RuntimeError):u.patch_cuda('def cleanup(): pass')
        self.assertIn('"cuda"',u.patch_cuda(SOURCE))
        self.assertEqual(u.patch_cuda(u.patch_cuda(SOURCE)),u.patch_cuda(SOURCE))

    def simulate(self, fail=False, running=True, api='1.2.1', source=SOURCE, ui_version='1.2.0'):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);db=root/'db';db.mkdir();(db/'PG_VERSION').write_text('17');(db/'record').write_text('original')
            ui=root/'control-plane/node_modules/@vectorize-io/hindsight-control-plane';ui.mkdir(parents=True)
            (ui/'package.json').write_text('{"version":"1.2.0"}')
            local=root/'venv/Lib/site-packages/hindsight_api/engine/local_device.py';local.parent.mkdir(parents=True);local.write_text(u.patch_cuda(SOURCE))
            (root/'.env').write_text('HINDSIGHT_API_DATABASE_URL=pg0://hindsight\nHINDSIGHT_API_TENANT_API_KEY=test\n')
            manager=Manager();state={'phase':'running' if running else 'stopped','services':{'api':{}} if running else {}}
            def command(args,**kwargs):
                if 'install' in args and '--ignore-scripts' in args:
                    staged=Path(kwargs['cwd'])/'node_modules/@vectorize-io/hindsight-control-plane/bin';staged.mkdir(parents=True);(staged/'cli.js').write_text('// fake staged UI')
                if '--report' in args:
                    report=Path(args[args.index('--report')+1]);report.write_text(json.dumps({'install':[{'metadata':{'name':'hindsight-api-slim','version':api},'download_info':{'url':f'https://example.invalid/hindsight_api_slim-{api}-py3-none-any.whl'}}]}))
                if 'download' in args:
                    dest=Path(args[args.index('--dest')+1]);version=args[-1].split('==')[1]
                    with zipfile.ZipFile(dest/f'hindsight_api_slim-{version}-py3-none-any.whl','w') as w:w.writestr('hindsight_api/engine/local_device.py',source)
                return 'fake dependency output'
            count=0
            def verify(config):
                nonlocal count
                count+=1
                if fail and count==1:
                    (db/'record').write_text('migrated')
                    raise RuntimeError('injected validation failure')
            fake_pg=SimpleNamespace(Pg0=lambda **kw:SimpleNamespace(info=lambda:SimpleNamespace(running=False)))
            with patch.object(u,'ROOT',root),patch.object(u,'DATABASE',db),patch.object(u,'RESULT',root/'result.json'),patch.object(u,'latest',side_effect=[api,ui_version]),patch.object(u,'run',side_effect=command),patch.object(u.metadata,'version',return_value='1.2.0'),patch.object(u.metadata,'distributions',return_value=[]),patch.object(u,'verify',side_effect=verify),patch.dict(sys.modules,{'pg0':fake_pg}):
                if source!=SOURCE:
                    with self.assertRaises(RuntimeError):u.update(manager,state)
                else:u.update(manager,state)
            result=json.loads((root/'result.json').read_text())
            if result['status']=='rolled_back':
                self.assertTrue((ui/'package.json').exists(), 'Original front end not restored')
            return result,manager.calls,state,(db/'record').read_text(),local.read_text()

    def test_up_to_date_never_stops(self):
        result,calls,*_=self.simulate(api='1.2.0');self.assertEqual(result['status'],'up_to_date');self.assertEqual(calls,[])
    def test_unknown_patch_never_stops(self):
        result,calls,*_=self.simulate(source='changed upstream');self.assertEqual(result['status'],'failed');self.assertEqual(calls,[])
    def test_success(self):
        result,calls,state,*_=self.simulate();self.assertEqual(result['status'],'updated');self.assertEqual(calls,['stop','start']);self.assertEqual(state['phase'],'running')
    def test_rollback_restores_database(self):
        result,calls,state,record,source=self.simulate(fail=True);self.assertEqual(result['status'],'rolled_back');self.assertEqual(record,'original');self.assertEqual(source,u.patch_cuda(SOURCE));self.assertEqual(calls,['stop','start','stop','start'])
    def test_ui_success(self):
        result,*_=self.simulate(ui_version='1.2.1');self.assertEqual(result['status'],'updated')
    def test_ui_rollback(self):
        result,*_=self.simulate(fail=True,ui_version='1.2.1');self.assertEqual(result['status'],'rolled_back')
    def test_stopped_state_preserved(self):
        result,calls,state,*_=self.simulate(running=False);self.assertEqual(result['status'],'updated');self.assertEqual(calls,['stop','start','stop']);self.assertEqual(state['phase'],'stopped')

if __name__=='__main__':unittest.main()
