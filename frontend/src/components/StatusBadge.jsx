const map = {
  DRAFT:       { label: 'Rascunho',  cls: 'badge badge-draft'     },
  SENT:        { label: 'Enviado',   cls: 'badge badge-sent'      },
  RECEIVED:    { label: 'Recebido',  cls: 'badge badge-received'  },
  // Legado — podem existir em registros antigos ou eventos históricos
  IN_PROGRESS: { label: 'Recebido',  cls: 'badge badge-received'  },
  RETURNED:    { label: 'Recebido',  cls: 'badge badge-received'  },
  COMPLETED:   { label: 'Recebido',  cls: 'badge badge-received'  },
}

// Perspectiva do destinatário: memo enviado mas ainda não aberto = "Pendente"
const recipientMap = {
  SENT: { label: 'Pendente', cls: 'badge badge-sent' },
}

export default function StatusBadge({ status, recipientView = false }) {
  const override = recipientView ? recipientMap[status] : null
  const { label, cls } = override || map[status] || { label: status, cls: 'badge badge-draft' }
  return <span className={cls}>{label}</span>
}
