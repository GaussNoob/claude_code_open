import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getProviderDisplayName } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'openrouter-key',
  aliases: ['or-key'],
  isSensitive: true,
  get description() {
    return `Set the ${getProviderDisplayName('openrouter')} API key`
  },
  argumentHint: '[api-key]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./openrouter-key.js'),
} satisfies Command
