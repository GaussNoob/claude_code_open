import chalk from 'chalk'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { Select } from '../../components/CustomSelect/select.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Spinner } from '../../components/Spinner.js'
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
  getOpenRouterModelDisplayName,
  listOpenRouterModels,
  resolveOpenRouterModelId,
  type OpenRouterModel,
} from '../../utils/model/openrouter.js'
import {
  getConfiguredExternalModel,
  getKnownExternalModelOptions,
} from '../../utils/model/providers.js'

type PickerProps = {
  currentModel: string
  models: OpenRouterModel[]
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
  remoteError?: string
}

function formatContextLength(contextLength?: number): string | undefined {
  if (!contextLength || contextLength <= 0) {
    return undefined
  }

  if (contextLength >= 1_000_000) {
    const compact = Number((contextLength / 1_000_000).toFixed(1))
    return `${compact}M ctx`
  }

  if (contextLength >= 1_000) {
    const compact = Number((contextLength / 1_000).toFixed(contextLength >= 100_000 ? 0 : 1))
    return `${compact}k ctx`
  }

  return `${contextLength} ctx`
}

function saveOpenRouterSelection(model: string | null): void {
  saveExternalProviderConfig('openrouter', {
    model,
    switchProvider: true,
  })
}

function applyOpenRouterSelectionToProcess(model: string | null): void {
  applyExternalProviderConfigToProcess('openrouter', {
    model,
    switchProvider: true,
  })
}

function formatSelectionMessage(model: string): string {
  return `Set OpenRouter model to ${chalk.bold(model)} and switched provider to ${chalk.bold('OpenRouter')}`
}

function OpenRouterModelPicker({
  currentModel,
  models,
  onDone,
  remoteError,
}: PickerProps): React.ReactNode {
  const setAppState = useSetAppState()

  function handleSelect(model: string): void {
    saveOpenRouterSelection(model)
    applyConfigEnvironmentVariables()
    applyOpenRouterSelectionToProcess(model)
    setAppState(prev => ({
      ...prev,
      mainLoopModel: model,
      mainLoopModelForSession: null,
    }))
    onDone(formatSelectionMessage(model))
  }

  function handleCancel(): void {
    onDone(`Kept OpenRouter model as ${chalk.bold(currentModel)}`, {
      display: 'system',
    })
  }

  const options = models.map(model => ({
    label: getOpenRouterModelDisplayName(model),
    value: model.id,
    description:
      [
        model.id,
        formatContextLength(model.contextLength),
        model.modality,
      ]
        .filter(Boolean)
        .join(' | ') ||
      model.description ||
      'OpenRouter model',
  }))

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>Select OpenRouter model</Text>
        <Text dimColor>
          Models loaded from the OpenRouter API when available. You can also run
          `/openrouter-model &lt;model-id&gt;` to set any model manually.
        </Text>
        <Text dimColor>
          Current: <Text>{currentModel}</Text>
        </Text>
        {remoteError ? <Text dimColor>{remoteError}</Text> : null}
        <Select
          options={options}
          defaultValue={currentModel}
          defaultFocusValue={
            options.some(option => option.value === currentModel)
              ? currentModel
              : options[0]?.value
          }
          visibleOptionCount={Math.min(12, options.length)}
          layout="compact-vertical"
          onChange={handleSelect}
          onCancel={handleCancel}
        />
      </Box>
    </Pane>
  )
}

function SetOpenRouterModelAndClose({
  model,
  onDone,
}: {
  model: string | null
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const setAppState = useSetAppState()

  React.useEffect(() => {
    saveOpenRouterSelection(model)
    applyConfigEnvironmentVariables()
    applyOpenRouterSelectionToProcess(model)
    const resolvedModel = model ?? getConfiguredExternalModel('openrouter')
    setAppState(prev => ({
      ...prev,
      mainLoopModel: resolvedModel,
      mainLoopModelForSession: null,
    }))

    if (model === null) {
      onDone(
        `Using default OpenRouter model ${chalk.bold(getConfiguredExternalModel('openrouter'))} and switched provider to ${chalk.bold('OpenRouter')}`,
      )
      return
    }

    onDone(formatSelectionMessage(model))
  }, [model, onDone, setAppState])

  return (
    <Box>
      <Spinner />
      <Text>Saving OpenRouter model...</Text>
    </Box>
  )
}

function ShowOpenRouterModelAndClose({
  onDone,
}: {
  onDone: (result?: string) => void
}): React.ReactNode {
  onDone(
    `Current OpenRouter model: ${chalk.bold(getConfiguredExternalModel('openrouter'))}`,
  )
  return null
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmedArgs = args?.trim() || ''

  if (COMMON_INFO_ARGS.includes(trimmedArgs)) {
    return <ShowOpenRouterModelAndClose onDone={onDone} />
  }

  if (COMMON_HELP_ARGS.includes(trimmedArgs)) {
    onDone(
      'Run /openrouter-model to load models from OpenRouter, /openrouter-model [modelId] to set one directly, or /openrouter-model default to clear the saved override.',
      { display: 'system' },
    )
    return null
  }

  if (trimmedArgs) {
    if (trimmedArgs === 'default') {
      return <SetOpenRouterModelAndClose model={null} onDone={onDone} />
    }

    const { models } = await listOpenRouterModels()
    const resolvedModelId = resolveOpenRouterModelId(trimmedArgs, models)

    if (!resolvedModelId && !trimmedArgs.includes('/')) {
      onDone(
        `OpenRouter needs the real model id, not only the display name. Try \`/openrouter-model\` to list models or pass an id like \`provider/model\`.`,
        { display: 'system' },
      )
      return null
    }

    return (
      <SetOpenRouterModelAndClose
        model={resolvedModelId ?? trimmedArgs}
        onDone={onDone}
      />
    )
  }

  const currentModel = getConfiguredExternalModel('openrouter')
  const { models, error } = await listOpenRouterModels()
  const fallbackModels = getKnownExternalModelOptions('openrouter').map(model => ({
    id: model.value,
    name: model.label,
    description: model.description,
  }))

  const options =
    models.length > 0
      ? models
      : fallbackModels.some(model => model.id === currentModel)
        ? fallbackModels
        : [
            {
              id: currentModel,
              name: currentModel,
              description: 'Current custom model',
            },
            ...fallbackModels,
          ]

  if (options.length === 0) {
    onDone(
      error ??
        'No OpenRouter models were returned. Run `/openrouter-model <model-id>` to set one manually.',
      { display: 'system' },
    )
    return null
  }

  return (
    <OpenRouterModelPicker
      currentModel={currentModel}
      models={options}
      onDone={onDone}
      remoteError={models.length > 0 ? undefined : error}
    />
  )
}
