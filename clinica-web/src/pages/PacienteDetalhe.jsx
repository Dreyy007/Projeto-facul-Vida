import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function PacienteDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [paciente, setPaciente] = useState(null)
  const [consultas, setConsultas] = useState([])
  const [mensagens, setMensagens] = useState([])
  const [medicos, setMedicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [aba, setAba] = useState('historico')
  const [novaMsg, setNovaMsg] = useState('')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: pac }, { data: cons }, { data: msgs }, { data: meds }] = await Promise.all([
      supabase.from('pacientes').select('*, medico:profiles(id,nome)').eq('id', id).single(),
      supabase.from('consultas').select('*, medico:profiles(nome)').eq('paciente_id', id).order('data', { ascending: false }),
      supabase.from('mensagens').select('*').eq('paciente_id', id).order('criado_em'),
      supabase.from('profiles').select('id, nome').eq('tipo', 'medico'),
    ])
    setPaciente(pac)
    setForm(pac || {})
    setConsultas(cons || [])
    setMensagens(msgs || [])
    setMedicos(meds || [])
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('pacientes').update({
      nome: form.nome,
      email: form.email,
      cpf: form.cpf,
      telefone: form.telefone,
      data_nascimento: form.data_nascimento || null,
      convenio: form.convenio,
      numero_convenio: form.numero_convenio,
      medico_id: form.medico_id || null,
    }).eq('id', id)
    if (!error) { setEditando(false); fetchAll() }
    else alert('Erro ao salvar: ' + error.message)
    setSaving(false)
  }

  async function toggleAtivo() {
    await supabase.from('pacientes').update({ ativo: !paciente.ativo }).eq('id', id)
    fetchAll()
  }

  async function handleEnviarMsg() {
    if (!novaMsg.trim()) return
    await supabase.from('mensagens').insert([{
      paciente_id: id,
      remetente: 'clinica',
      conteudo: novaMsg.trim(),
      lida: true,
    }])
    setNovaMsg('')
    fetchAll()
  }

  const tagClass = s => ({ confirmada:'tag tg', aguardando:'tag ta', cancelada:'tag tr', realizada:'tag tp', cancelamento_pendente:'tag tr', reagendamento_pendente:'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada:'Confirmada', aguardando:'Aguardando', cancelada:'Cancelada', realizada:'Realizada', cancelamento_pendente:'Cancelamento pend.', reagendamento_pendente:'Reagend. pend.' }[s] || s)

  if (loading) return <div className="page-loading">Carregando...</div>
  if (!paciente) return <div className="page-loading" style={{color:'var(--danger)'}}>Paciente não encontrado.</div>

  const idade = paciente.data_nascimento
    ? Math.floor((new Date() - new Date(paciente.data_nascimento)) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn-outline" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => navigate('/pacientes')}>
            ← Voltar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'var(--p)' }}>
              {paciente.nome.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display,serif', fontSize: 22 }}>{paciente.nome}</h1>
              <p className="page-sub">
                {idade ? `${idade} anos · ` : ''}
                {paciente.medico?.nome ? `Paciente de ${paciente.medico.nome}` : 'Sem profissional vinculado'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className={paciente.ativo ? 'tag tg' : 'tag tr'} style={{ padding: '6px 14px', fontSize: 12 }}>
            {paciente.ativo ? 'Ativo' : 'Inativo'}
          </span>
          {['admin', 'coordenador'].includes(profile?.tipo) && (
            <button className="btn-outline" onClick={toggleAtivo}>
              {paciente.ativo ? 'Desativar' : 'Reativar'}
            </button>
          )}
          <button className="btn-primary" onClick={() => setEditando(true)}>Editar dados</button>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Telefone', value: paciente.telefone || '—' },
          { label: 'E-mail', value: paciente.email },
          { label: 'CPF', value: paciente.cpf || '—' },
          { label: 'Convênio', value: paciente.convenio ? `${paciente.convenio} · ${paciente.numero_convenio || ''}` : '—' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="card">
        <div className="tabs">
          {[['historico','📋 Histórico de consultas'], ['mensagens','💬 Mensagens']].map(([k,l]) => (
            <div key={k} className={`tab${aba === k ? ' on' : ''}`} onClick={() => setAba(k)}>{l}</div>
          ))}
        </div>

        {aba === 'historico' && (
          <div className="card-body">
            {consultas.length === 0 ? (
              <div className="empty">Nenhuma consulta registrada.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr><th>Data</th><th>Horário</th><th>Profissional</th><th>Tipo</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {consultas.map(c => (
                    <tr key={c.id}>
                      <td>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0, 5)}</td>
                      <td>{c.medico?.nome}</td>
                      <td>{c.tipo}</td>
                      <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {aba === 'mensagens' && (
          <div>
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mensagens.length === 0 && <div className="empty">Nenhuma mensagem.</div>}
              {mensagens.map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.remetente === 'clinica' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    background: m.remetente === 'clinica' ? 'var(--p)' : 'var(--bg)',
                    color: m.remetente === 'clinica' ? '#fff' : 'var(--text)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    maxWidth: '70%',
                    fontSize: 13,
                  }}>{m.conteudo}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {m.remetente === 'clinica' ? 'Clínica' : paciente.nome} · {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input
                value={novaMsg}
                onChange={e => setNovaMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnviarMsg()}
                placeholder="Digite uma mensagem..."
                style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
              />
              <button className="btn-primary" onClick={handleEnviarMsg} disabled={!novaMsg.trim()}>Enviar</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal editar */}
      {editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <h2>Editar Paciente</h2>
            <div className="form-grid">
              <div className="fld"><label>Nome completo *</label><input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="fld"><label>E-mail *</label><input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="fld"><label>CPF</label><input value={form.cpf || ''} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <div className="fld"><label>Telefone</label><input value={form.telefone || ''} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" /></div>
              <div className="fld"><label>Data de nascimento</label><input type="date" value={form.data_nascimento || ''} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
              <div className="fld"><label>Profissional responsável</label>
                <select value={form.medico_id || ''} onChange={e => setForm({ ...form, medico_id: e.target.value })}>
                  <option value="">Nenhum</option>
                  {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Convênio</label><input value={form.convenio || ''} onChange={e => setForm({ ...form, convenio: e.target.value })} /></div>
              <div className="fld"><label>Nº do convênio</label><input value={form.numero_convenio || ''} onChange={e => setForm({ ...form, numero_convenio: e.target.value })} /></div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setEditando(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.nome || !form.email}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
