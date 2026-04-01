import React from 'react'
import { Select } from '../components/CustomSelect/index.js'
import { Dialog } from '../components/design-system/Dialog.js'
import { Text } from '../ink.js'

type AssistantSession = {
  id: string
  title?: string
  name?: string
}

type Props = {
  sessions: AssistantSession[]
  onSelect: (id: string) => void
  onCancel: () => void
}

export function AssistantSessionChooser(props: Props): React.ReactNode {
  if (props.sessions.length === 0) {
    return (
      <Dialog title="Assistant Sessions" onCancel={props.onCancel}>
        <Text>No assistant sessions were found.</Text>
        <Select
          options={[{ label: 'Back', value: 'cancel' as const }]}
          onChange={() => props.onCancel()}
        />
      </Dialog>
    )
  }

  return (
    <Dialog title="Assistant Sessions" onCancel={props.onCancel}>
      <Select
        options={props.sessions.map(session => ({
          label: session.title || session.name || session.id,
          value: session.id,
        }))}
        onChange={props.onSelect}
      />
    </Dialog>
  )
}
