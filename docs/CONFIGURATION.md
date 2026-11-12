# Configure your own Hindsight connection

Create `~/.hindsight/coding-agent.json` **locally, outside this repository**. Merge with any existing official configuration rather than overwriting it. This example is for a self-hosted server and a deliberately chosen bank:

```json
{
  "serverMode": "self-hosted",
  "apiUrl": "http://127.0.0.1:8888",
  "apiToken": "",
  "bankId": "my-bank",
  "dynamicBankId": false,
  "autoInject": "reflect",
  "retainSessions": false,
  "autoSeed": false,
  "gitIngest": "none",
  "codebaseSurvey": false,
  "manageBankConfig": false,
  "autoUpdate": false,
  "disabled": false
}
```

Fill `apiToken` privately, choose an existing bank, then reload Pi. The example opts out of automatic session retention and project ingestion; change those only if you intend to send that material to your memory service. The official skill describes upstream defaults; those defaults do not override your configuration. Reflect/injection may invoke the configured server LLM and incur costs.

This package loads the official runtime from its npm dependency. Standard Pi package updates own that dependency; the official staged-runtime `update` command is not the update mechanism for this public package.

If you previously ran the official installer, remove only its standalone Pi `dist/pi.js` registration from your settings after backing them up locally. Remove any duplicate Hindsight MCP registration as well. Keep unrelated extensions/MCP servers and your private connection file. Do not run the official `install pi` command again alongside this package.

In PiWeb, disabling the whole package disables its extension and skill resources after reload. Already submitted server tasks and memories are unaffected. Confirm the intended server/bank using the official `hindsight_diagnose` tool; redact its output before sharing.
