import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Clock3, Save, ShieldCheck, Users, Ban, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import {
  JORNADAS_PADRAO, calcularRegistro, formatarSaldo, getConfiguracoesJornada,
  getDiasInativos, getEquipeJornada, getRegistrosJornada, motivoBloqueio,
  removerDiaInativo, salvarConfiguracaoJornada, salvarDiaInativo, salvarRegistroJornada,
} from '../lib/jornadaParceiras'

const hoje = new Date().toISOString().slice(0,10)
const inicioMes = `${hoje.slice(0,7)}-01`
const STATUS = ['normal','atestado','falta','folga','férias','home office','outro']

function diasEntre(inicio,fim){
  const out=[];let d=new Date(`${inicio}T12:00:00`), f=new Date(`${fim}T12:00:00`)
  while(d<=f){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1)}
  return out
}
function padraoPorNome(nome,perfil){
  const chave=Object.keys(JORNADAS_PADRAO).find(k=>(nome||'').toLowerCase().includes(k.toLowerCase()))
  return JORNADAS_PADRAO[chave] || { carga_minutos:perfil==='estagiario_parceiras'?360:480, entrada:'', saida:'', almoco_inicio:'', almoco_fim:'', pausa_minutos:perfil==='estagiario_parceiras'?20:15 }
}
function Card({label,value,icon:Icon,tone}){
  return <div className="card" style={{padding:16,display:'flex',gap:12,alignItems:'center'}}><div style={{width:38,height:38,borderRadius:10,display:'grid',placeItems:'center',background:tone||'var(--accent-glow)',color:'var(--accent)'}}><Icon size={18}/></div><div><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div><div style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>{value}</div></div></div>
}

export default function ControleJornadaParceiras(){
  const { usuario:usuarioReal }=useAuth()
  const { usuario }=usePermissions()
  const admin=['administrador','supervisor_parceiras'].includes(usuarioReal?.perfil)
  const [equipe,setEquipe]=useState([]),[selecionado,setSelecionado]=useState('')
  const [inicio,setInicio]=useState(inicioMes),[fim,setFim]=useState(hoje)
  const [configs,setConfigs]=useState([]),[registros,setRegistros]=useState([]),[inativos,setInativos]=useState([])
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState('')
  const [modalInativo,setModalInativo]=useState(false),[novoInativo,setNovoInativo]=useState({data:hoje,motivo:'Iniciativa da empresa',individual:false})

  useEffect(()=>{(async()=>{try{const [eq,cf]=await Promise.all([getEquipeJornada(),getConfiguracoesJornada()]);setEquipe(eq);setConfigs(cf);const alvo=admin?(eq[0]?.id||''):usuario?.id;setSelecionado(alvo)}finally{setLoading(false)}})()},[]) // eslint-disable-line
  useEffect(()=>{if(!selecionado)return;(async()=>{setLoading(true);try{const [r,i]=await Promise.all([getRegistrosJornada(selecionado,inicio,fim),getDiasInativos(inicio,fim,selecionado)]);setRegistros(r);setInativos(i)}finally{setLoading(false)}})()},[selecionado,inicio,fim])

  const pessoa=equipe.find(x=>x.id===selecionado)||usuario
  const configSalva=configs.find(x=>x.usuario_id===selecionado)
  const padrao={...padraoPorNome(pessoa?.nome,pessoa?.perfil),...(configSalva||{})}
  const mapa=useMemo(()=>Object.fromEntries(registros.map(r=>[r.data,r])),[registros])
  const dias=diasEntre(inicio,fim)
  const linhas=dias.map(data=>{
    const manual=inativos.find(i=>i.data===data && (!i.usuario_id||i.usuario_id===selecionado))
    const automatico=motivoBloqueio(data)
    const registro=mapa[data]||{}
    const inativo=!!manual||!!automatico||registro.inativo
    const calc=calcularRegistro({...registro,inativo},padrao.carga_minutos)
    return {data,registro,inativo,motivo:manual?.motivo||automatico||registro.motivo_inativo,manual,calc}
  })
  const uteis=linhas.filter(l=>!l.inativo), completos=uteis.filter(l=>l.calc.saldo!=null)
  const saldo=completos.reduce((s,l)=>s+l.calc.saldo,0), positivos=completos.filter(l=>l.calc.saldo>0).reduce((s,l)=>s+l.calc.saldo,0), negativos=completos.filter(l=>l.calc.saldo<0).reduce((s,l)=>s+l.calc.saldo,0)

  function alterar(data,campo,valor){setRegistros(atual=>{const existe=atual.find(r=>r.data===data);return existe?atual.map(r=>r.data===data?{...r,[campo]:valor}:r):[...atual,{data,usuario_id:selecionado,[campo]:valor}]})}
  async function salvarLinha(linha){setSaving(linha.data);try{const r=linha.registro;await salvarRegistroJornada({usuario_id:selecionado,data:linha.data,entrada:r.entrada||null,almoco_inicio:r.almoco_inicio||null,almoco_fim:r.almoco_fim||null,saida:r.saida||null,pausa_inicio:r.pausa_inicio||null,pausa_fim:r.pausa_fim||null,intervalo_remunerado:pessoa?.perfil==='estagiario_parceiras',status:r.status||'normal',observacoes:r.observacoes||null,editado_por:usuarioReal.id});const dados=await getRegistrosJornada(selecionado,inicio,fim);setRegistros(dados)}catch(e){alert('Erro ao salvar: '+e.message)}finally{setSaving('')}}
  async function salvarPadrao(){if(!admin)return;const payload={usuario_id:selecionado,carga_minutos:Number(padrao.carga_minutos),entrada_padrao:padrao.entrada_padrao||padrao.entrada,saida_padrao:padrao.saida_padrao||padrao.saida,almoco_inicio_padrao:padrao.almoco_inicio_padrao||padrao.almoco_inicio,almoco_fim_padrao:padrao.almoco_fim_padrao||padrao.almoco_fim,pausa_minutos:Number(padrao.pausa_minutos||0),editavel_pelo_usuario:false,updated_by:usuarioReal.id};const salvo=await salvarConfiguracaoJornada(payload);setConfigs(c=>[...c.filter(x=>x.usuario_id!==selecionado),salvo]);alert('Jornada de referência atualizada.')}
  async function criarInativo(){try{await salvarDiaInativo({data:novoInativo.data,motivo:novoInativo.motivo,usuario_id:novoInativo.individual?selecionado:null,created_by:usuarioReal.id});setInativos(await getDiasInativos(inicio,fim,selecionado));setModalInativo(false)}catch(e){alert('Erro: '+e.message)}}

  if(loading&&!pessoa)return <div className="loading"><div className="spinner"/></div>
  return <div className="page" style={{padding:24}}>
    <div className="page-header" style={{marginBottom:18}}><div><h1 className="page-title" style={{display:'flex',alignItems:'center',gap:9}}><Clock3 size={24}/>Controle de Jornada — Parceiras</h1><p className="page-subtitle">Acompanhamento informativo de horários, intervalos e saldo de horas.</p></div>{admin&&<button className="btn btn-primary" onClick={()=>setModalInativo(true)}><Ban size={15}/>Inativar dia</button>}</div>

    <div className="card" style={{padding:16,marginBottom:16}}><div className="form-row" style={{alignItems:'end'}}>{admin&&<div className="form-group"><label className="form-label">Integrante</label><select className="form-select" value={selecionado} onChange={e=>setSelecionado(e.target.value)}>{equipe.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>}<div className="form-group"><label className="form-label">De</label><input className="form-input" type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/></div><div className="form-group"><label className="form-label">Até</label><input className="form-input" type="date" value={fim} onChange={e=>setFim(e.target.value)}/></div></div></div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}><Card label="Saldo do período" value={formatarSaldo(saldo)} icon={CalendarRange}/><Card label="Horas positivas" value={formatarSaldo(positivos)} icon={ShieldCheck}/><Card label="Horas negativas" value={formatarSaldo(negativos)} icon={Clock3}/><Card label="Dias preenchidos" value={`${completos.length}/${uteis.length}`} icon={Users}/></div>

    <div className="card" style={{padding:16,marginBottom:16}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}><div><strong>{pessoa?.nome}</strong><div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>Referência: {Math.floor(padrao.carga_minutos/60)}h por dia · entrada {padrao.entrada_padrao||padrao.entrada||'—'} · saída {padrao.saida_padrao||padrao.saida||'—'} · pausa remunerada de {padrao.pausa_minutos} min.</div></div>{admin&&<button className="btn btn-ghost btn-sm" onClick={salvarPadrao}><Save size={13}/>Salvar referência</button>}</div></div>

    <div className="card" style={{overflow:'auto'}}><table className="table" style={{minWidth:1120}}><thead><tr><th>Data</th><th>Entrada</th><th>Saída almoço</th><th>Retorno</th><th>Saída</th><th>Início pausa</th><th>Fim pausa</th><th>Status</th><th>Trabalhado</th><th>Saldo</th><th>Observações</th><th></th></tr></thead><tbody>{linhas.map(l=>{const r=l.registro,bloq=l.inativo;return <tr key={l.data} style={bloq?{opacity:.62,background:'var(--surface-2)'}:{}}><td><strong>{new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR')}</strong>{bloq&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{l.motivo}</div>}</td>{['entrada','almoco_inicio','almoco_fim','saida','pausa_inicio','pausa_fim'].map(c=><td key={c}><input className="form-input" style={{minWidth:92,padding:'6px 8px'}} type="time" disabled={bloq} value={r[c]?.slice(0,5)||''} onChange={e=>alterar(l.data,c,e.target.value)}/></td>)}<td><select className="form-select" disabled={bloq} value={r.status||'normal'} onChange={e=>alterar(l.data,'status',e.target.value)}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></td><td>{l.calc.trabalhados==null?'—':formatarSaldo(l.calc.trabalhados).replace('+','')}</td><td style={{fontWeight:700,color:l.calc.saldo>0?'#16a34a':l.calc.saldo<0?'#dc2626':'var(--text-muted)'}}>{l.calc.saldo==null?'—':formatarSaldo(l.calc.saldo)}</td><td><input className="form-input" disabled={bloq} value={r.observacoes||''} onChange={e=>alterar(l.data,'observacoes',e.target.value)} placeholder="Opcional"/></td><td>{!bloq&&<button className="btn btn-ghost btn-icon" disabled={saving===l.data} onClick={()=>salvarLinha(l)} title="Salvar"><Save size={14}/></button>}{admin&&l.manual&&<button className="btn btn-ghost btn-icon" onClick={async()=>{await removerDiaInativo(l.manual.id);setInativos(await getDiasInativos(inicio,fim,selecionado))}} title="Reativar"><Trash2 size={14}/></button>}</td></tr>})}</tbody></table></div>

    {modalInativo&&<div className="modal-backdrop" onClick={()=>setModalInativo(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:430}}><div className="modal-header"><h2 className="modal-title">Inativar dia</h2></div><div className="form-grid"><div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={novoInativo.data} onChange={e=>setNovoInativo(x=>({...x,data:e.target.value}))}/></div><div className="form-group"><label className="form-label">Motivo</label><input className="form-input" value={novoInativo.motivo} onChange={e=>setNovoInativo(x=>({...x,motivo:e.target.value}))}/></div><label style={{display:'flex',gap:8,alignItems:'center',fontSize:13}}><input type="checkbox" checked={novoInativo.individual} onChange={e=>setNovoInativo(x=>({...x,individual:e.target.checked}))}/>Aplicar apenas a {pessoa?.nome}</label></div><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModalInativo(false)}>Cancelar</button><button className="btn btn-primary" onClick={criarInativo}>Confirmar</button></div></div></div>}
  </div>
}
