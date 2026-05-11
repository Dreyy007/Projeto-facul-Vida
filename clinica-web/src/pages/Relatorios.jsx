import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Relatorios() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState(null)
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date()
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const fim = hoje.toISOString().split('T')[0]
    return { inicio: ini, fim }
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
      supabase.from('pacientes').select('id').gte('criado_em', periodo.inicio + 'T00:00:00').lte('criado_em', periodo.fim + 'T23:59:59'),
      supabase.from('consultas').select('*').gte('data', periodo.inicio).lte('data', periodo.fim).eq('status', 'cancelada'),
      supabase.from('consultas').select('*').gte('data', periodo.inicio).lte('data', periodo.fim).eq('status', 'realizada'),
      supabase.from('consultas').select('medico_id, medico:profiles(nome)').gte('data', periodo.inicio).lte('data', periodo.fim),
    ])

    // agrupa por médico
    const medMap = {}
    porMedico?.forEach(c => {
      const nome = c.medico?.nome || 'Sem nome'
      medMap[nome] = (medMap[nome] || 0) + 1
    })
    const topMedicos = Object.entries(medMap).sort((a, b) => b[1] - a[1])

    // agrupa por tipo
    const tipoMap = {}
    consultas?.forEach(c => { tipoMap[c.tipo] = (tipoMap[c.tipo] || 0) + 1 })
    const porTipo = Object.entries(tipoMap).sort((a, b) => b[1] - a[1])

    // taxa de cancelamento
    const total = consultas?.length || 0
    const txCanc = total > 0 ? ((canceladas?.length || 0) / total * 100).toFixed(1) : 0
    const txReal = total > 0 ? ((realizadas?.length || 0) / total * 100).toFixed(1) : 0

    setDados({
      total,
      pacientesAtivos: pacientes?.length || 0,
      novosPacientes: novos?.length || 0,
      canceladas: canceladas?.length || 0,
      realizadas: realizadas?.length || 0,
      txCanc,
      txReal,
      topMedicos,
      porTipo,
    })
    setLoading(false)
  }

  function exportarCSV() {
    if (!dados) return
    const linhas = [
      ['Relatório Clínica Vida+'],
      [`Período: ${fmtData(periodo.inicio)} a ${fmtData(periodo.fim)}`],
      [],
      ['Métrica', 'Valor'],
      ['Total de consultas', dados.total],
      ['Consultas realizadas', dados.realizadas],
      ['Consultas canceladas', dados.canceladas],
      ['Taxa de realização (%)', dados.txReal],
      ['Taxa de cancelamento (%)', dados.txCanc],
      ['Pacientes ativos', dados.pacientesAtivos],
      ['Novos pacientes no período', dados.novosPacientes],
      [],
      ['Consultas por profissional'],
      ...dados.topMedicos.map(([nome, qtd]) => [nome, qtd]),
      [],
      ['Consultas por tipo'],
      ...dados.porTipo.map(([tipo, qtd]) => [tipo, qtd]),
    ]
    const csv = linhas.map(l => l.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-clinica-vida-${periodo.inicio}-${periodo.fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''

  if (!['admin', 'coordenador'].includes(profile?.tipo)) {
    return <div className="page"><div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>🚫 Acesso restrito.</div></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Relatórios</h1>
          <p className="page-sub">Análise de desempenho da clínica</p>
        </div>
        <button className="btn-outline" onClick={exportarCSV} disabled={!dados}>📥 Exportar CSV</button>
      </div>

      {/* Filtro período */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="fld">
            <label>Data inicial</label>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
          </div>
          <div className="fld">
            <label>Data final</label>
            <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
          </div>
          {/* Atalhos rápidos */}
          {[
            ['Este mês', () => {
              const h = new Date(); const i = new Date(h.getFullYear(), h.getMonth(), 1)
              setPeriodo({ inicio: i.toISOString().split('T')[0], fim: h.toISOString().split('T')[0] })
            }],
            ['Mês passado', () => {
              const h = new Date(); const i = new Date(h.getFullYear(), h.getMonth() - 1, 1)
              const f = new Date(h.getFullYear(), h.getMonth(), 0)
              setPeriodo({ inicio: i.toISOString().split('T')[0], fim: f.toISOString().split('T')[0] })
            }],
            ['Este ano', () => {
              const h = new Date()
              setPeriodo({ inicio: `${h.getFullYear()}-01-01`, fim: h.toISOString().split('T')[0] })
            }],
          ].map(([label, fn]) => (
            <button key={label} className="btn-outline" style={{ padding: '10px 14px', fontSize: 12 }} onClick={fn}>{label}</button>
          ))}
          <button className="btn-primary" onClick={gerarRelatorio} disabled={loading}>
            {loading ? 'Gerando...' : '📊 Gerar relatório'}
          </button>
        </div>
      </div>

      {loading && <div className="page-loading" style={{ height: 200 }}>Carregando dados...</div>}

      {dados && !loading && (
        <>
          {/* KPIs */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">Total de consultas</div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Por médico */}
            <div className="card">
              <div className="card-head"><h3>Consultas por profissional</h3></div>
              <div className="card-body">
                {dados.topMedicos.length === 0 ? (
                  <div className="empty">Sem dados no período.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Profissional</th><th>Consultas</th><th>% do total</th></tr></thead>
                    <tbody>
                      {dados.topMedicos.map(([nome, qtd]) => (
                        <tr key={nome}>
                          <td>
                            <div className="td-user">
                              <div className="av" style={{ background: 'var(--sbg)', color: 'var(--success)' }}>{nome.slice(0, 2).toUpperCase()}</div>
                              {nome}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--p)' }}>{qtd}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                <div style={{ width: `${dados.total > 0 ? (qtd / dados.total * 100) : 0}%`, height: '100%', background: 'var(--p)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 32 }}>
                                {dados.total > 0 ? (qtd / dados.total * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Por tipo */}
            <div className="card">
              <div className="card-head"><h3>Consultas por tipo</h3></div>
              <div className="card-body">
                {dados.porTipo.length === 0 ? (
                  <div className="empty">Sem dados no período.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Tipo</th><th>Qtd</th><th>% do total</th></tr></thead>
                    <tbody>
                      {dados.porTipo.map(([tipo, qtd]) => (
                        <tr key={tipo}>
                          <td>{tipo}</td>
                          <td style={{ fontWeight: 700, color: 'var(--p)' }}>{qtd}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                <div style={{ width: `${dados.total > 0 ? (qtd / dados.total * 100) : 0}%`, height: '100%', background: 'var(--success)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 32 }}>
                                {dados.total > 0 ? (qtd / dados.total * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
