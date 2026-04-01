import { createUnavailableTool } from '../createUnavailableTool.js'
import { VERIFY_PLAN_EXECUTION_TOOL_NAME } from './constants.js'

export const VerifyPlanExecutionTool = createUnavailableTool(
  VERIFY_PLAN_EXECUTION_TOOL_NAME,
  'Plan verification is unavailable in this reconstructed build.',
)
