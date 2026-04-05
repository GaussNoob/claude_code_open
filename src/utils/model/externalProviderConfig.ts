import { saveGlobalConfig } from '../config.js'
import {
  getDefaultOllamaBaseUrl,
  getExternalProviderApiKeyEnvName,
  getExternalProviderModelEnvName,
  type ExternalAPIProvider,
} from './providers.js'

type ExternalProviderConfigUpdates = {
  apiKey?: string | null
  model?: string | null
  switchProvider?: boolean
}

function getProviderLegacyEnvKeys(): string[] {
  return [
    'CLAUDE_CODE_USE_OPENAI',
    'CLAUDE_CODE_USE_OPENROUTER',
    'CLAUDE_CODE_USE_GEMINI',
    'CLAUDE_CODE_USE_OLLAMA',
  ]
}

function applyEnvUpdate(
  target: NodeJS.ProcessEnv | Record<string, string>,
  key: string,
  value: string | null | undefined,
): void {
  if (value === undefined) {
    return
  }

  if (value === null) {
    delete target[key]
    return
  }

  target[key] = value
}

export function saveExternalProviderConfig(
  provider: ExternalAPIProvider,
  updates: ExternalProviderConfigUpdates,
): void {
  saveGlobalConfig(current => {
    const env = { ...(current.env ?? {}) }

    for (const legacyKey of getProviderLegacyEnvKeys()) {
      delete env[legacyKey]
    }

    if (updates.switchProvider !== false) {
      env.CLAUDE_CODE_API_PROVIDER = provider
    }

    const apiKeyEnv = getExternalProviderApiKeyEnvName(provider)
    if (apiKeyEnv) {
      applyEnvUpdate(env, apiKeyEnv, updates.apiKey)
    }

    applyEnvUpdate(
      env,
      getExternalProviderModelEnvName(provider),
      updates.model,
    )

    if (provider === 'ollama' && !env.OLLAMA_BASE_URL) {
      env.OLLAMA_BASE_URL = getDefaultOllamaBaseUrl()
    }

    return {
      ...current,
      env,
    }
  })
}

export function applyExternalProviderConfigToProcess(
  provider: ExternalAPIProvider,
  updates: ExternalProviderConfigUpdates,
): void {
  for (const legacyKey of getProviderLegacyEnvKeys()) {
    delete process.env[legacyKey]
  }

  if (updates.switchProvider !== false) {
    process.env.CLAUDE_CODE_API_PROVIDER = provider
  }

  const apiKeyEnv = getExternalProviderApiKeyEnvName(provider)
  if (apiKeyEnv) {
    applyEnvUpdate(process.env, apiKeyEnv, updates.apiKey)
  }

  applyEnvUpdate(
    process.env,
    getExternalProviderModelEnvName(provider),
    updates.model,
  )

  if (provider === 'ollama' && !process.env.OLLAMA_BASE_URL) {
    process.env.OLLAMA_BASE_URL = getDefaultOllamaBaseUrl()
  }
}
