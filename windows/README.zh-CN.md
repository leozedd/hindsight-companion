# Windows 托盘

[English](README.md)

## 环境要求

- Windows PowerShell 5.1 及 Windows Forms；PATH 中可用的 Node.js 和 pnpm。
- 已有的原生 Hindsight API 环境，Python 路径为 `<destination>/venv/Scripts/python.exe`，包含 `hindsight-api-slim[embedded-db]`、CUDA 版 torch、sentence-transformers、`httpx`、`psutil`、`python-dotenv`、`packaging` 和 `pg0`。
- Control Plane 安装于 `<destination>/control-plane/node_modules/@vectorize-io/hindsight-control-plane/bin/cli.js`。
- `.env` 中配置好的本地 embedding 和 reranker 模型路径。

管理器支持 CUDA、API 端口 `8888`、前端端口 `9999` 和命名内嵌数据库 `pg0://hindsight`。其他数据库布局或端口需要调整管理器。API 安装方式见 [Hindsight 官方文档（英文）](https://hindsight.vectorize.io/)。

安装 Control Plane 时，在 `<destination>/control-plane` 中执行：

```sh
pnpm add @vectorize-io/hindsight-control-plane@latest
```

## 安装托盘

替换管理脚本前，停止服务并退出已有托盘。在仓库根目录执行：

```powershell
.\windows\install.ps1 -Destination (Join-Path $HOME '.hindsight')
```

安装器检查依赖，备份旧管理脚本，并创建开始菜单中的 **Hindsight Companion** 快捷方式。已有 `.env` 保持不变；如果文件不存在，安装器从[模板](https://github.com/leozedd/hindsight-companion/blob/main/windows/.env.example)创建配置并生成 API 密钥。

编辑 `<destination>/.env`，填写 LLM 连接和模型路径。模板将 API 绑定到 `127.0.0.1:8888`，并启用密钥认证。Control Plane 绑定到 `127.0.0.1:9999`。

从开始菜单打开 **Hindsight Companion**，即可启动 API 和 Control Plane。双击托盘图标打开管理页面；右键显示服务菜单。关闭浏览器后服务继续运行。选择「停止前后端（释放显存）」停止服务，或选择「退出并停止服务」同时关闭托盘。

## 更新前后端

选择「检查并更新前后端…」并确认。更新器依次执行：

1. 检查 API 和前端的稳定版，下载待安装文件。
2. 检查 Python 依赖约束和 CUDA 清理补丁。
3. 停止服务，确认 PostgreSQL 已退出。
4. 备份数据库、配置和旧软件版本。
5. 安装新版、启动服务，并检查 API 健康、认证访问、CUDA 和前端页面。

如需额外验证召回，在 `.env` 中将 `HINDSIGHT_COMPANION_VERIFY_BANK` 设为一个已有记忆库。更新成功后，服务恢复到更新前的运行或停止状态。Pi 插件更新另行操作。

更新器固定非 Hindsight 的 Python 依赖。新版需要更改这些依赖，或 CUDA 补丁不再匹配时，自动更新会停止，等待兼容性复核。

## 查看结果与恢复

| 位置 | 内容 |
|---|---|
| `server-update-result.json` | 更新结果及备份位置 |
| `logs/manager.log` | 服务与更新日志 |
| `updates/<时间>/` | 配置、软件和数据库冷备份 |

安装或验证失败时，更新器会尝试回退。进程被中断或回退失败后，先停止服务并确认 PostgreSQL 已停止，再恢复文件。旧软件必须与对应的数据库备份一起恢复；只降级 API 不能撤销数据库迁移。恢复成功前保留失败时的数据目录。

备份由操作人员手动清理，其中包含服务配置和记忆数据库，应采用与正式数据相同的访问限制。
