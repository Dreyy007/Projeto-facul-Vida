import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Aprovacoes() {
  const { profile } = useAuth()
  const [solics, setSolics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSolics() }, [])

  async function fetchSolics() {
    const { data } = await supabase
      .from('solicitacoes')
      .select('*, consulta:consultas(*, paciente:pacientes(nome), medico:profiles(nome))')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })
    setSolics(data || [])
    setLoading(false)
  }

  async function handleAprovar(s, aprovado) {
    const isMedico = profile?.tipo === 'medico'
    const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)

    if (!isMedico && !isAdmin) return alert('Sem permissão para aprovar.')

    const update = {}
    if (isMedico) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    if (!aprovado) {
      update.status = 'recusada'
      // Restaura status da consulta para aguardando
      await supabase.from('consultas').update({ status: 'aguardando' }).eq('id', s.consulta_id)
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)

    // Verificar se ambos aprovaram
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()
    if (fresh?.aprovado_medico && fresh?.aprovado_admin) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)
      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      } else {
        await supabase.from('consultas').update({
          data: fresh.nova_data,
          hora: fresh.nova_hora,
          status: 'aguardando'
        }).eq('id', s.consulta_id)
      }
    }
    fetchSolics()
  }

  const canAct = (s) => {
    if (profile?.tipo === 'medico') return s.consulta?.medico_id === profile.id && s.aprovado_medico === null
    if (['admin','coordenador'].includes(profile?.tipo)) return s.aprovado_admin === null
    return false
  }

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Aprovações</h1>
          <p className="page-sub">{solics.length} solicitação(ões) pendente(s)</p>
        </div>
      </div>

      {solics.length === 0 ? (
        <div className="card">
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
            ✅ Nenhuma solicitação pendente.
          </div>
        </div>
      ) : (
        solics.map(s => (
          <div key={s.id} className="card">
            <div style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.tipo === 'cancelamento' ? 'var(--dbg)' : 'var(--wbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {s.tipo === 'cancelamento' ? '❌' : '📅'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {s.tipo === 'cancelamento' ? 'Cancelamento' : 'Reagendamento'} solicitado
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Paciente: <strong>{s.consulta?.paciente?.nome}</strong> · Profissional: {s.consulta?.medico?.nome}
                </div>
                {s.tipo === 'reagendamento' && s.nova_data && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    Nova data: {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0,5)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: s.aprovado_medico === true ? 'var(--sbg)' : s.aprovado_medico === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_medico === true ? 'var(--success)' : s.aprovado_medico === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                    {s.aprovado_medico === true ? '✓ Médico aprovado' : s.aprovado_medico === false ? '✗ Médico recusou' : '⏳ Médico pendente'}
                  </span>
                  <span style={{ background: s.aprovado_admin === true ? 'var(--sbg)' : s.aprovado_admin === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_admin === true ? 'var(--success)' : s.aprovado_admin === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                    {s.aprovado_admin === true ? '✓ Admin aprovado' : s.aprovado_admin === false ? '✗ Admin recusou' : '⏳ Admin pendente'}
                  </span>
                </div>
              </div>
              {canAct(s) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn-ok" style={{ padding: '9px 20px', fontSize: 13 }} onClick={() => handleAprovar(s, true)}>✓ Aprovar</button>
                  <button className="btn-no" style={{ padding: '9px 20px', fontSize: 13 }} onClick={() => handleAprovar(s, false)}>✗ Recusar</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
