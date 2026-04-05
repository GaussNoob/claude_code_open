import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { getGlobalConfig } from '../config.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry'
export type ExternalAPIProvider =
  | 'openai'
  | 'openrouter'
  | 'gemini'
  | 'ollama'
export type ModelProvider = APIProvider | ExternalAPIProvider
export type ExternalModelOption = {
  value: string
  label: string
  description: string
}

const OPENAI_DEFAULT_MAIN_MODEL = 'gpt-5.4'
const OPENAI_DEFAULT_SMALL_FAST_MODEL = 'gpt-5-mini'
const OPENROUTER_DEFAULT_MAIN_MODEL = 'openai/gpt-5.4'
const OPENROUTER_DEFAULT_SMALL_FAST_MODEL = 'openai/gpt-5.4-mini'
const GEMINI_DEFAULT_MAIN_MODEL = 'gemini-3.1-pro-preview'
const GEMINI_DEFAULT_SMALL_FAST_MODEL = 'gemini-3-flash-preview'
const OLLAMA_DEFAULT_MAIN_MODEL = 'qwen2.5-coder:14b'
const OLLAMA_DEFAULT_SMALL_FAST_MODEL = 'qwen2.5-coder:7b'
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

function getCachedOllamaModel(mode: 'main' | 'smallFast'): string | undefined {
  const cachedModels = (getGlobalConfig().additionalModelOptionsCache ?? [])
    .map(option => option.value)
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )

  if (cachedModels.length === 0) {
    return undefined
  }

  const preferredFallback =
    mode === 'smallFast'
      ? OLLAMA_DEFAULT_SMALL_FAST_MODEL
      : OLLAMA_DEFAULT_MAIN_MODEL

  return (
    cachedModels.find(model => model === preferredFallback) ?? cachedModels[0]
  )
}

export function getExternalAPIProvider(): ExternalAPIProvider | null {
  const explicitProvider = process.env.CLAUDE_CODE_API_PROVIDER
    ?.trim()
    .toLowerCase()

  switch (explicitProvider) {
    case 'openai':
    case 'openrouter':
    case 'gemini':
    case 'ollama':
      return explicitProvider
    default:
      break
  }

  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENAI)) {
    return 'openai'
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENROUTER)) {
    return 'openrouter'
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI)) {
    return 'gemini'
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OLLAMA)) {
    return 'ollama'
  }

  return null
}

export function getModelProvider(): ModelProvider {
  return getExternalAPIProvider() ?? getAPIProvider()
}

export function isExternalModelProvider(
  provider: ModelProvider = getModelProvider(),
): provider is ExternalAPIProvider {
  return (
    provider === 'openai' ||
    provider === 'openrouter' ||
    provider === 'gemini' ||
    provider === 'ollama'
  )
}

export function getProviderDisplayName(
  provider: ModelProvider = getModelProvider(),
): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI'
    case 'openrouter':
      return 'OpenRouter'
    case 'gemini':
      return 'Google Gemini'
    case 'ollama':
      return 'Ollama'
    case 'bedrock':
      return 'AWS Bedrock'
    case 'vertex':
      return 'Google Vertex AI'
    case 'foundry':
      return 'Microsoft Foundry'
    case 'firstParty':
    default:
      return 'Anthropic'
  }
}

export function getExternalProviderApiKeyEnvName(
  provider: ExternalAPIProvider,
): 'OPENAI_API_KEY' | 'OPENROUTER_API_KEY' | 'GEMINI_API_KEY' | null {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY'
    case 'openrouter':
      return 'OPENROUTER_API_KEY'
    case 'gemini':
      return 'GEMINI_API_KEY'
    case 'ollama':
      return null
  }
}

export function getExternalProviderModelEnvName(
  provider: ExternalAPIProvider,
): 'OPENAI_MODEL' | 'OPENROUTER_MODEL' | 'GEMINI_MODEL' | 'OLLAMA_MODEL' {
  switch (provider) {
    case 'openai':
      return 'OPENAI_MODEL'
    case 'openrouter':
      return 'OPENROUTER_MODEL'
    case 'gemini':
      return 'GEMINI_MODEL'
    case 'ollama':
      return 'OLLAMA_MODEL'
  }
}

export function getDefaultOllamaBaseUrl(): string {
  return DEFAULT_OLLAMA_BASE_URL
}

export function getKnownExternalModelOptions(
  provider: ExternalAPIProvider,
): ExternalModelOption[] {
  switch (provider) {
    case 'openai':
      return [
        {
          value: OPENAI_DEFAULT_MAIN_MODEL,
          label: 'GPT-5.4',
          description: 'Latest GPT-5 model for coding and agentic tasks',
        },
        {
          value: 'gpt-5.1',
          label: 'GPT-5.1',
          description: 'Earlier GPT-5 model for coding and agentic tasks',
        },
        {
          value: OPENAI_DEFAULT_SMALL_FAST_MODEL,
          label: 'GPT-5 mini',
          description: 'Faster and cheaper GPT-5 model',
        },
        {
          value: 'gpt-5-nano',
          label: 'GPT-5 nano',
          description: 'Smallest GPT-5 model for lightweight tasks',
        },
      ]
    case 'openrouter':
      return [
        {
          value: OPENROUTER_DEFAULT_MAIN_MODEL,
          label: 'OpenAI GPT-5.4',
          description: 'OpenRouter route for the latest GPT-5.4 model',
        },
        {
          value: 'anthropic/claude-sonnet-4.5',
          label: 'Anthropic Claude Sonnet 4.5',
          description: 'Strong coding and agentic model via OpenRouter',
        },
        {
          value: 'google/gemini-2.5-pro',
          label: 'Google Gemini 2.5 Pro',
          description: 'High-context reasoning model via OpenRouter',
        },
        {
          value: OPENROUTER_DEFAULT_SMALL_FAST_MODEL,
          label: 'OpenAI GPT-5.4 Mini',
          description: 'Fast and lower-cost OpenRouter model',
        },
      ]
    case 'gemini':
      return [
        {
          value: GEMINI_DEFAULT_MAIN_MODEL,
          label: 'Gemini 3.1 Pro Preview',
          description: 'Google flagship reasoning model for complex work',
        },
        {
          value: GEMINI_DEFAULT_SMALL_FAST_MODEL,
          label: 'Gemini 3 Flash Preview',
          description: 'Fast Gemini 3 model for everyday tasks',
        },
        {
          value: 'gemini-3.1-flash-lite-preview',
          label: 'Gemini 3.1 Flash-Lite Preview',
          description: 'Lower-cost Gemini 3.1 model for high-throughput tasks',
        },
      ]
    case 'ollama':
      return []
  }
}

export function getConfiguredExternalModel(
  provider: ExternalAPIProvider = getExternalAPIProvider() ?? 'openai',
  mode: 'main' | 'smallFast' = 'main',
): string {
  const envSuffix = mode === 'smallFast' ? '_SMALL_FAST_MODEL' : '_MODEL'
  const genericModel =
    process.env.CLAUDE_CODE_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL

  switch (provider) {
    case 'openai':
      return (
        process.env[`OPENAI${envSuffix}`] ??
        process.env.OPENAI_MODEL ??
        genericModel ??
        (mode === 'smallFast'
          ? OPENAI_DEFAULT_SMALL_FAST_MODEL
          : OPENAI_DEFAULT_MAIN_MODEL)
      )
    case 'openrouter':
      return (
        process.env[`OPENROUTER${envSuffix}`] ??
        process.env.OPENROUTER_MODEL ??
        genericModel ??
        (mode === 'smallFast'
          ? OPENROUTER_DEFAULT_SMALL_FAST_MODEL
          : OPENROUTER_DEFAULT_MAIN_MODEL)
      )
    case 'gemini':
      return (
        process.env[`GEMINI${envSuffix}`] ??
        process.env.GEMINI_MODEL ??
        genericModel ??
        (mode === 'smallFast'
          ? GEMINI_DEFAULT_SMALL_FAST_MODEL
          : GEMINI_DEFAULT_MAIN_MODEL)
      )
    case 'ollama':
      return (
        process.env[`OLLAMA${envSuffix}`] ??
        process.env.OLLAMA_MODEL ??
        genericModel ??
        getCachedOllamaModel(mode) ??
        (mode === 'smallFast'
          ? OLLAMA_DEFAULT_SMALL_FAST_MODEL
          : OLLAMA_DEFAULT_MAIN_MODEL)
      )
  }
}

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
