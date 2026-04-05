import React from 'react';
import { Box, Newline, Text } from '../ink.js';
import { saveGlobalConfig } from '../utils/config.js';
import { applyConfigEnvironmentVariables } from '../utils/managedEnv.js';
import { type ExternalAPIProvider, getExternalAPIProvider } from '../utils/model/providers.js';
import { Select } from './CustomSelect/select.js';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

type Props = {
  onDone(): void;
};

function applyExternalProviderToProcess(provider: ExternalAPIProvider): void {
  delete process.env.CLAUDE_CODE_USE_OPENAI;
  delete process.env.CLAUDE_CODE_USE_OPENROUTER;
  delete process.env.CLAUDE_CODE_USE_GEMINI;
  delete process.env.CLAUDE_CODE_USE_OLLAMA;
  process.env.CLAUDE_CODE_API_PROVIDER = provider;

  if (provider === 'ollama' && !process.env.OLLAMA_BASE_URL) {
    process.env.OLLAMA_BASE_URL = DEFAULT_OLLAMA_BASE_URL;
  }
}

function saveExternalProvider(provider: ExternalAPIProvider): void {
  saveGlobalConfig(current => {
    const {
      CLAUDE_CODE_USE_OPENAI: _useOpenAI,
      CLAUDE_CODE_USE_OPENROUTER: _useOpenRouter,
      CLAUDE_CODE_USE_GEMINI: _useGemini,
      CLAUDE_CODE_USE_OLLAMA: _useOllama,
      ...restEnv
    } = current.env ?? {};

    return {
      ...current,
      env: {
        ...restEnv,
        CLAUDE_CODE_API_PROVIDER: provider,
        ...(provider === 'ollama' && !restEnv.OLLAMA_BASE_URL ? {
          OLLAMA_BASE_URL: DEFAULT_OLLAMA_BASE_URL
        } : {})
      }
    };
  });
}

export function ExternalProviderSetup({
  onDone
}: Props): React.ReactNode {
  const currentProvider = getExternalAPIProvider() ?? 'openai';

  return <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Continue without login</Text>
      <Box flexDirection="column" gap={1} width={74}>
        <Text>
          Choose which provider to use inside the CLI.
          <Newline />
          OpenAI requires <Text bold>OPENAI_API_KEY</Text>, OpenRouter requires <Text bold>OPENROUTER_API_KEY</Text>, Gemini requires <Text bold>GEMINI_API_KEY</Text>, and Ollama uses your local server.
        </Text>
        <Select defaultFocusValue={currentProvider} layout="compact-vertical" options={[{
        label: 'OpenAI',
        value: 'openai',
        description: 'Uses OPENAI_API_KEY and the configured GPT model.'
      }, {
        label: 'OpenRouter',
        value: 'openrouter',
        description: 'Uses OPENROUTER_API_KEY and OpenRouter-compatible model IDs.'
      }, {
        label: 'Google Gemini',
        value: 'gemini',
        description: 'Uses GEMINI_API_KEY and the configured Gemini model.'
      }, {
        label: 'Ollama',
        value: 'ollama',
        description: 'Uses the local Ollama server and detects installed models automatically.'
      }]} onChange={(provider: ExternalAPIProvider) => {
        saveExternalProvider(provider);
        applyConfigEnvironmentVariables();
        applyExternalProviderToProcess(provider);
        onDone();
      }} />
        <Text dimColor>
          You can still change the provider later with environment variables.
        </Text>
      </Box>
    </Box>;
}
