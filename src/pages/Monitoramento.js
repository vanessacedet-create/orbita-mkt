import { useEffect, useState } from 'react'
import { getRegistrosMonitoramento, createRegistroMonitoramento, updateRegistroMonitoramento, deleteRegistroMonitoramento, getParceiros } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Eye, Plus, Pencil, Trash2, X } from 'lucide-react'

// ── UTILITÁRIOS DE DATA ────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function diaDaSemana(ano, mes, dia) {
  let a=ano,m=mes; if(m<3){m+=12;a-=1}
  const k=a%100,j=Math.floor(a/100)
  return(((dia+Math.floor(13*(m+1)/5)+k+Math.floor(k/4)+Math.floor(j/4)-2*j)%7)+6)%7
}
function diasNoMes(ano,mes){
  if(mes===2){return((ano%4===0&&ano%100!==0)||(ano%400===0))?29:28}
  return[0,31,28,31,30,31,30,31,31,30,31,30,31][mes]
}
function pad(n){return String(n).padStart(2,'0')}
function toKey(a,m,d){return`${a}-${pad(m)}-${pad(d)}`}
function hojeKey(){const d=new Date();return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())}
function addDias(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())}
function domingoDeKey(key){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()-d.getDay());return toKey(d.getFullYear(),d.getMonth()+1,d.getDate())}
function labelSemana(dom){
  const fim=addDias(dom,6)
  const[ay,am,ad]=dom.split('-').map(Number)
  const[by,bm,bd]=fim.split('-').map(Number)
  const mn=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return am===bm?`${ad}–${bd} ${mn[bm-1]} ${by}`:`${ad} ${mn[am-1]} – ${bd} ${mn[bm-1]} ${ay}`
}

function gerarGrid(ano,mes){
  const p=diaDaSemana(ano,mes,1),t=diasNoMes(ano,mes),g=[]
  if(p>0){const ma=mes===1?12:mes-1,aa=mes===1?ano-1:ano,ta=diasNoMes(aa,ma);for(let i=p-1;i>=0;i--)g.push({key:toKey(aa,ma,ta-i),dia:ta-i,doMes:false})}
  for(let d=1;d<=t;d++)g.push({key:toKey(ano,mes,d),dia:d,doMes:true})
  const r=g.length%7;if(r>0){const mp=mes===12?1:mes+1,ap=mes===12?ano+1:ano;for(let d=1;d<=7-r;d++)g.push({key:toKey(ap,mp,d),dia:d,doMes:false})}
  return g
}

// ── CONSTANTES ─────────────────────────────────────────────
const TIPOS_DIV = [
  {value:'stories',       label:'Stories',      temLink:false},
  {value:'feed',          label:'Feed',          temLink:true},
  {value:'reels',         label:'Reels',         temLink:true},
  {value:'tiktok',        label:'TikTok',        temLink:true},
  {value:'youtube',       label:'YouTube',       temLink:true},
  {value:'shorts',        label:'Shorts',        temLink:true},
  {value:'twitter',       label:'Twitter/X',     temLink:true},
  {value:'grupo_interno', label:'Grupo interno', temLink:false},
]

const STATUS_OPTS = [
  {value:'pendente',     label:'Pendente',      cor:'#6b7280', icon:'🕐'},
  {value:'postou',       label:'Postou',        cor:'#22c55e', icon:'✅'},
  {value:'nao_postou',   label:'Não postou',    cor:'#ef4444', icon:'❌'},
  {value:'sem_retorno',  label:'Sem retorno',   cor:'#eab308', icon:'💬'},
]

function statusInfo(s){ return STATUS_OPTS.find(x=>x.value===s)||STATUS_OPTS[0] }

function useToast(){
  const[t,setT]=useState(null)
  function show(msg,type='success'){setT({msg,type});setTimeout(()=>setT(null),4000)}
  return[t,show]
}

// ── MODAL NOVO / EDITAR REGISTRO ───────────────────────────
function ModalRegistro({registro, dataInicial, parceiros, onSave, onClose}){
  const EMPTY = {
    parceiro_id:'', data: dataInicial||hojeKey(),
    status:'pendente', tipo_postagem:'', link:'',
    observacao:''
  }
  const[form,setForm]=useState(registro ? {
    parceiro_id: registro.parceiro_id||'',
    data: registro.data||'',
    status: registro.status||'pendente',
    tipo_postagem: registro.tipo_postagem||'',
    link: registro.link||'',
    observacao: registro.observacao||'',
  } : EMPTY)
  const[saving,setSaving]=useState(false)
  const[search,setSearch]=useState(registro?.parceiros?.nome||'')
  const[open,setOpen]=useState(false)

  const tipoSel = TIPOS_DIV.find(t=>t.value===form.tipo_postagem)
  const temLink = tipoSel?.temLink||false

  const filtrados = parceiros.filter(p=>p.nome.toLowerCase().includes(search.toLowerCase()))

  async function salvar(){
    if(!form.parceiro_id||!form.data)return
    setSaving(true)
    try{
      await onSave(form)
      onClose()
    }catch(e){console.error(e)}finally{setSaving(false)}
  }

  return(
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header">
          <h2 className="modal-title">{registro?'Editar registro':'Novo registro'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          {/* Parceiro */}
          <div className="form-group" style={{position:'relative'}}>
            <label className="form-label">Parceiro *</label>
            <input className="form-input" value={search}
              onChange={e=>{setSearch(e.target.value);setOpen(true);if(!e.target.value)setForm(f=>({...f,parceiro_id:''}))}}
              onFocus={()=>setOpen(true)} placeholder="Buscar parceiro..." autoComplete="off"/>
            {open&&search.length>0&&(
              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:180,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                {filtrados.length===0
                  ?<div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado</div>
                  :filtrados.slice(0,8).map(p=>(
                    <div key={p.id} onClick={()=>{setForm(f=>({...f,parceiro_id:p.id}));setSearch(p.nome);setOpen(false)}}
                      style={{padding:'9px 14px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      {p.nome}
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Data */}
          <div className="form-group">
            <label className="form-label">Data *</label>
            <input className="form-input" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/>
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {STATUS_OPTS.map(s=>(
                <button key={s.value} type="button" onClick={()=>setForm(f=>({...f,status:s.value}))}
                  style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                    border:`2px solid ${s.cor}`,background:form.status===s.value?s.cor:'transparent',
                    color:form.status===s.value?'#fff':s.cor,transition:'all 0.15s'}}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de postagem */}
          <div className="form-group">
            <label className="form-label">Tipo de postagem</label>
            <select className="form-select" value={form.tipo_postagem}
              onChange={e=>setForm(f=>({...f,tipo_postagem:e.target.value,link:''}))}>
              <option value="">Selecionar...</option>
              {TIPOS_DIV.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Link — só para tipos que têm link */}
          {temLink&&(
            <div className="form-group">
              <label className="form-label">Link da publicação</label>
              <input className="form-input" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://..."/>
            </div>
          )}

          {/* Observação */}
          <div className="form-group">
            <label className="form-label">Observação</label>
            <textarea className="form-textarea" rows={2} value={form.observacao}
              onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} placeholder="Notas opcionais..."/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.parceiro_id||!form.data}>
            {saving?'Salvando...':registro?'Salvar':'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL DIA ──────────────────────────────────────────────
function ModalDia({dataKey, registros, parceiros, onAdd, onEdit, onDelete, onClose}){
  const[ay,am,ad]=dataKey.split('-').map(Number)
  return(
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:500,maxHeight:'80vh',overflowY:'auto'}}>
        <div className="modal-header">
          <h2 className="modal-title">{ad} de {MESES[am-1]} de {ay}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{marginBottom:16}}>
          <button className="btn btn-primary btn-sm" onClick={()=>onAdd(dataKey)}
            style={{display:'flex',alignItems:'center',gap:4,fontSize:12}}>
            <Plus size={13}/> Adicionar registro
          </button>
        </div>
        {registros.length===0
          ?<p style={{fontSize:13,color:'var(--text-muted)'}}>Nenhum registro para este dia.</p>
          :registros.map(r=>{
            const st=statusInfo(r.status)
            const tipo=TIPOS_DIV.find(t=>t.value===r.tipo_postagem)
            return(
              <div key={r.id} style={{background:'var(--surface-2)',border:`1px solid var(--border)`,borderLeft:`3px solid ${st.cor}`,borderRadius:8,padding:'10px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{r.parceiros?.nome}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:11,color:st.cor,fontWeight:600}}>{st.icon} {st.label}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>onEdit(r)}><Pencil size={11}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>onDelete(r.id)}><Trash2 size={11}/></button>
                  </div>
                </div>
                {tipo&&<div style={{fontSize:11,marginBottom:2}}><span className="badge badge-indigo" style={{fontSize:10}}>{tipo.label}</span></div>}
                {r.link&&<a href={r.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:'var(--accent)',display:'block',marginTop:4}}>🔗 Ver publicação</a>}
                {r.observacao&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{r.observacao}</div>}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ── CALENDÁRIO ─────────────────────────────────────────────
function Calendario({semanas, porDia, hj, onClickDia}){
  return(
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',width:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',borderBottom:'1px solid var(--border)'}}>
        {DIAS_SEMANA.map((d,i)=>(
          <div key={d} style={{padding:'10px 0',textAlign:'center',fontSize:11,fontWeight:700,
            color:i===0||i===6?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>
        ))}
      </div>
      {semanas.map((sem,si)=>(
        <div key={si} style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',borderBottom:si===semanas.length-1?'none':'1px solid var(--border))'}}>
          {sem.map(({key,dia,doMes},ci)=>{
            const regs = porDia[key]||[]
            const ehH  = key===hj
            const fds  = ci===0||ci===6
            // Contagem por status
            const postou   = regs.filter(r=>r.status==='postou').length
            const naoPst   = regs.filter(r=>r.status==='nao_postou').length
            const semRet   = regs.filter(r=>r.status==='sem_retorno').length
            const pendente = regs.filter(r=>r.status==='pendente').length
            return(
              <div key={key} onClick={()=>doMes&&onClickDia(key)}
                style={{minHeight:100,boxSizing:'border-box',padding:'6px 5px',
                  borderRight:ci<6?'1px solid var(--border)':'none',
                  background:ehH?'var(--accent-glow)':fds&&doMes?'rgba(255,255,255,0.012)':'transparent',
                  opacity:doMes?1:0.3, cursor:doMes?'pointer':'default',
                  transition:'background 0.15s'}}
                onMouseEnter={e=>{if(doMes)e.currentTarget.style.background='var(--surface-2)'}}
                onMouseLeave={e=>{e.currentTarget.style.background=ehH?'var(--accent-glow)':fds&&doMes?'rgba(255,255,255,0.012)':'transparent'}}>

                {/* Número do dia */}
                <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                  width:24,height:24,borderRadius:'50%',fontSize:12,marginBottom:4,
                  fontWeight:ehH?800:500,
                  color:ehH?'#fff':fds?'var(--accent)':'var(--text-muted)',
                  background:ehH?'var(--accent)':'transparent'}}>{dia}</div>

                {/* Pílulas de status */}
                {regs.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {postou>0&&<div style={{background:'#22c55e22',border:'1px solid #22c55e44',borderRadius:4,padding:'1px 5px',fontSize:10,color:'#22c55e',fontWeight:700}}>✅{postou}</div>}
                    {naoPst>0&&<div style={{background:'#ef444422',border:'1px solid #ef444444',borderRadius:4,padding:'1px 5px',fontSize:10,color:'#ef4444',fontWeight:700}}>❌{naoPst}</div>}
                    {semRet>0&&<div style={{background:'#eab30822',border:'1px solid #eab30844',borderRadius:4,padding:'1px 5px',fontSize:10,color:'#eab308',fontWeight:700}}>💬{semRet}</div>}
                    {pendente>0&&<div style={{background:'#6b728022',border:'1px solid #6b728044',borderRadius:4,padding:'1px 5px',fontSize:10,color:'#9ca3af',fontWeight:700}}>🕐{pendente}</div>}
                  </div>
                )}

                {/* Nomes (até 2) */}
                {regs.slice(0,2).map(r=>{
                  const st=statusInfo(r.status)
                  return(
                    <div key={r.id} style={{marginTop:2,fontSize:10,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                      borderLeft:`2px solid ${st.cor}`,paddingLeft:4}}>
                      {r.parceiros?.nome}
                    </div>
                  )
                })}
                {regs.length>2&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>+{regs.length-2} mais</div>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Monitoramento(){
  const agora = new Date()
  const[ano,setAno]     = useState(agora.getFullYear())
  const[mes,setMes]     = useState(agora.getMonth()+1)
  const[semDom,setSemDom] = useState(domingoDeKey(hojeKey()))
  const[visao,setVisao] = useState('mensal')
  const[registros,setRegistros] = useState([])
  const[parceiros,setParceiros] = useState([])
  const[loading,setLoading] = useState(true)
  const[modalDia,setModalDia] = useState(null)     // dataKey
  const[modalForm,setModalForm] = useState(null)   // {registro?, dataInicial?}
  const[toast,showToast] = useToast()

  async function carregar(a,m){
    setLoading(true)
    try{ setRegistros(await getRegistrosMonitoramento({ano:a,mes:m})) }
    catch(e){ console.error(e) }finally{ setLoading(false) }
  }

  useEffect(()=>{ getParceiros().then(setParceiros).catch(console.error) },[])
  useEffect(()=>{
    const a = visao==='mensal' ? ano : Number(semDom.split('-')[0])
    const m = visao==='mensal' ? mes  : Number(semDom.split('-')[1])
    carregar(a,m)
  },[ano,mes,visao,semDom])

  function navMes(d){let nm=mes+d,na=ano;if(nm>12){nm=1;na++}if(nm<1){nm=12;na--}setMes(nm);setAno(na)}
  function navSem(d){setSemDom(addDias(semDom,d*7))}

  // porDia
  const porDia={}
  for(const r of registros){
    if(!r.data)continue
    if(!porDia[r.data])porDia[r.data]=[]
    porDia[r.data].push(r)
  }

  // Grids
  const gridMes  = gerarGrid(ano,mes)
  const semanas  = visao==='mensal'
    ? Array.from({length:gridMes.length/7},(_,si)=>gridMes.slice(si*7,si*7+7))
    : [Array.from({length:7},(_,i)=>({key:addDias(semDom,i),dia:Number(addDias(semDom,i).split('-')[2]),doMes:true}))]

  const hj = hojeKey()

  // Totais
  const totalPostou  = registros.filter(r=>r.status==='postou').length
  const totalNao     = registros.filter(r=>r.status==='nao_postou').length
  const totalPend    = registros.filter(r=>r.status==='pendente').length
  const totalSemRet  = registros.filter(r=>r.status==='sem_retorno').length

  async function handleSave(form){
    if(modalForm?.registro){
      const upd = await updateRegistroMonitoramento(modalForm.registro.id, form)
      setRegistros(p=>p.map(r=>r.id===upd.id?upd:r))
      showToast('Atualizado!')
    } else {
      const novo = await createRegistroMonitoramento(form)
      setRegistros(p=>[...p,novo])
      showToast('Registrado!')
    }
  }

  async function handleDelete(id){
    if(!window.confirm('Excluir este registro?'))return
    await deleteRegistroMonitoramento(id)
    setRegistros(p=>p.filter(r=>r.id!==id))
    showToast('Removido!')
    // Fecha modal do dia se não sobrar nada
    if(modalDia){
      const restantes = registros.filter(r=>r.id!==id&&r.data===modalDia)
      if(restantes.length===0) setModalDia(null)
    }
  }

  return(
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Eye size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Monitoramento</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {registros.length} registro{registros.length!==1?'s':''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          {/* Resumo */}
          <div style={{display:'flex',gap:16}}>
            {[{n:totalPostou,l:'Postaram',c:'#22c55e'},{n:totalNao,l:'Não postaram',c:'#ef4444'},{n:totalSemRet,l:'Sem retorno',c:'#eab308'},{n:totalPend,l:'Pendentes',c:'#6b7280'}].map(({n,l,c})=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:c,lineHeight:1}}>{n}</div>
                <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Botão novo + toggle visão */}
          <button className="btn btn-primary" onClick={()=>setModalForm({dataInicial:hj})}
            style={{display:'flex',alignItems:'center',gap:6}}>
            <Plus size={15}/> Novo registro
          </button>
          <div style={{display:'flex',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
            {['mensal','semanal'].map(v=>(
              <button key={v} onClick={()=>{
                setVisao(v)
                if(v==='semanal') setSemDom(domingoDeKey(toKey(ano,mes,1)<=hj&&hj<=toKey(ano,mes,diasNoMes(ano,mes))?hj:toKey(ano,mes,1)))
              }} style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',
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
        <button className="btn btn-ghost btn-icon" onClick={()=>visao==='mensal'?navMes(-1):navSem(-1)}><ChevronLeft size={18}/></button>
        <span style={{fontSize:18,fontWeight:700,color:'var(--text)',minWidth:240,textAlign:'center'}}>
          {visao==='mensal' ? `${MESES[mes-1]} ${ano}` : labelSemana(semDom)}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={()=>visao==='mensal'?navMes(1):navSem(1)}><ChevronRight size={18}/></button>
      </div>

      {/* Calendário */}
      {loading
        ?<div className="loading"><div className="spinner"/></div>
        :<Calendario semanas={semanas} porDia={porDia} hj={hj} onClickDia={key=>setModalDia(key)}/>
      }

      {/* Legenda */}
      <div style={{display:'flex',gap:16,marginTop:12,flexWrap:'wrap'}}>
        {[{c:'#22c55e',l:'✅ Postou'},{c:'#ef4444',l:'❌ Não postou'},{c:'#eab308',l:'💬 Sem retorno'},{c:'#6b7280',l:'🕐 Pendente'}].map(({c,l})=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text-muted)'}}>
            <div style={{width:16,height:8,borderRadius:3,background:c}}/>{l}
          </div>
        ))}
      </div>

      {/* Modal dia */}
      {modalDia&&(
        <ModalDia
          dataKey={modalDia}
          registros={registros.filter(r=>r.data===modalDia)}
          parceiros={parceiros}
          onAdd={key=>{setModalDia(null);setModalForm({dataInicial:key})}}
          onEdit={r=>{setModalDia(null);setModalForm({registro:r})}}
          onDelete={async id=>{await handleDelete(id)}}
          onClose={()=>setModalDia(null)}
        />
      )}

      {/* Modal form */}
      {modalForm&&(
        <ModalRegistro
          registro={modalForm.registro}
          dataInicial={modalForm.dataInicial}
          parceiros={parceiros}
          onSave={handleSave}
          onClose={()=>setModalForm(null)}
        />
      )}

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
