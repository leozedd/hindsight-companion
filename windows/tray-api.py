"""Hidden-process API entry point used by the tray manager."""
import os
from pathlib import Path
import signal
import sys
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
load_dotenv(ROOT/'.env',override=True)

if __name__ == '__main__':
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA unavailable; refusing CPU fallback.')
    from hindsight_api.main import main

    def graceful_break(signum, frame):
        # Hidden Windows children may inherit CTRL_C_IGNORED. CTRL_BREAK is
        # always delivered; delegate to Uvicorn's current SIGINT handler.
        handler = signal.getsignal(signal.SIGINT)
        if callable(handler):
            handler(signal.SIGINT, frame)
        else:
            raise KeyboardInterrupt

    signal.signal(signal.SIGBREAK, graceful_break)
    sys.argv=[sys.argv[0]]
    main()
