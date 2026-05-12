import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.')
      return
    }
    setLoading(true)
    const { error } = await signIn(email, senha)
    if (error) {
      Alert.alert('Erro', 'E-mail ou senha inválidos.')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.top}>
        <View style={s.logoCircle}>
          <Text style={s.logoText}>V+</Text>
        </View>
        <Text style={s.brand}>Clínica Vida+</Text>
        <Text style={s.sub}>Portal do Paciente</Text>
      </View>

      <View style={s.card}>
        <Text style={s.title}>Bem-vindo!</Text>
        <Text style={s.desc}>Acesse sua conta para ver suas consultas</Text>

        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={s.label}>Senha</Text>
        <TextInput
          style={s.input}
          value={senha}
          onChangeText={setSenha}
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Entrar</Text>
          }
        </TouchableOpacity>

        <Text style={s.info}>
          Não tem conta? Entre em contato com a clínica.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0047AB', justifyContent: 'center', padding: 24 },
  top: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  brand: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28 },
  title: { fontSize: 22, fontWeight: '700', color: '#0D1B2A', marginBottom: 6 },
  desc: { fontSize: 13, color: '#6B7280', marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#0D1B2A', marginBottom: 16 },
  btn: { backgroundColor: '#0047AB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  info: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 16 },
})
