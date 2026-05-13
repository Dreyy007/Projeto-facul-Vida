import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af', cancelamento_pendente: '#991B1B', reagendamento_pendente: '#92400E' }
const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE', cancelamento_pendente: '#FEE2E2', reagendamento_pendente: '#FEF3C7' }
const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancelamento pend.', reagendamento_pendente: 'Reagend. pend.' }
const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function Consultas() {
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(null)
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('futuras')
  const [erro, setErro] = useState('')

  useEffect(() => { fetchConsultas() }, [paciente])

  async function fetchConsultas() {
    if (!paciente) return
    setRefreshing(true)
    const { data } = await supabase
      .from('consultas')
      .select('*, medico:profiles(nome, especialidade)')
      .eq('paciente_id', paciente.id)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
    setConsultas(data || [])
    setRefreshing(false)
  }

  async function handleSolicitar() {
    if (!modal) return
    setSaving(true)
    setErro('')
    const { tipo, consulta } = modal
    if (tipo === 'reagendamento' && (!novaData || !novaHora)) {
      setErro('Informe a nova data e horário.')
      setSaving(false)
      return
    }
    await supabase.from('solicitacoes').insert([{
      consulta_id: consulta.id, tipo,
      nova_data: novaData || null, nova_hora: novaHora || null, motivo: motivo || null
    }])
    await supabase.from('consultas')
      .update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' })
      .eq('id', consulta.id)
    setModal(null); setNovaData(''); setNovaHora(''); setMotivo('')
    fetchConsultas()
    setSaving(false)
  }

  const hoje = new Date().toISOString().split('T')[0]
  const futuras  = consultas.filter(c => c.data >= hoje && !['cancelada', 'realizada'].includes(c.status))
  const passadas = consultas.filter(c => c.data < hoje || ['cancelada', 'realizada'].includes(c.status))
  const lista = filtro === 'futuras' ? futuras : passadas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header azul */}
      <div style={s.header}>
        <div style={s.headerCircle} />
        <p style={s.headerTitle}>Minhas Consultas</p>
        <p style={s.headerSub}>{futuras.length} consulta(s)</p>
        <div style={s.tabs}>
          {['futuras', 'passadas'].map(f => (
            <button key={f} style={{ ...s.tab, ...(filtro === f ? s.tabOn : {}) }} onClick={() => setFiltro(f)}>
              <span style={{ ...s.tabText, ...(filtro === f ? s.tabTextOn : {}) }}>
                {f === 'futuras' ? `Próximas (${futuras.length})` : `Histórico (${passadas.length})`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {refreshing && <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginBottom: 12 }}>Atualizando...</p>}

        {lista.length === 0 && (
          <div style={s.empty}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📭</p>
            <p style={s.emptyTitle}>Nenhuma consulta aqui</p>
            <p style={s.emptyText}>Seu histórico aparecerá aqui.</p>
          </div>
        )}

        {lista.map(c => (
          <div key={c.id} style={s.card}>
            <div style={s.cardTop}>
              <div>
                <p style={s.cardData}>{fmtData(c.data)}</p>
                <p style={s.cardHora}>⏰ {c.hora?.slice(0, 5)}</p>
              </div>
              <span style={{ ...s.statusTag, backgroundColor: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151' }}>
                {statusLabel[c.status] || c.status}
              </span>
            </div>
            <div style={s.divider} />
            <p style={s.cardMedico}>Dr(a). {c.medico?.nome}</p>
            <p style={s.cardTipo}>{c.tipo}</p>
            {!['cancelada', 'realizada', 'cancelamento_pendente'].includes(c.status) && (
              <div style={s.cardBtns}>
                <button style={s.btnRe} onClick={() => setModal({ consulta: c, tipo: 'reagendamento' })}>
                  📅 Reagendar
                </button>
                <button style={s.btnCan} onClick={() => setModal({ consulta: c, tipo: 'cancelamento' })}>
                  ✕ Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
        <div style={{ height: 32 }} />
      </div>

      {/* Modal */}
      {modal && (
        <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={s.modalCard}>
            <div style={s.modalHandle} />
            <p style={s.modalTitle}>
              {modal.tipo === 'cancelamento' ? '❌ Solicitar Cancelamento' : '📅 Solicitar Reagendamento'}
            </p>
            <p style={s.modalSub}>
              {modal.consulta.medico?.nome} · {modal.consulta.data ? new Date(modal.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
            </p>
            <div style={s.avisoBox}><p style={s.avisoText}>⚠️ Requer aprovação da clínica.</p></div>

            {modal.tipo === 'reagendamento' && (
              <>
                <label style={s.inputLabel}>Nova data (AAAA-MM-DD)</label>
                <input style={s.input} value={novaData} onChange={e => setNovaData(e.target.value)} placeholder="Ex: 2025-06-15" />
                <label style={s.inputLabel}>Novo horário (HH:MM)</label>
                <input style={s.input} value={novaHora} onChange={e => setNovaHora(e.target.value)} placeholder="Ex: 14:30" />
              </>
            )}

            <label style={s.inputLabel}>Motivo (opcional)</label>
            <textarea style={{ ...s.input, height: 80, resize: 'none' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." />

            {erro && <p style={{ color: '#991B1B', fontSize: 13, marginBottom: 8 }}>{erro}</p>}

            <div style={s.modalBtns}>
              <button style={s.modalBtnOut} onClick={() => { setModal(null); setNovaData(''); setNovaHora(''); setMotivo(''); setErro('') }}>
                Voltar
              </button>
              <button style={s.modalBtnPrimary} onClick={handleSolicitar} disabled={saving}>
                {saving ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  header: { position: 'relative', backgroundColor: '#0047AB', paddingTop: 48, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#1a6fdf', top: -60, right: -40, opacity: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  tabs: { display: 'flex', gap: 8 },
  tab: { flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: '12px 12px 0 0', backgroundColor: 'rgba(255,255,255,0.12)', cursor: 'pointer', border: 'none' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' },
  tabTextOn: { color: '#0047AB' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, border: '1px solid #E5E7EB' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardData: { fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 4 },
  cardHora: { fontSize: 13, color: '#0047AB', fontWeight: 600 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  cardMedico: { fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 3 },
  cardTipo: { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  statusTag: { padding: '5px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
  cardBtns: { display: 'flex', gap: 10 },
  btnRe: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 11, textAlign: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0047AB', border: 'none' },
  btnCan: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 11, textAlign: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#991B1B', border: 'none' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 100 },
  modalCard: { backgroundColor: '#fff', borderRadius: '28px 28px 0 0', padding: '16px 28px 28px', width: '100%', maxWidth: 430, margin: '0 auto' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  avisoBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 16 },
  avisoText: { fontSize: 13, color: '#92400E', fontWeight: 500 },
  inputLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, color: '#0D1B2A', marginBottom: 14, outline: 'none', fontFamily: 'inherit' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 8 },
  modalBtnOut: { flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', backgroundColor: '#fff' },
  modalBtnPrimary: { flex: 1, backgroundColor: '#0047AB', borderRadius: 14, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', border: 'none' },
}
