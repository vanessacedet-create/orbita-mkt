import { useEffect, useState } from 'react'
import { getMonitoramento, createDivulgacaoCampanha, deleteDivulgacaoCampanha, updateParceiroCampanha } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Eye, Plus, Trash2, X, ExternalLink } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function diaDaSemana(ano, mes, dia) {
  let a=ano,m=mes; if(m<3){m+=12;a-=1}
  const k=a%100,j=Math.floor(a/100)
  const h=(dia+Math.floor(13*(m+1)/5)+k+Math.floor(k/4)+Math.floor(j/4)-2*j)%7
  return((h+6)%7)
}
function diasNoMes(ano,mes){
  if(mes===2){const b=(ano%4===0&&ano%100!==0)||(ano%400===0);return b?29:28}
  return[0,31,28,31,30,31,30,31,31,30,31,30,31][mes]
}
function pad(n){return String(n).padStart(2,'0')}
function toKey(a,m,d){return`${a}-${pad(m)}-${pad(d)}`}
function hojeKey(){const d=new Date();return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())}
function addDias(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())}

function gerarGrid(ano,mes){
  const p=diaDaSemana(ano,mes,1),t=diasNoMes(ano,mes),g=[]
  if(p>0){const ma=mes===1?12:mes-1,aa=mes===1?ano-1:ano,ta=diasNoMes(aa,ma);for(let i=p-1;i>=0;i--)g.push({key:toKey(aa,ma,ta-i),dia:ta-i,doMes:false})}
  for(let d=1;d<=t;d++)g.push({key:toKey(ano,mes,d),dia:d,doMes:true})
  const r=g.length%7;if(r>0){const mp=mes===12?1:mes+1,ap=mes===12?ano+1:ano;for(let d=1;d<=7-r;d++)g.push({key:toKey(ap,mp,d),dia:d,doMes:false})}
  return g
}

// Gera os 7 dias da semana a partir de uma key de domingo
function gerarSemana(domKey){
  return Array.from({length:7},(_,i)=>({key:addDias(domKey,i),dia:Number(addDias(domKey,i).split('-')[2]),doMes:true}))
}

// Retorna o domingo da semana que contém a key
function domingoDeKey(key){
  const d=new Date(key+'T12:00:00')
  d.setDate(d.getDate()-d.getDay())
  return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())
}

function labelSemana(domKey){
  const fim=addDias(domKey,6)
  const [ay,am,ad]=domKey.split('-').map(Number)
  const [by,bm,bd]=fim.split('-').map(Number)
  const meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  if(am===bm) return `${ad} – ${bd} ${meses[bm-1]} ${by}`
  return `${ad} ${meses[am-1]} – ${bd} ${meses[bm-1]} ${ay}`
}

const TIPOS_DIV=[
  {value:'stories',label:'Stories',temLink:false},
  {value:'feed',label:'Feed',temLink:true},
  {value:'reels',label:'Reels',temLink:true},
  {value:'tiktok',label:'TikTok',temLink:true},
  {value:'youtube',label:'YouTube',temLink:true},
  {value:'shorts',label:'Shorts',temLink:true},
  {value:'twitter',label:'Twitter/X',temLink:true},
  {value:'grupo_interno',label:'Grupo interno',temLink:false},
]

const STATUS_P=[
  {value:'convidado',label:'Convidado',cor:'#6366f1'},
  {value:'confirmado',label:'Confirmado',cor:'#eab308'},
  {value:'publicado',label:'Publicou',cor:'#22c55e'},
  {value:'nao_publicou',label:'Não publicou',cor:'#ef4444'},
  {value:'sem_retorno',label:'Sem retorno',cor:'#6b7280'},
  {value:'recusou',label:'Recusou',cor:'#9ca3af'},
]

const COR_ST={publicado:'#22c55e',nao_publicou:'#ef4444',confirmado:'#eab308',convidado:'#6366f1',sem_retorno:'#6b7280',recusou:'#9ca3af'}
const ICONE_ST={publicado:'✅',nao_publicou:'❌',confirmado:'🕐',convidado:'🕐',sem_retorno:'💬',recusou:'🚫'}

const PALETA=['#f97316','#6366f1','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#3b82f6','#eab308']
const _cmap={};let _cidx=0
function corEv(id){if(!_cmap[id])_cmap[id]=PALETA[_cidx++%PALETA.length];return _cmap[id]}

function useToast(){
  const[t,setT]=useState(null)
  function show(msg,type='success'){setT({msg,type});setTimeout(()=>setT(null),4000)}
  return[t,show]
}

function calcLinhas(eventos){
  const sorted=[...eventos].sort((a,b)=>a.inicio.localeCompare(b.inicio))
  const ocupado={}
  return sorted.map(ev=>{
    let linha=0
    while(true){
      let livre=true;let c=ev.inicio
      while(c<=ev.fim){if(ocupado[c]?.has(linha)){livre=false;break};c=addDias(c,1)}
      if(livre)break;linha++
    }
    let c=ev.inicio
    while(c<=ev.fim){if(!ocupado[c])ocupado[c]=new Set();ocupado[c].add(linha);c=addDias(c,1)}
    return{...ev,linha}
  })
}

// ── MODAL PERÍODO ──────────────────────────────────────────
function ModalPeriodo({cp,onClose,onUpdate}){
  const[divs,setDivs]=useState(cp.campanha_divulgacoes||[])
  const[status,setStatus]=useState(cp.status)
  const[salvando,setSalvando]=useState(false)
  const[modalDiv,setModalDiv]=useState(false)
  const[form,setForm]=useState({tipo:'',data_divulgacao:'',link:'',curtidas:'',comentarios:'',visualizacoes:''})
  const[saving,setSaving]=useState(false)
  const[toast,showToast]=useToast()
  const tipo=TIPOS_DIV.find(t=>t.value===form.tipo)
  const temLink=tipo?.temLink||false

  async function salvarStatus(s){
    setSalvando(true)
    try{await updateParceiroCampanha(cp.id,{status:s});setStatus(s);onUpdate({...cp,status:s});showToast('Atualizado!')}
    catch{showToast('Erro','error')}finally{setSalvando(false)}
  }

  async function salvarDiv(){
    if(!form.tipo)return;setSaving(true)
    try{
      const p={campanha_parceiro_id:cp.id,tipo:form.tipo,data_divulgacao:form.data_divulgacao||null,
        link:temLink?(form.link||null):null,
        curtidas:temLink&&form.curtidas!==''?Number(form.curtidas):null,
        comentarios:temLink&&form.comentarios!==''?Number(form.comentarios):null,
        visualizacoes:temLink&&form.visualizacoes!==''?Number(form.visualizacoes):null}
      const nova=await createDivulgacaoCampanha(p)
      const novasDivs=[nova,...divs]
      setDivs(novasDivs);setModalDiv(false)
      setForm({tipo:'',data_divulgacao:'',link:'',curtidas:'',comentarios:'',visualizacoes:''})
      if(status!=='publicado')await salvarStatus('publicado')
      onUpdate({...cp,campanha_divulgacoes:novasDivs,status:'publicado'})
      showToast('Divulgação registrada!')
    }catch{showToast('Erro','error')}finally{setSaving(false)}
  }

  async function removerDiv(id){
    if(!window.confirm('Remover?'))return
    try{await deleteDivulgacaoCampanha(id);setDivs(p=>p.filter(d=>d.id!==id));showToast('Removida!')}
    catch{showToast('Erro','error')}
  }

  return(
    <div className="modal-backdrop" style={{zIndex:1200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:540,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <div>
            <h2 className="modal-title" style={{marginBottom:2}}>{cp.parceiros?.nome}</h2>
            <div style={{fontSize:12,color:'var(--accent)'}}>{cp.campanhas?.nome}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div style={{display:'flex',gap:16,padding:'12px 0',fontSize:12,color:'var(--text-muted)',flexWrap:'wrap',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {cp.data_inicio&&<span>📅 Início: <strong style={{color:'var(--text)'}}>{cp.data_inicio.split('-').reverse().join('/')}</strong></span>}
          {cp.data_fim&&<span>🏁 Fim: <strong style={{color:'var(--text)'}}>{cp.data_fim.split('-').reverse().join('/')}</strong></span>}
          {cp.data_publicacao_combinada&&<span>⭐ <strong style={{color:'var(--amber)'}}>{cp.data_publicacao_combinada.split('-').reverse().join('/')}</strong></span>}
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Status geral</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {STATUS_P.map(s=>(
              <button key={s.value} onClick={()=>salvarStatus(s.value)} disabled={salvando}
                style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                  border:`2px solid ${s.cor}`,
                  background:status===s.value?s.cor:'transparent',
                  color:status===s.value?'#fff':s.cor,
                  opacity:salvando?.6:1,transition:'all 0.15s'}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{borderTop:'1px solid var(--border)',paddingTop:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Divulgações ({divs.length})</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalDiv(true)} style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
              <Plus size={13}/> Registrar
            </button>
          </div>
          {divs.length===0
            ?<p style={{fontSize:13,color:'var(--text-muted)'}}>Nenhuma divulgação registrada ainda.</p>
            :divs.map(d=>{
              const tp=TIPOS_DIV.find(t=>t.value===d.tipo)
              return(
                <div key={d.id} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span className="badge badge-indigo" style={{fontSize:10}}>{tp?.label||d.tipo}</span>
                      {d.data_divulgacao&&<span style={{fontSize:11,color:'var(--text-muted)'}}>{d.data_divulgacao.split('-').reverse().join('/')}</span>}
                    </div>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>removerDiv(d.id)}><Trash2 size={11}/></button>
                  </div>
                  {d.link&&<a href={d.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:'var(--accent)',display:'flex',alignItems:'center',gap:4,marginBottom:4}}><ExternalLink size={10}/> Ver publicação</a>}
                  {(d.curtidas!=null||d.comentarios!=null||d.visualizacoes!=null)&&(
                    <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',gap:10}}>
                      {d.curtidas!=null&&<span>❤️ {d.curtidas}</span>}
                      {d.comentarios!=null&&<span>💬 {d.comentarios}</span>}
                      {d.visualizacoes!=null&&<span>👁 {d.visualizacoes}</span>}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>

        {modalDiv&&(
          <div className="modal-backdrop" style={{zIndex:1300}} onClick={e=>e.target===e.currentTarget&&setModalDiv(false)}>
            <div className="modal" style={{maxWidth:460}}>
              <div className="modal-header">
                <h2 className="modal-title">Registrar divulgação</h2>
                <button className="btn btn-ghost btn-icon" onClick={()=>setModalDiv(false)}><X size={16}/></button>
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value,link:'',curtidas:'',comentarios:'',visualizacoes:''}))}>
                      <option value="">Selecionar...</option>
                      {TIPOS_DIV.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data</label>
                    <input className="form-input" type="date" value={form.data_divulgacao} onChange={e=>setForm(f=>({...f,data_divulgacao:e.target.value}))}/>
                  </div>
                </div>
                {temLink&&(
                  <>
                    <div className="form-group">
                      <label className="form-label">Link</label>
                      <input className="form-input" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://..."/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                      <div className="form-group"><label className="form-label">Curtidas</label><input className="form-input" type="number" value={form.curtidas} onChange={e=>setForm(f=>({...f,curtidas:e.target.value}))} placeholder="0"/></div>
                      <div className="form-group"><label className="form-label">Comentários</label><input className="form-input" type="number" value={form.comentarios} onChange={e=>setForm(f=>({...f,comentarios:e.target.value}))} placeholder="0"/></div>
                      <div className="form-group"><label className="form-label">Visualizações</label><input className="form-input" type="number" value={form.visualizacoes} onChange={e=>setForm(f=>({...f,visualizacoes:e.target.value}))} placeholder="0"/></div>
                    </div>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost" onClick={()=>setModalDiv(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvarDiv} disabled={saving||!form.tipo}>{saving?'Salvando...':'Salvar'}</button>
              </div>
            </div>
          </div>
        )}
        {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
// ── GRADE DE BARRAS (compartilhada entre mensal e semanal) ─
function GradeBarras({semanas, evsComLinha, altCelula, hj, setModalCp, labelIdx}){
  return(
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',width:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',borderBottom:'1px solid var(--border)'}}>
        {DIAS_SEMANA.map((d,i)=>(
          <div key={d} style={{padding:'10px 0',textAlign:'center',fontSize:11,fontWeight:700,color:i===0||i===6?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>
        ))}
      </div>
      {semanas.map((sem,si)=>{
        const semK=sem.map(s=>s.key)
        const ultima=si===semanas.length-1
        const evsSem=evsComLinha.filter(ev=>ev.fim>=semK[0]&&ev.inicio<=semK[6])
        return(
          <div key={semK[0]} style={{position:'relative',borderBottom:ultima?'none':'1px solid var(--border)'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))'}}>
              {sem.map(({key,dia,doMes},ci)=>{
                const ehH=key===hj,fds=ci===0||ci===6
                return(
                  <div key={key} style={{height:altCelula,boxSizing:'border-box',borderRight:ci<6?'1px solid var(--border)':'none',padding:'4px 5px',
                    background:ehH?'var(--accent-glow)':fds&&doMes?'rgba(255,255,255,0.012)':'transparent',opacity:doMes?1:0.35}}>
                    <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:24,height:24,borderRadius:'50%',fontSize:12,
                      fontWeight:ehH?800:500,color:ehH?'#fff':fds?'var(--accent)':'var(--text-muted)',background:ehH?'var(--accent)':'transparent'}}>{dia}</div>
                  </div>
                )
              })}
            </div>
            <div style={{position:'absolute',top:30,left:0,right:0,pointerEvents:'none'}}>
              {evsSem.map(ev=>{
                const idxI=Math.max(0,semK.findIndex(k=>k===ev.inicio)<0?0:semK.findIndex(k=>k===ev.inicio))
                const idxF=Math.min(6,semK.findIndex(k=>k===ev.fim)<0?6:semK.findIndex(k=>k===ev.fim))
                const iniciaAqui=ev.inicio>=semK[0]
                const terminaAqui=ev.fim<=semK[6]
                const cor=COR_ST[ev.cp.status]||'#6b7280'
                const top=ev.linha*24
                const left=`calc(${idxI}/7*100% + ${iniciaAqui?3:0}px)`
                const right=`calc(${6-idxF}/7*100% + ${terminaAqui?3:0}px)`
                const divQtd=ev.cp.campanha_divulgacoes?.length||0
                const br=iniciaAqui&&terminaAqui?'20px':iniciaAqui?'20px 0 0 20px':terminaAqui?'0 20px 20px 0':'0'
                return(
                  <div key={`${ev.id}-${si}-${labelIdx}`} onClick={()=>setModalCp(ev.cp)}
                    style={{position:'absolute',top,left,right,height:20,borderRadius:br,
                      background:cor,opacity:ev.cp.status==='recusou'?.4:.85,
                      display:'flex',alignItems:'center',paddingLeft:iniciaAqui?8:4,paddingRight:4,
                      cursor:'pointer',pointerEvents:'all',overflow:'hidden',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}
                    title={`${ev.cp.parceiros?.nome} — ${ev.cp.campanhas?.nome}`}>
                    {iniciaAqui&&(
                      <span style={{fontSize:10,fontWeight:700,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1}}>
                        {ev.cp.parceiros?.nome}
                        {divQtd>0&&<span style={{marginLeft:4,opacity:.8}}>✓{divQtd}</span>}
                      </span>
                    )}
                    {terminaAqui&&<span style={{fontSize:9,marginLeft:2,flexShrink:0}}>{ICONE_ST[ev.cp.status]||'🕐'}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Monitoramento(){
  const agora=new Date()
  const[ano,setAno]=useState(agora.getFullYear())
  const[mes,setMes]=useState(agora.getMonth()+1)
  const[semDom,setSemDom]=useState(domingoDeKey(hojeKey()))
  const[visao,setVisao]=useState('mensal') // 'mensal' | 'semanal'
  const[dados,setDados]=useState([])
  const[loading,setLoading]=useState(true)
  const[modalCp,setModalCp]=useState(null)
  const[toast,showToast]=useToast()

  // Para semanal: busca o mês do domingo atual (pode precisar de dois meses)
  const anoSem=Number(semDom.split('-')[0])
  const mesSem=Number(semDom.split('-')[1])

  async function carregar(a,m){
    setLoading(true)
    try{setDados(await getMonitoramento({ano:a,mes:m}))}
    catch(e){console.error(e)}finally{setLoading(false)}
  }

  useEffect(()=>{
    if(visao==='mensal') carregar(ano,mes)
    else carregar(anoSem,mesSem)
  },[ano,mes,visao,semDom])

  function navMes(d){let nm=mes+d,na=ano;if(nm>12){nm=1;na++}if(nm<1){nm=12;na--}setMes(nm);setAno(na)}
  function navSem(d){setSemDom(addDias(semDom,d*7))}

  function handleUpdate(upd){setDados(p=>p.map(cp=>cp.id===upd.id?{...cp,...upd}:cp))}

  const hj=hojeKey()

  // ── MENSAL ──
  const grid=gerarGrid(ano,mes)
  const iniMes=toKey(ano,mes,1)
  const fimMes=toKey(ano,mes,diasNoMes(ano,mes))

  // ── SEMANAL ──
  const semana=gerarSemana(semDom)
  const iniSem=semDom
  const fimSem=addDias(semDom,6)

  // Recorta eventos ao período visível
  const periodoIni = visao==='mensal' ? iniMes : iniSem
  const periodoFim = visao==='mensal' ? fimMes : fimSem

  const eventos=dados.map(cp=>{
    const ini=cp.data_inicio||cp.data_publicacao_combinada||cp.data_fim
    const fim=cp.data_fim||cp.data_publicacao_combinada||cp.data_inicio
    if(!ini||!fim)return null
    const iniV=ini<periodoIni?periodoIni:ini
    const fimV=fim>periodoFim?periodoFim:fim
    if(iniV>fimV)return null
    return{id:cp.id,inicio:iniV,fim:fimV,cp}
  }).filter(Boolean)

  const evsComLinha=calcLinhas(eventos)
  const maxL=evsComLinha.reduce((m,e)=>Math.max(m,e.linha+1),1)
  // Semanal tem mais espaço vertical
  const altCelula=visao==='semanal' ? 40+maxL*28 : 30+maxL*24

  const totalPostou=dados.filter(cp=>cp.status==='publicado').length
  const totalPend=dados.filter(cp=>['convidado','confirmado'].includes(cp.status)).length
  const totalNao=dados.filter(cp=>cp.status==='nao_publicou').length
  const totalSR=dados.filter(cp=>cp.status==='sem_retorno').length

  // Semanas do mês para visão mensal
  const semanasMes=Array.from({length:grid.length/7},(_,si)=>grid.slice(si*7,si*7+7).map(g=>({...g,doMes:g.doMes})))

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Eye size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Monitoramento</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{dados.length} parceiro{dados.length!==1?'s':''}</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          {/* Resumo */}
          <div style={{display:'flex',gap:16}}>
            {[{n:totalPostou,l:'Postaram',c:'#22c55e'},{n:totalPend,l:'Pendentes',c:'#eab308'},{n:totalNao,l:'Não postaram',c:'#ef4444'},{n:totalSR,l:'Sem retorno',c:'#6b7280'}].map(({n,l,c})=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:c,lineHeight:1}}>{n}</div>
                <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Toggle visão */}
          <div style={{display:'flex',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
            {['mensal','semanal'].map(v=>(
              <button key={v} onClick={()=>{
                setVisao(v)
                // Ao mudar para semanal, vai para a semana que contém hoje (ou o mês atual)
                if(v==='semanal') setSemDom(domingoDeKey(toKey(ano,mes,1)<=hj&&hj<=toKey(ano,mes,diasNoMes(ano,mes))?hj:toKey(ano,mes,1)))
              }}
                style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',
                  background:visao===v?'var(--accent)':'transparent',
                  color:visao===v?'#fff':'var(--text-muted)',transition:'all 0.15s'}}>
                {v==='mensal'?'Mensal':'Semanal'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 20px'}}>
        {visao==='mensal'?(
          <>
            <button className="btn btn-ghost btn-icon" onClick={()=>navMes(-1)}><ChevronLeft size={18}/></button>
            <span style={{fontSize:18,fontWeight:700,color:'var(--text)',minWidth:220,textAlign:'center'}}>{MESES[mes-1]} {ano}</span>
            <button className="btn btn-ghost btn-icon" onClick={()=>navMes(1)}><ChevronRight size={18}/></button>
          </>
        ):(
          <>
            <button className="btn btn-ghost btn-icon" onClick={()=>navSem(-1)}><ChevronLeft size={18}/></button>
            <span style={{fontSize:18,fontWeight:700,color:'var(--text)',minWidth:260,textAlign:'center'}}>{labelSemana(semDom)}</span>
            <button className="btn btn-ghost btn-icon" onClick={()=>navSem(1)}><ChevronRight size={18}/></button>
          </>
        )}
      </div>

      {loading?<div className="loading"><div className="spinner"/></div>:(
        visao==='mensal'
          ? <GradeBarras semanas={semanasMes} evsComLinha={evsComLinha} altCelula={altCelula} hj={hj} setModalCp={setModalCp} labelIdx={`${ano}-${mes}`}/>
          : <GradeBarras semanas={[semana.map(d=>({...d,doMes:true}))]} evsComLinha={evsComLinha} altCelula={altCelula} hj={hj} setModalCp={setModalCp} labelIdx={semDom}/>
      )}

      <div style={{display:'flex',gap:16,marginTop:12,flexWrap:'wrap'}}>
        {[{c:'#22c55e',l:'✅ Publicou'},{c:'#eab308',l:'🕐 Pendente'},{c:'#ef4444',l:'❌ Não publicou'},{c:'#6b7280',l:'💬 Sem retorno'}].map(({c,l})=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text-muted)'}}>
            <div style={{width:24,height:8,borderRadius:4,background:c}}/>{l}
          </div>
        ))}
      </div>

      {modalCp&&<ModalPeriodo cp={modalCp} onClose={()=>setModalCp(null)} onUpdate={handleUpdate}/>}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
