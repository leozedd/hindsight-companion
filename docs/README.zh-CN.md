# Hindsight Companion

两个独立工具：**Pi / PiWeb 标准插件包**，以及 **Windows 原生 GPU 服务托盘管理器**。这是社区封装，不是 Vectorize、Pi 或 PiWeb 官方产品；记忆逻辑由官方 Hindsight 提供。

## 在 PiWeb 中安装、开关和更新

当前是待发布候选版，尚未上传 npm。正式发布后，在 PiWeb「设置 → 插件 → 添加插件」输入 `npm:pi-hindsight-companion`，或执行：

```sh
pi install npm:pi-hindsight-companion
```

先按 [配置说明](CONFIGURATION.md) 在本机填写自己的 Hindsight 地址和认证信息。包只加载官方扩展和配套 Skill，不注册第二个 MCP 入口，不修改 PiWeb 编译文件。不要同时保留官方扩展的另一条注册。

- **关闭**：禁用包，再重载目标会话。其他已运行会话也需分别重载；已经读入的记忆不会从上下文中消失，需要隔离时新建会话。
- **更新**：使用 PiWeb 原生「检查 / 更新」。更新的是 Companion 的最新发行版及它指定的官方依赖，不更新后端。官方扩展发布新版后，维护者需要先更新依赖并发布 Companion；不会宣称上游发布即刻可用。
- **卸载**：执行 `pi remove npm:pi-hindsight-companion`。不会删除服务端记忆或私密连接配置。

入口测试版本：官方扩展 `0.8.7`、Pi `1.5.0`。本包不新增记忆删除工具，也不改写官方召回或写入策略。

## 在 Windows 中管理前后端

托盘面向已有的 Windows 原生 CUDA API、Control Plane 和内嵌 PostgreSQL 安装，不是完整后端安装器。安装条件、命令和恢复方式见 [Windows 说明](../windows/README.md)。

托盘更新只处理前后端，不处理 Pi 插件。更新前检查依赖与 CUDA 补丁；停服务后冷备份数据库和配置。普通更新异常会尝试恢复旧包及对应数据库；强制结束进程或断电时需要人工恢复，不能只降级 Python 包。

## 隐私与费用

仓库与 npm 包只包含源码和空配置模板。不要提交 `.env`、认证配置、数据库、模型、日志、截图或备份。日志可能包含请求数据和渠道信息，不能直接上传排障。

真实内容可能发给自行配置的外部 LLM，并产生费用。插件开关不等于网络隔离；远程 API 需要认证和受保护网络。详见 [安全说明](../SECURITY.md)。

发布走 GitHub 和 npm；Pi 官方目录通过 `pi-package` 关键词发现 npm 包，PiWeb 复用 Pi 包。发布步骤见 [RELEASING.md](RELEASING.md)。
