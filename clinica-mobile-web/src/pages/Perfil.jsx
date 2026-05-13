import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Perfil() {
  const navigate = useNavigate()
  const { paciente, signOut } = useAuth()

  function handleLogout() {
    if (window.confirm('Deseja sair da sua conta?')) signOut()
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
    { label: 'Falar com a clínica', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#0047AB" stroke="#0047AB" strokeWidth="1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, bg: '#EFF6FF', action: () => navigate('/chat') },
    { label: 'Notificações', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>, bg: '#F5F3FF', action: () => {} },
    { label: 'Privacidade', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, bg: '#ECFDF5', action: () => {} },
    { label: 'Ajuda e suporte', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, bg: '#FFFBEB', action: () => {} },
  ]

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerCircle1} />
        <div style={s.headerCircle2} />
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
            <button style={s.editBtn}>
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
        <button style={s.logoutBtn} onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 8 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair da conta
        </button>

        <div style={{ height: 40 }} />
      </div>
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
  logoutBtn: { width: '100%', backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#991B1B', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}