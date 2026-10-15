import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {getParceiros,getLivros} from '../lib/supabase'
import CalendarioGrade,{STATUS} from '../components/CalendarioGrade'
const vazio={data_publicacao:'',titulo:'',tipo:'Reels',tema:'',roteiro:'',orientacoes:'',status:'pendente',livro_id:'',link_publicacao:''}
export default function CalendarioDivulgacoes(){
 const [parceiros,setParceiros]=useState([]),[livros,setLivros]=useState([]),[parceiroId,setParceiroId]=useState(''),[items,setItems]=useState([])
 const [livroBusca,setLivroBusca]=useState(''),[form,setForm]=useState(null),[erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[carregando,setCarregando]=useState(false),[link,setLink]=useState('')
 useEffect(()=>{getParceiros().then(p=>setParceiros(p||[])).catch(e=>setErro(e.message))},[])
 useEffect(()=>{let ativo=true;getLivros({page:0,pageSize:50,search:livroBusca}).then(({data})=>{if(ativo)setLivros(Array.isArray(data)?data:[])}).catch(e=>{if(ativo)setErro('Não foi possível carregar livros: '+e.message)});return()=>{ativo=false}},[livroBusca])
 useEffect(()=>{if(!parceiroId){setItems([]);return}let ativo=true;supabase.from('calendario_divulgacoes').select('*').eq('parceiro_id',parceiroId).order('data_publicacao').then(({data,error})=>{if(!ativo)return;if(error)setErro(error.message);else setItems(data||[])});return()=>{ativo=false}},[parceiroId])
 const salvar=async()=>{if(!form?.titulo?.trim()||!form?.data_publicacao)return setErro('Informe título e data.');setCarregando(true);setErro('');setAviso('')
 const {id,...campos}=form;const payload={...campos,parceiro_id:parceiroId,livro_id:form.livro_id||null}
 const {data,error}=id?await supabase.from('calendario_divulgacoes').update(payload).eq('id',id).select().single():await supabase.from('calendario_divulgacoes').insert(payload).select().single()
 setCarregando(false);if(error){setErro(error.message);return}setItems(list=>[...list.filter(i=>i.id!==data.id),data].sort((a,b)=>a.data_publicacao.localeCompare(b.data_publicacao)));setForm(data);setAviso('Divulgação salva.')}
 const excluir=async()=>{if(!form?.id||!window.confirm('Excluir esta divulgação?'))return;const {error}=await supabase.from('calendario_divulgacoes').delete().eq('id',form.id);if(error)return setErro(error.message);setItems(list=>list.filter(x=>x.id!==form.id));setForm(null)}
 const gerarLink=async()=>{setErro('');setAviso('');setLink('');if(!parceiroId)return;const array=new Uint8Array(48);window.crypto.getRandomValues(array);const token=Array.from(array,b=>b.toString(16).padStart(2,'0')).join('')
 const {data,error}=await supabase.rpc('calendario_criar_link',{p_parceiro:parceiroId,p_token:token});if(error||!data)return setErro(error?.message||'Não foi possível criar o link')
 const url=window.location.origin+'/calendario/parceiro/'+token;setLink(url);setAviso('Link criado. Copie agora: por segurança, ele não poderá ser recuperado depois. Gerar novamente revoga o anterior.')}
 const v=(field,value)=>setForm(f=>({...f,[field]:value}))
 return <div className="cd-page"><h1>Calendário de divulgações</h1><p>Planeje os conteúdos e compartilhe um calendário exclusivo com cada parceiro.</p>
 <label>Parceiro</label><select value={parceiroId} onChange={e=>{setParceiroId(e.target.value);setForm(null);setLink('');setErro('');setAviso('')}}><option value="">Selecione...</option>{parceiros.map(p=><option value={p.id} key={p.id}>{p.nome}</option>)}</select>
 {parceiroId&&<><div style={{display:'flex',gap:8,margin:'14px 0',flexWrap:'wrap'}}><button className="btn btn-primary" onClick={()=>{setForm({...vazio,data_publicacao:new Date().toISOString().slice(0,10)});setAviso('')}}>+ Nova divulgação</button><button className="btn btn-ghost" onClick={gerarLink}>Gerar ou renovar link exclusivo</button></div>
 {link&&<div className="cd-panel"><label>Link (copie antes de sair)</label><input value={link} readOnly onFocus={e=>e.target.select()}/><button onClick={()=>navigator.clipboard.writeText(link).then(()=>setAviso('Link copiado.')).catch(()=>setErro('Copie manualmente o link acima.'))}>Copiar link</button></div>}
 <CalendarioGrade items={items} selectedId={form?.id} onSelect={setForm}/>
 {form&&<div className="cd-panel"><h3>{form.id?'Editar divulgação':'Nova divulgação'}</h3><label>Data</label><input type="date" value={form.data_publicacao||''} onChange={e=>v('data_publicacao',e.target.value)}/>
 <label>Título</label><input value={form.titulo||''} onChange={e=>v('titulo',e.target.value)}/>
 <label>Formato</label><select value={form.tipo} onChange={e=>v('tipo',e.target.value)}>{['Reels','Stories','Carrossel','Post','Live','Outro'].map(x=><option key={x}>{x}</option>)}</select>
 <label>Livro relacionado (opcional)</label><input placeholder="Busque pelo título, autor ou ISBN" value={livroBusca} onChange={e=>setLivroBusca(e.target.value)}/><select value={form.livro_id||''} onChange={e=>v('livro_id',e.target.value)}><option value="">Nenhum livro selecionado</option>{form.livro_id&&!livros.some(l=>l.id===form.livro_id)&&<option value={form.livro_id}>Livro selecionado (busque para alterar)</option>}{livros.map(l=><option key={l.id} value={l.id}>{l.titulo}</option>)}</select>
 <label>Tema / sugestão</label><textarea value={form.tema||''} onChange={e=>v('tema',e.target.value)}/>
 <label>Roteiro</label><textarea value={form.roteiro||''} onChange={e=>v('roteiro',e.target.value)}/>
 <label>Orientações</label><textarea value={form.orientacoes||''} onChange={e=>v('orientacoes',e.target.value)}/>
 <label>Status</label><select value={form.status} onChange={e=>v('status',e.target.value)}>{Object.entries(STATUS).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select>
 <label>Link da publicação</label><input value={form.link_publicacao||''} onChange={e=>v('link_publicacao',e.target.value)}/>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={salvar} disabled={carregando}>{carregando?'Salvando...':'Salvar'}</button>{form.id&&<button onClick={excluir}>Excluir</button>}<button onClick={()=>setForm(null)}>Fechar</button></div></div>}
 </>}
 {aviso&&<p role="status">{aviso}</p>}{erro&&<p className="cd-error" role="alert">{erro}</p>}
 </div>
}
