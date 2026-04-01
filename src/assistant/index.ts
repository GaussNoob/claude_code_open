let assistantForced = false

export function isAssistantMode(): boolean {
  return assistantForced
}

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export async function initializeAssistantTeam(): Promise<void> {}

export function getAssistantSystemPromptAddendum(): string {
  return ''
}

export function getAssistantActivationPath(): string | undefined {
  return undefined
}
