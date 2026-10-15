import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import CalendarioGrade,{STATUS} from '../components/CalendarioGrade'
export default function CalendarioParceiroPublico(){
 const {token}=useParams(),[payload,setPayload]=useState(null),[item,setItem]=useState(null),[status,setStatus]=useState('pendente'),[url,setUrl]=useState(''),[erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 useEffect(()=>{let ativo=true;supabase.rpc('calendario_consultar',{p_token:token}).then(({data,error})=>{if(!ativo)return;setPayload(data);setErro(error?.message||(!data?'Link inválido ou revogado.':''));setLoading(false)});return()=>{ativo=false}},[token])
 const selecionar=e=>{setItem(e);setStatus(e.status);setUrl(e.link_publicacao||'');setAviso('');setErro('')}
 const salvar=async()=>{if(saving||!item)return;setSaving(true);setErro('');setAviso('')
 const {data,error}=await supabase.rpc('calendario_atualizar_publico',{p_token:token,p_divulgacao:item.id,p_status:status,p_link:url||null});setSaving(false)
 if(error||!data)return setErro(error?.message||'Não foi possível atualizar. Confira se o link continua válido.')
 const atualizado={...item,status,link_publicacao:url||null};setItem(atualizado);setPayload(p=>({...p,itens:p.itens.map(i=>i.id===item.id?atualizado:i)}));setAviso('Atualização registrada.')}
 return <main className="cd-public"><div className="cd-page"><header><strong>Órbita · CEDET</strong><h1>Seu calendário de divulgações</h1></header>
 {loading?<p>Carregando...</p>:payload?<><p>Olá, {payload.parceiro}! Aqui estão as sugestões de conteúdo e os roteiros do seu planejamento.</p>
 <CalendarioGrade items={payload.itens||[]} selectedId={item?.id} onSelect={selecionar}/>
 {item&&<section className="cd-panel"><h2>{item.titulo}</h2><p>{new Date(item.data_publicacao+'T12:00:00').toLocaleDateString('pt-BR')} · {item.tipo}</p>{item.tema&&<p><strong>Tema:</strong> {item.tema}</p>}
 {item.roteiro&&<><h3>Roteiro sugerido</h3><p style={{whiteSpace:'pre-wrap'}}>{item.roteiro}</p><button onClick={()=>navigator.clipboard.writeText(item.roteiro).then(()=>setAviso('Roteiro copiado.')).catch(()=>setErro('Selecione e copie o texto manualmente.'))}>Copiar roteiro</button></>}
 {item.orientacoes&&<><h3>Orientações</h3><p style={{whiteSpace:'pre-wrap'}}>{item.orientacoes}</p></>}
 <label>Andamento da divulgação</label><select value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(STATUS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>
 <label>Link do conteúdo publicado (opcional)</label><input type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/>
 <button onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar atualização'}</button></section>}
 </>:<p>Não foi possível abrir este calendário.</p>}{aviso&&<p role="status">{aviso}</p>}{erro&&<p className="cd-error" role="alert">{erro}</p>}
 <p style={{fontSize:12,marginTop:24}}>Este link é pessoal. Evite compartilhá-lo com outras pessoas.</p></div></main>
}
