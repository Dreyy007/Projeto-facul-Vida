import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, StatusBar } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export default function PerfilScreen({ navigation }) {
  const { paciente, signOut } = useAuth()

  function handleLogout() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ])
  }

  const info = [
    { label: 'E-mail', value: paciente?.email },
    { label: 'CPF', value: paciente?.cpf || 'Não informado' },
    { label: 'Telefone', value: paciente?.telefone || 'Não informado' },
    { label: 'Data de nascimento', value: paciente?.data_nascimento ? new Date(paciente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado' },
    { label: 'Convênio', value: paciente?.convenio || 'Não informado' },
    { label: 'Nº do convênio', value: paciente?.numero_convenio || 'Não informado' },
  ]

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0047AB" />

      {/* Header azul */}
      <View style={s.header}>
        <View style={s.headerCircle} />
        <View style={s.avatar}>
          <Text style={s.avatarText}>{paciente?.nome?.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={s.nome}>{paciente?.nome}</Text>
        <View style={s.statusTag}>
          <Text style={s.statusText}>{paciente?.ativo ? '✓ Paciente ativo' : 'Inativo'}</Text>
        </View>
      </View>

      <View style={s.body}>
        {/* Card de dados */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>MEUS DADOS</Text>
            <TouchableOpacity>
              <Text style={s.editBtn}>✏️ Editar</Text>
            </TouchableOpacity>
          </View>
          {info.map((item, i) => (
            <View key={item.label} style={[s.row, i < info.length - 1 && s.rowBorder]}>
              <Text style={s.rowLabel}>{item.label}</Text>
              <Text style={s.rowValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Falar com clínica */}
        <TouchableOpacity style={s.menuItem} onPress={() => navigation.navigate('Chat')}>
          <View style={s.menuIcon}><Text style={{ fontSize: 18 }}>💬</Text></View>
          <Text style={s.menuLabel}>Falar com a clínica</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>

        {/* Aviso */}
        <View style={s.avisoCard}>
          <Text style={s.avisoText}>Para atualizar seus dados, entre em contato com a recepção da clínica.</Text>
        </View>

        {/* Sair */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#0047AB', paddingTop: 56, paddingBottom: 36, alignItems: 'center', overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#1a6fdf', top: -60, right: -40, opacity: 0.5 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10 },
  statusTag: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 50 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  editBtn: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  row: { paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 3 },
  rowValue: { fontSize: 14, color: '#0D1B2A', fontWeight: '500' },
  menuItem: { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  menuArrow: { fontSize: 22, color: '#9CA3AF' },
  avisoCard: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 12 },
  avisoText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#991B1B' },
})