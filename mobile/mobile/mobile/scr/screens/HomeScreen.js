import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function HomeScreen({ navigation }) {
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [proxima, setProxima] = useState(null)
  const [msgs, setMsgs] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchDados() }, [paciente])

  async function fetchDados() {
    if (!paciente) return
    const hoje = new Date().toISOString().split('T')[0]
    const [{ data: cons }, { data: mensagens }] = await Promise.all([
      supabase.from('consultas').select('*, medico:profiles(nome, especialidade)').eq('paciente_id', paciente.id).gte('data', hoje).order('data').order('hora').limit(5),
      supabase.from('mensagens').select('id').eq('paciente_id', paciente.id).eq('remetente', 'clinica').eq('lida', false),
    ])
    setConsultas(cons || [])
    setProxima(cons?.[0] || null)
    setMsgs(mensagens?.length || 0)
    setRefreshing(false)
  }

  const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }
  const statusBg = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
  const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }
  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const hora = d => d?.slice(0, 5)

  const saudacao = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDados() }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header branco */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{saudacao()} 👋</Text>
            <Text style={s.nome}>{paciente?.nome?.split(' ')[0]}</Text>
          </View>
          <TouchableOpacity style={s.chatBtn} onPress={() => navigation.navigate('Chat')}>
            <Text style={s.chatBtnIcon}>🔔</Text>
            {msgs > 0 && <View style={s.badge}><Text style={s.badgeText}>{msgs}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Card azul próxima consulta */}
        {proxima ? (
          <View style={s.proximaCard}>
            <View style={s.proximaCircle} />
            <Text style={s.proximaLabel}>● PRÓXIMA CONSULTA</Text>
            <Text style={s.proximaData}>{fmtData(proxima.data)}</Text>
            <Text style={s.proximaHora}>⏰ {hora(proxima.hora)} · Dr(a). {proxima.medico?.nome}</Text>
            <View style={s.proximaRow}>
              <Text style={s.proximaTipo}>{proxima.tipo}</Text>
              <View style={[s.statusTagDark, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={s.statusTagDarkText}>{statusLabel[proxima.status] || proxima.status}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.semConsultaCard}>
            <Text style={s.semConsultaEmoji}>📭</Text>
            <Text style={s.semConsultaText}>Nenhuma consulta agendada</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Consultas')}>
              <Text style={s.semConsultaLink}>Agendar →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Título ações */}
        <View style={s.acoesHeader}>
          <Text style={s.acoesTitle}>Ações rápidas</Text>
        </View>

        {/* Grid 2x2 com borda */}
        <View style={s.grid}>
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Consultas')}>
            <View style={[s.gridIcon, { backgroundColor: '#EFF6FF' }]}><Text style={s.gridEmoji}>📋</Text></View>
            <Text style={s.gridLabel}>Consultas</Text>
            <Text style={s.gridSub}>Ver histórico</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Chat')}>
            <View style={[s.gridIcon, { backgroundColor: '#F0FDF4' }]}><Text style={s.gridEmoji}>💬</Text></View>
            <Text style={s.gridLabel}>Chat</Text>
            <Text style={s.gridSub}>Fale conosco</Text>
            {msgs > 0 && <View style={s.gridBadge}><Text style={s.gridBadgeText}>{msgs}</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Consultas')}>
            <View style={[s.gridIcon, { backgroundColor: '#FFF7ED' }]}><Text style={s.gridEmoji}>➕</Text></View>
            <Text style={s.gridLabel}>Agendar</Text>
            <Text style={s.gridSub}>Nova consulta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Perfil')}>
            <View style={[s.gridIcon, { backgroundColor: '#FAF5FF' }]}><Text style={s.gridEmoji}>📄</Text></View>
            <Text style={s.gridLabel}>Resultados</Text>
            <Text style={s.gridSub}>Meus exames</Text>
          </TouchableOpacity>
        </View>

        {/* Próximas consultas */}
        {consultas.length > 1 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Próximas consultas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Consultas')}>
                <Text style={s.sectionLink}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {consultas.slice(1).map(c => (
              <View key={c.id} style={s.consultaItem}>
                <View style={s.consultaDate}>
                  <Text style={s.consultaDay}>{new Date(c.data + 'T12:00:00').getDate()}</Text>
                  <Text style={s.consultaMon}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</Text>
                </View>
                <View style={s.consultaInfo}>
                  <Text style={s.consultaHora}>{hora(c.hora)}</Text>
                  <Text style={s.consultaMed}>Dr(a). {c.medico?.nome}</Text>
                  <Text style={s.consultaTipo}>{c.tipo}</Text>
                </View>
                <View style={[s.statusTag, { backgroundColor: statusBg[c.status] || '#F3F4F6' }]}>
                  <Text style={[s.statusText, { color: statusColor[c.status] || '#374151' }]}>{statusLabel[c.status] || c.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, backgroundColor: '#fff' },
  greeting: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nome: { fontSize: 26, fontWeight: '800', color: '#0D1B2A', marginTop: 2 },
  chatBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  chatBtnIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  proximaCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: '#0047AB', borderRadius: 22, padding: 22, overflow: 'hidden' },
  proximaCircle: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#1a6fdf', top: -30, right: -30, opacity: 0.5 },
  proximaLabel: { fontSize: 10, fontWeight: '800', color: '#93C5FD', letterSpacing: 1, marginBottom: 8 },
  proximaData: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 6 },
  proximaHora: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  proximaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proximaTipo: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statusTagDark: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50 },
  statusTagDarkText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  semConsultaCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: '#F8FAFC', borderRadius: 22, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  semConsultaEmoji: { fontSize: 36, marginBottom: 10 },
  semConsultaText: { fontSize: 14, color: '#6B7280', marginBottom: 10 },
  semConsultaLink: { fontSize: 14, color: '#0047AB', fontWeight: '700' },

  acoesHeader: { paddingHorizontal: 20, marginBottom: 12 },
  acoesTitle: { fontSize: 17, fontWeight: '800', color: '#0D1B2A' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 28 },
  gridCard: { width: '47%', backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E5E7EB' },
  gridIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridEmoji: { fontSize: 22 },
  gridLabel: { fontSize: 14, fontWeight: '700', color: '#0D1B2A', marginBottom: 3 },
  gridSub: { fontSize: 11, color: '#9CA3AF' },
  gridBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  gridBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  section: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0D1B2A' },
  sectionLink: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  consultaItem: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  consultaDate: { width: 48, height: 48, backgroundColor: '#EFF6FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  consultaDay: { fontSize: 20, fontWeight: '800', color: '#0047AB', lineHeight: 22 },
  consultaMon: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' },
  consultaInfo: { flex: 1 },
  consultaHora: { fontSize: 13, fontWeight: '700', color: '#0047AB' },
  consultaMed: { fontSize: 13, color: '#0D1B2A', fontWeight: '500' },
  consultaTipo: { fontSize: 11, color: '#9CA3AF' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  statusText: { fontSize: 10, fontWeight: '700' },
})
