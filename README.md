> **Disclaimer:** This repository contains source code recovered from the source map (`cli.js.map`) bundled in the [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm package. It is not an official source release by Anthropic. All rights belong to their respective owners.

# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more at [Claude Code Homepage](https://claude.com/product/claude-code)** | [Documentation](https://code.claude.com/docs/en/overview)

<img src="https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1" />

## Get started

1. Install Claude Code:

```sh
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project directory and run `claude`.

## External providers (MVP)

This fork now has an experimental non-Anthropic provider path for `OpenAI`, `Gemini`, and `Ollama`.

Set one of the providers below before starting the CLI:

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

Current scope of the MVP:

- Main chat/tool loop works through a non-streaming adapter.
- Tool calling is translated for the external providers above.
- OpenAI defaults to `gpt-5.4`, Gemini defaults to `gemini-3.1-pro-preview`, and Ollama loads installed models from the local server.
- Advanced Anthropic-only features such as prompt caching, Claude-specific betas, and some multimodal blocks are not fully supported on this path yet.

If `OLLAMA_MODEL` is not set, the CLI falls back to the first installed Ollama model cached from the local server. You can still override any provider model manually with `OPENAI_MODEL`, `GEMINI_MODEL`, or `OLLAMA_MODEL`.

Convenience commands for external providers:

- `/openai-key` or `/openai-key <apiKey>` to save an OpenAI API key
- `/openai-model` or `/openai-model <model>` to switch OpenAI models
- `/gemini-key` or `/gemini-key <apiKey>` to save a Gemini API key
- `/gemini-model` or `/gemini-model <model>` to switch Gemini models
- `/ollama-model` or `/ollama-model <installed-model>` to switch Ollama models

Notes for Ollama:

- The first prompt can be slower because Ollama may need to load the model into memory.
- This fork now sends `keep_alive` on Ollama chat requests and warms the selected model in the background on startup.
- Override the keep-alive duration with `OLLAMA_KEEP_ALIVE` if you want a shorter or longer model residency.

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
