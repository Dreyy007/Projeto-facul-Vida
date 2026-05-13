import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const resultados = [
  {
    id: 1,
    tipo: 'Hemograma Completo',
    data: '2024-04-28',
    medico: 'Dra. Ana Paula',
    status: 'disponivel',
    categoria: 'Exame de Sangue',
    itens: [
      { nome: 'Hemoglobina',    valor: '14,2 g/dL',  ref: '12,0–16,0',  ok: true },
      { nome: 'Hematócrito',    valor: '42%',         ref: '36–46%',     ok: true },
      { nome: 'Leucócitos',     valor: '7.200/mm³',   ref: '4.000–11.000', ok: true },
      { nome: 'Plaquetas',      valor: '210.000/mm³', ref: '150.000–400.000', ok: true },
      { nome: 'Glicose',        valor: '112 mg/dL',   ref: '70–99',      ok: false },
    ],
  },
  {
    id: 2,
    tipo: 'Avaliação Psicológica',
    data: '2024-04-10',
    medico: 'Dr. Carlos Mendes',
    status: 'disponivel',
    categoria: 'Psicologia',
    laudo: 'Paciente apresenta boa evolução no processo terapêutico. Redução significativa dos sintomas ansiosos relatados. Recomenda-se continuidade do acompanhamento semanal com reavaliação em 60 dias.',
  },
  {
    id: 3,
    tipo: 'Eletrocardiograma',
    data: '2024-03-15',
    medico: 'Dr. Ricardo Lima',
    status: 'disponivel',
    categoria: 'Cardiologia',
    laudo: 'Ritmo sinusal normal. Frequência cardíaca de 72 bpm. Sem alterações significativas no traçado eletrocardiográfico. Exame dentro dos parâmetros normais para a faixa etária.',
  },
  {
    id: 4,
    tipo: 'Ressonância Magnética',
    data: '2024-05-20',
    medico: 'Dra. Fernanda Costa',
    status: 'pendente',
    categoria: 'Imagem',
    laudo: null,
  },
]

const catIcon = {
  'Exame de Sangue': { bg: '#FEF3C7', stroke: '#D97706' },
  'Psicologia':      { bg: '#F5F3FF', stroke: '#7C3AED' },
  'Cardiologia':     { bg: '#FEE2E2', stroke: '#DC2626' },
  'Imagem':          { bg: '#EFF6FF', stroke: '#0047AB' },
}

const fmtData = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Resultados() {
  const { paciente } = useAuth()
  const [aberto, setAberto] = useState(null)

  const disponíveis = resultados.filter(r => r.status === 'disponivel')
  const pendentes   = resultados.filter(r => r.status === 'pendente')

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
            <p style={s.statNum}>{disponíveis.length}</p>
            <p style={s.statLabel}>Disponíveis</p>
          </div>
          <div style={s.statDivider} />
          <div style={s.statBox}>
            <p style={s.statNum}>{pendentes.length}</p>
            <p style={s.statLabel}>Pendentes</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px' }}>

        {/* Disponíveis */}
        <p style={s.sectionTitle}>✅ Disponíveis</p>
        {disponíveis.map(r => {
          const ci = catIcon[r.categoria] || { bg: '#F3F4F6', stroke: '#6B7280' }
          const isOpen = aberto === r.id
          return (
            <div key={r.id} style={s.card}>
              <button style={s.cardBtn} onClick={() => setAberto(isOpen ? null : r.id)}>
                <div style={{ ...s.catIcon, backgroundColor: ci.bg }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ci.stroke} strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={s.cardTipo}>{r.tipo}</p>
                  <p style={s.cardMeta}>{fmtData(r.data)} · {r.medico}</p>
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
                  {r.itens ? (
                    <div>
                      <p style={s.detalheLabel}>VALORES</p>
                      {r.itens.map(item => (
                        <div key={item.nome} style={s.itemRow}>
                          <div style={{ flex: 1 }}>
                            <p style={s.itemNome}>{item.nome}</p>
                            <p style={s.itemRef}>Ref: {item.ref}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ ...s.itemValor, color: item.ok ? '#166534' : '#991B1B' }}>{item.valor}</p>
                            <span style={{ ...s.itemTag, backgroundColor: item.ok ? '#DCFCE7' : '#FEE2E2', color: item.ok ? '#166534' : '#991B1B' }}>
                              {item.ok ? '✓' : '↑'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {r.itens.some(i => !i.ok) && (
                        <div style={s.alertaBox}>
                          <p style={s.alertaText}>⚠️ Alguns valores estão fora da referência. Consulte seu médico.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p style={s.detalheLabel}>LAUDO MÉDICO</p>
                      <p style={s.laudoText}>{r.laudo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Pendentes */}
        {pendentes.length > 0 && (
          <>
            <p style={{ ...s.sectionTitle, marginTop: 24 }}>⏳ Aguardando liberação</p>
            {pendentes.map(r => {
              const ci = catIcon[r.categoria] || { bg: '#F3F4F6', stroke: '#6B7280' }
              return (
                <div key={r.id} style={{ ...s.card, opacity: 0.7 }}>
                  <div style={s.cardBtn}>
                    <div style={{ ...s.catIcon, backgroundColor: ci.bg }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ci.stroke} strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={s.cardTipo}>{r.tipo}</p>
                      <p style={s.cardMeta}>{fmtData(r.data)} · {r.medico}</p>
                    </div>
                    <span style={{ backgroundColor: '#FEF9C3', color: '#854D0E', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50 }}>Pendente</span>
                  </div>
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
  itemRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F9FAFB' },
  itemNome: { fontSize: 13, fontWeight: 600, color: '#0D1B2A', marginBottom: 2 },
  itemRef: { fontSize: 11, color: '#9CA3AF' },
  itemValor: { fontSize: 14, fontWeight: 700 },
  itemTag: { width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 },
  alertaBox: { backgroundColor: '#FEF9C3', borderRadius: 10, padding: '10px 12px', marginTop: 12, border: '1px solid #FDE68A' },
  alertaText: { fontSize: 12, color: '#854D0E', fontWeight: 500 },
  laudoText: { fontSize: 13, color: '#374151', lineHeight: '20px', backgroundColor: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F3F4F6' },
  avisoCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: '12px 16px', marginTop: 20, display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #BFDBFE' },
  avisoText: { fontSize: 12, color: '#1d4ed8', lineHeight: '18px' },
}