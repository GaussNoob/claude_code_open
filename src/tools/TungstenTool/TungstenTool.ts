import { createUnavailableTool } from '../createUnavailableTool.js'

export const TungstenTool = createUnavailableTool(
  'Tungsten',
  'Terminal multiplexing is unavailable in this reconstructed build.',
)

export function clearSessionsWithTungstenUsage(): void {}

export function resetInitializationState(): void {}
