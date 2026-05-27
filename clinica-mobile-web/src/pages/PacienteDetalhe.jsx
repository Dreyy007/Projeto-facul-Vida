import { useEffect, useState, useRef } from 'react'
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
  const [resultados, setResultados] = useState([])
  const [laudos, setLaudos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [aba, setAba] = useState('historico')
  const [novaMsg, setNovaMsg] = useState('')
  const [modalResultado, setModalResultado] = useState(false)
  const [modalLaudo, setModalLaudo] = useState(false)
  const [formRes, setFormRes] = useState({ nome: '', categoria: 'Exame de Sangue', conteudo: '' })
  const [formLaudo, setFormLaudo] = useState({ nome: '', conteudo: '' })
  const [savingRes, setSavingRes] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { fetchAll() }, [id])

  // Marca mensagens como lidas ao abrir a aba
  useEffect(() => {
    if (aba === 'mensagens') {
      supabase.from('mensagens')
        .update({ lida: true })
        .eq('paciente_id', id)
        .eq('lida', false)
        .eq('remetente', 'paciente')
    }
  }, [aba, id])

  async function fetchAll() {
    const [{ data: pac }, { data: cons }, { data: msgs }, { data: meds }, { data: res }] = await Promise.all([
      supabase.from('pacientes').select('*, medico:profiles(id,nome)').eq('id', id).single(),
      supabase.from('consultas').select('*, medico:profiles(nome)').eq('paciente_id', id).order('data', { ascending: false }),
      supabase.from('mensagens').select('*').eq('paciente_id', id).order('criado_em'),
      supabase.from('profiles').select('id, nome').eq('tipo', 'medico'),
      supabase.from('resultados').select('*').eq('paciente_id', id).order('criado_em', { ascending: false }),
    ])
    setPaciente(pac)
    setForm(pac || {})
    setConsultas(cons || [])
    setMensagens(msgs || [])
    setMedicos(meds || [])
    const todos = res || []
    setResultados(todos)
    setLaudos(todos.filter(r => r.categoria === 'Laudo' && r.conteudo))
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('pacientes').update({
      nome: form.nome, email: form.email, cpf: form.cpf, telefone: form.telefone,
      data_nascimento: form.data_nascimento || null, convenio: form.convenio,
      numero_convenio: form.numero_convenio, medico_id: form.medico_id || null,
    }).eq('id', id)
    if (!error) { setEditando(false); fetchAll() }
    else alert('Erro ao salvar: ' + error.message)
    setSaving(false)
  }

  async function toggleAtivo() {
    await supabase.from('pacientes').update({ ativo: !paciente.ativo }).eq('id', id)
    fetchAll()
  }

  async function handleExcluirPaciente() {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente o paciente? Todos os dados serão apagados e essa ação não pode ser desfeita.`)) return
    if (!window.confirm("Confirme novamente: excluir tudo permanentemente?")) return
    const { error } = await supabase.from("pacientes").delete().eq("id", id)
    if (error) { alert("Erro ao excluir: " + error.message); return }
    navigate("/pacientes")
  }

  async function handleEnviarMsg() {
    if (!novaMsg.trim()) return
    await supabase.from('mensagens').insert([{ paciente_id: id, remetente: 'clinica', conteudo: novaMsg.trim(), lida: true }])
    setNovaMsg('')
    fetchAll()
  }

  async function salvarResultado() {
    setSavingRes(true)
    let arquivo_url = null, arquivo_nome = null, arquivo_tipo = null
    if (arquivo) {
      const ext = arquivo.name.split('.').pop()
      const path = `${id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('resultados').upload(path, arquivo)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('resultados').getPublicUrl(path)
        arquivo_url = urlData.publicUrl; arquivo_nome = arquivo.name; arquivo_tipo = arquivo.type
      }
    }
    await supabase.from('resultados').insert([{
      paciente_id: id, medico_id: profile.id, nome: formRes.nome,
      categoria: formRes.categoria, conteudo: formRes.conteudo || null,
      arquivo_url, arquivo_nome, arquivo_tipo,
    }])
    setModalResultado(false)
    setFormRes({ nome: '', categoria: 'Exame de Sangue', conteudo: '' })
    setArquivo(null)
    fetchAll()
    setSavingRes(false)
  }

  async function salvarLaudo() {
    setSavingRes(true)
    await supabase.from('resultados').insert([{
      paciente_id: id, medico_id: profile.id,
      nome: formLaudo.nome, categoria: 'Laudo', conteudo: formLaudo.conteudo,
    }])
    setModalLaudo(false)
    setFormLaudo({ nome: '', conteudo: '' })
    fetchAll()
    setSavingRes(false)
  }

  async function excluirResultado(rid) {
    if (!window.confirm('Excluir?')) return
    await supabase.from('resultados').delete().eq('id', rid)
    fetchAll()
  }

  const catColor = { 'Exame de Sangue': 'tp', 'Psicologia': 'ta', 'Cardiologia': 'tr', 'Neuropsicologia': 'ta', 'Imagem': 'tg', 'Laudo': 'tp', 'Outro': 'tp' }
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
          <button className="btn-outline" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => navigate('/pacientes')}>← Voltar</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'var(--p)' }}>
              {paciente.nome.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontFamily: 'General Sans, sans-serif', fontSize: 22 }}>{paciente.nome}</h1>
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
            <button className="btn-outline" onClick={toggleAtivo}>{paciente.ativo ? 'Desativar' : 'Reativar'}</button>
          )}
          <button className="btn-primary" onClick={() => setEditando(true)}>Editar dados</button>
          {profile?.tipo === 'admin' && (
            <button className="btn-danger" style={{ padding: '7px 14px', fontSize: 13 }} onClick={handleExcluirPaciente}>Excluir paciente</button>
          )}
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
          {[
            ['historico', '📋 Histórico de consultas'],
            ['mensagens', '💬 Mensagens'],
            ['resultados', '🔬 Resultados'],
            ['laudos', '📄 Laudos'],
          ].map(([k, l]) => (
            <div key={k} className={`tab${aba === k ? ' on' : ''}`} onClick={() => setAba(k)}>{l}</div>
          ))}
        </div>

        {/* Histórico */}
        {aba === 'historico' && (
          <div className="card-body">
            {consultas.length === 0 ? <div className="empty">Nenhuma consulta registrada.</div> : (
              <table className="tbl">
                <thead><tr><th>Data</th><th>Horário</th><th>Profissional</th><th>Tipo</th><th>Status</th></tr></thead>
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

        {/* Mensagens */}
        {aba === 'mensagens' && (
          <div>
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mensagens.length === 0 && <div className="empty">Nenhuma mensagem.</div>}
              {mensagens.map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.remetente === 'clinica' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ background: m.remetente === 'clinica' ? 'var(--p)' : 'var(--bg)', color: m.remetente === 'clinica' ? '#fff' : 'var(--text)', borderRadius: 12, padding: '10px 14px', maxWidth: '70%', fontSize: 13 }}>
                    {m.conteudo}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {m.remetente === 'clinica' ? 'Clínica' : paciente.nome} · {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input value={novaMsg} onChange={e => setNovaMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEnviarMsg()} placeholder="Digite uma mensagem..."
                style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
              <button className="btn-primary" onClick={handleEnviarMsg} disabled={!novaMsg.trim()}>Enviar</button>
            </div>
          </div>
        )}

        {/* Resultados */}
        {aba === 'resultados' && (
          <div className="card-body" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setModalResultado(true)}>+ Novo resultado</button>
            </div>
            {resultados.filter(r => r.categoria !== 'Laudo').length === 0 ? <div className="empty">Nenhum resultado cadastrado.</div> : (
              <table className="tbl">
                <thead><tr><th>Nome</th><th>Categoria</th><th>Arquivo</th><th>Observações</th><th>Data</th><th></th></tr></thead>
                <tbody>
                  {resultados.filter(r => r.categoria !== 'Laudo').map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.nome}</td>
                      <td><span className={`tag ${catColor[r.categoria] || 'tp'}`}>{r.categoria}</span></td>
                      <td>{r.arquivo_url
                        ? <a href={r.arquivo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--p)', fontWeight: 600, fontSize: 12 }}>📎 Ver arquivo</a>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {r.conteudo
                          ? <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={r.conteudo}>{r.conteudo}</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td><button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => excluirResultado(r.id)}>Excluir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Laudos */}
        {aba === 'laudos' && (
          <div className="card-body" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setModalLaudo(true)}>+ Novo laudo</button>
            </div>
            {laudos.length === 0 ? <div className="empty">Nenhum laudo cadastrado.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {laudos.map(r => (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.nome}</span>
                        <span className="tag tp" style={{ marginLeft: 8 }}>Laudo</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                        <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => excluirResultado(r.id)}>Excluir</button>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: '20px', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>{r.conteudo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal novo resultado */}
      {modalResultado && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalResultado(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2>Novo Resultado</h2>
            <div className="form-grid">
              <div className="fld"><label>Nome do exame *</label><input value={formRes.nome} onChange={e => setFormRes({...formRes, nome: e.target.value})} placeholder="Ex: Hemograma Completo"/></div>
              <div className="fld"><label>Categoria</label>
                <select value={formRes.categoria} onChange={e => setFormRes({...formRes, categoria: e.target.value})}>
                  {['Exame de Sangue','Psicologia','Cardiologia','Neuropsicologia','Imagem','Outro'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="fld"><label>Arquivo (PDF / imagem)</label>
                <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setArquivo(e.target.files[0])} />
                <button className="btn-outline" style={{ textAlign: 'left' }} onClick={() => fileRef.current?.click()}>
                  {arquivo ? `📎 ${arquivo.name}` : '📎 Selecionar arquivo...'}
                </button>
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Observações (opcional)</label>
                <textarea rows={3} value={formRes.conteudo} onChange={e => setFormRes({...formRes, conteudo: e.target.value})} placeholder="Observações sobre o resultado..." style={{ resize: 'vertical' }}/>
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModalResultado(false); setArquivo(null) }}>Cancelar</button>
              <button className="btn-primary" onClick={salvarResultado} disabled={savingRes || !formRes.nome}>{savingRes ? 'Salvando...' : 'Salvar resultado'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo laudo */}
      {modalLaudo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalLaudo(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2>Novo Laudo</h2>
            <div className="form-grid">
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Título do laudo *</label>
                <input value={formLaudo.nome} onChange={e => setFormLaudo({...formLaudo, nome: e.target.value})} placeholder="Ex: Avaliação Psicológica"/>
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Texto do laudo *</label>
                <textarea rows={6} value={formLaudo.conteudo} onChange={e => setFormLaudo({...formLaudo, conteudo: e.target.value})} placeholder="Digite o laudo médico completo aqui..." style={{ resize: 'vertical' }}/>
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalLaudo(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarLaudo} disabled={savingRes || !formLaudo.nome || !formLaudo.conteudo}>{savingRes ? 'Salvando...' : 'Salvar laudo'}</button>
            </div>
          </div>
        </div>
      )}

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