import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getConfiguredExternalModel } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'ollama-model',
  aliases: ['omodel'],
  get description() {
    return `Choose the Ollama model to use (currently ${getConfiguredExternalModel('ollama')})`
  },
  argumentHint: '[installed-model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./ollama-model.js'),
} satisfies Command
