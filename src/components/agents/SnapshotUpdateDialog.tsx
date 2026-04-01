import React from 'react'
import { Select } from '../CustomSelect/index.js'
import { Dialog } from '../design-system/Dialog.js'
import { Text } from '../../ink.js'
import type { AgentMemoryScope } from '../../tools/AgentTool/agentMemory.js'

type Props = {
  agentType: string
  scope: AgentMemoryScope
  snapshotTimestamp: string
  onComplete: (choice: 'merge' | 'keep' | 'replace') => void
  onCancel: () => void
}

export function SnapshotUpdateDialog(props: Props): React.ReactNode {
  return (
    <Dialog title="Snapshot Update" onCancel={props.onCancel}>
      <Text>
        Snapshot for {props.agentType} in scope {String(props.scope)} from{' '}
        {props.snapshotTimestamp}.
      </Text>
      <Select
        options={[
          { label: 'Merge snapshot', value: 'merge' as const },
          { label: 'Keep current memory', value: 'keep' as const },
          { label: 'Replace current memory', value: 'replace' as const },
        ]}
        onChange={props.onComplete}
      />
    </Dialog>
  )
}
