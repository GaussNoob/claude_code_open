# External Providers Guide

This fork adds an experimental provider adapter so Claude Code can run its main chat loop against `OpenAI`, `Google Gemini`, or `Ollama` instead of Anthropic-hosted models.

The goal is to preserve the normal Claude Code workflow:

- start the CLI the same way
- keep tool use available
- switch providers without patching prompts or source files
- persist provider settings in Claude Code global config

## Running this fork locally

Use this repo like a local project, not like the published upstream npm package:

```sh
npm install
npm run start
```

Optional:

```sh
npm run build
```

Notes:

- `npm run start` is the normal local entrypoint for this fork
- `npm run build` regenerates `dist/cli.js`
- both scripts rely on `bun` internally
- `npm install -g @anthropic-ai/claude-code` refers to the official upstream package, not this repository checkout

## Supported providers

### OpenAI

- Provider id: `openai`
- Required auth: `OPENAI_API_KEY`
- Default base URL: `https://api.openai.com/v1`
- Default main model: `gpt-5.4`
- Default small/fast model: `gpt-5-mini`

### Google Gemini

- Provider id: `gemini`
- Required auth: `GEMINI_API_KEY`
- Default base URL: `https://generativelanguage.googleapis.com/v1beta`
- Default main model: `gemini-3.1-pro-preview`
- Default small/fast model: `gemini-3-flash-preview`

### Ollama

- Provider id: `ollama`
- Required auth: none
- Default base URL: `http://127.0.0.1:11434`
- Default main model: `qwen2.5-coder:14b`
- Default small/fast model: `qwen2.5-coder:7b`

Ollama behaves differently from OpenAI and Gemini in one important way: the CLI can query the local Ollama server for installed models and use that list in the picker and in fallback resolution.

## Quick start

### OpenAI

```sh
export CLAUDE_CODE_API_PROVIDER=openai
export OPENAI_API_KEY=your_key
export OPENAI_MODEL=gpt-5.4
npm run start
```

### Gemini

```sh
export CLAUDE_CODE_API_PROVIDER=gemini
export GEMINI_API_KEY=your_key
export GEMINI_MODEL=gemini-3.1-pro-preview
npm run start
```

### Ollama

```sh
export CLAUDE_CODE_API_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=qwen2.5-coder:14b
export OLLAMA_KEEP_ALIVE=30m
npm run start
```

If you installed the published npm package globally instead of running this repository checkout, replace `npm run start` with `claude`.

If you do not want to export variables manually, start the CLI and use the "Continue without login" flow. The provider choice is stored in Claude Code global config and applied automatically in later sessions.

## Environment variables

### Provider selection

The preferred switch is:

```sh
export CLAUDE_CODE_API_PROVIDER=openai
```

Accepted values are:

- `openai`
- `gemini`
- `ollama`

Legacy booleans are still honored for compatibility:

- `CLAUDE_CODE_USE_OPENAI`
- `CLAUDE_CODE_USE_GEMINI`
- `CLAUDE_CODE_USE_OLLAMA`

If `CLAUDE_CODE_API_PROVIDER` is set, it takes precedence over the legacy flags.

### Authentication

Use one of these based on the selected provider:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Ollama does not require an API key in this adapter path.

### Base URLs

Optional endpoint overrides:

- `OPENAI_BASE_URL`
- `GEMINI_BASE_URL`
- `OLLAMA_BASE_URL`

Defaults:

- OpenAI: `https://api.openai.com/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Ollama: `http://127.0.0.1:11434`

This is useful when routing through a gateway, reverse proxy, self-hosted compatibility layer, or a remote Ollama instance.

### Model variables

Provider-specific model variables:

- `OPENAI_MODEL`
- `OPENAI_SMALL_FAST_MODEL`
- `GEMINI_MODEL`
- `GEMINI_SMALL_FAST_MODEL`
- `OLLAMA_MODEL`
- `OLLAMA_SMALL_FAST_MODEL`

Generic fallback variables that are also checked:

- `CLAUDE_CODE_MODEL`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`

Resolution order is provider-specific model variable first, then generic fallback, then the provider default.

## Model discovery and selection

### OpenAI

The model picker exposes a curated list of known models:

- `gpt-5.4`
- `gpt-5.1`
- `gpt-5-mini`
- `gpt-5-nano`

You can still set any compatible model string manually with `/openai-model <model>`.

### Gemini

The model picker exposes a curated list of known models:

- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`
- `gemini-3.1-flash-lite-preview`

You can still set any compatible model string manually with `/gemini-model <model>`.

### Ollama

Ollama models are discovered dynamically:

- the bootstrap path queries `${OLLAMA_BASE_URL}/api/tags`
- `/ollama-model` reads installed models from the local `ollama list` command
- selecting an Ollama model also triggers a background warmup request

If `OLLAMA_MODEL` is unset, Claude Code tries the following:

1. `OLLAMA_MODEL` or `OLLAMA_SMALL_FAST_MODEL`
2. generic fallback variables such as `CLAUDE_CODE_MODEL`
3. cached installed models discovered from Ollama, preferring `qwen2.5-coder:14b` or `qwen2.5-coder:7b` when present
4. built-in defaults

## Commands inside Claude Code

### OpenAI

- `/openai-key`
- `/openai-key <apiKey>`
- `/openai-key clear`
- `/openai-model`
- `/openai-model <model>`
- `/openai-model default`

### Gemini

- `/gemini-key`
- `/gemini-key <apiKey>`
- `/gemini-key clear`
- `/gemini-model`
- `/gemini-model <model>`
- `/gemini-model default`

### Ollama

- `/ollama-model`
- `/ollama-model <installed-model>`

Behavior notes:

- key commands store the credential in Claude Code global config
- OpenAI and Gemini key/model commands also switch the active provider for the current session
- OpenAI and Gemini model pickers show curated models, but direct manual entry is allowed
- `/ollama-model` only accepts installed models and returns a clear error if the requested model is not present

## Runtime behavior

The external-provider path is implemented as a provider adapter around Claude Code's existing message and tool loop.

Current behavior:

- requests run through a non-streaming adapter
- tool schemas are translated to provider-specific function/tool calling payloads
- tool results are converted back into Claude Code's internal message format
- system prompts are preserved and forwarded to the external provider

Ollama-specific behavior:

- chat requests include `keep_alive`
- startup can warm the selected model in the background
- changing models through `/ollama-model` also triggers warmup

You can control model residency with:

```sh
export OLLAMA_KEEP_ALIVE=30m
```

## Current limitations

This path is useful today, but it is still an MVP.

Known tradeoffs:

- some Anthropic-only features do not carry over to external providers
- prompt caching and Anthropic-specific beta features are not fully supported
- the adapter is non-streaming today
- some multimodal content blocks are flattened to text or omitted when translated to external provider payloads
- model lists for OpenAI and Gemini are curated in code rather than fetched dynamically

## Troubleshooting

### OpenAI or Gemini fails immediately

Check:

- the provider selected in `CLAUDE_CODE_API_PROVIDER`
- whether the matching API key is set
- whether a custom `OPENAI_BASE_URL` or `GEMINI_BASE_URL` is pointing at the correct endpoint

### Ollama shows no models

Check:

- whether the Ollama server is reachable at `OLLAMA_BASE_URL`
- whether `ollama list` returns installed models
- whether you need to install a model first, then run `/ollama-model` again

The CLI will tell you to run `ollama pull <model>` when no installed models are found.

### A saved provider keeps reappearing

Provider and model settings can be persisted by Claude Code global config, not only by your shell session. If a provider keeps being selected after restarting the shell, clear or replace the saved setting with the matching `/openai-*`, `/gemini-*`, or `/ollama-model` command.

## Recommended starting points

These are sensible defaults for first use with this fork:

- OpenAI: `gpt-5.4`
- Gemini: `gemini-3.1-pro-preview`
- Ollama: a locally installed coding model that already responds well in `ollama list`, with `qwen2.5-coder:14b` as the built-in default
