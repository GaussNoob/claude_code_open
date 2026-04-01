import { z } from 'zod/v4'
import { buildTool } from '../Tool.js'
import { jsonStringify } from '../utils/slowOperations.js'

const inputSchema = z.object({}).passthrough()
const outputSchema = z.object({
  message: z.string(),
})

export function createUnavailableTool(name: string, description: string) {
  return buildTool({
    name,
    userFacingName: () => name,
    inputSchema,
    outputSchema,
    async description() {
      return description
    },
    async prompt() {
      return description
    },
    mapToolResultToToolResultBlockParam(output, toolUseID) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseID,
        content: jsonStringify(output),
      }
    },
    renderToolUseMessage() {
      return `${name} unavailable in this reconstructed build`
    },
    async call() {
      return {
        data: {
          message: `${name} is unavailable in this reconstructed build`,
        },
      }
    },
  })
}
