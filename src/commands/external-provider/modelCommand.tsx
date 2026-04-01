import chalk from 'chalk'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { Select } from '../../components/CustomSelect/select.js'
import { Pane } from '../../components/design-system/Pane.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import { Box, Text } from '../../ink.js'
import { useSetAppState } from '../../state/AppState.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js'
import {
  applyExternalProviderConfigToProcess,
  saveExternalProviderConfig,
} from '../../utils/model/externalProviderConfig.js'
import {
  getConfiguredExternalModel,
  getKnownExternalModelOptions,
  getProviderDisplayName,
  type ExternalAPIProvider,
} from '../../utils/model/providers.js'

type ProviderModelCommandProps = {
  provider: Extract<ExternalAPIProvider, 'openai' | 'gemini'>
}

type PickerProps = ProviderModelCommandProps & {
  currentModel: string
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}

function formatSelectionMessage(
  provider: ProviderModelCommandProps['provider'],
  model: string,
): string {
  const providerLabel = getProviderDisplayName(provider)
  return `Set ${providerLabel} model to ${chalk.bold(model)} and switched provider to ${chalk.bold(providerLabel)}`
}

function saveProviderModel(
  provider: ProviderModelCommandProps['provider'],
  model: string | null,
): void {
  saveExternalProviderConfig(provider, {
    model,
    switchProvider: true,
  })
}

function applyProviderModelToProcess(
  provider: ProviderModelCommandProps['provider'],
  model: string | null,
): void {
  applyExternalProviderConfigToProcess(provider, {
    model,
    switchProvider: true,
  })
}

function ProviderModelPicker({
  provider,
  currentModel,
  onDone,
}: PickerProps): React.ReactNode {
  const setAppState = useSetAppState()
  const providerLabel = getProviderDisplayName(provider)

  function handleSelect(model: string): void {
    saveProviderModel(provider, model)
    applyConfigEnvironmentVariables()
    applyProviderModelToProcess(provider, model)
    setAppState(prev => ({
      ...prev,
      mainLoopModel: null,
      mainLoopModelForSession: null,
    }))
    onDone(formatSelectionMessage(provider, model))
  }

  function handleCancel(): void {
    onDone(`Kept ${providerLabel} model as ${chalk.bold(currentModel)}`, {
      display: 'system',
    })
  }

  const knownOptions = getKnownExternalModelOptions(provider)
  const options = knownOptions.some(option => option.value === currentModel)
    ? knownOptions
    : [
        {
          value: currentModel,
          label: currentModel,
          description: 'Current custom model',
        },
        ...knownOptions,
      ]

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>Select {providerLabel} model</Text>
        <Text dimColor>
          Known models for {providerLabel}. Selecting one also switches the
          provider for this session.
        </Text>
        <Text dimColor>
          Current: <Text>{currentModel}</Text>
        </Text>
        <Select
          options={options}
          defaultValue={currentModel}
          defaultFocusValue={
            options.some(option => option.value === currentModel)
              ? currentModel
              : options[0]?.value
          }
          visibleOptionCount={Math.min(10, options.length)}
          layout="compact-vertical"
          onChange={handleSelect}
          onCancel={handleCancel}
        />
      </Box>
    </Pane>
  )
}

function SetProviderModelAndClose({
  provider,
  model,
  onDone,
}: ProviderModelCommandProps & {
  model: string | null
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const setAppState = useSetAppState()

  React.useEffect(() => {
    saveProviderModel(provider, model)
    applyConfigEnvironmentVariables()
    applyProviderModelToProcess(provider, model)
    setAppState(prev => ({
      ...prev,
      mainLoopModel: null,
      mainLoopModelForSession: null,
    }))

    if (model === null) {
      onDone(
        `Using default ${getProviderDisplayName(provider)} model ${chalk.bold(getConfiguredExternalModel(provider))} and switched provider to ${chalk.bold(getProviderDisplayName(provider))}`,
      )
      return
    }

    onDone(formatSelectionMessage(provider, model))
  }, [model, onDone, provider, setAppState])

  return null
}

function ShowProviderModelAndClose({
  provider,
  onDone,
}: ProviderModelCommandProps & {
  onDone: (result?: string) => void
}): React.ReactNode {
  onDone(
    `Current ${getProviderDisplayName(provider)} model: ${chalk.bold(getConfiguredExternalModel(provider))}`,
  )
  return null
}

export function createExternalModelCommand(
  provider: ProviderModelCommandProps['provider'],
): LocalJSXCommandCall {
  return async (onDone, _context, args) => {
    const trimmedArgs = args?.trim() || ''

    if (COMMON_INFO_ARGS.includes(trimmedArgs)) {
      return <ShowProviderModelAndClose provider={provider} onDone={onDone} />
    }

    if (COMMON_HELP_ARGS.includes(trimmedArgs)) {
      onDone(
        `Run /${provider}-model to pick from common ${getProviderDisplayName(provider)} models, /${provider}-model [modelName] to set one directly, or /${provider}-model default to clear the saved override.`,
        { display: 'system' },
      )
      return null
    }

    if (trimmedArgs) {
      return (
        <SetProviderModelAndClose
          provider={provider}
          model={trimmedArgs === 'default' ? null : trimmedArgs}
          onDone={onDone}
        />
      )
    }

    return (
      <ProviderModelPicker
        provider={provider}
        currentModel={getConfiguredExternalModel(provider)}
        onDone={onDone}
      />
    )
  }
}
