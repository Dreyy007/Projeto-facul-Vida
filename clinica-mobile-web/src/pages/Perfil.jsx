import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Perfil() {
  const navigate = useNavigate()
  const { paciente, signOut } = useAuth()

  function handleLogout() {
    if (window.confirm('Deseja sair da sua conta?')) signOut()
  }

  const [editModal, setEditModal] = useState(false)
  const [privModal, setPrivModal] = useState(false)
  const [ajudaModal, setAjudaModal] = useState(false)
  const [contatoModal, setContatoModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msgOk, setMsgOk] = useState('')

  function abrirEditar() {
    setForm({
      nome: paciente?.nome || '',
      telefone: paciente?.telefone || '',
      cpf: paciente?.cpf || '',
      data_nascimento: paciente?.data_nascimento || '',
    })
    setEditModal(true)
  }

  async function salvarEdicao() {
    setSaving(true)
    const { error } = await supabase.from('pacientes').update({
      nome: form.nome,
      telefone: form.telefone,
      cpf: form.cpf,
      data_nascimento: form.data_nascimento || null,
    }).eq('id', paciente.id)
    setSaving(false)
    if (!error) {
      setEditModal(false)
      setMsgOk('Dados atualizados!')
      setTimeout(() => setMsgOk(''), 3000)
      // Recarrega paciente
      const { data } = await supabase.from('pacientes').select('*').eq('id', paciente.id).single()
      if (data) Object.assign(paciente, data)
    } else {
      alert('Erro ao salvar: ' + error.message)
    }
  }

  const iniciais = paciente?.nome
    ? paciente.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  const info = [
    { label: 'E-mail',             value: paciente?.email },
    { label: 'CPF',                value: paciente?.cpf || 'Não informado' },
    { label: 'Telefone',           value: paciente?.telefone || 'Não informado' },
    { label: 'Data de nascimento', value: paciente?.data_nascimento ? new Date(paciente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado' },
    { label: 'Convênio',           value: paciente?.convenio || 'Não informado' },
    { label: 'Nº do convênio',     value: paciente?.numero_convenio || 'Não informado' },
  ]

  const menu = [
    { label: 'Falar com a clínica', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#0047AB" stroke="#0047AB" strokeWidth="1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, bg: '#EFF6FF', action: () => setContatoModal(true) },

    { label: 'Privacidade', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, bg: '#ECFDF5', action: () => setPrivModal(true) },
    { label: 'Ajuda e suporte', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, bg: '#FFFBEB', action: () => setAjudaModal(true) },
  ]

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerCircle1} />
        <div style={s.headerCircle2} />
        <button style={s.notifBtn} onClick={async () => {
          if (!('Notification' in window)) { alert('Seu navegador não suporta notificações.'); return }
          if (Notification.permission === 'granted') { alert('Notificações já estão ativadas! ✅'); return }
          if (Notification.permission === 'denied') { alert('Notificações bloqueadas. Habilite nas configurações do seu navegador.'); return }
          const result = await Notification.requestPermission()
          if (result === 'granted') { new Notification('Clínica Vida+', { body: 'Notificações ativadas com sucesso! 🎉' }) }
          else { alert('Permissão negada.') }
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </button>
        <div style={s.avatar}>
          <span style={s.avatarText}>{iniciais}</span>
        </div>
        <p style={s.nome}>{paciente?.nome || 'Paciente'}</p>
        <p style={s.desde}>Paciente desde Jan/2024</p>
        <div style={s.statusRow}>
          <span style={{ ...s.statusDot, backgroundColor: paciente?.ativo ? '#4ADE80' : '#F87171' }} />
          <span style={s.statusTag}>{paciente?.ativo ? 'Paciente ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div style={s.body}>
        {/* Card dados */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>MEUS DADOS</span>
            <button style={s.editBtn} onClick={abrirEditar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: 5 }}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
          </div>
          {info.map((item, i) => (
            <div key={item.label} style={{ ...s.row, ...(i < info.length - 1 ? s.rowBorder : {}) }}>
              <p style={s.rowLabel}>{item.label}</p>
              <p style={{ ...s.rowValue, color: item.value === 'Não informado' ? '#D1D5DB' : '#0D1B2A' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        {menu.map(item => (
          <button key={item.label} style={s.menuItem} onClick={item.action}>
            <div style={{ ...s.menuIcon, backgroundColor: item.bg }}>{item.icon}</div>
            <span style={s.menuLabel}>{item.label}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}

        {/* Aviso */}
        <div style={s.avisoCard}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={s.avisoText}>Para atualizar seus dados, entre em contato com a recepção da clínica.</p>
        </div>

        {/* Sair */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <button style={s.logoutBtn} onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 8 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair da conta
        </button>
        </div>

        <div style={{ height: 40 }} />
      </div>

      {/* Toast sucesso */}
      {msgOk && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#166534', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap' }}>
          ✅ {msgOk}
        </div>
      )}

      {/* Modal Falar com a clínica */}
      {contatoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>Falar com a clínica</p>
              <button onClick={() => setContatoModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: '16px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#93C5FD', letterSpacing: 1, marginBottom: 3 }}>TELEFONE</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0047AB' }}>(11) 3333-3333</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>Seg–Sex, 8h–18h</p>
                </div>
              </div>
              <div style={{ backgroundColor: '#F0FDF4', borderRadius: 14, padding: '16px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: 1, marginBottom: 3 }}>E-MAIL</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>contato@clinicavida.com.br</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>Respondemos em até 24h</p>
                </div>
              </div>
            </div>
            <button onClick={() => { setContatoModal(false); navigate('/chat') }} style={{ width: '100%', backgroundColor: '#0047AB', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              💬 Abrir chat
            </button>
          </div>
        </div>
      )}

      {/* Modal Privacidade */}
      {privModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>Privacidade</p>
              <button onClick={() => setPrivModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            {[
              { titulo: '📋 Coleta de dados', texto: 'Coletamos apenas as informações necessárias para o atendimento clínico: nome, e-mail, CPF, telefone, data de nascimento e dados de convênio.' },
              { titulo: '🔒 Uso das informações', texto: 'Seus dados são utilizados exclusivamente para agendamentos, comunicação com a clínica e histórico de consultas. Nunca compartilhamos suas informações com terceiros sem seu consentimento.' },
              { titulo: '💬 Mensagens e chat', texto: 'As mensagens trocadas com a clínica ficam armazenadas de forma segura e são acessíveis apenas pela equipe médica responsável pelo seu atendimento.' },
              { titulo: '🗑️ Exclusão de dados', texto: 'Você pode solicitar a exclusão dos seus dados a qualquer momento entrando em contato com a recepção da clínica.' },
              { titulo: '📜 Conformidade', texto: 'Seguimos as diretrizes da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e as normas do Conselho Federal de Medicina.' },
            ].map(item => (
              <div key={item.titulo} style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>{item.titulo}</p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: '20px' }}>{item.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Ajuda e suporte */}
      {ajudaModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>Ajuda e suporte</p>
              <button onClick={() => setAjudaModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            {[
              { q: 'Como agendar uma consulta?', a: 'Acesse a aba "Início" e toque em "Agendar". Escolha a data e horário disponíveis e confirme o agendamento.' },
              { q: 'Como cancelar ou reagendar?', a: 'Na aba "Consultas", selecione a consulta desejada e solicite o cancelamento ou reagendamento. A solicitação passará pela aprovação da clínica.' },
              { q: 'Não consigo fazer login, o que faço?', a: 'Verifique se o e-mail está correto. Caso o problema persista, entre em contato com a recepção para redefinir seu acesso.' },
              { q: 'Como falo com a clínica?', a: 'Use o chat disponível na aba "Chat" para enviar mensagens diretamente para a equipe. Respondemos em horário comercial.' },
              { q: 'Meus dados estão seguros?', a: 'Sim. Todas as informações são armazenadas com criptografia e seguimos as normas da LGPD. Consulte nossa política de privacidade para mais detalhes.' },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 18, padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: 14, border: '1px solid #F3F4F6' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>❓ {item.q}</p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: '20px' }}>{item.a}</p>
              </div>
            ))}
            <div style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: '14px 16px', border: '1px solid #BFDBFE' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0047AB', marginBottom: 4 }}>📞 Contato direto</p>
              <p style={{ fontSize: 13, color: '#1d4ed8' }}>contato@clinicavida.com.br</p>
              <p style={{ fontSize: 13, color: '#1d4ed8' }}>(11) 3333-3333 · Seg–Sex, 8h–18h</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>Editar dados</p>
              <button onClick={() => setEditModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            {[
              { label: 'Nome completo', key: 'nome', type: 'text' },
              { label: 'Telefone', key: 'telefone', type: 'tel' },
              { label: 'CPF', key: 'cpf', type: 'text' },
              { label: 'Data de nascimento', key: 'data_nascimento', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, letterSpacing: 1 }}>{f.label.toUpperCase()}</p>
                <input
                  type={f.type}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E7EB', borderRadius: 12, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <button onClick={salvarEdicao} disabled={saving || !form.nome} style={{ backgroundColor: '#0047AB', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  header: { position: 'relative', background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', paddingTop: 56, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' },
  headerCircle1: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 },
  headerCircle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -20 },
  avatar: { width: 90, height: 90, borderRadius: 45, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: '3px solid rgba(255,255,255,0.35)' },
  avatarText: { fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: 1 },
  nome: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4, textAlign: 'center' },
  desde: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', padding: '6px 16px', borderRadius: 50 },
  statusDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  statusTag: { color: '#fff', fontSize: 12, fontWeight: 600 },
  body: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 16px 10px' },
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1.5 },
  editBtn: { fontSize: 13, color: '#0047AB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  row: { padding: '13px 16px' },
  rowBorder: { borderBottom: '1px solid #F9FAFB' },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 3 },
  rowValue: { fontSize: 14, fontWeight: 500 },
  menuItem: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, border: '1px solid #F3F4F6', cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  menuIcon: { width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 600, color: '#0D1B2A' },
  avisoCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #FDE68A' },
  avisoText: { fontSize: 13, color: '#92400E', lineHeight: '18px' },
  notifBtn: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.35)', cursor: 'pointer' },
  logoutBtn: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: '12px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#991B1B', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}