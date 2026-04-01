import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getProviderDisplayName } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'openai-key',
  aliases: ['gpt-key'],
  isSensitive: true,
  get description() {
    return `Set the ${getProviderDisplayName('openai')} API key`
  },
  argumentHint: '[api-key]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./openai-key.js'),
} satisfies Command
