import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Perfil() {
  const navigate = useNavigate()
  const { paciente, signOut } = useAuth()

  function handleLogout() {
    if (window.confirm('Deseja sair da sua conta?')) signOut()
  }

  const info = [
    { label: 'E-mail',             value: paciente?.email },
    { label: 'CPF',                value: paciente?.cpf || 'Não informado' },
    { label: 'Telefone',           value: paciente?.telefone || 'Não informado' },
    { label: 'Data de nascimento', value: paciente?.data_nascimento ? new Date(paciente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado' },
    { label: 'Convênio',           value: paciente?.convenio || 'Não informado' },
    { label: 'Nº do convênio',     value: paciente?.numero_convenio || 'Não informado' },
  ]

  return (
    <div style={{ backgroundColor: '#F0F4FA', minHeight: '100%' }}>
      {/* Header azul */}
      <div style={s.header}>
        <div style={s.headerCircle} />
        <div style={s.avatar}>
          <span style={s.avatarText}>{paciente?.nome?.slice(0, 2).toUpperCase()}</span>
        </div>
        <p style={s.nome}>{paciente?.nome}</p>
        <span style={s.statusTag}>
          {paciente?.ativo ? '✓ Paciente ativo' : 'Inativo'}
        </span>
      </div>

      <div style={s.body}>
        {/* Card de dados */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>MEUS DADOS</span>
            <button style={s.editBtn}>✏️ Editar</button>
          </div>
          {info.map((item, i) => (
            <div key={item.label} style={{ ...s.row, ...(i < info.length - 1 ? s.rowBorder : {}) }}>
              <p style={s.rowLabel}>{item.label}</p>
              <p style={s.rowValue}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Falar com clínica */}
        <button style={s.menuItem} onClick={() => navigate('/chat')}>
          <div style={s.menuIcon}><span style={{ fontSize: 18 }}>💬</span></div>
          <span style={s.menuLabel}>Falar com a clínica</span>
          <span style={s.menuArrow}>›</span>
        </button>

        {/* Aviso */}
        <div style={s.avisoCard}>
          <p style={s.avisoText}>Para atualizar seus dados, entre em contato com a recepção da clínica.</p>
        </div>

        {/* Sair */}
        <button style={s.logoutBtn} onClick={handleLogout}>
          Sair da conta
        </button>

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

const s = {
  header: { position: 'relative', backgroundColor: '#0047AB', paddingTop: 52, paddingBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#1a6fdf', top: -60, right: -40, opacity: 0.5 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: '3px solid rgba(255,255,255,0.35)' },
  avatarText: { fontSize: 30, fontWeight: 800, color: '#fff' },
  nome: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 },
  statusTag: { backgroundColor: 'rgba(255,255,255,0.18)', padding: '6px 16px', borderRadius: 50, color: '#fff', fontSize: 12, fontWeight: 600 },
  body: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12, border: '1px solid #E5E7EB' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' },
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1 },
  editBtn: { fontSize: 13, color: '#0047AB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' },
  row: { padding: '13px 16px' },
  rowBorder: { borderBottom: '1px solid #F3F4F6' },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 3 },
  rowValue: { fontSize: 14, color: '#0D1B2A', fontWeight: 500 },
  menuItem: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, border: '1px solid #E5E7EB', cursor: 'pointer', textAlign: 'left' },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 600, color: '#0D1B2A' },
  menuArrow: { fontSize: 22, color: '#9CA3AF' },
  avisoCard: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 12 },
  avisoText: { fontSize: 13, color: '#92400E', lineHeight: '18px' },
  logoutBtn: { width: '100%', backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, textAlign: 'center', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#991B1B', border: '1px solid #FECACA' },
}
