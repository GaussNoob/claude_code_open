import type {
  BetaContentBlock,
  BetaJSONOutputFormat,
  BetaToolChoiceTool,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { randomUUID } from 'crypto'
import type { ToolPermissionContext, Tools } from '../../Tool.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { normalizeMessagesForAPI } from '../../utils/messages.js'
import { logForDebugging } from '../../utils/debug.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import {
  getConfiguredExternalModel,
  getExternalAPIProvider,
  getProviderDisplayName,
  type ExternalAPIProvider,
} from '../../utils/model/providers.js'
import {
  applyExternalProviderConfigToProcess,
  saveExternalProviderConfig,
} from '../../utils/model/externalProviderConfig.js'
import {
  getOpenRouterBaseUrl,
  listOpenRouterModels,
  resolveOpenRouterModelId,
} from '../../utils/model/openrouter.js'
import { toolToAPISchema } from '../../utils/api.js'
import { EMPTY_USAGE } from './emptyUsage.js'

type ExternalQueryOptions = {
  getToolPermissionContext: () => Promise<ToolPermissionContext>
  model: string
  outputFormat?: BetaJSONOutputFormat
  temperatureOverride?: number
  toolChoice?: BetaToolChoiceTool
  isNonInteractiveSession: boolean
  agents: AgentDefinition[]
  allowedAgentTypes?: string[]
}

type ExternalQueryParams = {
  messages: Message[]
  systemPrompt: SystemPrompt
  tools: Tools
  signal: AbortSignal
  options: ExternalQueryOptions
}

type ToolSchema = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

const DEFAULT_OLLAMA_KEEP_ALIVE = '30m'

let warmedOllamaModel: string | null = null
let activeOllamaWarmup: Promise<void> | null = null

function getGeminiThoughtSignature(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const camelCase = (value as { thoughtSignature?: unknown }).thoughtSignature
  if (typeof camelCase === 'string' && camelCase.trim()) {
    return camelCase
  }

  const snakeCase = (value as { thought_signature?: unknown }).thought_signature
  if (typeof snakeCase === 'string' && snakeCase.trim()) {
    return snakeCase
  }

  return undefined
}

function getOpenAIBaseUrl(): string {
  return process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1'
}

function getGeminiBaseUrl(): string {
  return (
    process.env.GEMINI_BASE_URL?.replace(/\/$/, '') ||
    'https://generativelanguage.googleapis.com/v1beta'
  )
}

function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:11434'
}

function getOllamaKeepAlive(): string {
  return process.env.OLLAMA_KEEP_ALIVE?.trim() || DEFAULT_OLLAMA_KEEP_ALIVE
}

function requireApiKey(
  provider: ExternalAPIProvider,
  envName: string,
): string {
  const value = process.env[envName]?.trim()
  if (value) {
    return value
  }
  throw new Error(
    `${getProviderDisplayName(provider)} requires ${envName} to be configured.`,
  )
}

function contentValueToString(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (content == null) {
    return ''
  }
  if (Array.isArray(content)) {
    return content.map(contentValueToString).filter(Boolean).join('\n')
  }
  if (typeof content === 'object') {
    const maybeText = (content as { text?: unknown }).text
    if (typeof maybeText === 'string') {
      return maybeText
    }
  }
  return jsonStringify(content)
}

function messageContentToText(
  content: string | readonly { type: string }[],
  providerLabel: string,
): string {
  if (typeof content === 'string') {
    return content
  }

  return content
    .map(block => {
      switch (block.type) {
        case 'text':
          return contentValueToString((block as { text?: unknown }).text)
        case 'thinking':
          return contentValueToString((block as { thinking?: unknown }).thinking)
        case 'redacted_thinking':
          return '[redacted thinking]'
        case 'image':
          return `[image omitted for ${providerLabel}]`
        case 'document':
          return `[document omitted for ${providerLabel}]`
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}

function toolResultContentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') {
          return part
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text
          return typeof text === 'string' ? text : jsonStringify(part)
        }
        return jsonStringify(part)
      })
      .join('\n')
  }
  return contentValueToString(content)
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function buildAssistantMessage(
  model: string,
  content: BetaContentBlock[],
  usage: Partial<typeof EMPTY_USAGE> | undefined,
  requestId?: string,
): AssistantMessage {
  const hasToolUse = content.some(block => block.type === 'tool_use')
  return {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    requestId,
    message: {
      id: randomUUID(),
      container: null,
      model,
      role: 'assistant',
      stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage: {
        ...EMPTY_USAGE,
        ...usage,
      },
      content,
      context_management: null,
    },
  } as AssistantMessage
}

async function getToolSchemas(
  tools: Tools,
  options: ExternalQueryOptions,
): Promise<ToolSchema[]> {
  if (tools.length === 0) {
    return []
  }

  const schemas = await Promise.all(
    tools.map(tool =>
      toolToAPISchema(tool, {
        getToolPermissionContext: options.getToolPermissionContext,
        tools,
        agents: options.agents,
        allowedAgentTypes: options.allowedAgentTypes,
        model: options.model,
      }),
    ),
  )

  return schemas.map(schema => ({
    name: schema.name,
    description: schema.description,
    input_schema: (schema.input_schema ?? {
      type: 'object',
      properties: {},
    }) as Record<string, unknown>,
  }))
}

function buildOpenAIMessages(
  messages: ReturnType<typeof normalizeMessagesForAPI>,
  providerLabel: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  for (const message of messages) {
    if (message.type === 'user') {
      const blocks =
        typeof message.message.content === 'string' ? [] : message.message.content
      const text = messageContentToText(message.message.content, providerLabel)
      if (text.trim()) {
        out.push({ role: 'user', content: text })
      }
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          out.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: toolResultContentToString(block.content),
          })
        }
      }
      continue
    }

    const text = messageContentToText(message.message.content, providerLabel)
    const toolCalls = message.message.content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: jsonStringify(block.input ?? {}),
        },
      }))

    out.push({
      role: 'assistant',
      ...(text.trim() ? { content: text } : { content: null }),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    })
  }

  return out
}

/**
 * Build messages in Ollama's native /api/chat format.
 *
 * Key differences from OpenAI format:
 * - Tool results use `tool_name` instead of `tool_call_id`
 * - Assistant tool_calls keep `arguments` as an object (not a JSON string)
 * - Tool calls don't include `id` or `type` fields
 */
function buildOllamaMessages(
  messages: ReturnType<typeof normalizeMessagesForAPI>,
  providerLabel: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  // Map tool_use_id -> tool name so we can populate tool_name on tool results
  const toolNameById = new Map<string, string>()

  for (const message of messages) {
    if (message.type === 'user') {
      const blocks =
        typeof message.message.content === 'string' ? [] : message.message.content
      const text = messageContentToText(message.message.content, providerLabel)
      if (text.trim()) {
        out.push({ role: 'user', content: text })
      }
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          // Ollama native API uses tool_name (not tool_call_id) to associate
          // tool results with their originating calls.
          out.push({
            role: 'tool',
            content: toolResultContentToString(block.content),
            ...(toolNameById.has(block.tool_use_id)
              ? { tool_name: toolNameById.get(block.tool_use_id) }
              : {}),
          })
        }
      }
      continue
    }

    // Assistant message
    const text = messageContentToText(message.message.content, providerLabel)
    const toolCalls = message.message.content
      .filter(block => block.type === 'tool_use')
      .map(block => {
        // Track the id -> name mapping for later tool_result messages
        toolNameById.set(block.id, block.name)
        return {
          function: {
            name: block.name,
            // Ollama expects arguments as a JSON object, not a string
            arguments: block.input ?? {},
          },
        }
      })

    out.push({
      role: 'assistant',
      ...(text.trim() ? { content: text } : { content: '' }),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    })
  }

  return out
}

function buildGeminiContents(
  messages: ReturnType<typeof normalizeMessagesForAPI>,
  providerLabel: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  const toolNamesById = new Map<string, string>()

  for (const message of messages) {
    if (message.type === 'user') {
      const blocks =
        typeof message.message.content === 'string' ? [] : message.message.content
      const parts: Record<string, unknown>[] = []
      const text = messageContentToText(message.message.content, providerLabel)
      if (text.trim()) {
        parts.push({ text })
      }
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: toolNamesById.get(block.tool_use_id) ?? block.tool_use_id,
              response: {
                result: toolResultContentToString(block.content),
              },
            },
          })
        }
      }
      if (parts.length > 0) {
        out.push({
          role: 'user',
          parts,
        })
      }
      continue
    }

    const parts: Record<string, unknown>[] = []
    for (const block of message.message.content) {
      if (block.type === 'text') {
        const text = contentValueToString(block.text)
        if (text.trim()) {
          const thoughtSignature = getGeminiThoughtSignature(block)
          parts.push(thoughtSignature ? { text, thoughtSignature } : { text })
        }
        continue
      }
      if (block.type === 'thinking') {
        const text = contentValueToString(block.thinking)
        if (text.trim()) {
          const thoughtSignature = getGeminiThoughtSignature(block)
          parts.push(thoughtSignature ? { text, thoughtSignature } : { text })
        }
        continue
      }
      if (block.type === 'tool_use') {
        toolNamesById.set(block.id, block.name)
        const thoughtSignature = getGeminiThoughtSignature(block)
        parts.push(
          thoughtSignature
            ? {
                functionCall: {
                  name: block.name,
                  args: block.input ?? {},
                },
                thoughtSignature,
              }
            : {
                functionCall: {
                  name: block.name,
                  args: block.input ?? {},
                },
              },
        )
      }
    }
    if (parts.length > 0) {
      out.push({
        role: 'model',
        parts,
      })
    }
  }

  return out
}

function buildOpenAITools(
  toolSchemas: ToolSchema[],
): Array<Record<string, unknown>> {
  return toolSchemas.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }))
}

function buildGeminiTools(
  toolSchemas: ToolSchema[],
): Array<Record<string, unknown>> {
  if (toolSchemas.length === 0) {
    return []
  }
  return [
    {
      functionDeclarations: toolSchemas.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      })),
    },
  ]
}

function outputFormatToOpenAI(
  outputFormat?: BetaJSONOutputFormat,
): Record<string, unknown> | undefined {
  if (!outputFormat) {
    return undefined
  }
  if (outputFormat.type === 'json_schema') {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'structured_output',
        schema: outputFormat.schema,
        strict: true,
      },
    }
  }
  return { type: 'json_object' }
}

function outputFormatToGemini(
  outputFormat?: BetaJSONOutputFormat,
): Record<string, unknown> | undefined {
  if (!outputFormat) {
    return undefined
  }
  if (outputFormat.type === 'json_schema') {
    return {
      responseMimeType: 'application/json',
      responseSchema: outputFormat.schema,
    }
  }
  return { responseMimeType: 'application/json' }
}

function outputFormatToOllama(
  outputFormat?: BetaJSONOutputFormat,
): unknown {
  if (!outputFormat) {
    return undefined
  }
  if (outputFormat.type === 'json_schema') {
    return outputFormat.schema
  }
  return 'json'
}

async function fetchJson(
  url: string,
  init: RequestInit,
  provider: ExternalAPIProvider,
): Promise<{ data: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(url, init)
  const text = await response.text()
  let data: Record<string, unknown> = {}
  if (text.trim()) {
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    const details =
      contentValueToString((data as { error?: unknown }).error) ||
      contentValueToString((data as { message?: unknown }).message) ||
      text
    throw new Error(
      `${getProviderDisplayName(provider)} request failed (${response.status}): ${details}`,
    )
  }

  return { data, headers: response.headers }
}

async function queryOpenAI(
  params: ExternalQueryParams,
  normalizedMessages: ReturnType<typeof normalizeMessagesForAPI>,
  toolSchemas: ToolSchema[],
): Promise<AssistantMessage> {
  return queryOpenAICompatibleProvider(
    params,
    normalizedMessages,
    toolSchemas,
    {
      provider: 'openai',
      apiKeyEnvName: 'OPENAI_API_KEY',
      baseUrl: getOpenAIBaseUrl(),
    },
  )
}

async function queryOpenRouter(
  params: ExternalQueryParams,
  normalizedMessages: ReturnType<typeof normalizeMessagesForAPI>,
  toolSchemas: ToolSchema[],
): Promise<AssistantMessage> {
  let resolvedModel = params.options.model
  const { models } = await listOpenRouterModels()
  const matchedModelId = resolveOpenRouterModelId(params.options.model, models)

  if (matchedModelId && matchedModelId !== params.options.model) {
    resolvedModel = matchedModelId
    logForDebugging(
      `[ExternalProviders] Resolved OpenRouter model '${params.options.model}' -> '${resolvedModel}'`,
    )
    saveExternalProviderConfig('openrouter', {
      model: resolvedModel,
      switchProvider: false,
    })
    applyExternalProviderConfigToProcess('openrouter', {
      model: resolvedModel,
      switchProvider: false,
    })
  }

  return queryOpenAICompatibleProvider(
    params,
    normalizedMessages,
    toolSchemas,
    {
      provider: 'openrouter',
      apiKeyEnvName: 'OPENROUTER_API_KEY',
      baseUrl: getOpenRouterBaseUrl(),
      model: resolvedModel,
    },
  )
}

async function queryOpenAICompatibleProvider(
  params: ExternalQueryParams,
  normalizedMessages: ReturnType<typeof normalizeMessagesForAPI>,
  toolSchemas: ToolSchema[],
  config: {
    provider: Extract<ExternalAPIProvider, 'openai' | 'openrouter'>
    apiKeyEnvName: 'OPENAI_API_KEY' | 'OPENROUTER_API_KEY'
    baseUrl: string
    model?: string
  },
): Promise<AssistantMessage> {
  const apiKey = requireApiKey(config.provider, config.apiKeyEnvName)
  const providerLabel = getProviderDisplayName(config.provider)
  const selectedModel = config.model ?? params.options.model
  const body: Record<string, unknown> = {
    model: selectedModel,
    messages: [
      ...(params.systemPrompt.length > 0
        ? [
            {
              role: 'system',
              content: params.systemPrompt.join('\n\n'),
            },
          ]
        : []),
      ...buildOpenAIMessages(normalizedMessages, providerLabel),
    ],
    stream: false,
    ...(toolSchemas.length > 0 ? { tools: buildOpenAITools(toolSchemas) } : {}),
    ...(params.options.toolChoice?.type === 'tool'
      ? {
          tool_choice: {
            type: 'function',
            function: { name: params.options.toolChoice.name },
          },
        }
      : toolSchemas.length > 0
        ? { tool_choice: 'auto' }
        : {}),
    ...(params.options.temperatureOverride !== undefined
      ? { temperature: params.options.temperatureOverride }
      : {}),
    ...(outputFormatToOpenAI(params.options.outputFormat)
      ? { response_format: outputFormatToOpenAI(params.options.outputFormat) }
      : {}),
  }

  const { data, headers } = await fetchJson(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    config.provider,
  )

  const choice = Array.isArray(data.choices)
    ? (data.choices[0] as Record<string, unknown> | undefined)
    : undefined
  const message = (choice?.message ?? {}) as Record<string, unknown>
  const content: BetaContentBlock[] = []
  const messageContent = message.content
  if (typeof messageContent === 'string' && messageContent.trim()) {
    content.push({ type: 'text', text: messageContent } as BetaContentBlock)
  } else if (Array.isArray(messageContent)) {
    const text = messageContent
      .map(part => contentValueToString(part))
      .filter(Boolean)
      .join('\n')
    if (text.trim()) {
      content.push({ type: 'text', text } as BetaContentBlock)
    }
  }

  if (Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls as Array<Record<string, unknown>>) {
      const fn = (toolCall.function ?? {}) as Record<string, unknown>
      content.push({
        type: 'tool_use',
        id:
          (toolCall.id as string | undefined) ??
          `toolu_${randomUUID().replaceAll('-', '')}`,
        name: (fn.name as string | undefined) ?? 'unknown_tool',
        input: safeJsonParse(fn.arguments ?? '{}') as Record<string, unknown>,
      } as BetaContentBlock)
    }
  }

  const usage = (data.usage ?? {}) as Record<string, unknown>
  return buildAssistantMessage(
    (message.model as string | undefined) ?? selectedModel,
    content,
    {
      input_tokens: (usage.prompt_tokens as number | undefined) ?? 0,
      output_tokens: (usage.completion_tokens as number | undefined) ?? 0,
    },
    headers.get('x-request-id') ?? undefined,
  )
}

async function queryGemini(
  params: ExternalQueryParams,
  normalizedMessages: ReturnType<typeof normalizeMessagesForAPI>,
  toolSchemas: ToolSchema[],
): Promise<AssistantMessage> {
  const apiKey = requireApiKey('gemini', 'GEMINI_API_KEY')
  const body: Record<string, unknown> = {
    ...(params.systemPrompt.length > 0
      ? {
          systemInstruction: {
            parts: [{ text: params.systemPrompt.join('\n\n') }],
          },
        }
      : {}),
    contents: buildGeminiContents(
      normalizedMessages,
      getProviderDisplayName('gemini'),
    ),
    ...(toolSchemas.length > 0 ? { tools: buildGeminiTools(toolSchemas) } : {}),
    generationConfig: {
      ...(params.options.temperatureOverride !== undefined
        ? { temperature: params.options.temperatureOverride }
        : {}),
      ...(outputFormatToGemini(params.options.outputFormat) ?? {}),
    },
  }

  if (toolSchemas.length > 0 && params.options.toolChoice?.type === 'tool') {
    body.toolConfig = {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [params.options.toolChoice.name],
      },
    }
  }

  const { data } = await fetchJson(
    `${getGeminiBaseUrl()}/models/${encodeURIComponent(params.options.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    'gemini',
  )

  const candidate = Array.isArray(data.candidates)
    ? (data.candidates[0] as Record<string, unknown> | undefined)
    : undefined
  const candidateContent = (candidate?.content ?? {}) as {
    parts?: Array<Record<string, unknown>>
  }
  const content: BetaContentBlock[] = []
  for (const part of candidateContent.parts ?? []) {
    const text = part.text
    if (typeof text === 'string' && text.trim()) {
      const thoughtSignature = getGeminiThoughtSignature(part)
      content.push(
        (
          thoughtSignature
            ? { type: 'text', text, thoughtSignature }
            : { type: 'text', text }
        ) as BetaContentBlock,
      )
    }
    const functionCall = part.functionCall as
      | { name?: string; args?: unknown }
      | undefined
    if (functionCall?.name) {
      const thoughtSignature = getGeminiThoughtSignature(part)
      content.push({
        type: 'tool_use',
        id: `toolu_${randomUUID().replaceAll('-', '')}`,
        name: functionCall.name,
        input: safeJsonParse(functionCall.args ?? {}) as Record<string, unknown>,
        ...(thoughtSignature ? { thoughtSignature } : {}),
      } as BetaContentBlock)
    }
  }

  const usage = (data.usageMetadata ?? {}) as Record<string, unknown>
  return buildAssistantMessage(params.options.model, content, {
    input_tokens: (usage.promptTokenCount as number | undefined) ?? 0,
    output_tokens: (usage.candidatesTokenCount as number | undefined) ?? 0,
  })
}

async function queryOllama(
  params: ExternalQueryParams,
  normalizedMessages: ReturnType<typeof normalizeMessagesForAPI>,
  toolSchemas: ToolSchema[],
): Promise<AssistantMessage> {
  const providerLabel = getProviderDisplayName('ollama')
  const body: Record<string, unknown> = {
    model: params.options.model,
    messages: [
      ...(params.systemPrompt.length > 0
        ? [
            {
              role: 'system',
              content: params.systemPrompt.join('\n\n'),
            },
          ]
        : []),
      ...buildOllamaMessages(normalizedMessages, providerLabel),
    ],
    stream: false,
    keep_alive: getOllamaKeepAlive(),
    ...(toolSchemas.length > 0 ? { tools: buildOpenAITools(toolSchemas) } : {}),
    ...(outputFormatToOllama(params.options.outputFormat)
      ? { format: outputFormatToOllama(params.options.outputFormat) }
      : {}),
    ...(params.options.temperatureOverride !== undefined
      ? {
          options: {
            temperature: params.options.temperatureOverride,
          },
        }
      : {}),
  }

  const { data } = await fetchJson(
    `${getOllamaBaseUrl()}/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    'ollama',
  )

  const message = (data.message ?? {}) as Record<string, unknown>
  const content: BetaContentBlock[] = []
  if (typeof message.content === 'string' && message.content.trim()) {
    content.push({ type: 'text', text: message.content } as BetaContentBlock)
  }
  if (Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls as Array<Record<string, unknown>>) {
      const fn = (toolCall.function ?? {}) as Record<string, unknown>
      content.push({
        type: 'tool_use',
        id: `toolu_${randomUUID().replaceAll('-', '')}`,
        name: (fn.name as string | undefined) ?? 'unknown_tool',
        input: (typeof fn.arguments === 'string'
          ? safeJsonParse(fn.arguments)
          : (fn.arguments ?? {})) as Record<string, unknown>,
      } as BetaContentBlock)
    }
  }

  return buildAssistantMessage(params.options.model, content, {
    input_tokens: (data.prompt_eval_count as number | undefined) ?? 0,
    output_tokens: (data.eval_count as number | undefined) ?? 0,
  })
}

export async function warmupOllamaModel(
  model = getConfiguredExternalModel('ollama'),
): Promise<void> {
  if (getExternalAPIProvider() !== 'ollama') {
    return
  }

  if (!model.trim()) {
    return
  }

  if (warmedOllamaModel === model || activeOllamaWarmup) {
    return activeOllamaWarmup ?? undefined
  }

  activeOllamaWarmup = (async () => {
    try {
      const response = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: '',
          stream: false,
          keep_alive: getOllamaKeepAlive(),
        }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(
          `warmup failed (${response.status}): ${details || 'unknown error'}`,
        )
      }

      warmedOllamaModel = model
      logForDebugging(`[ExternalProviders] Ollama warmup ready for ${model}`)
    } catch (error) {
      logForDebugging(
        `[ExternalProviders] Ollama warmup skipped: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      activeOllamaWarmup = null
    }
  })()

  return activeOllamaWarmup
}

export async function queryExternalProvider(
  params: ExternalQueryParams,
): Promise<AssistantMessage> {
  const provider = getExternalAPIProvider()
  if (!provider) {
    throw new Error('No external provider is configured.')
  }

  const normalizedMessages = normalizeMessagesForAPI(params.messages, params.tools)
  const toolSchemas = await getToolSchemas(params.tools, params.options)

  switch (provider) {
    case 'openai':
      return queryOpenAI(params, normalizedMessages, toolSchemas)
    case 'openrouter':
      return queryOpenRouter(params, normalizedMessages, toolSchemas)
    case 'gemini':
      return queryGemini(params, normalizedMessages, toolSchemas)
    case 'ollama':
      return queryOllama(params, normalizedMessages, toolSchemas)
  }
}
