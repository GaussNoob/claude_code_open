import type { Command } from '../../commands.js'

const assistant = {
  type: 'local-jsx',
  name: 'assistant',
  description: 'Assistant mode is unavailable in this reconstructed build',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./assistant.js'),
} satisfies Command

export default assistant
