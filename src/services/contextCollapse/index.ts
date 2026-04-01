import type { Message } from '../../types/message.js'

type CollapseStats = {
  collapsedSpans: number
  stagedSpans: number
  health: {
    totalErrors: number
    totalEmptySpawns: number
    emptySpawnWarningEmitted: boolean
  }
}

const EMPTY_STATS: CollapseStats = {
  collapsedSpans: 0,
  stagedSpans: 0,
  health: {
    totalErrors: 0,
    totalEmptySpawns: 0,
    emptySpawnWarningEmitted: false,
  },
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export function getStats(): CollapseStats {
  return EMPTY_STATS
}

export function subscribe(_listener: () => void): () => void {
  return () => {}
}

export function projectView<T extends Message>(messages: T[]): T[] {
  return messages
}

export function resetContextCollapse(): void {}

export function getContextCollapseStore() {
  return {
    getStats,
    subscribe,
  }
}

export function createContextCollapse() {
  return {
    async applyCollapsesIfNeeded(messages: Message[]) {
      return { messages }
    },
    projectView,
    getStats,
    subscribe,
    resetContextCollapse,
  }
}
