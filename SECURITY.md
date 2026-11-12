# Security

[简体中文](SECURITY.zh-CN.md)

## Data flow

The Pi package loads the official Hindsight extension. Recall and retention requests use the configured Hindsight service, which may call its configured LLM provider. Automatic session retention and project ingestion are controlled by the official extension's settings.

## Service access

The Windows template binds the API and Control Plane to loopback and enables API-key authentication. Access from another machine needs an authenticated API endpoint over a protected network or TLS connection.

## Backups and logs

Server update backups include the database and `.env`. Restrict their access like the live service data. When reporting a problem, provide a minimal reproduction and relevant log excerpts with credentials and memory content removed.

## Exposed credentials

Revoke or rotate an exposed credential with its issuing service, then update the clients that use it. Removing a file from a repository does not invalidate its credentials.
