import type { Command } from '../../commands.js'

const agentsPlatform = {
  type: 'local-jsx',
  name: 'agents-platform',
  description: 'Agents platform is unavailable in this reconstructed build',
  isEnabled: () => false,
  isHidden: true,
  load: async () => ({
    call: () => 'Agents platform is unavailable in this reconstructed build.',
  }),
} satisfies Command

export default agentsPlatform
