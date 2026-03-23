import { useEffect, useState } from 'react'
import { getDashboardStats } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, X, Users, BookOpen, Megaphone, TrendingUp } from 'lucide-react'

// ── MODAL DIVULGADOS ──────────────────────────────────────
function ModalDivulgados({ stats, onClose }) {
  const { breakdown, totalDivulgacoes, totalOrganicas, totalCombinadas } = stats
  const pctOrg  = totalDivulgacoes > 0 ? Math.round((totalOrganicas  / totalDivulgacoes) * 100) : 0
  const pctComb = totalDivulgacoes > 0 ? Math.round((totalCombinadas / totalDivulgacoes) * 100) : 0

  const linhas = [
    { label: 'Lançamento / Geral', ...breakdown.lancamento, cor: '#6366f1' },
    { label: 'Promoção',           ...breakdown.promocao,   cor: '#f97316' },
    { label: 'Livraria',           ...breakdown.livraria,   cor: '#06b6d4' },
  ]

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">Divulgações — Detalhamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Total */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
          {[
            { label:'Total', value: totalDivulgacoes, cor:'var(--accent)' },
            { label:'🌱 Orgânicas', value: totalOrganicas, cor:'#22c55e' },
            { label:'🤝 Combinadas', value: totalCombinadas, cor:'#f97316' },
          ].map(({label,value,cor})=>(
            <div key={label} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'14px 12px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{label}</div>
              <div style={{fontSize:26,fontWeight:800,color:cor}}>{value}</div>
            </div>
          ))}
        </div>

        {/* Barra de proporção */}
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:4}}>
            <span>🌱 Orgânicas {pctOrg}%</span>
            <span>🤝 Combinadas {pctComb}%</span>
          </div>
          <div style={{height:8,borderRadius:99,background:'var(--surface-2)',overflow:'hidden',display:'flex'}}>
            <div style={{width:`${pctOrg}%`,background:'#22c55e',transition:'width 0.3s'}}/>
            <div style={{width:`${pctComb}%`,background:'#f97316',transition:'width 0.3s'}}/>
          </div>
        </div>

        {/* Por tipo de campanha */}
        <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>
          Por tipo de campanha
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {linhas.map(l => (
            <div key={l.label} style={{background:'var(--surface-2)',border:`1px solid var(--border)`,borderLeft:`3px solid ${l.cor}`,borderRadius:8,padding:'10px 14px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{l.label}</span>
                <span style={{fontSize:13,fontWeight:800,color:l.cor}}>{l.total}</span>
              </div>
              <div style={{display:'flex',gap:16,fontSize:11,color:'var(--text-muted)'}}>
                <span>🌱 Orgânica: <strong style={{color:'#22c55e'}}>{l.organica}</strong></span>
                <span>🤝 Combinada: <strong style={{color:'#f97316'}}>{l.combinada}</strong></span>
              </div>
              {l.total > 0 && (
                <div style={{height:4,borderRadius:99,background:'var(--surface)',overflow:'hidden',display:'flex',marginTop:6}}>
                  <div style={{width:`${Math.round((l.organica/l.total)*100)}%`,background:'#22c55e'}}/>
                  <div style={{width:`${Math.round((l.combinada/l.total)*100)}%`,background:'#f97316'}}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────
export default function Dashboard() {
  const { usuario } = useAuth()
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [modalDiv, setModalDiv]     = useState(false)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return <div className="loading" style={{minHeight:'auto',padding:60}}><div className="spinner"/></div>

  const cards = stats ? [
    {
      label: 'Parceiros',
      value: stats.totalParceiros,
      icon: Users,
      cor: 'var(--accent)',
      clicavel: false,
    },
    {
      label: 'Livros',
      value: stats.totalLivros,
      icon: BookOpen,
      cor: '#6366f1',
      clicavel: false,
    },
    {
      label: 'Campanhas',
      value: stats.totalCampanhas,
      icon: Megaphone,
      cor: '#f97316',
      clicavel: false,
    },
    {
      label: 'Divulgações',
      value: stats.totalDivulgacoes,
      icon: TrendingUp,
      cor: '#22c55e',
      clicavel: true,
      sub: stats.totalDivulgacoes > 0
        ? `🌱 ${stats.totalOrganicas} org. · 🤝 ${stats.totalCombinadas} comb.`
        : null,
    },
  ] : []

  return (
    <div>
      <div className="page-header" style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <LayoutDashboard size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>{saudacao}, {usuario?.nome?.split(' ')[0]} 👋</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>Visão geral do Orbita MKT</p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16,marginBottom:28}}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label}
              onClick={c.clicavel ? ()=>setModalDiv(true) : undefined}
              style={{
                background:'var(--surface)',
                border:`1px solid ${c.clicavel ? c.cor+'40' : 'var(--border)'}`,
                borderTop:`3px solid ${c.cor}`,
                borderRadius:10,
                padding:'18px 20px',
                cursor: c.clicavel ? 'pointer' : 'default',
                transition:'all 0.15s',
                position:'relative',
              }}
              onMouseEnter={e=>{ if(c.clicavel) e.currentTarget.style.background='var(--surface-2)' }}
              onMouseLeave={e=>{ if(c.clicavel) e.currentTarget.style.background='var(--surface)' }}
            >
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>
                  {c.label}
                </span>
                <Icon size={16} color={c.cor} strokeWidth={1.5}/>
              </div>
              <div style={{fontSize:32,fontWeight:800,color:c.cor,lineHeight:1}}>{c.value}</div>
              {c.sub && (
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>{c.sub}</div>
              )}
              {c.clicavel && (
                <div style={{fontSize:10,color:c.cor,marginTop:6,fontWeight:600}}>
                  Ver detalhes →
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Proporção orgânicas vs combinadas */}
      {stats && stats.totalDivulgacoes > 0 && (
        <div className="table-card" style={{padding:'18px 20px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Divulgações: Orgânicas vs Combinadas</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setModalDiv(true)}
              style={{fontSize:11}}>
              Ver detalhes
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <div style={{flex:1,height:10,borderRadius:99,background:'var(--surface-2)',overflow:'hidden',display:'flex'}}>
              <div style={{
                width:`${Math.round((stats.totalOrganicas/stats.totalDivulgacoes)*100)}%`,
                background:'#22c55e', transition:'width 0.5s'
              }}/>
              <div style={{
                width:`${Math.round((stats.totalCombinadas/stats.totalDivulgacoes)*100)}%`,
                background:'#f97316', transition:'width 0.5s'
              }}/>
            </div>
          </div>
          <div style={{display:'flex',gap:20,fontSize:12}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:10,height:10,borderRadius:99,background:'#22c55e'}}/>
              <span style={{color:'var(--text-muted)'}}>🌱 Orgânicas</span>
              <strong style={{color:'#22c55e'}}>{stats.totalOrganicas}</strong>
              <span style={{color:'var(--text-muted)'}}>({Math.round((stats.totalOrganicas/stats.totalDivulgacoes)*100)}%)</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:10,height:10,borderRadius:99,background:'#f97316'}}/>
              <span style={{color:'var(--text-muted)'}}>🤝 Combinadas</span>
              <strong style={{color:'#f97316'}}>{stats.totalCombinadas}</strong>
              <span style={{color:'var(--text-muted)'}}>({Math.round((stats.totalCombinadas/stats.totalDivulgacoes)*100)}%)</span>
            </div>
          </div>
        </div>
      )}

      {modalDiv && stats && (
        <ModalDivulgados stats={stats} onClose={()=>setModalDiv(false)}/>
      )}
    </div>
  )
}
