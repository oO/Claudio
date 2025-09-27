# Claude Code Environment Variables Reference

Complete reference of all environment variables that Claude Code responds to, organized by category.

---

## Authentication & API Keys

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ANTHROPIC_API_KEY` | API key for Claude SDK authentication | - | Required for API access |
| `ANTHROPIC_AUTH_TOKEN` | Custom authorization header value | - | For custom auth setups |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API authentication key | - | Added in v1.0.51 |
| `ANTHROPIC_CUSTOM_HEADERS` | Additional custom request headers | - | JSON format |

---

## Model Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ANTHROPIC_MODEL` | Name of model to use | - | Can set default model |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Default Opus model (used by `opus` alias and `opusplan` in Plan Mode) | - | Added in v1.0.88 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Default Sonnet model (used by `sonnet` alias and `opusplan` when not in Plan Mode) | - | Added in v1.0.88 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Default Haiku model for background tasks | - | Replaces deprecated `ANTHROPIC_SMALL_FAST_MODEL` |
| `ANTHROPIC_SMALL_FAST_MODEL` | ⚠️ **DEPRECATED** - Haiku-class model for background tasks | - | Use `ANTHROPIC_DEFAULT_HAIKU_MODEL` instead |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | AWS region for Haiku model | - | For Bedrock users |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model to use for subagents | - | Override default subagent model |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum output tokens per request | - | Control response length |

---

## Network & Proxy Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `HTTP_PROXY` | HTTP proxy server URL | - | Standard proxy var |
| `HTTPS_PROXY` | HTTPS proxy server URL | - | Standard proxy var |
| `NO_PROXY` | Domains/IPs bypassing proxy | - | Comma-separated list, added in v1.0.93 |
| `NODE_EXTRA_CA_CERTS` | Path to custom CA certificate file | - | For enterprise SSL |
| `CLAUDE_CODE_CLIENT_CERT` | Path to client certificate for mTLS | - | Added in v1.0.126 |
| `CLAUDE_CODE_CLIENT_KEY` | Path to client private key for mTLS | - | Added in v1.0.126 |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | Passphrase for encrypted private key | - | Added in v1.0.126 |

---

## Bash/Shell Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `BASH_DEFAULT_TIMEOUT_MS` | Default timeout for bash commands (ms) | 120000 (2 min) | Added in v0.2.108 |
| `BASH_MAX_TIMEOUT_MS` | Maximum timeout for bash commands (ms) | 600000 (10 min) | Added in v0.2.108 |
| `BASH_MAX_OUTPUT_LENGTH` | Maximum characters in bash outputs | - | Truncates long output |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Freeze working directory for bash commands | false | Added in v1.0.18 |
| `CLAUDE_BASH_NO_LOGIN` | Skip login shell for BashTool | false | Set to `1` or `true`, added in v1.0.124 |
| `CLAUDE_CODE_SHELL_PREFIX` | Wrapper for shell commands | - | Added in v1.0.61 |
| `CLAUDE_CODE_GIT_BASH_PATH` | Path to bash.exe for Git for Windows | - | Windows-specific |

---

## MCP (Model Context Protocol)

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `MCP_TIMEOUT` | MCP server startup timeout (ms) | - | Added in v0.2.41 |
| `MCP_TOOL_TIMEOUT` | Timeout for individual MCP tool calls (ms) | - | Added in v1.0.8 |
| `MAX_MCP_OUTPUT_TOKENS` | Maximum allowed MCP tool output tokens | 25000 | Controls output size |

### MCP Server-Specific Variables

| Variable | Description | Notes |
|----------|-------------|-------|
| `AIRTABLE_API_KEY` | Airtable MCP server authentication | Example from docs |
| `CLICKUP_API_KEY` | ClickUp MCP server authentication | Example from docs |
| `CLICKUP_TEAM_ID` | ClickUp team ID | Example from docs |

---

## Claude Code Behavior & Features

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disable background services | false | For restricted networks |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | Credential refresh interval (ms) | 300000 (5 min) | Added in v0.2.74 |
| `CLAUDE_PROJECT_DIR` | Absolute path to project root | - | Available in hook commands only |
| `CLAUDE_CONFIG_DIR` | Custom config directory path | `~/.claude` | Respects XDG_CONFIG_HOME, added in v1.0.6 |
| `XDG_CONFIG_HOME` | XDG Base Directory config path | - | Added in v1.0.28 |
| `DISABLE_AUTOUPDATER` | Disable automatic updates | false | Set to `1` |
| `DISABLE_BUG_COMMAND` | Disable `/bug` command | false | |
| `DISABLE_COST_WARNINGS` | Disable cost warning messages | false | |
| `DISABLE_INTERLEAVED_THINKING` | Opt out of interleaved thinking | false | Added in v1.0.1 |
| `USE_BUILTIN_RIPGREP` | Use built-in ripgrep binary | true | Set to `0` to opt out, added in v1.0.84 |

---

## IDE Integration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | Enable IDE auto-connection | true | Set to `false` to disable, added in v1.0.61 |

---

## Cloud Providers

### AWS Bedrock

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CLAUDE_CODE_USE_BEDROCK` | Enable AWS Bedrock integration | false | Set to `1` |
| `AWS_REGION` | AWS region for Bedrock | - | Required for Bedrock |
| `ANTHROPIC_BEDROCK_BASE_URL` | Custom Bedrock endpoint URL | - | For proxies/gateways |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | Skip Bedrock authentication | false | For custom auth |

### Google Vertex AI

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CLAUDE_CODE_USE_VERTEX` | Enable Google Vertex AI integration | false | Set to `1` |
| `CLOUD_ML_REGION` | Google Cloud region for Vertex | - | Required for Vertex |
| `ANTHROPIC_VERTEX_PROJECT_ID` | GCP project ID for Vertex | - | Required for Vertex |
| `ANTHROPIC_VERTEX_BASE_URL` | Custom Vertex endpoint URL | - | For proxies/gateways |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH` | Skip Vertex authentication | false | For custom auth |

---

## Debugging & Logging

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ANTHROPIC_LOG` | Enable debug logging | - | Set to `debug`, replaces `DEBUG=true` (v0.2.125) |

### OpenTelemetry (OTEL)

| Variable | Description | Notes |
|----------|-------------|-------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTEL collector endpoint | Standard OTEL var |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers for OTEL exporter | Standard OTEL var |
| Various `OTEL_*` variables | Standard OpenTelemetry configuration | See OTEL spec |

---

## Hooks

| Variable | Description | Context | Notes |
|----------|-------------|---------|-------|
| `CLAUDE_PROJECT_DIR` | Absolute path to project root directory | Available when Claude Code spawns hook commands | Added in v1.0.54 |

---

## System & Platform

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `NODE_PATH` | Node.js module resolution paths | - | Preserved from parent environment |

---

## Notes

### Deprecated Variables
- `ANTHROPIC_SMALL_FAST_MODEL` → Use `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- `DEBUG=true` → Use `ANTHROPIC_LOG=debug`

### Version-Specific Additions
- **v1.0.126**: mTLS support (`CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`)
- **v1.0.124**: `CLAUDE_BASH_NO_LOGIN`
- **v1.0.93**: `NO_PROXY`
- **v1.0.88**: `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`
- **v1.0.84**: `USE_BUILTIN_RIPGREP`
- **v1.0.61**: `CLAUDE_CODE_AUTO_CONNECT_IDE`, `CLAUDE_CODE_SHELL_PREFIX`
- **v1.0.51**: `AWS_BEARER_TOKEN_BEDROCK`
- **v1.0.28**: `XDG_CONFIG_HOME`
- **v1.0.18**: `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`
- **v1.0.8**: `MCP_TOOL_TIMEOUT`
- **v1.0.6**: `CLAUDE_CONFIG_DIR`
- **v1.0.1**: `DISABLE_INTERLEAVED_THINKING`
- **v0.2.125**: `ANTHROPIC_LOG`, Bedrock ARN handling changes
- **v0.2.108**: `BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`
- **v0.2.74**: `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`
- **v0.2.41**: `MCP_TIMEOUT`

### Settings Helper Scripts (AWS)
- `awsAuthRefresh`: Helper script for foreground AWS operations (e.g., `aws sso login`)
- `awsCredentialExport`: Helper script for background AWS credential refresh with STS-like response

---

**Total Environment Variables Documented**: 50+

**Last Updated**: Based on Claude Code v1.0.126 documentation