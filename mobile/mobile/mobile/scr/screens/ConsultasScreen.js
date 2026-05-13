import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, RefreshControl, StatusBar } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ConsultasScreen() {
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(null)
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('futuras')

  useEffect(() => { fetchConsultas() }, [paciente])

  async function fetchConsultas() {
    if (!paciente) return
    const { data } = await supabase.from('consultas').select('*, medico:profiles(nome, especialidade)').eq('paciente_id', paciente.id).order('data', { ascending: false }).order('hora', { ascending: false })
    setConsultas(data || [])
    setRefreshing(false)
  }

  async function handleSolicitar() {
    if (!modal) return
    setSaving(true)
    const { tipo, consulta } = modal
    if (tipo === 'reagendamento' && (!novaData || !novaHora)) { Alert.alert('Atenção', 'Informe a nova data e horário.'); setSaving(false); return }
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo, nova_data: novaData || null, nova_hora: novaHora || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' }).eq('id', consulta.id)
    setModal(null); setNovaData(''); setNovaHora(''); setMotivo('')
    fetchConsultas()
    Alert.alert('✅ Solicitação enviada!', 'Aguarde a aprovação da clínica.')
    setSaving(false)
  }

  const hoje = new Date().toISOString().split('T')[0]
  const futuras = consultas.filter(c => c.data >= hoje && !['cancelada', 'realizada'].includes(c.status))
  const passadas = consultas.filter(c => c.data < hoje || ['cancelada', 'realizada'].includes(c.status))
  const lista = filtro === 'futuras' ? futuras : passadas

  const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af', cancelamento_pendente: '#991B1B', reagendamento_pendente: '#92400E' }
  const statusBg = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE', cancelamento_pendente: '#FEE2E2', reagendamento_pendente: '#FEF3C7' }
  const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancelamento pend.', reagendamento_pendente: 'Reagend. pend.' }
  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0047AB" />

      {/* Header azul */}
      <View style={s.header}>
        <View style={s.headerCircle} />
        <Text style={s.headerTitle}>Minhas Consultas</Text>
        <Text style={s.headerSub}>{futuras.length} consulta(s)</Text>
        <View style={s.tabs}>
          {['futuras', 'passadas'].map(f => (
            <TouchableOpacity key={f} style={[s.tab, filtro === f && s.tabOn]} onPress={() => setFiltro(f)}>
              <Text style={[s.tabText, filtro === f && s.tabTextOn]}>
                {f === 'futuras' ? `Próximas (${futuras.length})` : `Histórico (${passadas.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConsultas() }} tintColor="#0047AB" />}>
        {lista.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>Nenhuma consulta aqui</Text>
            <Text style={s.emptyText}>Seu histórico aparecerá aqui.</Text>
          </View>
        )}
        {lista.map(c => (
          <View key={c.id} style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.cardData}>{fmtData(c.data)}</Text>
                <Text style={s.cardHora}>⏰ {c.hora?.slice(0, 5)}</Text>
              </View>
              <View style={[s.statusTag, { backgroundColor: statusBg[c.status] || '#F3F4F6' }]}>
                <Text style={[s.statusText, { color: statusColor[c.status] || '#374151' }]}>{statusLabel[c.status] || c.status}</Text>
              </View>
            </View>
            <View style={s.divider} />
            <Text style={s.cardMedico}>Dr(a). {c.medico?.nome}</Text>
            <Text style={s.cardTipo}>{c.tipo}</Text>
            {!['cancelada', 'realizada', 'cancelamento_pendente'].includes(c.status) && (
              <View style={s.cardBtns}>
                <TouchableOpacity style={s.btnRe} onPress={() => setModal({ consulta: c, tipo: 'reagendamento' })}>
                  <Text style={s.btnReText}>📅 Reagendar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnCan} onPress={() => setModal({ consulta: c, tipo: 'cancelamento' })}>
                  <Text style={s.btnCanText}>✕ Cancelar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={!!modal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{modal?.tipo === 'cancelamento' ? '❌ Solicitar Cancelamento' : '📅 Solicitar Reagendamento'}</Text>
            <Text style={s.modalSub}>{modal?.consulta?.medico?.nome} · {modal?.consulta?.data ? new Date(modal.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</Text>
            <View style={s.avisoBox}><Text style={s.avisoText}>⚠️ Requer aprovação da clínica.</Text></View>
            {modal?.tipo === 'reagendamento' && (
              <>
                <Text style={s.inputLabel}>Nova data (AAAA-MM-DD)</Text>
                <TextInput style={s.input} value={novaData} onChangeText={setNovaData} placeholder="Ex: 2025-06-15" placeholderTextColor="#9CA3AF" />
                <Text style={s.inputLabel}>Novo horário (HH:MM)</Text>
                <TextInput style={s.input} value={novaHora} onChangeText={setNovaHora} placeholder="Ex: 14:30" placeholderTextColor="#9CA3AF" />
              </>
            )}
            <Text style={s.inputLabel}>Motivo (opcional)</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={motivo} onChangeText={setMotivo} placeholder="Descreva o motivo..." placeholderTextColor="#9CA3AF" multiline />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnOut} onPress={() => { setModal(null); setNovaData(''); setNovaHora(''); setMotivo('') }}>
                <Text style={s.modalBtnOutText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnPrimary} onPress={handleSolicitar} disabled={saving}>
                <Text style={s.modalBtnPrimaryText}>{saving ? 'Enviando...' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0047AB', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 0, overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#1a6fdf', top: -60, right: -40, opacity: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextOn: { color: '#0047AB' },
  list: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0D1B2A', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardData: { fontSize: 14, fontWeight: '700', color: '#0D1B2A', marginBottom: 4 },
  cardHora: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  cardMedico: { fontSize: 15, fontWeight: '700', color: '#0D1B2A', marginBottom: 3 },
  cardTipo: { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBtns: { flexDirection: 'row', gap: 10 },
  btnRe: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 11, alignItems: 'center' },
  btnReText: { color: '#0047AB', fontSize: 13, fontWeight: '600' },
  btnCan: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 11, alignItems: 'center' },
  btnCanText: { color: '#991B1B', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingTop: 16 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B2A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  avisoBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 16 },
  avisoText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, color: '#0D1B2A', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnOut: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, alignItems: 'center' },
  modalBtnOutText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnPrimary: { flex: 1, backgroundColor: '#0047AB', borderRadius: 14, padding: 14, alignItems: 'center' },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
