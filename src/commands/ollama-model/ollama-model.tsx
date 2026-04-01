import chalk from 'chalk';
import * as React from 'react';
import type { CommandResultDisplay } from '../../commands.js';
import { Select } from '../../components/CustomSelect/select.js';
import { Pane } from '../../components/design-system/Pane.js';
import { Spinner } from '../../components/Spinner.js';
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js';
import { Box, Text } from '../../ink.js';
import { warmupOllamaModel } from '../../services/api/externalProviders.js';
import { useSetAppState } from '../../state/AppState.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js';
import { applyExternalProviderConfigToProcess, saveExternalProviderConfig } from '../../utils/model/externalProviderConfig.js';
import { getConfiguredExternalModel } from '../../utils/model/providers.js';

type Props = {
  initialModel: string;
  models: OllamaInstalledModel[];
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void;
};

type OllamaInstalledModel = {
  name: string;
  size?: string;
  modified?: string;
};

function parseOllamaListOutput(stdout: string): OllamaInstalledModel[] {
  const lines = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines
    .slice(1)
    .map(line => {
      const [name, _id, size, modified] = line.split(/\s{2,}/);
      return {
        name: name?.trim() ?? '',
        size: size?.trim(),
        modified: modified?.trim(),
      };
    })
    .filter(model => model.name.length > 0);
}

async function listInstalledOllamaModels(): Promise<{
  models: OllamaInstalledModel[];
  error?: string;
}> {
  const result = await execFileNoThrow('ollama', ['list']);
  if (result.code !== 0) {
    return {
      models: [],
      error:
        result.stderr.trim() ||
        result.error ||
        'Failed to run `ollama list`. Make sure Ollama is installed and available in PATH.',
    };
  }

  return {
    models: parseOllamaListOutput(result.stdout),
  };
}

function saveOllamaSelection(model: string): void {
  saveExternalProviderConfig('ollama', { model });
}

function applyOllamaSelectionToProcess(model: string): void {
  applyExternalProviderConfigToProcess('ollama', { model });
}

function formatSelectionMessage(model: string): string {
  return `Set Ollama model to ${chalk.bold(model)} and switched provider to ${chalk.bold('Ollama')}`;
}

function OllamaModelPickerCommand({
  initialModel,
  models,
  onDone,
}: Props): React.ReactNode {
  const setAppState = useSetAppState();

  function handleSelect(model: string): void {
    saveOllamaSelection(model);
    applyConfigEnvironmentVariables();
    applyOllamaSelectionToProcess(model);
    void warmupOllamaModel(model);
    setAppState(prev => ({
      ...prev,
      mainLoopModel: null,
      mainLoopModelForSession: null,
    }));
    onDone(formatSelectionMessage(model));
  }

  function handleCancel(): void {
    onDone(`Kept Ollama model as ${chalk.bold(initialModel)}`, {
      display: 'system',
    });
  }

  const options = models.map(model => ({
    label: model.name,
    value: model.name,
    description: [model.size, model.modified].filter(Boolean).join(' | '),
  }));

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>Select Ollama model</Text>
        <Text dimColor>
          Installed models from `ollama list`. Selecting one also switches the
          provider to Ollama for this session.
        </Text>
        <Text dimColor>
          Current: <Text>{initialModel}</Text>
        </Text>
        <Select
          options={options}
          defaultValue={initialModel}
          defaultFocusValue={
            options.some(option => option.value === initialModel)
              ? initialModel
              : options[0]?.value
          }
          visibleOptionCount={Math.min(10, options.length)}
          layout="compact-vertical"
          onChange={handleSelect}
          onCancel={handleCancel}
        />
      </Box>
    </Pane>
  );
}

function SetOllamaModelAndClose({
  model,
  onDone,
}: {
  model: string;
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void;
}): React.ReactNode {
  const setAppState = useSetAppState();

  React.useEffect(() => {
    saveOllamaSelection(model);
    applyConfigEnvironmentVariables();
    applyOllamaSelectionToProcess(model);
    void warmupOllamaModel(model);
    setAppState(prev => ({
      ...prev,
      mainLoopModel: null,
      mainLoopModelForSession: null,
    }));
    onDone(formatSelectionMessage(model));
  }, [model, onDone, setAppState]);

  return (
    <Box>
      <Spinner />
      <Text>Saving Ollama model...</Text>
    </Box>
  );
}

function ShowOllamaModelAndClose({
  onDone,
}: {
  onDone: (result?: string) => void;
}): React.ReactNode {
  onDone(`Current Ollama model: ${chalk.bold(getConfiguredExternalModel('ollama'))}`);
  return null;
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmedArgs = args?.trim() || '';

  if (COMMON_INFO_ARGS.includes(trimmedArgs)) {
    return <ShowOllamaModelAndClose onDone={onDone} />;
  }

  if (COMMON_HELP_ARGS.includes(trimmedArgs)) {
    onDone(
      'Run /ollama-model to pick from installed Ollama models, or /ollama-model [modelName] to set one directly.',
      { display: 'system' },
    );
    return null;
  }

  const { models, error } = await listInstalledOllamaModels();
  if (error) {
    onDone(error, { display: 'system' });
    return null;
  }

  if (models.length === 0) {
    onDone(
      'No Ollama models are installed yet. Run `ollama pull <model>` first, then try /ollama-model again.',
      { display: 'system' },
    );
    return null;
  }

  if (trimmedArgs) {
    const selectedModel = models.find(model => model.name === trimmedArgs);
    if (!selectedModel) {
      onDone(
        `Model '${trimmedArgs}' is not installed. Run /ollama-model to choose from installed models.`,
        { display: 'system' },
      );
      return null;
    }
    return <SetOllamaModelAndClose model={selectedModel.name} onDone={onDone} />;
  }

  return (
    <OllamaModelPickerCommand
      initialModel={getConfiguredExternalModel('ollama')}
      models={models}
      onDone={onDone}
    />
  );
};
