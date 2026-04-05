import { z } from 'zod'
import { logForDebugging } from '../debug.js'

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const OPENROUTER_MODELS_CACHE_TTL_MS = 60_000

const openRouterModelsSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        context_length: z.number().optional(),
        pricing: z
          .object({
            prompt: z.string().optional(),
            completion: z.string().optional(),
            request: z.string().optional(),
            image: z.string().optional(),
          })
          .optional(),
        architecture: z
          .object({
            modality: z.string().optional(),
          })
          .passthrough()
          .optional(),
      }),
    )
    .default([]),
})

export type OpenRouterModel = {
  id: string
  name?: string
  description?: string
  contextLength?: number
  modality?: string
  isFree?: boolean
}

let cachedModels:
  | {
      key: string
      expiresAt: number
      models: OpenRouterModel[]
    }
  | undefined

function isZeroPrice(value?: string): boolean {
  if (!value) {
    return true
  }

  return Number(value) === 0
}

function normalizeModelLookup(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function toProviderDisplayName(modelId: string): string {
  const provider = modelId.split('/')[0] ?? modelId
  return provider
    .split(/[-_:]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getOpenRouterBaseUrl(): string {
  return (
    process.env.OPENROUTER_BASE_URL?.replace(/\/$/, '') ??
    DEFAULT_OPENROUTER_BASE_URL
  )
}

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined
}

export function getOpenRouterModelDisplayName(model: OpenRouterModel): string {
  const baseName = model.name?.trim() || model.id
  const providerName = toProviderDisplayName(model.id)
  const freeSuffix = model.isFree ? ' (free)' : ''

  if (normalizeModelLookup(baseName) === normalizeModelLookup(providerName)) {
    return `${baseName}${freeSuffix}`
  }

  return `${providerName}: ${baseName}${freeSuffix}`
}

function buildOpenRouterModelAliases(model: OpenRouterModel): string[] {
  const providerName = toProviderDisplayName(model.id)
  const baseName = model.name?.trim()
  return [
    model.id,
    getOpenRouterModelDisplayName(model),
    `${providerName}: ${baseName ?? model.id}`,
    baseName,
    model.isFree && baseName ? `${baseName} (free)` : undefined,
  ].filter((value): value is string => Boolean(value?.trim()))
}

export function resolveOpenRouterModelId(
  input: string,
  models: OpenRouterModel[],
): string | undefined {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return undefined
  }

  const normalizedInput = normalizeModelLookup(trimmedInput)
  const exactIdMatch = models.find(model => model.id === trimmedInput)
  if (exactIdMatch) {
    return exactIdMatch.id
  }

  const aliases = models.flatMap(model =>
    buildOpenRouterModelAliases(model).map(name => ({
      id: model.id,
      normalized: normalizeModelLookup(name),
    })),
  )

  const exactAliasMatch = aliases.find(alias => alias.normalized === normalizedInput)
  if (exactAliasMatch) {
    return exactAliasMatch.id
  }

  const looseAliasMatch = aliases.find(alias =>
    alias.normalized.includes(normalizedInput) ||
    normalizedInput.includes(alias.normalized),
  )
  return looseAliasMatch?.id
}

export async function listOpenRouterModels(): Promise<{
  models: OpenRouterModel[]
  error?: string
}> {
  const apiKey = getOpenRouterApiKey()
  const baseUrl = getOpenRouterBaseUrl()
  const cacheKey = `${baseUrl}::${apiKey ? 'auth' : 'public'}`
  const now = Date.now()

  if (
    cachedModels &&
    cachedModels.key === cacheKey &&
    cachedModels.expiresAt > now
  ) {
    return { models: cachedModels.models }
  }

  const requests = apiKey ? ['/models/user', '/models'] : ['/models']

  for (const path of requests) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      })

      if (!response.ok) {
        logForDebugging(
          `[OpenRouterModel] Model list fetch failed for ${path}: ${response.status}`,
        )
        continue
      }

      const data = await response.json()
      const parsed = openRouterModelsSchema.safeParse(data)
      if (!parsed.success) {
        logForDebugging(
          `[OpenRouterModel] Response validation failed for ${path}: ${parsed.error.message}`,
        )
        continue
      }

      const models = parsed.data.data
        .map(model => ({
          id: model.id,
          name: model.name,
          description: model.description,
          contextLength: model.context_length,
          modality: model.architecture?.modality,
          isFree:
            isZeroPrice(model.pricing?.prompt) &&
            isZeroPrice(model.pricing?.completion) &&
            isZeroPrice(model.pricing?.request) &&
            isZeroPrice(model.pricing?.image),
        }))
        .filter(model => model.id.trim().length > 0)

      cachedModels = {
        key: cacheKey,
        expiresAt: now + OPENROUTER_MODELS_CACHE_TTL_MS,
        models,
      }

      return { models }
    } catch (error) {
      logForDebugging(
        `[OpenRouterModel] Model list fetch failed for ${path}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return {
    models: [],
    error:
      'Failed to load models from OpenRouter. You can still run `/openrouter-model <model-id>` with a model name copied from the OpenRouter site.',
  }
}
