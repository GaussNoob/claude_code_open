import figures from 'figures'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import TextInput from '../../components/TextInput.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js'
import {
  applyExternalProviderConfigToProcess,
  saveExternalProviderConfig,
} from '../../utils/model/externalProviderConfig.js'
import {
  getExternalProviderApiKeyEnvName,
  getProviderDisplayName,
  type ExternalAPIProvider,
} from '../../utils/model/providers.js'

type ProviderKeyCommandProps = {
  provider: Extract<ExternalAPIProvider, 'openai' | 'gemini'>
}

function maskApiKey(key: string): string {
  const trimmed = key.trim()
  const suffix = trimmed.slice(-4)
  return suffix ? `****${suffix}` : 'configured'
}

function getConfiguredApiKey(
  provider: ProviderKeyCommandProps['provider'],
): string | undefined {
  const envName = getExternalProviderApiKeyEnvName(provider)
  return envName ? process.env[envName]?.trim() || undefined : undefined
}

function saveProviderKey(
  provider: ProviderKeyCommandProps['provider'],
  apiKey: string | null,
  switchProvider: boolean,
): void {
  saveExternalProviderConfig(provider, {
    apiKey,
    switchProvider,
  })
}

function applyProviderKeyToProcess(
  provider: ProviderKeyCommandProps['provider'],
  apiKey: string | null,
  switchProvider: boolean,
): void {
  applyExternalProviderConfigToProcess(provider, {
    apiKey,
    switchProvider,
  })
}

function formatSavedMessage(
  provider: ProviderKeyCommandProps['provider'],
  apiKey: string | null,
): string {
  const providerLabel = getProviderDisplayName(provider)
  if (apiKey === null) {
    return `Cleared saved ${providerLabel} API key`
  }

  return `Saved ${providerLabel} API key ${maskApiKey(apiKey)} and switched provider to ${providerLabel}`
}

function SaveProviderKeyAndClose({
  provider,
  apiKey,
  switchProvider,
  onDone,
}: ProviderKeyCommandProps & {
  apiKey: string | null
  switchProvider: boolean
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  React.useEffect(() => {
    saveProviderKey(provider, apiKey, switchProvider)
    applyConfigEnvironmentVariables()
    applyProviderKeyToProcess(provider, apiKey, switchProvider)
    onDone(formatSavedMessage(provider, apiKey))
  }, [apiKey, onDone, provider, switchProvider])

  return null
}

function ShowProviderKeyAndClose({
  provider,
  onDone,
}: ProviderKeyCommandProps & {
  onDone: (result?: string) => void
}): React.ReactNode {
  const apiKey = getConfiguredApiKey(provider)
  onDone(
    apiKey
      ? `${getProviderDisplayName(provider)} API key: configured (${maskApiKey(apiKey)})`
      : `${getProviderDisplayName(provider)} API key: not configured`,
  )
  return null
}

function ProviderKeyPrompt({
  provider,
  onDone,
}: ProviderKeyCommandProps & {
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const providerLabel = getProviderDisplayName(provider)
  const existingKey = getConfiguredApiKey(provider)
  const [value, setValue] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)

  useKeybinding('confirm:no', () => onDone(`Cancelled ${providerLabel} API key update`, {
    display: 'system',
  }), {
    context: 'Settings',
  })

  function handleSubmit(rawValue: string): void {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      onDone('API key cannot be empty.', { display: 'system' })
      return
    }

    saveProviderKey(provider, trimmed, true)
    applyConfigEnvironmentVariables()
    applyProviderKeyToProcess(provider, trimmed, true)
    onDone(formatSavedMessage(provider, trimmed))
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Set {providerLabel} API key</Text>
      <Text dimColor>
        The key is stored in Claude Code global config and applied to new
        requests immediately.
      </Text>
      {existingKey ? (
        <Text dimColor>
          Current key: <Text>{maskApiKey(existingKey)}</Text>
        </Text>
      ) : (
        <Text dimColor>No key configured yet.</Text>
      )}
      <Box flexDirection="row" gap={1}>
        <Text>{figures.pointer}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          focus
          showCursor
          mask="*"
          placeholder={`Paste ${providerLabel} API key${figures.ellipsis}`}
          columns={80}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
      <Text dimColor>
        Use `/{provider}-key clear` to remove the saved key.
      </Text>
    </Box>
  )
}

export function createExternalKeyCommand(
  provider: ProviderKeyCommandProps['provider'],
): LocalJSXCommandCall {
  return async (onDone, _context, args) => {
    const trimmedArgs = args?.trim() || ''

    if (COMMON_INFO_ARGS.includes(trimmedArgs)) {
      return <ShowProviderKeyAndClose provider={provider} onDone={onDone} />
    }

    if (COMMON_HELP_ARGS.includes(trimmedArgs)) {
      onDone(
        `Run /${provider}-key to enter a ${getProviderDisplayName(provider)} API key, /${provider}-key [apiKey] to save one directly, or /${provider}-key clear to remove the saved key.`,
        { display: 'system' },
      )
      return null
    }

    if (trimmedArgs) {
      const shouldClear =
        trimmedArgs === 'clear' ||
        trimmedArgs === 'unset' ||
        trimmedArgs === 'remove'

      return (
        <SaveProviderKeyAndClose
          provider={provider}
          apiKey={shouldClear ? null : trimmedArgs}
          switchProvider={!shouldClear}
          onDone={onDone}
        />
      )
    }

    return <ProviderKeyPrompt provider={provider} onDone={onDone} />
  }
}
