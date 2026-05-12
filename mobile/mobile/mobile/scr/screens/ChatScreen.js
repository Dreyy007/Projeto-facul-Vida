import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ChatScreen() {
  const { paciente } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!paciente) return
    fetchMensagens()
    marcarLidas()

    const channel = supabase
      .channel('chat-mobile-' + paciente.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `paciente_id=eq.${paciente.id}`
      }, payload => {
        setMensagens(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [paciente])

  async function fetchMensagens() {
    if (!paciente) return
    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('criado_em')
    setMensagens(data || [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200)
  }

  async function marcarLidas() {
    if (!paciente) return
    await supabase.from('mensagens')
      .update({ lida: true })
      .eq('paciente_id', paciente.id)
      .eq('remetente', 'clinica')
  }

  async function handleEnviar() {
    if (!texto.trim() || !paciente) return
    setSending(true)
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id,
      remetente: 'paciente',
      conteudo: texto.trim(),
      lida: false,
    }])
    setTexto('')
    setSending(false)
  }

  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  let lastDate = null

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {mensagens.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyText}>Nenhuma mensagem ainda.</Text>
            <Text style={s.emptySub}>Envie uma mensagem para a clínica!</Text>
          </View>
        )}

        {mensagens.map(m => {
          const msgDate = fmtData(m.criado_em)
          const showDate = msgDate !== lastDate
          lastDate = msgDate
          const isMe = m.remetente === 'paciente'

          return (
            <View key={m.id}>
              {showDate && (
                <View style={s.dateRow}>
                  <Text style={s.dateText}>{msgDate}</Text>
                </View>
              )}
              <View style={[s.msgRow, isMe && s.msgRowMe]}>
                {!isMe && (
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>V+</Text>
                  </View>
                )}
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                  <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{m.conteudo}</Text>
                  <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{fmtHora(m.criado_em)}</Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={[s.sendBtn, !texto.trim() && s.sendBtnDisabled]} onPress={handleEnviar} disabled={!texto.trim() || sending}>
          <Text style={s.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  messages: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  dateRow: { alignItems: 'center', marginVertical: 12 },
  dateText: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 50 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0047AB', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleMe: { backgroundColor: '#0047AB', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  bubbleText: { fontSize: 14, color: '#0D1B2A', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10 },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#0D1B2A', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0047AB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  sendIcon: { color: '#fff', fontSize: 16 },
})
