import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getConfiguredExternalModel } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'openrouter-model',
  aliases: ['or-model'],
  get description() {
    return `Choose the OpenRouter model to use (currently ${getConfiguredExternalModel('openrouter')})`
  },
  argumentHint: '[model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./openrouter-model.js'),
} satisfies Command
