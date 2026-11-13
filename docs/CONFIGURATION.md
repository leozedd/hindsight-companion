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

## Register the current project

In a Pi or PiWeb session opened in the project directory, run:

```text
/hindsight-project
```

The command adds the project to the official `mapPathToBank` configuration and reloads Pi automatically. With Git available, repository subdirectories and linked worktrees resolve to the main repository root. Outside Git, the current session directory is registered. Git must be installed for directory detection.

The default bank ID is `coding-agent::<project-directory-name>`. To use the same bank from a differently named checkout, or separate unrelated projects with the same name, specify an ID:

```text
/hindsight-project coding-agent::my-project
```

Register once on each computer; its local path can differ, but the bank ID must match to share project memory. Existing mappings are reused. A conflicting explicit ID is refused rather than silently replacing the destination.

The command changes routing only: it does not move existing memories, change connection or retention settings, or change the default bank for other directories. The first edit keeps a private backup beside the configuration as `hindsight.json.before-project-registration`. After a successful save, reload applies the route; if reload fails, restart Pi / PiWeb.

To use `personal` outside registered projects, set these top-level fields in the existing configuration, keeping the connection fields:

```json
{
  "bankId": "personal",
  "dynamicBankId": false
}
```

Only the session working directory determines its bank; discussing a project or editing its files from another directory does not switch banks. Unregistered directories still use the default bank. Existing history and memories are not relocated when routing changes.

## Recall and retention

Additional options in this file control the official extension's behavior, including automatic injection, session retention and project ingestion. See the [official integration documentation](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents) for the supported options. Fields omitted from the example use upstream defaults.

Disabling the PiWeb package takes effect after reload. Previously recalled text remains in the current conversation; a new conversation starts with fresh context.

## Update the runtime

The official runtime version is specified in Companion's `package.json`. Update Companion through the installation method described in the [README](../README.md#update).
