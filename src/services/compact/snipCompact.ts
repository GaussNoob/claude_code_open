import type { Message } from '../../types/message.js'

type SnipResult = {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message
  executed?: boolean
}

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}

export function isSnipMarkerMessage(_message: Message): boolean {
  return false
}

export function snipCompactIfNeeded(
  messages: Message[],
  _options?: { force?: boolean },
): SnipResult {
  return {
    messages,
    tokensFreed: 0,
    executed: false,
  }
}
