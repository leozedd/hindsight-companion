# Hindsight Companion

[简体中文](docs/README.zh-CN.md)

Use [Hindsight](https://github.com/vectorize-io/hindsight) memory in Pi and PiWeb, and manage a Windows Hindsight server from the system tray.

- **Pi / PiWeb package:** exposes the official Hindsight extension and its companion skill as a manageable Pi package.
- **Windows tray:** starts, stops and updates the API and Control Plane for an existing native CUDA deployment.

The two components can be used independently. Plugin updates and server updates are separate operations.

## Install the Pi package

Requires Node.js 22+, Pi and a running Hindsight server.

```sh
pi install npm:pi-hindsight-companion
```

In PiWeb, use **Settings → Plugins → Add plugin** and enter `npm:pi-hindsight-companion`.

Load or reload Pi after installation. On a new setup, the plugin creates a disabled configuration template at `~/.pi/agent/hindsight.json`. Set the server address, API token and bank, then change `disabled` to `false` and reload Pi. See the [configuration guide](docs/CONFIGURATION.md).

In PiWeb, open **Settings → Plugins** to enable or disable the package. Reload the affected session to apply the change.

### Use a project bank

Open a session in the project directory and run `/hindsight-project`. Companion adds the official directory-to-bank mapping and reloads Pi; no manual path entry is needed. See [project registration](docs/CONFIGURATION.md#register-the-current-project) for custom bank IDs and a `personal` fallback.

### Update

Use PiWeb's **Check / Update** actions, or run:

```sh
pi update --extensions
```

Reload the session afterward. Updates install the latest Companion release and its specified official runtime version. Official runtime updates become available when included in a Companion release.

## Install the Windows tray

The tray uses an existing CUDA API environment, Control Plane and embedded PostgreSQL database. Follow [Windows setup](windows/README.md) to install the scripts and Start Menu shortcut.

From the tray menu:

- **启动前后端** — start the API and Control Plane.
- **停止前后端（释放显存）** — stop services and the embedded database.
- **检查并更新前后端…** — back up and update the server components.

The management page opens at <http://127.0.0.1:9999>.

## Documentation

- [Connection settings](docs/CONFIGURATION.md)
- [Windows setup and recovery](windows/README.md)
- [Development and releases](docs/RELEASING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)

MIT licensed. Community project built on Vectorize's Hindsight; see [NOTICE](NOTICE) for attribution.
