# Connection settings

[简体中文](CONFIGURATION.zh-CN.md)

The Pi package stores its configuration at `~/.pi/agent/hindsight.json`. On Windows, this is `$HOME\.pi\agent\hindsight.json`.

If `PI_CODING_AGENT_DIR` is set, the default file is `hindsight.json` in that directory. An explicit `HINDSIGHT_CONFIG` takes precedence.

On first load, an existing `~/.hindsight/coding-agent.json` is copied to the Pi location if the destination is absent. The original file is retained for other clients. After upgrading from 0.1.1 or earlier, restart Pi / PiWeb once so the official runtime reloads its configuration path.

With no existing configuration, the first plugin load creates the template below and shows its location in Pi / PiWeb. Installing the npm package alone does not create the file; start or reload Pi afterward. The template stays disabled until connection details are filled in. Explicit `HINDSIGHT_CONFIG` paths remain user-managed.

Update the generated file:

```json
{
  "disabled": true,
  "serverMode": "self-hosted",
  "apiUrl": "http://127.0.0.1:8888",
  "apiToken": "",
  "bankId": "my-bank",
  "dynamicBankId": false
}
```

| Field | Value |
|---|---|
| `disabled` | Change to `false` after configuring the connection |
| `serverMode` | `self-hosted` for an existing Hindsight service |
| `apiUrl` | URL reachable from the machine running Pi |
| `apiToken` | API key issued by that service |
| `bankId` | Memory bank to use |
| `dynamicBankId` | `false` to use the specified bank rather than select one by project |

Set the server URL, API token and bank, then change `disabled` to `false` and reload the session. The Hindsight tools remain unavailable while disabled. Run the official `hindsight_diagnose` tool after enabling to check the effective connection.

When connecting from another computer, `127.0.0.1` refers to that computer. Use the Hindsight server’s reachable address, API token and bank ID; for a shared bank, use the same bank ID on every client.

## Recall and retention

Additional options in this file control the official extension's behavior, including automatic injection, session retention and project ingestion. See the [official integration documentation](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents) for the supported options. Fields omitted from the example use upstream defaults.

Disabling the PiWeb package takes effect after reload. Previously recalled text remains in the current conversation; a new conversation starts with fresh context.

## Update the runtime

The official runtime version is specified in Companion's `package.json`. Update Companion through the installation method described in the [README](../README.md#update).
