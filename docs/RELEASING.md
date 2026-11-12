# Development and releases

[简体中文](RELEASING.zh-CN.md)

## Run checks

Requires Node.js 22+, pnpm and Python. Install Python test dependencies in a virtual environment:

```sh
pnpm install --ignore-scripts
pnpm test
python -m pip install httpx python-dotenv packaging
python windows/test-update-server.py
pnpm run release:check
```

`release:check` runs the JavaScript tests, validates the source allowlist and checks the npm file inventory. GitHub Actions also runs tests on Windows and Ubuntu.

## Update the official dependency

```sh
pnpm run sync:upstream
pnpm install --ignore-scripts
```

The sync script selects the latest stable `@vectorize-io/hindsight-coding-agents` release, updates the exact dependency, increments Companion's patch version and adds a changelog entry. Review upstream changes and run the checks before releasing. Translate the changelog entry into [Chinese](../CHANGELOG.zh-CN.md).

The scheduled `sync official runtime` workflow opens a dependency-update pull request. It requires repository permission for GitHub Actions to create pull requests.

## Build and publish

1. Update the version and both changelogs.
2. Review the staged diff and run `pnpm run release:check`.
3. Build a candidate with `npm pack --ignore-scripts --pack-destination .release` after creating `.release/`; inspect its contents against `package.json.files`.
4. Publish the reviewed version with `pnpm publish --access public`.
5. Verify the registry version and install it in a clean Pi profile.
6. Tag the released commit and create a GitHub release.

npm authentication and any required 2FA must be completed before publication. The **publish npm** workflow supports npm trusted publishing: configure the GitHub repository, workflow `publish.yml` and environment `npm` as a trusted publisher in npm.

Packages with the `pi-package` keyword are eligible for the [Pi package catalog](https://pi.dev/packages), as described in [Pi's package documentation](https://pi.dev/docs/latest/packages). PiWeb installs the same Pi packages.

## Windows distribution

The Windows scripts are distributed in the GitHub source archive. The npm payload includes Windows documentation but not the tray scripts. Use `git archive` from the released commit for an additional source archive.
