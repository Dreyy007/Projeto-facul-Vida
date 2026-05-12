import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, RefreshControl } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ConsultasScreen() {
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(null) // { consulta, tipo }
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('futuras')

  useEffect(() => { fetchConsultas() }, [paciente])

  async function fetchConsultas() {
    if (!paciente) return
    const { data } = await supabase
      .from('consultas')
      .select('*, medico:profiles(nome, especialidade)')
      .eq('paciente_id', paciente.id)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
    setConsultas(data || [])
    setLoading(false)
    setRefreshing(false)
  }

  async function handleSolicitar() {
    if (!modal) return
    setSaving(true)
    const { tipo, consulta } = modal

    if (tipo === 'reagendamento' && (!novaData || !novaHora)) {
      Alert.alert('Atenção', 'Informe a nova data e horário.')
      setSaving(false)
      return
    }

    await supabase.from('solicitacoes').insert([{
      consulta_id: consulta.id,
      tipo,
      nova_data: novaData || null,
      nova_hora: novaHora || null,
      motivo: motivo || null,
    }])

    await supabase.from('consultas').update({
      status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente'
    }).eq('id', consulta.id)

    setModal(null)
    setNovaData('')
    setNovaHora('')
    setMotivo('')
    fetchConsultas()
    Alert.alert('✅ Solicitação enviada!', 'Aguarde a aprovação da clínica.')
    setSaving(false)
  }

  const hoje = new Date().toISOString().split('T')[0]
  const futuras = consultas.filter(c => c.data >= hoje && !['cancelada', 'realizada'].includes(c.status))
  const passadas = consultas.filter(c => c.data < hoje || ['cancelada', 'realizada'].includes(c.status))
  const lista = filtro === 'futuras' ? futuras : passadas

  const statusColor = { confirmada: '#166534', aguardando: '#854D0E', cancelada: '#991B1B', realizada: '#1e40af', cancelamento_pendente: '#991B1B', reagendamento_pendente: '#854D0E' }
  const statusBg = { confirmada: '#DCFCE7', aguardando: '#FEF9C3', cancelada: '#FEE2E2', realizada: '#DBEAFE', cancelamento_pendente: '#FEE2E2', reagendamento_pendente: '#FEF9C3' }
  const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancelamento pend.', reagendamento_pendente: 'Reagend. pend.' }
  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  return (
    <View style={s.container}>
      {/* Filtro */}
      <View style={s.filtroBar}>
        {['futuras', 'passadas'].map(f => (
          <TouchableOpacity key={f} style={[s.filtroBtn, filtro === f && s.filtroBtnOn]} onPress={() => setFiltro(f)}>
            <Text style={[s.filtroBtnText, filtro === f && s.filtroBtnTextOn]}>
              {f === 'futuras' ? `Próximas (${futuras.length})` : `Histórico (${passadas.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConsultas() }} />}>
        {lista.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyText}>Nenhuma consulta aqui.</Text>
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
                <Text style={[s.statusText, { color: statusColor[c.status] || '#374151' }]}>
                  {statusLabel[c.status] || c.status}
                </Text>
              </View>
            </View>
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
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal solicitação */}
      <Modal visible={!!modal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {modal?.tipo === 'cancelamento' ? '❌ Solicitar Cancelamento' : '📅 Solicitar Reagendamento'}
            </Text>
            <Text style={s.modalSub}>
              {modal?.consulta?.medico?.nome} · {modal?.consulta?.data ? new Date(modal.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
            </Text>
            <View style={s.avisoBox}>
              <Text style={s.avisoText}>⚠️ Requer aprovação da clínica.</Text>
            </View>

            {modal?.tipo === 'reagendamento' && (
              <>
                <Text style={s.inputLabel}>Nova data (DD/MM/AAAA)</Text>
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
                <Text style={s.modalBtnPrimaryText}>{saving ? 'Enviando...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  filtroBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filtroBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#F3F4F6' },
  filtroBtnOn: { backgroundColor: '#0047AB' },
  filtroBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filtroBtnTextOn: { color: '#fff' },
  list: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardData: { fontSize: 14, fontWeight: '700', color: '#0D1B2A' },
  cardHora: { fontSize: 13, color: '#0047AB', fontWeight: '600', marginTop: 2 },
  cardMedico: { fontSize: 15, fontWeight: '600', color: '#0D1B2A', marginBottom: 2 },
  cardTipo: { fontSize: 12, color: '#6B7280', marginBottom: 14 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBtns: { flexDirection: 'row', gap: 10 },
  btnRe: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  btnReText: { color: '#0047AB', fontSize: 13, fontWeight: '600' },
  btnCan: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, alignItems: 'center' },
  btnCanText: { color: '#991B1B', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0D1B2A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  avisoBox: { backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, marginBottom: 16 },
  avisoText: { fontSize: 13, color: '#854D0E', fontWeight: '500' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#0D1B2A', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnOut: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnOutText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnPrimary: { flex: 1, backgroundColor: '#0047AB', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
