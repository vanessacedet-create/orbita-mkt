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
                return (
                  <tr key={e.id}>
                    <td className="td-strong">{e.parceiros?.nome || '—'}</td>
                    <td>{e.livros?.titulo || '—'}</td>
                    <td className="td-muted">
                      {format(new Date(e.created_at), "dd MMM yyyy", { locale: ptBR })}
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
