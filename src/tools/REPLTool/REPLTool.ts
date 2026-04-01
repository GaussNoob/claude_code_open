import { createUnavailableTool } from '../createUnavailableTool.js'
import { REPL_TOOL_NAME } from './constants.js'

export const REPLTool = createUnavailableTool(
  REPL_TOOL_NAME,
  'REPL mode is unavailable in this reconstructed build.',
)
