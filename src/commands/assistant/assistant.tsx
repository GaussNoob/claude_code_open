import React from 'react'
import { Select } from '../../components/CustomSelect/index.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Text } from '../../ink.js'

type NewInstallWizardProps = {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

export async function computeDefaultInstallDir(): Promise<string> {
  return `${process.cwd()}/assistant`
}

export function NewInstallWizard(
  props: NewInstallWizardProps,
): React.ReactNode {
  return (
    <Dialog title="Assistant Install" onCancel={props.onCancel}>
      <Text>Install path: {props.defaultDir}</Text>
      <Select
        options={[
          { label: 'Install here', value: 'install' as const },
          { label: 'Cancel', value: 'cancel' as const },
        ]}
        onChange={value => {
          if (value === 'install') {
            props.onInstalled(props.defaultDir)
            return
          }
          props.onCancel()
        }}
      />
    </Dialog>
  )
}
