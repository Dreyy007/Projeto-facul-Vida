import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function HomeScreen({ navigation }) {
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [proxima, setProxima] = useState(null)
  const [msgs, setMsgs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchDados() }, [paciente])

  async function fetchDados() {
    if (!paciente) return
    const hoje = new Date().toISOString().split('T')[0]

    const [{ data: cons }, { data: mensagens }] = await Promise.all([
      supabase.from('consultas')
        .select('*, medico:profiles(nome, especialidade)')
        .eq('paciente_id', paciente.id)
        .gte('data', hoje)
        .order('data')
        .order('hora')
        .limit(5),
      supabase.from('mensagens')
        .select('id')
        .eq('paciente_id', paciente.id)
        .eq('remetente', 'clinica')
        .eq('lida', false),
    ])

    setConsultas(cons || [])
    setProxima(cons?.[0] || null)
    setMsgs(mensagens?.length || 0)
    setLoading(false)
    setRefreshing(false)
  }

  function onRefresh() { setRefreshing(true); fetchDados() }

  const statusColor = { confirmada: '#166534', aguardando: '#854D0E', cancelada: '#991B1B', realizada: '#1e40af' }
  const statusBg = { confirmada: '#DCFCE7', aguardando: '#FEF9C3', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
  const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

  const hora = d => d?.slice(0, 5)

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Olá, {paciente?.nome?.split(' ')[0]} 👋</Text>
          <Text style={s.headerSub}>Como você está hoje?</Text>
        </View>
        <TouchableOpacity style={s.chatBtn} onPress={() => navigation.navigate('Chat')}>
          <Text style={s.chatBtnText}>💬</Text>
          {msgs > 0 && <View style={s.badge}><Text style={s.badgeText}>{msgs}</Text></View>}
        </TouchableOpacity>
      </View>

      {/* Próxima consulta */}
      {proxima ? (
        <View style={s.proximaCard}>
          <Text style={s.proximaLabel}>📅 Próxima consulta</Text>
          <Text style={s.proximaData}>{fmtData(proxima.data)} às {hora(proxima.hora)}</Text>
          <Text style={s.proximaMedico}>Dr(a). {proxima.medico?.nome}</Text>
          <Text style={s.proximaTipo}>{proxima.tipo}</Text>
          <View style={[s.statusTag, { backgroundColor: statusBg[proxima.status] || '#F3F4F6' }]}>
            <Text style={[s.statusText, { color: statusColor[proxima.status] || '#374151' }]}>
              {statusLabel[proxima.status] || proxima.status}
            </Text>
          </View>
        </View>
      ) : (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>Nenhuma consulta agendada</Text>
        </View>
      )}

      {/* Cards de ação */}
      <View style={s.actionsGrid}>
        <TouchableOpacity style={[s.actionCard, { backgroundColor: '#EFF6FF' }]} onPress={() => navigation.navigate('Consultas')}>
          <Text style={s.actionIcon}>📋</Text>
          <Text style={s.actionLabel}>Minhas consultas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionCard, { backgroundColor: '#F0FDF4' }]} onPress={() => navigation.navigate('Chat')}>
          <Text style={s.actionIcon}>💬</Text>
          <Text style={s.actionLabel}>Chat clínica</Text>
          {msgs > 0 && <Text style={s.actionBadge}>{msgs} nova(s)</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionCard, { backgroundColor: '#FFF7ED' }]} onPress={() => navigation.navigate('Perfil')}>
          <Text style={s.actionIcon}>👤</Text>
          <Text style={s.actionLabel}>Meu perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Próximas consultas */}
      {consultas.length > 1 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Próximas consultas</Text>
          {consultas.slice(1).map(c => (
            <View key={c.id} style={s.consultaItem}>
              <View style={s.consultaDate}>
                <Text style={s.consultaDay}>{new Date(c.data + 'T12:00:00').getDate()}</Text>
                <Text style={s.consultaMon}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</Text>
              </View>
              <View style={s.consultaInfo}>
                <Text style={s.consultaHora}>{hora(c.hora)}</Text>
                <Text style={s.consultaMed}>Dr(a). {c.medico?.nome}</Text>
                <Text style={s.consultaTipo}>{c.tipo}</Text>
              </View>
              <View style={[s.statusTag, { backgroundColor: statusBg[c.status] || '#F3F4F6' }]}>
                <Text style={[s.statusText, { color: statusColor[c.status] || '#374151', fontSize: 10 }]}>
                  {statusLabel[c.status] || c.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#0047AB', padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  chatBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  chatBtnText: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#E24B4A', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  proximaCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  proximaLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  proximaData: { fontSize: 20, fontWeight: '800', color: '#0047AB', marginBottom: 4 },
  proximaMedico: { fontSize: 15, fontWeight: '600', color: '#0D1B2A', marginBottom: 2 },
  proximaTipo: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  emptyCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  statusTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 50 },
  statusText: { fontSize: 12, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 16 },
  actionCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 26 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  actionBadge: { fontSize: 10, color: '#166534', fontWeight: '700' },
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0D1B2A', marginBottom: 12 },
  consultaItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  consultaDate: { width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  consultaDay: { fontSize: 18, fontWeight: '800', color: '#0047AB', lineHeight: 20 },
  consultaMon: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase' },
  consultaInfo: { flex: 1 },
  consultaHora: { fontSize: 13, fontWeight: '700', color: '#0047AB' },
  consultaMed: { fontSize: 13, color: '#0D1B2A' },
  consultaTipo: { fontSize: 11, color: '#6B7280' },
})
