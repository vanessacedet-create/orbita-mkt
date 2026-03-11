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
  const [stats, setStats]       = useState(null)
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [detalhe, setDetalhe]   = useState(null)

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
                  <tr key={e.id} onClick={()=>setDetalhe(e)} style={{cursor:'pointer'}} onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-2)'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
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
      {detalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <h2 className="modal-title">Detalhe do Envio</h2>
              <button className="btn btn-ghost btn-icon" onClick={()=>setDetalhe(null)}>✕</button>
            </div>

            {/* Parceiro */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>Parceiro</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>{detalhe.parceiros?.nome || '—'}</div>
              {detalhe.parceiros?.tipo_parceria && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{detalhe.parceiros.tipo_parceria}</div>}
            </div>

            {/* Status + Data */}
            <div style={{display:'flex',gap:24,marginBottom:20}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>Status</div>
                <span className={`badge ${(STATUS_LABELS[detalhe.status]||STATUS_LABELS.enviado).cls}`}>
                  {(STATUS_LABELS[detalhe.status]||STATUS_LABELS.enviado).label}
                </span>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>Data do envio</div>
                <div style={{fontSize:14,color:'var(--text)'}}>
                  {detalhe.data_envio
                    ? format(new Date(detalhe.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})
                    : format(new Date(detalhe.created_at),'dd MMM yyyy',{locale:ptBR})}
                </div>
              </div>
            </div>

            {/* Livros */}
            <div style={{marginBottom: detalhe.observacoes ? 20 : 0}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:10}}>
                Livros enviados ({(detalhe.envio_livros||[]).length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(detalhe.envio_livros||[]).filter(el=>el.livros).map((el,i) => (
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{width:28,height:28,borderRadius:6,flexShrink:0,background:'var(--accent-glow)',border:'1px solid rgba(224,96,48,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--accent)'}}>
                      {i+1}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{el.livros.titulo}</div>
                      <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2,display:'flex',gap:8}}>
                        {el.livros.autor && <span>{el.livros.autor}</span>}
                        {el.livros.isbn  && <span>ISBN: {el.livros.isbn}</span>}
                      </div>
                      {el.divulgado && (
                        <div style={{fontSize:11,color:'var(--green)',marginTop:3,fontWeight:600}}>
                          ✓ Divulgado {el.data_divulgacao ? format(new Date(el.data_divulgacao+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR}) : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observações */}
            {detalhe.observacoes && (
              <div style={{marginTop:16,padding:'10px 14px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--border)'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:4}}>Observações</div>
                <div style={{fontSize:13,color:'var(--text)'}}>{detalhe.observacoes}</div>
              </div>
            )}

            <div className="form-actions" style={{marginTop:20}}>
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
