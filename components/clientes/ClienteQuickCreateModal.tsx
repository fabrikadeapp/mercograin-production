'use client'

import { Dialog } from '@/components/ui/phb'
import { ClienteForm, type ClienteCriado } from './ClienteForm'

export interface ClienteQuickCreateModalProps {
  open: boolean
  onClose: () => void
  initialNome?: string
  onCreated: (cliente: ClienteCriado) => void
}

export function ClienteQuickCreateModal({
  open,
  onClose,
  initialNome,
  onCreated,
}: ClienteQuickCreateModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title="Criar cliente rápido"
      description="Cole o CNPJ para auto-preencher os dados. Os campos opcionais podem ficar em branco."
      className="max-w-2xl"
    >
      <ClienteForm
        embedded
        initialNome={initialNome}
        submitLabel="Criar e continuar"
        onCancel={onClose}
        onSuccess={(cliente) => {
          onCreated(cliente)
          onClose()
        }}
      />
    </Dialog>
  )
}
