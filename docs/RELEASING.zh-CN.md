# 开发与发布

[English](RELEASING.md)

## 运行检查

需要 Node.js 22+、pnpm 和 Python。Python 测试依赖安装在虚拟环境中：

```sh
pnpm install --ignore-scripts
pnpm test
python -m pip install httpx python-dotenv packaging
python windows/test-update-server.py
pnpm run release:check
```

`release:check` 执行 JavaScript 测试、校验源码白名单，并检查 npm 文件清单。GitHub Actions 还会在 Windows 和 Ubuntu 上运行测试。

## 更新官方依赖

```sh
pnpm run sync:upstream
pnpm install --ignore-scripts
```

同步脚本选择 `@vectorize-io/hindsight-coding-agents` 的最新稳定版，更新精确依赖版本、递增 Companion 补丁版本，并新增更新日志条目。发布前审阅上游变更并运行检查，同时更新[中文更新日志](../CHANGELOG.zh-CN.md)。

定时工作流 `sync official runtime` 会创建依赖更新 PR。仓库需要允许 GitHub Actions 创建 PR。

## 打包与发布

1. 更新版本号和中英文更新日志。
2. 审阅暂存区差异，运行 `pnpm run release:check`。
3. 创建 `.release/` 目录后，执行 `npm pack --ignore-scripts --pack-destination .release`，对照 `package.json.files` 检查包内文件。
4. 执行 `pnpm publish --access public` 发布已审阅的版本。
5. 核对 npm 版本，并在干净的 Pi 配置中安装验证。
6. 为发行提交创建标签和 GitHub Release。

发布前需完成 npm 登录及要求的双重验证。工作流 **publish npm** 支持 npm 可信发布：在 npm 中配置对应 GitHub 仓库、工作流 `publish.yml` 和环境 `npm`。

按 [Pi 包文档（英文）](https://pi.dev/docs/latest/packages)，带 `pi-package` 关键词的 npm 包可被 [Pi 插件目录](https://pi.dev/packages)发现。PiWeb 安装同一套 Pi 包。

## 分发 Windows 工具

Windows 脚本通过 GitHub 源码压缩包分发。npm 包包含 Windows 使用文档，不包含托盘脚本。需要单独源码包时，从发行提交执行 `git archive`。
