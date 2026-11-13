# 连接配置

[English](CONFIGURATION.md)

Pi 插件的配置文件为 `~/.pi/agent/hindsight.json`。Windows 对应路径为 `$HOME\.pi\agent\hindsight.json`。

设置了 `PI_CODING_AGENT_DIR` 时，默认使用该目录中的 `hindsight.json`。显式设置的 `HINDSIGHT_CONFIG` 优先。

首次加载时，如果 Pi 配置文件不存在，会从已有的 `~/.hindsight/coding-agent.json` 复制配置。原文件保留，供其他客户端使用。从 0.1.1 或更早版本升级后，重启一次 Pi / PiWeb，使官方运行时重新读取配置路径。

没有现有配置时，插件首次加载会生成以下模板，并在 Pi / PiWeb 中提示文件位置。仅安装 npm 包不会生成文件，安装后需要启动或重载 Pi。模板在填写连接信息前保持禁用。显式 `HINDSIGHT_CONFIG` 指定的文件由用户管理。

修改生成的配置文件：

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

| 字段 | 填写内容 |
|---|---|
| `disabled` | 配置连接后改为 `false` |
| `serverMode` | 连接已有 Hindsight 服务时使用 `self-hosted` |
| `apiUrl` | 运行 Pi 的机器能够访问的服务地址 |
| `apiToken` | 该服务的 API 密钥 |
| `bankId` | 要使用的记忆库 |
| `dynamicBankId` | 设为 `false`，使用指定记忆库，而不是按项目选择 |

填写服务地址、API 令牌和记忆库，将 `disabled` 改为 `false`，然后重载会话。禁用期间不会注册 Hindsight 工具；启用后可运行官方 `hindsight_diagnose` 检查实际连接。

从另一台电脑连接时，`127.0.0.1` 指向那台电脑自身。应填写 Hindsight 服务所在机器的可访问地址、API 令牌和记忆库 ID；多个客户端共享记忆库时，使用同一个记忆库 ID。

## 登记当前项目

在项目目录中打开 Pi 或 PiWeb 会话，执行：

```text
/hindsight-project
```

命令将项目加入官方 `mapPathToBank` 配置，并自动重载 Pi。Git 仓库的子目录和关联 worktree 会归到主仓库根目录；非 Git 目录则登记当前会话的工作目录。目录识别需要系统已安装 Git。

默认记忆库 ID 为 `coding-agent::<项目目录名>`。不同电脑的检出目录名称不同时，或需要区分同名的无关项目时，可指定 ID：

```text
/hindsight-project coding-agent::my-project
```

每台电脑登记一次。各电脑的本地路径可以不同；共享项目记忆时，使用同一个记忆库 ID。已有映射会直接复用；如果显式指定的 ID 与已有映射冲突，命令会拒绝修改，不会静默覆盖。

命令只修改路由：不搬迁已有记忆，不修改连接和保存设置，也不改变其他目录的默认记忆库。首次修改会在配置旁保留私有备份 `hindsight.json.before-project-registration`。保存成功后通过重载应用路由；重载失败时，重启 Pi / PiWeb。

如果希望未登记的目录使用 `personal`，在已有配置中设置以下顶层字段，保留连接字段：

```json
{
  "bankId": "personal",
  "dynamicBankId": false
}
```

记忆库由会话工作目录决定；在其他目录讨论项目或编辑项目文件，不会自动切库。未登记的目录仍使用默认记忆库。修改路由不会搬迁已有会话历史或记忆。

## 召回与保存

该文件的其他选项由官方扩展处理，包括自动注入、会话保存和项目摄取。支持的选项见[官方集成文档（英文）](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents)。示例中省略的字段使用上游默认值。

在 PiWeb 中禁用插件包后，重载会话即可生效。之前召回的文字仍保留在当前对话中；新建对话会使用新的上下文。

## 更新运行版本

Companion 的 `package.json` 指定官方运行版本。按 [README](README.zh-CN.md#更新插件) 中对应的安装方式更新 Companion。
