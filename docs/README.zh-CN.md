# Hindsight Companion

[English](../README.md)

在 Pi 和 PiWeb 中使用 [Hindsight](https://github.com/vectorize-io/hindsight) 长期记忆，并通过 Windows 托盘管理 Hindsight 服务。

- **Pi / PiWeb 插件包**：将官方 Hindsight 扩展及配套 Skill 接入 Pi 的插件管理。
- **Windows 托盘**：为已有的原生 CUDA 部署提供 API 和 Control Plane 的启动、停止与更新入口。

两个组件可独立使用。插件更新与前后端更新分别操作。

## 安装 Pi 插件

需要 Node.js 22+、pnpm、Pi，以及可访问的 Hindsight 服务。npm 包尚未发布，目前从源码安装：

```sh
git clone https://github.com/leozedd/hindsight-companion.git
cd hindsight-companion
pnpm install --ignore-scripts
pi install .
```

按[连接配置](CONFIGURATION.zh-CN.md)在 `~/.hindsight/coding-agent.json` 中填写服务地址和 API 令牌，然后重载 Pi。

在 PiWeb「设置 → 插件」中可启用或禁用插件包。切换后重载目标会话，使设置生效。

### 更新插件

源码安装时，在仓库目录执行以下命令，然后重载会话：

```sh
git pull
pnpm install --ignore-scripts
```

通过 npm 安装的版本可在 PiWeb 中点击「检查 / 更新」，安装最新 Companion 发行版及其指定的官方运行版本。官方运行版本的更新随 Companion 发行版提供。

## 安装 Windows 托盘

托盘使用已有的 CUDA API 环境、Control Plane 和内嵌 PostgreSQL。按 [Windows 安装与恢复](../windows/README.zh-CN.md)安装管理脚本及开始菜单快捷方式。

托盘菜单提供：

- **启动前后端**：启动 API 和 Control Plane。
- **停止前后端（释放显存）**：停止服务及内嵌数据库。
- **检查并更新前后端…**：备份并更新服务端组件。

管理页面地址：<http://127.0.0.1:9999>。

## 文档

- [连接配置](CONFIGURATION.zh-CN.md)
- [Windows 安装与恢复](../windows/README.zh-CN.md)
- [开发与发布](RELEASING.zh-CN.md)
- [安全说明](../SECURITY.zh-CN.md)
- [更新日志](../CHANGELOG.zh-CN.md)

本项目采用 MIT 许可证，是基于 Vectorize Hindsight 的社区工具。依赖归属见 [NOTICE](../NOTICE)，[中文说明](NOTICE.zh-CN.md)。
