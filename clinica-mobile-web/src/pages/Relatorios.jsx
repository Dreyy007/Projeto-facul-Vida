import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

const tagClass = s => ({ confirmada: 'tag tg', aguardando: 'tag ta', cancelada: 'tag tr', realizada: 'tag tp', cancelamento_pendente: 'tag tr', reagendamento_pendente: 'tag ta' }[s] || 'tag tp')
const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }[s] || s)

const avColors = ['#0047AB','#7C3AED','#059669','#DC2626','#D97706','#0891B2','#BE185D']
function avColor(nome) { let h = 0; for (const c of (nome||'')) h += c.charCodeAt(0); return avColors[h % avColors.length] }
function iniciais(nome) { if (!nome) return '?'; const p = nome.trim().split(' '); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase() }

export default function Relatorios() {
  const { profile } = useAuth()
  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState(null)
  const [profModal, setProfModal] = useState(null)   // { nome, id, consultas[] }
  const [loadingProf, setLoadingProf] = useState(false)
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date()
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    return { inicio: ini, fim: hoje.toISOString().split('T')[0] }
  })

  useEffect(() => { gerarRelatorio() }, [])

  async function gerarRelatorio() {
    setLoading(true)
    const [
      { data: consultas },
      { data: pacientes },
      { data: novos },
      { data: canceladas },
      { data: realizadas },
      { data: porMedico },
    ] = await Promise.all([
      supabase.from('consultas').select('*').gte('data', periodo.inicio).lte('data', periodo.fim),
      supabase.from('pacientes').select('id').eq('ativo', true),
      supabase.from('pacientes').select('id').gte('criado_em', periodo.inicio+'T00:00:00').lte('criado_em', periodo.fim+'T23:59:59'),
      supabase.from('consultas').select('*').gte('data', periodo.inicio).lte('data', periodo.fim).eq('status','cancelada'),
      supabase.from('consultas').select('*').gte('data', periodo.inicio).lte('data', periodo.fim).eq('status','realizada'),
      (() => {
        let q = supabase.from('consultas').select('medico_id, medico:profiles(id,nome)').gte('data', periodo.inicio).lte('data', periodo.fim)
        if (!isAdmin) q = q.eq('medico_id', profile?.id)
        return q
      })(),
    ])

    const medMap = {}
    porMedico?.forEach(c => {
      const nome = c.medico?.nome || 'Sem nome'
      const id = c.medico_id
      if (!medMap[id]) medMap[id] = { nome, id, qtd: 0 }
      medMap[id].qtd++
    })
    const topMedicos = Object.values(medMap).sort((a, b) => b.qtd - a.qtd)

    const tipoMap = {}
    consultas?.forEach(c => { tipoMap[c.tipo] = (tipoMap[c.tipo] || 0) + 1 })
    const porTipo = Object.entries(tipoMap).sort((a, b) => b[1] - a[1])

    const total = consultas?.length || 0
    setDados({
      total,
      pacientesAtivos: pacientes?.length || 0,
      novosPacientes: novos?.length || 0,
      canceladas: canceladas?.length || 0,
      realizadas: realizadas?.length || 0,
      txCanc: total > 0 ? ((canceladas?.length||0)/total*100).toFixed(1) : 0,
      txReal: total > 0 ? ((realizadas?.length||0)/total*100).toFixed(1) : 0,
      topMedicos,
      porTipo,
    })
    setLoading(false)
  }

  async function verConsultasProfissional(prof) {
    setProfModal({ ...prof, consultas: null })
    setLoadingProf(true)
    const { data } = await supabase.from('consultas')
      .select('*, paciente:pacientes(nome)')
      .eq('medico_id', prof.id)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim)
      .order('data').order('hora')
    setProfModal({ ...prof, consultas: data || [] })
    setLoadingProf(false)
  }

  function exportarCSV() {
    if (!dados) return
    const linhas = [
      ['Relatório Clínica Vida+'],
      [`Período: ${fmtData(periodo.inicio)} a ${fmtData(periodo.fim)}`],
      [],['Métrica','Valor'],
      ['Total de consultas', dados.total],
      ['Consultas realizadas', dados.realizadas],
      ['Consultas canceladas', dados.canceladas],
      ['Taxa de realização (%)', dados.txReal],
      ['Taxa de cancelamento (%)', dados.txCanc],
      ['Pacientes ativos', dados.pacientesAtivos],
      ['Novos pacientes no período', dados.novosPacientes],
      [],['Consultas por profissional'],
      ...dados.topMedicos.map(p => [p.nome, p.qtd]),
      [],['Consultas por tipo'],
      ...dados.porTipo.map(([tipo, qtd]) => [tipo, qtd]),
    ]
    const csv = linhas.map(l => l.join(',')).join('\n')
    const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `relatorio-${periodo.inicio}-${periodo.fim}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const fmtData = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : ''

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Relatórios</h1>
          <p className="page-sub">Análise de desempenho da clínica</p>
        </div>
        <button className="btn-outline" onClick={exportarCSV} disabled={!dados}>📥 Exportar CSV</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="fld" style={{ flex: 1, minWidth: 130 }}>
            <label>Data inicial</label>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
          </div>
          <div className="fld" style={{ flex: 1, minWidth: 130 }}>
            <label>Data final</label>
            <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
          </div>
        </div>
        <div className="chip-row" style={{ marginTop: 10 }}>
          {[
            ['Este mês', () => { const h = new Date(); setPeriodo({ inicio: new Date(h.getFullYear(),h.getMonth(),1).toISOString().split('T')[0], fim: h.toISOString().split('T')[0] }) }],
            ['Mês passado', () => { const h = new Date(); setPeriodo({ inicio: new Date(h.getFullYear(),h.getMonth()-1,1).toISOString().split('T')[0], fim: new Date(h.getFullYear(),h.getMonth(),0).toISOString().split('T')[0] }) }],
            ['Este ano', () => { const h = new Date(); setPeriodo({ inicio: `${h.getFullYear()}-01-01`, fim: h.toISOString().split('T')[0] }) }],
          ].map(([l, fn]) => <button key={l} className="chip" style={{ fontSize: 12 }} onClick={fn}>{l}</button>)}
        </div>
        <button className="btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={gerarRelatorio} disabled={loading}>
          {loading ? <><span className="spinner"/>Gerando...</> : '📊 Gerar relatório'}
        </button>
      </div>

      {loading && <div className="page-loading" style={{ height: 120 }}>Carregando dados...</div>}

      {dados && !loading && (
        <>
          {/* KPIs */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total consultas</div>
              <div className="stat-num blue">{dados.total}</div>
              <div className="stat-sub">{fmtData(periodo.inicio)} – {fmtData(periodo.fim)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Realizadas</div>
              <div className="stat-num green">{dados.realizadas}</div>
              <div className="stat-sub">{dados.txReal}% do total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Canceladas</div>
              <div className="stat-num red">{dados.canceladas}</div>
              <div className="stat-sub">{dados.txCanc}% do total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Novos pacientes</div>
              <div className="stat-num warn">{dados.novosPacientes}</div>
              <div className="stat-sub">{dados.pacientesAtivos} ativos total</div>
            </div>
          </div>

          {/* Por profissional — cards clicáveis */}
          <div className="card">
            <div className="card-head">
              <h3>Consultas por profissional</h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>toque para ver detalhes</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dados.topMedicos.length === 0 ? (
                <div className="empty">Sem dados no período.</div>
              ) : dados.topMedicos.map(prof => (
                <button key={prof.id} onClick={() => verConsultasProfissional(prof)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit', transition: '.15s' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--p)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: avColor(prof.nome), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {iniciais(prof.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{prof.nome}</div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${dados.total > 0 ? (prof.qtd/dados.total*100) : 0}%`, height: '100%', background: avColor(prof.nome), borderRadius: 3, transition: 'width .4s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--p)' }}>{prof.qtd}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dados.total > 0 ? (prof.qtd/dados.total*100).toFixed(0) : 0}%</div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 16 }}>›</span>
                </button>
              ))}
            </div>
          </div>

          {/* Por tipo */}
          <div className="card">
            <div className="card-head"><h3>Consultas por tipo</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dados.porTipo.length === 0 ? (
                <div className="empty">Sem dados no período.</div>
              ) : dados.porTipo.map(([tipo, qtd]) => (
                <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{tipo}</div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${dados.total > 0 ? (qtd/dados.total*100) : 0}%`, height: '100%', background: 'var(--success)', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>{qtd}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dados.total > 0 ? (qtd/dados.total*100).toFixed(0) : 0}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal drill-down profissional */}
      {profModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setProfModal(null)}>
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: avColor(profModal.nome), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {iniciais(profModal.nome)}
              </div>
              <div>
                <h2 style={{ fontSize: 17, margin: 0 }}>{profModal.nome}</h2>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{fmtData(periodo.inicio)} – {fmtData(periodo.fim)}</p>
              </div>
              <button onClick={() => setProfModal(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>×</button>
            </div>

            {loadingProf || !profModal.consultas ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <span className="spinner spinner-muted" style={{ width: 24, height: 24, borderWidth: 3 }} />
              </div>
            ) : profModal.consultas.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>Nenhuma consulta no período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                  {profModal.consultas.length} consulta(s) no período
                </div>
                {profModal.consultas.map(c => (
                  <div key={c.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{c.paciente?.nome || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · {c.tipo}
                      </div>
                    </div>
                    <span className={tagClass(c.status)} style={{ flexShrink: 0, fontSize: 10, padding: '2px 8px' }}>{tagLabel(c.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
