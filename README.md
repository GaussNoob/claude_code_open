> **Disclaimer:** This repository contains source code recovered from the source map (`cli.js.map`) bundled in the [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm package. It is not an official source release by Anthropic. All rights belong to their respective owners.

# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more at [Claude Code Homepage](https://claude.com/product/claude-code)** | [Documentation](https://code.claude.com/docs/en/overview)

<img src="https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1" />

## Get started

This repository is a local fork/reconstruction, not the published npm package workflow.

To run this repo locally:

```sh
npm install
npm run start
```

Notes:

- `npm run start` launches the local CLI from this repository.
- `npm run build` rebuilds the bundled output in `dist/` when you want to regenerate the compiled CLI.
- The local run/build scripts use `bun` under the hood, so Bun needs to be available.

If you want the official upstream package instead of this fork, then `npm install -g @anthropic-ai/claude-code` is the published-package path.

## External providers (MVP)

This fork now has an experimental non-Anthropic provider path for `OpenAI`, `Gemini`, and `Ollama`.

The external-provider path lets Claude Code keep the same terminal workflow while routing model requests through a provider-specific adapter. In practice, that means you can use the CLI without Anthropic login, keep tool calling enabled, and switch providers with either environment variables or in-product commands.

## Quick start

Set one provider before starting the CLI:

```sh
# OpenAI
export CLAUDE_CODE_API_PROVIDER=openai
export OPENAI_API_KEY=your_key
export OPENAI_MODEL=gpt-5.4

# Gemini
export CLAUDE_CODE_API_PROVIDER=gemini
export GEMINI_API_KEY=your_key
export GEMINI_MODEL=gemini-3.1-pro-preview

# Ollama
export CLAUDE_CODE_API_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=qwen2.5-coder:14b
export OLLAMA_KEEP_ALIVE=30m
```

Then start the CLI:

```sh
npm run start
```

If you installed the published npm package globally instead of running this repo locally, the equivalent command is `claude`.

You can also choose a provider from the "Continue without login" setup flow inside the CLI. That screen stores the provider in Claude Code global config and applies the matching environment variables for future sessions.

## What works today

Current scope of the MVP:

- Main chat/tool loop works through a non-streaming adapter.
- Tool calling is translated for the external providers above.
- OpenAI defaults to `gpt-5.4`, Gemini defaults to `gemini-3.1-pro-preview`, and Ollama can resolve installed models from the local server.
- OpenAI and Gemini expose curated model lists in the picker; Ollama discovers models dynamically from the local runtime.
- Advanced Anthropic-only features such as prompt caching, Claude-specific betas, and some multimodal blocks are not fully supported on this path yet.

## Provider configuration

Core variables:

| Provider | Required auth | Default model | Optional endpoint override |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-5.4` | `OPENAI_BASE_URL` |
| Gemini | `GEMINI_API_KEY` | `gemini-3.1-pro-preview` | `GEMINI_BASE_URL` |
| Ollama | none | `qwen2.5-coder:14b` with fallback to detected installed models | `OLLAMA_BASE_URL` |

Model override variables:

- `OPENAI_MODEL`, `OPENAI_SMALL_FAST_MODEL`
- `GEMINI_MODEL`, `GEMINI_SMALL_FAST_MODEL`
- `OLLAMA_MODEL`, `OLLAMA_SMALL_FAST_MODEL`

Generic model fallback variables that are also honored by the adapter:

- `CLAUDE_CODE_MODEL`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`

Legacy compatibility flags are still recognized:

- `CLAUDE_CODE_USE_OPENAI`
- `CLAUDE_CODE_USE_GEMINI`
- `CLAUDE_CODE_USE_OLLAMA`

If `OLLAMA_MODEL` is not set, the CLI first checks cached installed models discovered from the local Ollama server and prefers `qwen2.5-coder:14b` when available. You can still override any provider model manually with `OPENAI_MODEL`, `GEMINI_MODEL`, or `OLLAMA_MODEL`.

## In-product commands

Convenience commands for external providers:

- `/openai-key` or `/openai-key <apiKey>` to save an OpenAI API key
- `/openai-model` or `/openai-model <model>` to switch OpenAI models
- `/gemini-key` or `/gemini-key <apiKey>` to save a Gemini API key
- `/gemini-model` or `/gemini-model <model>` to switch Gemini models
- `/ollama-model` or `/ollama-model <installed-model>` to switch Ollama models

Notes for Ollama:

- The first prompt can be slower because Ollama may need to load the model into memory.
- This fork now sends `keep_alive` on Ollama chat requests and warms the selected model in the background on startup.
- The default Ollama server URL is `http://127.0.0.1:11434`.
- Override the keep-alive duration with `OLLAMA_KEEP_ALIVE` if you want a shorter or longer model residency.
- `/ollama-model` lists installed models from your local `ollama` runtime and validates the selected name before saving it.

## More detailed guide

For a fuller walkthrough covering setup, environment variables, model resolution, command behavior, and troubleshooting for `OpenAI`, `Gemini`, and `Ollama`, see [docs/external-providers.md](./docs/external-providers.md).

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers using Claude Code. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://code.claude.com/docs/en/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information and restricted access to user session data.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).

# claude_code_open
