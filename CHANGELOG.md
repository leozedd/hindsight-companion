# Changelog

[简体中文](CHANGELOG.zh-CN.md)

## [0.1.4]

- Add `/hindsight-project [bank-id]` to register the current project through official `mapPathToBank` settings and reload Pi.
- Resolve Git subdirectories and linked worktrees to the main project; retain existing mappings and configuration.

## [0.1.3]

- Create a disabled configuration template on the first plugin load in a fresh environment, and show setup guidance.
- Keep existing and explicitly overridden configurations unchanged.

## [0.1.2]

- Store plugin configuration in the Pi agent directory as `hindsight.json`.
- Migrate legacy configuration on first load without overwriting an existing Pi config; honor explicit configuration overrides.

## [0.1.1]

- Fix official Skill discovery in npm/pnpm installations by resolving the dependency at runtime.

## [0.1.0]

- Pi/PiWeb package for the official Hindsight extension and companion skill.
- Optional Windows tray with service start, stop, frontend/backend update and rollback support.
