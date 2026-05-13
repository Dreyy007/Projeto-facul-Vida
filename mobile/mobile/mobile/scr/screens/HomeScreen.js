import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
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
      <StatusBar barStyle="light-content" />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDados() }} tintColor="#fff" />} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#0047AB', '#1a6fdf']} style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.greeting}>{saudacao()} 👋</Text>
              <Text style={s.nome}>{paciente?.nome?.split(' ')[0]}</Text>
            </View>
            <TouchableOpacity style={s.chatBtn} onPress={() => navigation.navigate('Chat')}>
              <Text style={s.chatBtnIcon}>💬</Text>
              {msgs > 0 && <View style={s.badge}><Text style={s.badgeText}>{msgs}</Text></View>}
            </TouchableOpacity>
          </View>

          {/* Próxima consulta dentro do header */}
          {proxima ? (
            <View style={s.proximaCard}>
              <Text style={s.proximaLabel}>● PRÓXIMA CONSULTA</Text>
              <Text style={s.proximaData}>{fmtData(proxima.data)}</Text>
              <Text style={s.proximaHora}>⏰ {hora(proxima.hora)} · Dr(a). {proxima.medico?.nome}</Text>
              <View style={s.proximaRow}>
                <Text style={s.proximaTipo}>{proxima.tipo}</Text>
                <View style={[s.statusTag, { backgroundColor: statusBg[proxima.status] || '#F3F4F6' }]}>
                  <Text style={[s.statusText, { color: statusColor[proxima.status] || '#374151' }]}>{statusLabel[proxima.status] || proxima.status}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.semConsultaCard}>
              <Text style={s.semConsultaText}>Nenhuma consulta agendada</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Consultas')}>
                <Text style={s.semConsultaLink}>Agendar →</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Cards de ação */}
        <View style={s.acoes}>
          <TouchableOpacity style={s.acaoCard} onPress={() => navigation.navigate('Consultas')}>
            <View style={[s.acaoIcon, { backgroundColor: '#EFF6FF' }]}><Text style={s.acaoEmoji}>📋</Text></View>
            <Text style={s.acaoLabel}>Consultas</Text>
            <Text style={s.acaoSub}>Ver histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acaoCard} onPress={() => navigation.navigate('Chat')}>
            <View style={[s.acaoIcon, { backgroundColor: '#F0FDF4' }]}><Text style={s.acaoEmoji}>💬</Text></View>
            <Text style={s.acaoLabel}>Chat</Text>
            <Text style={s.acaoSub}>Fale conosco</Text>
            {msgs > 0 && <View style={s.acaoBadge}><Text style={s.acaoBadgeText}>{msgs}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={s.acaoCard} onPress={() => navigation.navigate('Consultas')}>
            <View style={[s.acaoIcon, { backgroundColor: '#FFF7ED' }]}><Text style={s.acaoEmoji}>➕</Text></View>
            <Text style={s.acaoLabel}>Agendar</Text>
            <Text style={s.acaoSub}>Nova consulta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acaoCard} onPress={() => navigation.navigate('Perfil')}>
            <View style={[s.acaoIcon, { backgroundColor: '#FAF5FF' }]}><Text style={s.acaoEmoji}>📄</Text></View>
            <Text style={s.acaoLabel}>Resultados</Text>
            <Text style={s.acaoSub}>Meus exames</Text>
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
                  <Text style={[s.statusText, { color: statusColor[c.status] || '#374151', fontSize: 10 }]}>{statusLabel[c.status] || c.status}</Text>
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
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  nome: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  chatBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  chatBtnIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0047AB' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  proximaCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, padding: 18 },
  proximaLabel: { fontSize: 10, fontWeight: '800', color: '#93C5FD', letterSpacing: 1, marginBottom: 6 },
  proximaData: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  proximaHora: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  proximaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proximaTipo: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  semConsultaCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  semConsultaText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  semConsultaLink: { fontSize: 14, color: '#93C5FD', fontWeight: '700' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  statusText: { fontSize: 11, fontWeight: '700' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  acaoCard: { width: '47%', backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  acaoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  acaoEmoji: { fontSize: 22 },
  acaoLabel: { fontSize: 14, fontWeight: '700', color: '#0D1B2A', marginBottom: 2 },
  acaoSub: { fontSize: 11, color: '#9CA3AF' },
  acaoBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  acaoBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  section: { paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0D1B2A' },
  sectionLink: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  consultaItem: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  consultaDate: { width: 48, height: 48, backgroundColor: '#EFF6FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  consultaDay: { fontSize: 20, fontWeight: '800', color: '#0047AB', lineHeight: 22 },
  consultaMon: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' },
  consultaInfo: { flex: 1 },
  consultaHora: { fontSize: 13, fontWeight: '700', color: '#0047AB' },
  consultaMed: { fontSize: 13, color: '#0D1B2A', fontWeight: '500' },
  consultaTipo: { fontSize: 11, color: '#9CA3AF' },
})
