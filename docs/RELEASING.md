# Release to GitHub, npm and the Pi catalog

## Public identity and authorization

Publishing exposes the GitHub owner/repository and npm publisher account. Review the accounts before release; use project accounts if personal account linkage is unwanted. Keep personal author names/emails out of Git commits. Do not retrieve stored credentials through shell workarounds or copy tokens into this repository.

Authenticate through official clients only:

```sh
gh auth login --web --git-protocol https
npm login --auth-type=web --registry=https://registry.npmjs.org
```

Both may require browser approval / 2FA. Do not paste passwords, tokens or recovery codes into chat. Never commit `.npmrc`, CLI auth files or browser profiles.

## Candidate review

1. Set `repository` and `homepage` in `package.json` to the actual intended public repository, after checking the authenticated GitHub account. Do not invent owner placeholders for a release.
2. Run `pnpm install --ignore-scripts`, `pnpm test`, `pnpm run audit:privacy` and `pnpm run release:check`. Run `python windows/test-update-server.py` with the documented test dependencies. The release check intentionally fails while the repository identity is missing.
3. Inspect every source in `release-files.json`, the staged diff and `git ls-files`. A fresh source-only repository is required; do not import deployment history or use `git add .` in the deployment root.
4. Inspect the real tarball, not only the ignore file: `npm pack --ignore-scripts`, then list/extract its contents privately. Expected npm files are exactly `package.json` plus `package.json.files`; no Windows runtime/configuration files are included. Delete candidate archives before creating a new one.
5. Review account linkage, URLs, attribution, private paths, keys, emails, network addresses, model/provider settings and financial information. Automated patterns do not replace this review.

A public GitHub repository can be created with `gh repo create hindsight-companion --public --source . --remote origin`. Commit only the reviewed allowlist, using a public-safe contributor identity, then push. Never force-push a repository you did not create for this release. After upload, inspect the remote file inventory and first commit before announcing it.

## Publish and discover

After GitHub publication and final local review, change the candidate-status wording in README, Chinese README and CHANGELOG to match the actual release, rerun the gate, then `npm publish --access public` (or `pnpm publish --access public` with the same prepublish gate). Do not bypass `prepublishOnly` for a real publish. Complete npm's 2FA flow through the official client if requested.

Pi's [package documentation](https://pi.dev/docs/latest/packages) states that npm packages with the `pi-package` keyword are eligible for discovery in [Pi's catalog](https://pi.dev/packages). There is no separate plugin-upload repository to submit to. PiWeb manages the same Pi packages; its [contribution policy](https://github.com/agegr/pi-web/blob/main/CONTRIBUTING.md) prefers Pi extensions and excludes a separate plugin subsystem. npm publication does not guarantee immediate catalog indexing or official endorsement.

After publication, check `npm view pi-hindsight-companion version`, install that registry release into an empty Pi test profile and verify one extension entry plus native package disable/enable. Confirm registry tarball inventory and catalog appearance separately. Only then record the public URLs and release version.

GitHub Actions' `publish npm` workflow uses OIDC and requires an npm trusted publisher configured for the actual GitHub owner/repository, workflow `publish.yml`, and environment `npm`. Configure this in npm; no long-lived npm token belongs in the repository. Require human approval on the GitHub environment. First publication may still require an interactive npm login before trusted publishing is configured.

## Keep official runtime updates convenient

`pnpm run sync:upstream` checks the official npm release, updates its exact dependency, increments the Companion patch version and adds a changelog entry. The scheduled workflow opens a reviewable PR; it never updates an installed backend, mutates memory or publishes automatically. Enable GitHub Actions' permission to create PRs if your repository disables it. Review changes, run tests and publish a Companion release. PiWeb's native Update button then installs that release.

## Windows source distribution

GitHub contains `windows/` source; npm deliberately does not. If a GitHub release archive is wanted, build it from reviewed tracked sources (`git archive`), not the installed `.hindsight` directory. Configuration templates must be empty, and backups, models, database and runtime logs must be absent. The tray remains optional and independent of the npm package update lifecycle.
