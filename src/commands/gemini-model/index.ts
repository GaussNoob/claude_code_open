import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getConfiguredExternalModel } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'gemini-model',
  aliases: ['gmodel'],
  get description() {
    return `Choose the Gemini model to use (currently ${getConfiguredExternalModel('gemini')})`
  },
  argumentHint: '[model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./gemini-model.js'),
} satisfies Command
