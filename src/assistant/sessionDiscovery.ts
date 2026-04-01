export type AssistantSession = {
  id: string
  title?: string
  name?: string
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  return []
}
