import { useEffect, useState } from 'react'
import { getDashboardStats } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, X, Users, Megaphone, TrendingUp, ChevronDown } from 'lucide-react'

const STATUS_CAMPANHA_LABEL = {
  planejamento: 'Planejada',
  em_andamento: 'Em andamento',
  concluida:    'Concluída',
  cancelada:    'Cancelada',
}

// ── DROPDOWN FILTRO ────────────────────────────────────────
function FiltroDropdown({ label, valor, opcoes, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{position:'relative'}}>
      <button onClick={e=>{ e.stopPropagation(); setOpen(p=>!p) }}
        style={{display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,cursor:'pointer',
          background:valor?'var(--accent-glow)':'var(--surface-2)',
          border:`1px solid ${valor?'rgba(224,96,48,0.4)':'var(--border)'}`,
          color:valor?'var(--accent)':'var(--text-muted)',
          borderRadius:6,padding:'4px 8px',whiteSpace:'nowrap'}}>
        {valor ? (opcoes.find(o=>o.v===valor)?.l||valor) : label}
        <ChevronDown size={11} style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.15s'}}/>
      </button>
      {open && (
        <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:200,
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,
          boxShadow:'0 8px 24px rgba(0,0,0,0.3)',minWidth:160,overflow:'hidden'}}>
          <div onClick={()=>{ onChange(''); setOpen(false) }}
            style={{padding:'8px 12px',fontSize:12,cursor:'pointer',color:'var(--text-muted)',borderBottom:'1px solid var(--border)',background:!valor?'var(--surface-2)':'transparent'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
            onMouseLeave={e=>e.currentTarget.style.background=!valor?'var(--surface-2)':'transparent'}>
            Todos
          </div>
          {opcoes.map(o=>(
            <div key={o.v} onClick={()=>{ onChange(o.v); setOpen(false) }}
              style={{padding:'8px 12px',fontSize:12,cursor:'pointer',color:valor===o.v?'var(--accent)':'var(--text)',
                background:valor===o.v?'var(--accent-glow)':'transparent',
                display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}
              onMouseEnter={e=>{ if(valor!==o.v) e.currentTarget.style.background='var(--surface-2)' }}
              onMouseLeave={e=>{ e.currentTarget.style.background=valor===o.v?'var(--accent-glow)':'transparent' }}>
              <span>{o.l}</span>
              <span style={{fontSize:11,color:'var(--text-muted)',fontWeight:600}}>{o.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MODAL DIVULGAÇÕES ──────────────────────────────────────
function ModalDivulgados({ stats, onClose }) {
  const { breakdown, totalDivulgacoes, totalOrganicas, totalCombinadas } = stats
  const pctOrg  = totalDivulgacoes > 0 ? Math.round((totalOrganicas  / totalDivulgacoes) * 100) : 0
  const pctComb = totalDivulgacoes > 0 ? Math.round((totalCombinadas / totalDivulgacoes) * 100) : 0
  const linhas = [
    { label:'Lançamento / Geral', ...breakdown.lancamento, cor:'#6366f1' },
    { label:'Promoção',           ...breakdown.promocao,   cor:'#f97316' },
    { label:'Livraria',           ...breakdown.livraria,   cor:'#06b6d4' },
  ]
  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">Divulgações — Detalhamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
          {[{label:'Total',value:totalDivulgacoes,cor:'var(--accent)'},{label:'🌱 Orgânicas',value:totalOrganicas,cor:'#22c55e'},{label:'🤝 Combinadas',value:totalCombinadas,cor:'#f97316'}].map(({label,value,cor})=>(
            <div key={label} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'14px 12px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{label}</div>
              <div style={{fontSize:26,fontWeight:800,color:cor}}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:4}}>
            <span>🌱 Orgânicas {pctOrg}%</span><span>🤝 Combinadas {pctComb}%</span>
          </div>
          <div style={{height:8,borderRadius:99,background:'var(--surface-2)',overflow:'hidden',display:'flex'}}>
            <div style={{width:`${pctOrg}%`,background:'#22c55e',transition:'width 0.3s'}}/>
            <div style={{width:`${pctComb}%`,background:'#f97316',transition:'width 0.3s'}}/>
          </div>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Por tipo de campanha</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {linhas.map(l=>(
            <div key={l.label} style={{background:'var(--surface-2)',borderLeft:`3px solid ${l.cor}`,borderRadius:8,padding:'10px 14px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{l.label}</span>
                <span style={{fontSize:13,fontWeight:800,color:l.cor}}>{l.total}</span>
              </div>
              <div style={{display:'flex',gap:16,fontSize:11,color:'var(--text-muted)'}}>
                <span>🌱 Orgânica: <strong style={{color:'#22c55e'}}>{l.organica}</strong></span>
                <span>🤝 Combinada: <strong style={{color:'#f97316'}}>{l.combinada}</strong></span>
              </div>
              {l.total>0&&<div style={{height:4,borderRadius:99,background:'var(--surface)',overflow:'hidden',display:'flex',marginTop:6}}>
                <div style={{width:`${Math.round((l.organica/l.total)*100)}%`,background:'#22c55e'}}/>
                <div style={{width:`${Math.round((l.combinada/l.total)*100)}%`,background:'#f97316'}}/>
              </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── DASHBOARD ──────────────────────────────────────────────
export default function Dashboard() {
  const { usuario } = useAuth()
  const [stats, setStats]         = useState(null)
  const [statsBase, setStatsBase] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [modalDiv, setModalDiv]   = useState(false)

  // Filtros parceiros
  const [filtroParcTipo,   setFiltroParcTipo]   = useState('')
  const [filtroParcStatus, setFiltroParcStatus] = useState('')
  // Filtros campanhas
  const [filtroCampTipo,   setFiltroCampTipo]   = useState('')
  const [filtroCampStatus, setFiltroCampStatus] = useState('')
  // Filtros divulgações
  const [filtroDiv, setFiltroDiv] = useState('')
  // Filtro de data global
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim]       = useState('')

  async function carregar(filtros) {
    setLoading(true)
    try { setStats(await getDashboardStats(filtros)) } finally { setLoading(false) }
  }

  useEffect(() => {
    const filtros = { dataInicio:dataInicio||undefined, dataFim:dataFim||undefined }
    getDashboardStats(filtros).then(s=>{ setStatsBase(s); setStats(s) }).finally(()=>setLoading(false))
  }, [dataInicio, dataFim])

  // Recarrega divulgações ao filtrar por origem/tipo
  useEffect(() => {
    if (statsBase) {
      const isOrigem = filtroDiv === 'organica' || filtroDiv === 'combinada'
      carregar({
        origem: isOrigem ? filtroDiv : undefined,
        tipoCampanha: !isOrigem && filtroDiv ? filtroDiv : undefined,
        dataInicio: dataInicio||undefined,
        dataFim: dataFim||undefined,
      })
    }
  }, [filtroDiv, dataInicio, dataFim])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // Parceiros filtrados em memória
  const totalParceiros = (() => {
    if (!statsBase) return 0
    if (filtroParcTipo)   return statsBase.parceirosPorTipo?.[filtroParcTipo]     ?? 0
    if (filtroParcStatus) return statsBase.parceirosPorStatus?.[filtroParcStatus] ?? 0
    return statsBase.totalParceiros
  })()

  // Campanhas filtradas em memória
  const totalCampanhas = (() => {
    if (!statsBase) return 0
    if (filtroCampTipo)   return statsBase.campanhasPorTipo?.[filtroCampTipo]   ?? 0
    if (filtroCampStatus) return statsBase.campanhasPorStatus?.[filtroCampStatus] ?? 0
    return statsBase.totalCampanhas
  })()

  // Opções dropdown parceiros
  const opcoesParcTipo = [
    'Livraria de influencer','Booktime','Divulgação editoras próprias'
  ].map(v => ({ v, l: v, count: statsBase?.parceirosPorTipo?.[v] || 0 }))
  const opcoesParcStatus = [
    { v:'ativo',   l:'Ativo'   },
    { v:'inativo', l:'Inativo' },
  ].map(({ v, l }) => ({ v, l, count: statsBase?.parceirosPorStatus?.[v] || 0 }))
  // Opções dropdown campanhas
  const opcoesCampTipo   = Object.entries(statsBase?.campanhasPorTipo   || {}).map(([v,count])=>({v,l:v,count}))
  const opcoesCampStatus = Object.entries(statsBase?.campanhasPorStatus || {})
    .map(([v,count])=>({ v, l: STATUS_CAMPANHA_LABEL[v]||v, count }))
  // Opções dropdown divulgações
  const opcoesDivOrigem = [
    {v:'organica',  l:'🌱 Orgânicas',  count:statsBase?.totalOrganicas  || 0},
    {v:'combinada', l:'🤝 Combinadas', count:statsBase?.totalCombinadas || 0},
  ]
  const opcoesDivTipo = [
    {v:'Lançamento', l:'Lançamento / Geral', count:statsBase?.breakdown?.lancamento?.total || 0},
    {v:'Promoção',   l:'Promoção',           count:statsBase?.breakdown?.promocao?.total   || 0},
    {v:'Geral',      l:'Livraria',           count:statsBase?.breakdown?.livraria?.total   || 0},
  ]

  const filtroDivOrigem = filtroDiv === 'organica' || filtroDiv === 'combinada' ? filtroDiv : ''
  const filtroDivTipo   = ['Lançamento','Promoção','Geral'].includes(filtroDiv) ? filtroDiv : ''

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-header" style={{marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <LayoutDashboard size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>{saudacao}, {usuario?.nome?.split(' ')[0]} 👋</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>Visão geral do Orbita MKT</p>
          </div>
        </div>
      </div>

      {/* Filtro de data global */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 16px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',whiteSpace:'nowrap'}}>📅 Período</span>
        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>De</label>
            <input type="date" className="form-input" style={{padding:'5px 10px',fontSize:12,width:140}}
              value={dataInicio} onChange={e=>setDataInicio(e.target.value)}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>Até</label>
            <input type="date" className="form-input" style={{padding:'5px 10px',fontSize:12,width:140}}
              value={dataFim} onChange={e=>setDataFim(e.target.value)}/>
          </div>
          {(dataInicio||dataFim) && (
            <button onClick={()=>{ setDataInicio(''); setDataFim('') }}
              style={{fontSize:11,color:'var(--text-muted)',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
              Limpar período
            </button>
          )}
        </div>
        {(dataInicio||dataFim) && (
          <span style={{fontSize:11,color:'var(--accent)',fontWeight:600}}>
            {dataInicio&&dataFim ? `${dataInicio.split('-').reverse().join('/')} → ${dataFim.split('-').reverse().join('/')}` : dataInicio ? `A partir de ${dataInicio.split('-').reverse().join('/')}` : `Até ${dataFim.split('-').reverse().join('/')}`}
          </span>
        )}
      </div>

      {/* 3 Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:28}}>

        {/* PARCEIROS */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderTop:'3px solid var(--accent)',borderRadius:10,padding:'18px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>Parceiros</span>
            <Users size={16} color="var(--accent)" strokeWidth={1.5}/>
          </div>
          <div style={{fontSize:36,fontWeight:800,color:'var(--accent)',lineHeight:1,marginBottom:14}}>
            {loading ? '—' : totalParceiros}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <FiltroDropdown label="Tipo de parceria" valor={filtroParcTipo} opcoes={opcoesParcTipo}
              onChange={v=>{ setFiltroParcTipo(v); setFiltroParcStatus('') }}/>
            <FiltroDropdown label="Status" valor={filtroParcStatus} opcoes={opcoesParcStatus}
              onChange={v=>{ setFiltroParcStatus(v); setFiltroParcTipo('') }}/>
          </div>
          {(filtroParcTipo||filtroParcStatus)&&(
            <button onClick={()=>{ setFiltroParcTipo(''); setFiltroParcStatus('') }}
              style={{marginTop:8,fontSize:10,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
              Limpar filtro
            </button>
          )}
        </div>

        {/* CAMPANHAS */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderTop:'3px solid #f97316',borderRadius:10,padding:'18px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>Campanhas</span>
            <Megaphone size={16} color="#f97316" strokeWidth={1.5}/>
          </div>
          <div style={{fontSize:36,fontWeight:800,color:'#f97316',lineHeight:1,marginBottom:14}}>
            {loading ? '—' : totalCampanhas}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <FiltroDropdown label="Tipo" valor={filtroCampTipo} opcoes={opcoesCampTipo}
              onChange={v=>{ setFiltroCampTipo(v); setFiltroCampStatus('') }}/>
            <FiltroDropdown label="Status" valor={filtroCampStatus} opcoes={opcoesCampStatus}
              onChange={v=>{ setFiltroCampStatus(v); setFiltroCampTipo('') }}/>
          </div>
          {(filtroCampTipo||filtroCampStatus)&&(
            <button onClick={()=>{ setFiltroCampTipo(''); setFiltroCampStatus('') }}
              style={{marginTop:8,fontSize:10,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
              Limpar filtro
            </button>
          )}
        </div>

        {/* DIVULGAÇÕES */}
        <div style={{background:'var(--surface)',border:'1px solid rgba(34,197,94,0.25)',borderTop:'3px solid #22c55e',borderRadius:10,padding:'18px 20px',cursor:'pointer'}}
          onClick={()=>setModalDiv(true)}
          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>Divulgações</span>
            <TrendingUp size={16} color="#22c55e" strokeWidth={1.5}/>
          </div>
          <div style={{fontSize:36,fontWeight:800,color:'#22c55e',lineHeight:1,marginBottom:6}}>
            {loading ? '—' : stats?.totalDivulgacoes ?? 0}
          </div>
          {stats && stats.totalDivulgacoes > 0 && (
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>
              🌱 {stats.totalOrganicas} org. · 🤝 {stats.totalCombinadas} comb.
            </div>
          )}
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
            <FiltroDropdown label="Origem" valor={filtroDivOrigem} opcoes={opcoesDivOrigem}
              onChange={v=>setFiltroDiv(v)}/>
            <FiltroDropdown label="Tipo camp." valor={filtroDivTipo} opcoes={opcoesDivTipo}
              onChange={v=>setFiltroDiv(v)}/>
          </div>
          {filtroDiv&&(
            <button onClick={e=>{ e.stopPropagation(); setFiltroDiv('') }}
              style={{marginTop:8,fontSize:10,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
              Limpar filtro
            </button>
          )}
          <div style={{fontSize:10,color:'#22c55e',marginTop:8,fontWeight:600}}>Ver detalhes →</div>
        </div>

      </div>

      {/* Barra proporção */}
      {stats && stats.totalDivulgacoes > 0 && (
        <div className="table-card" style={{padding:'18px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Divulgações: Orgânicas vs Combinadas</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setModalDiv(true)} style={{fontSize:11}}>Ver detalhes</button>
          </div>
          <div style={{height:10,borderRadius:99,background:'var(--surface-2)',overflow:'hidden',display:'flex',marginBottom:10}}>
            <div style={{width:`${Math.round((stats.totalOrganicas/stats.totalDivulgacoes)*100)}%`,background:'#22c55e',transition:'width 0.5s'}}/>
            <div style={{width:`${Math.round((stats.totalCombinadas/stats.totalDivulgacoes)*100)}%`,background:'#f97316',transition:'width 0.5s'}}/>
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

      {modalDiv && stats && <ModalDivulgados stats={stats} onClose={()=>setModalDiv(false)}/>}
    </div>
  )
}
