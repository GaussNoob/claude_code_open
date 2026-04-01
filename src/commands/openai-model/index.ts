import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getConfiguredExternalModel } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'openai-model',
  aliases: ['gpt-model'],
  get description() {
    return `Choose the OpenAI model to use (currently ${getConfiguredExternalModel('openai')})`
  },
  argumentHint: '[model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./openai-model.js'),
} satisfies Command
