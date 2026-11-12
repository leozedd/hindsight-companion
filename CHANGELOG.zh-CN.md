# 更新日志

[English](CHANGELOG.md)

## [0.1.2]

- 插件默认使用 Pi agent 目录中的 `hindsight.json`。
- 首次加载时迁移旧配置，不覆盖已有 Pi 配置，并保留显式配置路径设置。

## [0.1.1]

- 运行时解析官方依赖位置，修复 npm / pnpm 安装后配套 Skill 无法被发现的问题。

## [0.1.0]

- 提供加载官方 Hindsight 扩展及配套 Skill 的 Pi / PiWeb 插件包。
- 提供可选的 Windows 托盘，支持服务启停、前后端更新和失败回退。
