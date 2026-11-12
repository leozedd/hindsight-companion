# Windows tray setup

The tray manages an existing **Windows-native CUDA** Hindsight deployment. It is not a fresh GPU installer. Requirements:

- Windows PowerShell 5.1 with Windows Forms; Node.js and pnpm on PATH.
- `<destination>/venv/Scripts/python.exe` with official `hindsight-api-slim[embedded-db]`, CUDA-enabled torch, sentence-transformers, `httpx`, `psutil`, `python-dotenv`, `packaging` and `pg0` available.
- `<destination>/control-plane/node_modules/@vectorize-io/hindsight-control-plane/bin/cli.js` installed from the official npm package. For example, run `pnpm add @vectorize-io/hindsight-control-plane@latest` **inside that control-plane directory**.
- Local embedding and reranker model paths configured in `.env`; no CPU fallback. Use the official installation documentation to set up compatible GPU dependencies/models first.
- Named embedded database `pg0://hindsight`, API port 8888, Control Plane port 9999. Other database layouts/ports need an explicit code adaptation and are not supported by this updater.

## Install without changing private settings

Stop managed services and exit any existing tray first. From a source checkout:

```powershell
.\windows\install.ps1 -Destination (Join-Path $HOME '.hindsight')
```

The installer checks prerequisites, backs up old manager scripts and copies only five named source files. Existing `.env`, models, Python environment and database are preserved. If no `.env` exists, it copies the empty template and generates an API key locally without printing it. It creates a Start Menu shortcut, not an auto-start task, and does not start services.

Edit `<destination>/.env` locally. Set model paths, LLM model and LLM credential. Default template binds API to loopback with API-key authentication; Control Plane always binds loopback. Credentials and content stay out of this source checkout. External LLM requests can transmit memory content and incur charges. For remote API access, explicitly secure the network/transport; the installer does not open firewall rules.

Launch **Hindsight Companion** from Start Menu. Stop/exit releases the owned API, UI and embedded database; closing the browser does not stop them. Processes are identified by PID and creation time. The manager refuses to take over occupied ports. A graceful-stop timeout may terminate owned processes; update backup begins only after PostgreSQL is confirmed stopped.

## Update and recover

Tray → **检查并更新前后端…** checks PyPI/npm for stable releases. This does not update the Pi plugin. The updater stages downloads before downtime, pins non-Hindsight Python dependencies and rejects unsupported dependency/patch changes. It handles the known post-inference CUDA GC guard only; it refuses unknown upstream implementations.

After a cold backup it installs, starts and verifies health, authenticated bank access, CUDA availability and UI HTTP. To also exercise recall, set `HINDSIGHT_COMPANION_VERIFY_BANK` to an existing bank in `.env`; no test memory is written. The original stopped/running state is restored on success. Ordinary validation failures attempt a rollback of packages, patch and database together. UI versions and API versions are checked independently.

Results: `server-update-result.json`; logs: `logs/manager.log`; backups: `updates/<time>/`. These contain private configuration and potentially memory data. Do not upload them. Backups are retained until the operator removes them after confirming recovery is unnecessary.

If interrupted by process termination, power loss or failed recovery: stop the owned services; confirm PostgreSQL is stopped; retain both original and failed data directories. Restore the backed-up `.env`, old wheel set, original `local_device.py`, old Control Plane and **matching cold database** before restarting. Do not downgrade only the API after a database migration. Do not restore database files while PostgreSQL is running. Keep the backup if any recovery step fails.

## Validation scope

The predecessor local tray was exercised on Windows with CUDA and official API/UI 1.2.0. The public source adds portable packaging and installer guards. Its update state machine has isolated tests; a full fresh-machine GPU setup and a production cross-version database migration have not been validated by this project. It does not claim universal Windows installation support.
