# Security and privacy

Do not post credentials, private configuration, memory exports, logs, screenshots, model directories, databases or backups to issues. Describe a reproduction using synthetic data. If you discover a credential exposure, revoke/rotate that credential at its issuer first. Deleting a Git file does not revoke a leaked key or erase public history.

This repository ships a source allowlist and a local privacy gate. It checks release filenames, common credential/private-path patterns, personal-network addresses and unexpected binary files. This reduces accidental leakage; it does not prove absence of all personal or proprietary information. Review the complete staged diff and archive inventory before every public upload.

The npm wrapper runs the official Hindsight extension with the user's Pi permissions. It adds no telemetry or remote listener. Official extension/service requests follow the user's own configuration and may include prompts, memory content and project data. Disabling a plugin does not retract already-sent data or revoke API credentials.

The optional Windows updater downloads executable code from PyPI/npm. Review upstream changes and back up data. Its retained runtime logs and backups are private. The API defaults to loopback with key authentication; exposing HTTP to another host requires a separately secured network and transport.

Until a public repository's private security-reporting channel is enabled, do not disclose vulnerability details or private attachments in public issues. Report privately through a maintainer-controlled channel once one is published; this candidate intentionally lists no personal email address.
