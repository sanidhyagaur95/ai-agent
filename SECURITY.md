# Security

## Overview

This project is an AI coding agent that can inspect and interact with a local software project through tools such as filesystem access, code search, and Git.

Because the agent can access project data and potentially modify files, it should be treated as a privileged development tool.

Use it only in environments where you understand and trust the tools available to the agent.

## Local Project Access

The agent may be able to read files from the target project.

Use `.aiignore` to prevent sensitive files and directories from being exposed to the model.

Examples of files that may need to be excluded:

- `.env`
- Credentials
- API keys
- Private certificates
- SSH keys
- Database dumps
- Production configuration
- Other confidential data

Do not rely solely on `.aiignore` for protecting highly sensitive secrets. Verify the agent's actual filesystem boundaries and tool implementation.

## Cloud LLM Providers

When using a cloud LLM provider, information from the project may be sent to the provider.

Depending on the agent's behavior, this can include:

- Source code
- File contents
- Search results
- Git information
- Tool results
- User prompts
- Other project context

Before enabling a cloud provider for a project, review that provider's current privacy, data retention, and security policies.

Do not send confidential or proprietary source code to a cloud provider unless you are authorized to do so and understand the applicable data handling policies.

## API Keys and Secrets

Never commit secrets to the repository.

Do not commit:

```text
.env
API keys
Access tokens
Passwords
Private keys
Certificates
Cloud credentials
Database credentials