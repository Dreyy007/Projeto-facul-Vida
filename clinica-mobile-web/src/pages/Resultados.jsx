import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const catIcon = {
  'Exame de Sangue': { bg: '#FEF3C7', stroke: '#D97706' },
  'Psicologia':      { bg: '#F5F3FF', stroke: '#7C3AED' },
  'Cardiologia':     { bg: '#FEE2E2', stroke: '#DC2626' },
  'Neuropsicologia': { bg: '#EFF6FF', stroke: '#0047AB' },
  'Imagem':          { bg: '#F0FDF4', stroke: '#059669' },
  'Laudo':           { bg: '#FFF7ED', stroke: '#EA580C' },
  'Outro':           { bg: '#F3F4F6', stroke: '#6B7280' },
}

const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Resultados() {
  const { paciente } = useAuth()
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    if (!paciente) return
    fetchResultados()
  }, [paciente])

  async function fetchResultados() {
    setLoading(true)
    const { data } = await supabase
      .from('resultados')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('criado_em', { ascending: false })
    setResultados(data || [])
    setLoading(false)
  }

  const laudos = resultados.filter(r => r.categoria === 'Laudo')
  const exames = resultados.filter(r => r.categoria !== 'Laudo')

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100%' }}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.circle1} />
        <div style={s.circle2} />
        <p style={s.title}>Meus Resultados</p>
        <p style={s.sub}>Exames e laudos liberados pela clínica</p>
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <p style={s.statNum}>{exames.length}</p>
            <p style={s.statLabel}>Exames</p>
          </div>
          <div style={s.statDivider} />
          <div style={s.statBox}>
            <p style={s.statNum}>{laudos.length}</p>
            <p style={s.statLabel}>Laudos</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 14 }}>
            Carregando...
          </div>
        )}

        {!loading && resultados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhum resultado ainda</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Seus exames e laudos aparecerão aqui quando forem liberados pela clínica.</p>
          </div>
        )}

        {/* Exames */}
        {!loading && exames.length > 0 && (
          <>
            <p style={s.sectionTitle}>🔬 Exames</p>
            {exames.map(r => {
              const ci = catIcon[r.categoria] || { bg: '#F3F4F6', stroke: '#6B7280' }
              const isOpen = aberto === r.id
              return (
                <div key={r.id} style={s.card}>
                  <button style={s.cardBtn} onClick={() => setAberto(isOpen ? null : r.id)}>
                    <div style={{ ...s.catIcon, backgroundColor: ci.bg }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ci.stroke} strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <p style={s.cardTipo}>{r.nome}</p>
                      <p style={s.cardMeta}>{fmtData(r.criado_em)}</p>
                      <span style={s.catTag}>{r.categoria}</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: '.2s', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>

                  {isOpen && (
                    <div style={s.detalhe}>
                      <div style={s.divider} />
                      {r.arquivo_url && (
                        <a href={r.arquivo_url} target="_blank" rel="noreferrer" style={s.arquivoBtn}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                          </svg>
                          📎 Ver arquivo anexo
                        </a>
                      )}
                      {r.conteudo && (
                        <div>
                          <p style={s.detalheLabel}>OBSERVAÇÕES</p>
                          <p style={s.laudoText}>{r.conteudo}</p>
                        </div>
                      )}
                      {!r.arquivo_url && !r.conteudo && (
                        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>Sem detalhes adicionais.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* Laudos */}
        {!loading && laudos.length > 0 && (
          <>
            <p style={{ ...s.sectionTitle, marginTop: 24 }}>📄 Laudos</p>
            {laudos.map(r => {
              const isOpen = aberto === r.id
              return (
                <div key={r.id} style={s.card}>
                  <button style={s.cardBtn} onClick={() => setAberto(isOpen ? null : r.id)}>
                    <div style={{ ...s.catIcon, backgroundColor: '#FFF7ED' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <p style={s.cardTipo}>{r.nome}</p>
                      <p style={s.cardMeta}>{fmtData(r.criado_em)}</p>
                      <span style={{ ...s.catTag, backgroundColor: '#FFF7ED', color: '#EA580C' }}>Laudo</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: '.2s', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={s.detalhe}>
                      <div style={s.divider} />
                      <p style={s.detalheLabel}>LAUDO MÉDICO</p>
                      <p style={s.laudoText}>{r.conteudo}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        <div style={s.avisoCard}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={s.avisoText}>Resultados são liberados pela equipe médica após análise. Em caso de dúvidas, use o chat.</p>
        </div>
      </div>
    </div>
  )
}

const s = {
  header: { position: 'relative', background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', padding: '52px 20px 24px', overflow: 'hidden' },
  circle1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -70, right: -50 },
  circle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: 10 },
  title: { fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 20 },
  statsRow: { display: 'flex', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '12px 0' },
  statBox: { flex: 1, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  statNum: { fontSize: 24, fontWeight: 900, color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' },
  cardBtn: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' },
  catIcon: { width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTipo: { fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 3 },
  cardMeta: { fontSize: 12, color: '#9CA3AF', marginBottom: 5 },
  catTag: { fontSize: 10, fontWeight: 700, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: 50 },
  detalhe: { padding: '0 18px 18px' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },
  detalheLabel: { fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 12 },
  laudoText: { fontSize: 13, color: '#374151', lineHeight: '20px', backgroundColor: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F3F4F6' },
  arquivoBtn: { display: 'flex', alignItems: 'center', gap: 8, color: '#0047AB', fontSize: 13, fontWeight: 600, textDecoration: 'none', backgroundColor: '#EFF6FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 },
  avisoCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: '12px 16px', marginTop: 20, display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #BFDBFE' },
  avisoText: { fontSize: 12, color: '#1d4ed8', lineHeight: '18px' },
}