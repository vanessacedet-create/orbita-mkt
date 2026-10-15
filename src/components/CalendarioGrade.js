import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './CalendarioDivulgacoes.css'
const WEEK=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const STATUS={pendente:'Pendente',aguardando_aprovacao:'Aguardando aprovação',agendado:'Agendado',postado:'Postado'}
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
const plus=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)
export default function CalendarioGrade({items=[],onSelect,selectedId}) {
 const [periodo,setPeriodo]=useState('mes'),[cursor,setCursor]=useState(new Date())
 const datas=useMemo(()=>{
   if(periodo==='semana'){const d=monday(cursor);return Array.from({length:7},(_,i)=>plus(d,i))}
   const inicio=new Date(cursor.getFullYear(),cursor.getMonth(),1)
   const começo=plus(inicio,-inicio.getDay())
   const ultimo=new Date(cursor.getFullYear(),cursor.getMonth()+1,0)
   const total=Math.ceil((inicio.getDay()+ultimo.getDate())/7)*7
   return Array.from({length:total},(_,i)=>plus(começo,i))
 },[cursor,periodo])
 const legenda=periodo==='mes'
  ?cursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  :`${datas[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – ${datas[6].toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`
 const navegar=n=>setCursor(d=>periodo==='mes'?new Date(d.getFullYear(),d.getMonth()+n,1):plus(d,7*n))
 return <section className="cd-calendario">
   <div className="cd-toolbar">
     <div className="cd-nav"><button type="button" onClick={()=>navegar(-1)} aria-label="Anterior"><ChevronLeft size={18}/></button><strong>{legenda}</strong><button type="button" onClick={()=>navegar(1)} aria-label="Próximo"><ChevronRight size={18}/></button><button type="button" onClick={()=>setCursor(new Date())}>Hoje</button></div>
     <div className="cd-nav"><button type="button" aria-pressed={periodo==='mes'} onClick={()=>setPeriodo('mes')}>Mês</button><button type="button" aria-pressed={periodo==='semana'} onClick={()=>setPeriodo('semana')}>Semana</button></div>
   </div>
   <div className="cd-grid">
     {WEEK.map(d=><div className="cd-weekday" key={d}>{d}</div>)}
     {datas.map(d=>{const day=iso(d);const eventos=items.filter(i=>i.data_publicacao===day);return <div key={day} className={`cd-day ${d.getMonth()!==cursor.getMonth()&&periodo==='mes'?'cd-outside':''}`}><div className="cd-daynum">{d.getDate()}</div>{eventos.map(e=><button key={e.id} className={`cd-event cd-${e.status} ${e.id===selectedId?'cd-selected':''}`} onClick={()=>onSelect?.(e)} title={e.titulo}><span>{e.titulo}</span><small>{STATUS[e.status]||e.status}</small></button>)}</div>})}
   </div>
   <div className="cd-legend">{Object.entries(STATUS).map(([k,v])=><span key={k} className={`cd-${k}`}>● {v}</span>)}</div>
 </section>
}
export {STATUS}
