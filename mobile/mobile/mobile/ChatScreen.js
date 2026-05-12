import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, AppState, Image, Linking } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export default function ChatScreen() {
  const { paciente } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const scrollRef = useRef(null)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    if (!paciente) return
    registrarPushToken()
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
        const nova = payload.new
        setMensagens(prev => [...prev, nova])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
        if (nova.remetente === 'clinica' && appState.current !== 'active') {
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Clínica Vida+',
              body: nova.conteudo || '📎 Anexo',
              sound: true,
            },
            trigger: null,
          })
        }
      })
      .subscribe()

    const sub = AppState.addEventListener('change', next => {
      appState.current = next
      if (next === 'active') marcarLidas()
    })

    return () => {
      supabase.removeChannel(channel)
      sub.remove()
    }
  }, [paciente])

  async function registrarPushToken() {
    if (!Device.isDevice) return
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return
    const { data: token } = await Notifications.getExpoPushTokenAsync()
    if (token) await supabase.from('pacientes').update({ push_token: token }).eq('id', paciente.id)
  }

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

  async function handleEscolherImagem() {
    setShowAnexo(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { alert('Permissão negada.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (result.canceled) return
    await uploadAnexo(result.assets[0].uri, result.assets[0].fileName || 'imagem.jpg', 'image/jpeg')
  }

  async function handleEscolherDoc() {
    setShowAnexo(false)
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
    })
    if (result.canceled) return
    const file = result.assets[0]
    await uploadAnexo(file.uri, file.name, file.mimeType)
  }

  async function uploadAnexo(uri, nome, tipo) {
    setSending(true)
    const ext = nome.split('.').pop()
    const path = `${paciente.id}/${Date.now()}.${ext}`
    const response = await fetch(uri)
    const blob = await response.blob()
    const { error } = await supabase.storage.from('chat-anexos').upload(path, blob, { contentType: tipo })
    if (error) { alert('Erro ao enviar arquivo.'); setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id,
      remetente: 'paciente',
      conteudo: '',
      anexo_url: urlData.publicUrl,
      anexo_tipo: tipo,
      anexo_nome: nome,
      lida: false,
    }])
    setSending(false)
  }

  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  let lastDate = null

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
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
                  {m.anexo_url && m.anexo_tipo?.startsWith('image/') && (
                    <Image source={{ uri: m.anexo_url }} style={s.msgImg} resizeMode="cover" />
                  )}
                  {m.anexo_url && !m.anexo_tipo?.startsWith('image/') && (
                    <TouchableOpacity style={s.docRow} onPress={() => Linking.openURL(m.anexo_url)}>
                      <Text style={s.docIcon}>📄</Text>
                      <Text style={[s.docNome, isMe && { color: '#fff' }]} numberOfLines={2}>
                        {m.anexo_nome}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!!m.conteudo && (
                    <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{m.conteudo}</Text>
                  )}
                  <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>
                    {fmtHora(m.criado_em)}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>

      {showAnexo && (
        <View style={s.anexoMenu}>
          <TouchableOpacity style={s.anexoOpt} onPress={handleEscolherImagem}>
            <Text style={s.anexoIcon}>🖼️</Text>
            <Text style={s.anexoLabel}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.anexoOpt} onPress={handleEscolherDoc}>
            <Text style={s.anexoIcon}>📄</Text>
            <Text style={s.anexoLabel}>Documento / PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.inputBar}>
        <TouchableOpacity
          style={s.clipBtn}
          onPress={() => setShowAnexo(v => !v)}
          disabled={sending}
        >
          <Text style={s.clipIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!texto.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleEnviar}
          disabled={!texto.trim() || sending}
        >
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
  msgImg: { width: 200, height: 160, borderRadius: 10, marginBottom: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  docIcon: { fontSize: 22 },
  docNome: { fontSize: 13, color: '#0D1B2A', flexShrink: 1, fontWeight: '500' },
  anexoMenu: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', padding: 16, gap: 24 },
  anexoOpt: { alignItems: 'center', gap: 4 },
  anexoIcon: { fontSize: 32 },
  anexoLabel: { fontSize: 12, color: '#374151' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10 },
  clipBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clipIcon: { fontSize: 22 },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#0D1B2A', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0047AB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  sendIcon: { color: '#fff', fontSize: 16 },
})
