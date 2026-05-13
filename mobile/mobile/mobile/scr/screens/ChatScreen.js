import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, AppState, Image, Linking, StatusBar } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'

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
    fetchMensagens()
    marcarLidas()

    const channel = supabase.channel('chat-mobile-' + paciente.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `paciente_id=eq.${paciente.id}` }, payload => {
        setMensagens(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      }).subscribe()

    const sub = AppState.addEventListener('change', next => { appState.current = next; if (next === 'active') marcarLidas() })
    return () => { supabase.removeChannel(channel); sub.remove() }
  }, [paciente])

  async function fetchMensagens() {
    if (!paciente) return
    const { data } = await supabase.from('mensagens').select('*').eq('paciente_id', paciente.id).order('criado_em')
    setMensagens(data || [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200)
  }

  async function marcarLidas() {
    if (!paciente) return
    await supabase.from('mensagens').update({ lida: true }).eq('paciente_id', paciente.id).eq('remetente', 'clinica')
  }

  async function handleEnviar() {
    if (!texto.trim() || !paciente) return
    setSending(true)
    await supabase.from('mensagens').insert([{ paciente_id: paciente.id, remetente: 'paciente', conteudo: texto.trim(), lida: false }])
    setTexto('')
    setSending(false)
  }

  async function handleEscolherImagem() {
    setShowAnexo(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { alert('Permissão negada.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (result.canceled) return
    await uploadAnexo(result.assets[0].uri, result.assets[0].fileName || 'imagem.jpg', 'image/jpeg')
  }

  async function handleEscolherDoc() {
    setShowAnexo(false)
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] })
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
    if (error) { alert('Erro ao enviar.'); setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{ paciente_id: paciente.id, remetente: 'paciente', conteudo: '', anexo_url: urlData.publicUrl, anexo_tipo: tipo, anexo_nome: nome, lida: false }])
    setSending(false)
  }

  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  let lastDate = null

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0047AB" />

      <View style={s.header}>
        <View style={s.headerCircle} />
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>V+</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerNome}>Clínica Vida+</Text>
          <Text style={s.headerStatus}>● Online</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
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
                {showDate && <View style={s.dateRow}><Text style={s.dateText}>{msgDate}</Text></View>}
                <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
                  <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                    {m.anexo_url && m.anexo_tipo?.startsWith('image/') && (
                      <Image source={{ uri: m.anexo_url }} style={s.msgImg} resizeMode="cover" />
                    )}
                    {m.anexo_url && !m.anexo_tipo?.startsWith('image/') && (
                      <TouchableOpacity style={s.docRow} onPress={() => Linking.openURL(m.anexo_url)}>
                        <Text style={s.docIcon}>📄</Text>
                        <Text style={[s.docNome, isMe && { color: '#fff' }]} numberOfLines={2}>{m.anexo_nome}</Text>
                      </TouchableOpacity>
                    )}
                    {!!m.conteudo && <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{m.conteudo}</Text>}
                    <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{fmtHora(m.criado_em)}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </ScrollView>

        {showAnexo && (
          <View style={s.anexoMenu}>
            <TouchableOpacity style={s.anexoOpt} onPress={handleEscolherImagem}>
              <View style={s.anexoIconBox}><Text style={{ fontSize: 26 }}>🖼️</Text></View>
              <Text style={s.anexoLabel}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.anexoOpt} onPress={handleEscolherDoc}>
              <View style={s.anexoIconBox}><Text style={{ fontSize: 26 }}>📄</Text></View>
              <Text style={s.anexoLabel}>Documento</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.inputBar}>
          <TouchableOpacity style={s.clipBtn} onPress={() => setShowAnexo(v => !v)} disabled={sending}>
            <Text style={{ fontSize: 22 }}>📎</Text>
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
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  header: { backgroundColor: '#0047AB', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#1a6fdf', top: -60, right: -30, opacity: 0.5 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  headerAvatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  headerInfo: { flex: 1 },
  headerNome: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerStatus: { fontSize: 11, color: '#93C5FD' },
  messages: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  dateRow: { alignItems: 'center', marginVertical: 12 },
  dateText: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 50 },
  msgRow: { marginBottom: 8 },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowThem: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 13 },
  bubbleMe: { backgroundColor: '#0047AB', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  bubbleText: { fontSize: 14, color: '#0D1B2A', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 5, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },
  msgImg: { width: 200, height: 160, borderRadius: 10, marginBottom: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  docIcon: { fontSize: 22 },
  docNome: { fontSize: 13, color: '#0D1B2A', flexShrink: 1, fontWeight: '500' },
  anexoMenu: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', padding: 16, gap: 24 },
  anexoOpt: { alignItems: 'center', gap: 6 },
  anexoIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  anexoLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10 },
  clipBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#0D1B2A', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0047AB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  sendIcon: { color: '#fff', fontSize: 16 },
})