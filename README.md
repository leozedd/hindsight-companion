# Hindsight Companion

[中文](docs/README.zh-CN.md)

Two independent conveniences around [official Hindsight](https://github.com/vectorize-io/hindsight): a standard Pi / PiWeb package, and an optional Windows tray manager for a native GPU deployment. Community project; not an official Vectorize, Pi, or PiWeb product.

## Pi / PiWeb package

**Publication status: release candidate, not yet published to npm.** The package name is proposed; the following command applies after a successful release:

```sh
pi install npm:pi-hindsight-companion
```

In PiWeb, add the same npm source under **Settings → Plugins → Add plugin**. The package imports the official `@vectorize-io/hindsight-coding-agents` entry without changing its hooks or tools. The official companion skill is exposed through the dependency's directory. There is no second Hindsight MCP registration, background service installer, or PiWeb binary patch.

Before loading, configure your own server connection in `~/.hindsight/coding-agent.json`; see [Configuration](docs/CONFIGURATION.md). Do not load this package alongside another registration of the official Pi extension. Existing memory banks stay on your server.

- **Disable:** use the package switch, then reload each affected session. Already-recalled text remains in that session's context; start a fresh session when isolation matters.
- **Update:** use PiWeb's normal package Check / Update actions, or `pi update --extensions`. Updates install the latest **Companion release**, including its tested official dependency version. A new official release is not available through this button until a Companion release adopts it.
- **Uninstall:** `pi remove npm:pi-hindsight-companion`. This removes the package registration, not server memories or your private configuration.

Tested entry: official runtime `0.8.7`, Pi `1.5.0`. This package supplies no alternate memory implementation or extra delete tools. It does not rewrite your configuration. Upstream behavior and outbound data handling follow your official Hindsight settings.

## Windows tray manager

For an **existing** Windows-native CUDA API installation with embedded PostgreSQL. Not a general Hindsight installer; no Docker, CPU fallback, or automatic firewall changes. See [Windows setup](windows/README.md).

The tray starts/stops its owned API, Control Plane and embedded database. Its **Check and update frontend/backend** action updates those server components only. It never updates the Pi package. API updates pin existing non-Hindsight Python dependencies, check the known CUDA cleanup patch, and cold-back up the database before installation. Ordinary update failures attempt package/database rollback; interrupted processes and power loss require recovery from the retained backup.

## Privacy and costs

The repository/package contains source and empty configuration templates only. No accounts, credentials, databases, model files, logs, screenshots, or deployment backups belong here. Local runtime logs/backups are private; inspect and redact before sharing them.

Memory content can be sent to your configured external LLM and incur charges. Package disablement is not a network authorization boundary. Keep management UI local; use authentication and an explicitly secured network for remote API access. See [Security](SECURITY.md).

## Development and release

Node.js 22+, pnpm; Python tests use an isolated environment with `httpx`, `python-dotenv`, `packaging`.

```sh
pnpm install --ignore-scripts
pnpm test
pnpm run audit:privacy
pnpm run release:check
```

[Release procedure](docs/RELEASING.md) documents GitHub/npm publication, the Pi catalog, privacy gates, and upstream dependency updates. The repository starts from a clean source-only history; never import deployment history.

License: MIT. Hindsight is maintained by Vectorize AI; upstream license and attribution are linked in [NOTICE](NOTICE).
