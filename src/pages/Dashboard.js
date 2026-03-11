import { useEffect, useState } from 'react'
import { getStats, getEnvios } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS = {
  enviado:   { label: 'Enviado',   cls: 'badge-amber' },
  divulgado: { label: 'Divulgado', cls: 'badge-green' },
  cancelado: { label: 'Cancelado', cls: 'badge-red'   },
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const [stats, setStats]     = useState(null)
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStats(), getEnvios()])
      .then(([s, e]) => { setStats(s); setRecentes(e.slice(0, 8)) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return <div className="loading" style={{ minHeight: 'auto', padding: 60 }}><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{saudacao}, {usuario?.nome?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Visão geral do Orbita MKT</p>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Parceiros</div>
            <div className="stat-value">{stats.totalParceiros}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Livros</div>
            <div className="stat-value">{stats.totalLivros}</div>
          </div>
          <div className="stat-card accent">
            <div className="stat-label">Total Envios</div>
            <div className="stat-value">{stats.totalEnvios}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Divulgados</div>
            <div className="stat-value">{stats.confirmados}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Pendentes</div>
            <div className="stat-value">{stats.pendentes}</div>
          </div>
        </div>
      )}

      <p className="section-title">Envios Recentes</p>
      <div className="table-card">
        {recentes.length === 0 ? (
          <div className="empty-state"><p>Nenhum envio registrado ainda.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Livro</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map(e => {
                const s = STATUS_LABELS[e.status] || STATUS_LABELS.enviado
                const livros = (e.envio_livros || []).map(el => el.livros?.titulo).filter(Boolean)
                const visiveis = livros.slice(0, 3)
                const extras = livros.length - 3
                return (
                  <tr key={e.id}>
                    <td className="td-strong">{e.parceiros?.nome || '—'}</td>
                    <td>
                      {livros.length === 0 ? '—' : (
                        <div style={{display:'flex',flexDirection:'column',gap:3}}>
                          {visiveis.map((t,i) => <span key={i} style={{fontSize:12.5}}>{t}</span>)}
                          {extras > 0 && <span style={{fontSize:11.5,color:'var(--accent)',fontWeight:600}}>+{extras} livro{extras>1?'s':''}</span>}
                        </div>
                      )}
                    </td>
                    <td className="td-muted">
                      {e.data_envio
                        ? format(new Date(e.data_envio + 'T12:00:00'), "dd MMM yyyy", { locale: ptBR })
                        : format(new Date(e.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
