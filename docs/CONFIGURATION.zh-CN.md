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

## 召回与保存

该文件的其他选项由官方扩展处理，包括自动注入、会话保存和项目摄取。支持的选项见[官方集成文档（英文）](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents)。示例中省略的字段使用上游默认值。

在 PiWeb 中禁用插件包后，重载会话即可生效。之前召回的文字仍保留在当前对话中；新建对话会使用新的上下文。

## 更新运行版本

Companion 的 `package.json` 指定官方运行版本。按 [README](README.zh-CN.md#更新插件) 中对应的安装方式更新 Companion。
