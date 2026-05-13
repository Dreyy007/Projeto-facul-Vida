import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
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
    { label: 'E-mail', value: paciente?.email, icon: '✉️' },
    { label: 'CPF', value: paciente?.cpf || 'Não informado', icon: '🪪' },
    { label: 'Telefone', value: paciente?.telefone || 'Não informado', icon: '📱' },
    { label: 'Data de nascimento', value: paciente?.data_nascimento ? new Date(paciente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado', icon: '🎂' },
    { label: 'Convênio', value: paciente?.convenio || 'Não informado', icon: '🏥' },
    { label: 'Nº do convênio', value: paciente?.numero_convenio || 'Não informado', icon: '🔢' },
  ]

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0047AB', '#1a6fdf']} style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{paciente?.nome?.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={s.nome}>{paciente?.nome}</Text>
        <View style={s.statusTag}>
          <Text style={s.statusText}>{paciente?.ativo ? '✓ Paciente ativo' : 'Inativo'}</Text>
        </View>
      </LinearGradient>

      <View style={s.body}>
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>MEUS DADOS</Text>
          <TouchableOpacity style={s.editBtn}>
            <Text style={s.editBtnText}>✏️ Editar</Text>
          </TouchableOpacity>
          {info.map((item, i) => (
            <View key={item.label} style={[s.row, i < info.length - 1 && s.rowBorder]}>
              <Text style={s.rowIcon}>{item.icon}</Text>
              <View style={s.rowContent}>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.menuItem} onPress={() => navigation.navigate('Chat')}>
          <View style={[s.menuIcon, { backgroundColor: '#F0FDF4' }]}><Text>💬</Text></View>
          <Text style={s.menuLabel}>Falar com a clínica</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>

        <View style={s.avisoCard}>
          <Text style={s.avisoText}>Para atualizar seus dados, entre em contato com a recepção da clínica.</Text>
        </View>

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
  header: { paddingTop: 56, paddingBottom: 36, alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10 },
  statusTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 50 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: 16 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, padding: 16, paddingBottom: 0 },
  editBtn: { position: 'absolute', top: 12, right: 16 },
  editBtnText: { fontSize: 13, color: '#0047AB', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rowIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  rowValue: { fontSize: 14, color: '#0D1B2A', fontWeight: '500' },
  menuItem: { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  menuArrow: { fontSize: 22, color: '#9CA3AF' },
  avisoCard: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 12 },
  avisoText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#991B1B' },
})