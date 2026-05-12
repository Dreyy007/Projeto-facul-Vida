import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export default function PerfilScreen() {
  const { paciente, signOut } = useAuth()

  function handleLogout() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ])
  }

  const idade = paciente?.data_nascimento
    ? Math.floor((new Date() - new Date(paciente.data_nascimento)) / (365.25 * 24 * 3600 * 1000))
    : null

  const info = [
    { label: 'E-mail', value: paciente?.email },
    { label: 'CPF', value: paciente?.cpf || 'Não informado' },
    { label: 'Telefone', value: paciente?.telefone || 'Não informado' },
    { label: 'Data de nascimento', value: paciente?.data_nascimento ? new Date(paciente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado' },
    { label: 'Convênio', value: paciente?.convenio || 'Não informado' },
    { label: 'Nº do convênio', value: paciente?.numero_convenio || 'Não informado' },
  ]

  return (
    <ScrollView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{paciente?.nome?.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={s.nome}>{paciente?.nome}</Text>
        {idade && <Text style={s.idade}>{idade} anos</Text>}
        <View style={s.statusTag}>
          <Text style={s.statusText}>{paciente?.ativo ? '✓ Paciente ativo' : 'Inativo'}</Text>
        </View>
      </View>

      {/* Dados */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Meus dados</Text>
        <View style={s.card}>
          {info.map((item, i) => (
            <View key={item.label} style={[s.row, i < info.length - 1 && s.rowBorder]}>
              <Text style={s.rowLabel}>{item.label}</Text>
              <Text style={s.rowValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Aviso */}
      <View style={s.avisoCard}>
        <Text style={s.avisoText}>
          Para atualizar seus dados, entre em contato com a recepção da clínica.
        </Text>
      </View>

      {/* Sair */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>🚪 Sair da conta</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  header: { backgroundColor: '#0047AB', padding: 32, alignItems: 'center', paddingTop: 48 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  idade: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  statusTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { margin: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0D1B2A', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 },
  rowValue: { fontSize: 14, color: '#0D1B2A', fontWeight: '500' },
  avisoCard: { marginHorizontal: 16, backgroundColor: '#FEF9C3', borderRadius: 12, padding: 14, marginBottom: 16 },
  avisoText: { fontSize: 13, color: '#854D0E', lineHeight: 18 },
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#991B1B' },
})
