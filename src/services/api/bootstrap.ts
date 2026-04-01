import axios from 'axios'
import isEqual from 'lodash-es/isEqual.js'
import {
  getAnthropicApiKey,
  getClaudeAIOAuthTokens,
  hasProfileScope,
} from 'src/utils/auth.js'
import { z } from 'zod'
import { getOauthConfig, OAUTH_BETA_HEADER } from '../../constants/oauth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { withOAuth401Retry } from '../../utils/http.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import {
  getAPIProvider,
  getExternalAPIProvider,
  getKnownExternalModelOptions,
} from '../../utils/model/providers.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'

const bootstrapResponseSchema = lazySchema(() =>
  z.object({
    client_data: z.record(z.unknown()).nullish(),
    additional_model_options: z
      .array(
        z
          .object({
            model: z.string(),
            name: z.string(),
            description: z.string(),
          })
          .transform(({ model, name, description }) => ({
            value: model,
            label: name,
            description,
          })),
      )
      .nullish(),
  }),
)

type BootstrapResponse = z.infer<ReturnType<typeof bootstrapResponseSchema>>

const ollamaTagsSchema = lazySchema(() =>
  z.object({
    models: z
      .array(
        z.object({
          name: z.string(),
          model: z.string().optional(),
          modified_at: z.string().optional(),
        }),
      )
      .default([]),
  }),
)

function getStaticExternalModelOptions() {
  const externalProvider = getExternalAPIProvider()
  return externalProvider ? getKnownExternalModelOptions(externalProvider) : []
}

async function fetchOllamaModelOptions() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:11434'
  try {
    const response = await axios.get<unknown>(`${baseUrl}/api/tags`, {
      timeout: 3000,
    })
    const parsed = ollamaTagsSchema().safeParse(response.data)
    if (!parsed.success) {
      logForDebugging(
        `[Bootstrap] Ollama tags failed validation: ${parsed.error.message}`,
      )
      return []
    }
    return parsed.data.models.map(model => ({
      value: model.name,
      label: model.name,
      description: model.modified_at
        ? `Installed in Ollama · updated ${model.modified_at}`
        : 'Installed in Ollama',
    }))
  } catch (error) {
    logForDebugging(
      `[Bootstrap] Ollama tags fetch failed: ${axios.isAxiosError(error) ? (error.response?.status ?? error.code) : 'unknown'}`,
    )
    return []
  }
}

async function fetchExternalBootstrapData(): Promise<BootstrapResponse | null> {
  const externalProvider = getExternalAPIProvider()
  if (!externalProvider) {
    return null
  }
  const existingClientData = getGlobalConfig().clientDataCache ?? null

  if (externalProvider === 'ollama') {
    const models = await fetchOllamaModelOptions()
    return {
      client_data: existingClientData,
      additional_model_options: models,
    }
  }

  return {
    client_data: existingClientData,
    additional_model_options: getStaticExternalModelOptions(),
  }
}

async function fetchBootstrapAPI(): Promise<BootstrapResponse | null> {
  const externalBootstrap = await fetchExternalBootstrapData()
  if (externalBootstrap) {
    return externalBootstrap
  }

  if (isEssentialTrafficOnly()) {
    logForDebugging('[Bootstrap] Skipped: Nonessential traffic disabled')
    return null
  }

  if (getAPIProvider() !== 'firstParty') {
    logForDebugging('[Bootstrap] Skipped: 3P provider')
    return null
  }

  // OAuth preferred (requires user:profile scope — service-key OAuth tokens
  // lack it and would 403). Fall back to API key auth for console users.
  const apiKey = getAnthropicApiKey()
  const hasUsableOAuth =
    getClaudeAIOAuthTokens()?.accessToken && hasProfileScope()
  if (!hasUsableOAuth && !apiKey) {
    logForDebugging('[Bootstrap] Skipped: no usable OAuth or API key')
    return null
  }

  const endpoint = `${getOauthConfig().BASE_API_URL}/api/claude_cli/bootstrap`

  // withOAuth401Retry handles the refresh-and-retry. API key users fail
  // through on 401 (no refresh mechanism — no OAuth token to pass).
  try {
    return await withOAuth401Retry(async () => {
      // Re-read OAuth each call so the retry picks up the refreshed token.
      const token = getClaudeAIOAuthTokens()?.accessToken
      let authHeaders: Record<string, string>
      if (token && hasProfileScope()) {
        authHeaders = {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': OAUTH_BETA_HEADER,
        }
      } else if (apiKey) {
        authHeaders = { 'x-api-key': apiKey }
      } else {
        logForDebugging('[Bootstrap] No auth available on retry, aborting')
        return null
      }

      logForDebugging('[Bootstrap] Fetching')
      const response = await axios.get<unknown>(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getClaudeCodeUserAgent(),
          ...authHeaders,
        },
        timeout: 5000,
      })
      const parsed = bootstrapResponseSchema().safeParse(response.data)
      if (!parsed.success) {
        logForDebugging(
          `[Bootstrap] Response failed validation: ${parsed.error.message}`,
        )
        return null
      }
      logForDebugging('[Bootstrap] Fetch ok')
      return parsed.data
    })
  } catch (error) {
    logForDebugging(
      `[Bootstrap] Fetch failed: ${axios.isAxiosError(error) ? (error.response?.status ?? error.code) : 'unknown'}`,
    )
    throw error
  }
}

/**
 * Fetch bootstrap data from the API and persist to disk cache.
 */
export async function fetchBootstrapData(): Promise<void> {
  try {
    const response = await fetchBootstrapAPI()
    if (!response) return

    const clientData = response.client_data ?? null
    const additionalModelOptions = response.additional_model_options ?? []

    // Only persist if data actually changed — avoids a config write on every startup.
    const config = getGlobalConfig()
    if (
      isEqual(config.clientDataCache, clientData) &&
      isEqual(config.additionalModelOptionsCache, additionalModelOptions)
    ) {
      logForDebugging('[Bootstrap] Cache unchanged, skipping write')
      return
    }

    logForDebugging('[Bootstrap] Cache updated, persisting to disk')
    saveGlobalConfig(current => ({
      ...current,
      clientDataCache: clientData,
      additionalModelOptionsCache: additionalModelOptions,
    }))
  } catch (error) {
    logError(error)
  }
}
