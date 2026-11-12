# Windows tray

[简体中文](README.zh-CN.md)

## Requirements

- Windows PowerShell 5.1 with Windows Forms; Node.js and pnpm on PATH.
- An existing native Hindsight API environment at `<destination>/venv/Scripts/python.exe`, with `hindsight-api-slim[embedded-db]`, CUDA-enabled torch, sentence-transformers, `httpx`, `psutil`, `python-dotenv`, `packaging` and `pg0`.
- Control Plane at `<destination>/control-plane/node_modules/@vectorize-io/hindsight-control-plane/bin/cli.js`.
- Local embedding and reranker model paths configured in `.env`.

The manager supports CUDA, API port 8888, UI port 9999 and the named embedded database `pg0://hindsight`. Other database layouts and ports require changes to the manager. For API installation, see the [Hindsight documentation](https://hindsight.vectorize.io/).

To install Control Plane, run the following inside `<destination>/control-plane`:

```sh
pnpm add @vectorize-io/hindsight-control-plane@latest
```

## Install

Stop managed services and exit the tray before replacing its scripts. From the repository root:

```powershell
.\windows\install.ps1 -Destination (Join-Path $HOME '.hindsight')
```

The installer checks dependencies, backs up previous manager scripts and creates a **Hindsight Companion** Start Menu shortcut. Existing `.env` settings are preserved. If the file is absent, the installer creates it from the [template](https://github.com/leozedd/hindsight-companion/blob/main/windows/.env.example) and generates an API key.

Edit `<destination>/.env` to set the LLM connection and model paths. The template binds the API to `127.0.0.1:8888` with key authentication. Control Plane binds to `127.0.0.1:9999`.

Open **Hindsight Companion** from Start Menu. It starts the API and Control Plane. Double-click the tray icon to open the management page; right-click for service controls. Closing the browser leaves services running. Use **停止前后端（释放显存）** to stop them, or **退出并停止服务** to stop services and close the tray.

## Update frontend and backend

Select **检查并更新前后端…** and confirm. The updater:

1. Checks stable API/UI releases and stages downloads.
2. Checks Python dependency constraints and the CUDA cleanup patch.
3. Stops services and confirms PostgreSQL has exited.
4. Backs up the database, configuration and previous software.
5. Installs the update, starts services and checks API health, authenticated bank access, CUDA and the UI.

For an additional recall check, set `HINDSIGHT_COMPANION_VERIFY_BANK` to an existing bank in `.env`. After a successful update, services return to their previous running/stopped state. Pi package updates are handled separately.

The updater pins non-Hindsight Python dependencies. If a new release needs dependency changes or its CUDA patch no longer matches, automatic updating stops for compatibility review.

## Results and recovery

| Location | Contents |
|---|---|
| `server-update-result.json` | Update result and backup location |
| `logs/manager.log` | Service and update log |
| `updates/<time>/` | Configuration, software and cold database backup |

Ordinary installation/validation failures trigger a rollback attempt. If interrupted or rollback fails, stop services and confirm PostgreSQL is stopped before restoring files. Restore the old software and its matching database backup together; an API downgrade alone cannot reverse a database migration. Retain the failed data directory until recovery succeeds.

Backups are retained for manual cleanup. They include the service configuration and memory database; store them with the same access restrictions as the live data.
