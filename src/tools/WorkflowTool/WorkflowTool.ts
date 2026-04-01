import { createUnavailableTool } from '../createUnavailableTool.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'

export const WorkflowTool = createUnavailableTool(
  WORKFLOW_TOOL_NAME,
  'Workflow execution is unavailable in this reconstructed build.',
)
