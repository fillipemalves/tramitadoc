import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function VerificarAssinatura() {
  const { code } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/verificar/${code}`)
      .then(r => r.json())
      .then(data => setResult(data))
      .catch(() => setResult({ valid: false, error: 'Erro ao consultar a assinatura.' }))
      .finally(() => setLoading(false))
  }, [code])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '40px 48px', maxWidth: 480, width: '100%' }}>

        {/* Logo / Título */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            TramitaDOC
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            Verificação de Assinatura Digital
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            Verificando...
          </div>
        )}

        {!loading && result?.valid && (
          <>
            {/* Badge válido */}
            <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Assinatura válida</div>
                <div style={{ color: '#86efac', fontSize: 12, marginTop: 2 }}>Este documento é autêntico.</div>
              </div>
            </div>

            {/* Dados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Row label="Protocolo" value={result.protocol || '—'} />
              <Row label="Assunto" value={result.subject || '—'} />
              <Row label="Assinado por" value={result.signer || '—'} />
              <Row label="Setor" value={result.dept || '—'} />
              <Row
                label="Data da assinatura"
                value={result.signedAt
                  ? format(new Date(result.signedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                  : '—'}
              />
              <Row label="Código de verificação" value={code} mono />
            </div>
          </>
        )}

        {!loading && result && !result.valid && (
          <div style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>❌</span>
            <div>
              <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Assinatura não encontrada</div>
              <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 2 }}>
                {result.error || 'O código informado não corresponde a nenhum documento.'}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 36, textAlign: 'center', color: '#475569', fontSize: 11 }}>
          Esta página é pública e não requer login.
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ borderBottom: '1px solid #1e3a5f', paddingBottom: 12 }}>
      <div style={{ color: '#64748b', fontSize: 11, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontSize: 13, fontFamily: mono ? 'monospace' : 'Arial, sans-serif', wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}
