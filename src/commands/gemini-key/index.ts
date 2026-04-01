import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getProviderDisplayName } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'gemini-key',
  aliases: ['gkey'],
  isSensitive: true,
  get description() {
    return `Set the ${getProviderDisplayName('gemini')} API key`
  },
  argumentHint: '[api-key]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./gemini-key.js'),
} satisfies Command
