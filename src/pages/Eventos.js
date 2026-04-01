import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, Plus, Pencil, Trash2, X, ChevronDown, ChevronLeft,
  Upload, Users, BookOpen, Gift, Star, AlertCircle, ExternalLink,
  MapPin, Clock, Package
} from 'lucide-react'

// ── UTILITÁRIOS ────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}
function fmtData(d) {
  if (!d) return '—'
  const [a,m,dia] = d.split('-')
  return `${dia}/${m}/${a}`
}
function hoje() { return new Date().toISOString().slice(0,10) }

const STATUS_EVENTO = [
  { v:'planejamento', l:'Planejamento', cls:'badge-indigo' },
  { v:'confirmado',   l:'Confirmado',   cls:'badge-amber'  },
  { v:'em_andamento', l:'Em andamento', cls:'badge-cyan'   },
  { v:'encerrado',    l:'Encerrado',    cls:'badge-green'  },
  { v:'cancelado',    l:'Cancelado',    cls:'badge-red'    },
]
const TIPO_EVENTO = [
  { v:'padrao', l:'Evento Padrão' },
  { v:'cdl',    l:'Caminho do Livro (CDL)' },
]

const OBJETIVO_LABEL = {
  branding:'Branding', vendas:'Vendas', relacionamento:'Relacionamento',
  lancamento:'Lançamento de produto', outro:'Outro',
}
const FORMA_LABEL = {
  publicidade:'Publicidade',
  comissao:'Comissão de vendas (CEDET)',
  vendas_diretas:'Vendas diretas (revendas)',
  evento_interno:'Evento interno',
}
const STATUS_PART = [
  { v:'confirmado', l:'Confirmado', cls:'badge-green'  },
  { v:'pendente',   l:'Pendente',   cls:'badge-amber'  },
  { v:'cancelado',  l:'Cancelado',  cls:'badge-red'    },
]
const STATUS_AUTOR = [
  { v:'convidado', l:'Convidado', cls:'badge-indigo' },
  { v:'aceito',    l:'Aceito',    cls:'badge-green'  },
  { v:'recusado',  l:'Recusado',  cls:'badge-red'    },
]
const STATUS_BRINDE = [
  { v:'planejado',   l:'Planejado',   cls:'badge-indigo' },
  { v:'em_producao', l:'Em produção', cls:'badge-amber'  },
  { v:'disponivel',  l:'Disponível',  cls:'badge-cyan'   },
  { v:'entregue',    l:'Entregue',    cls:'badge-green'  },
]
const TIPO_PRODUTO = ['livro','colecao','kit','outro']
const TIPO_PRODUTO_LABEL = { livro:'Livro', colecao:'Coleção', kit:'Kit', outro:'Outro' }

// ── SUPABASE HELPERS ───────────────────────────────────────
async function getEventos() {
  const { data } = await supabase.from('eventos')
    .select('*, usuarios(id,nome)')
    .order('data_inicio', { ascending: false })
  return data || []
}
async function getEvento(id) {
  const { data } = await supabase.from('eventos')
    .select(`*, usuarios(id,nome),
      evento_materiais(*),
      evento_participantes(*),
      evento_autores(*, evento_sessoes(*)),
      evento_produtos(*),
      evento_brindes(*),
      evento_cdl(*)`)
    .eq('id', id).single()
  if (data && data.evento_cdl?.length) data._cdl = data.evento_cdl[0]
  return data
}
async function getCDL(evento_id) {
  const { data } = await supabase.from('evento_cdl').select('*').eq('evento_id', evento_id).maybeSingle()
  return data
}
async function saveCDL(evento_id, cdl, id) {
  const payload = {
    evento_id,
    nome_colegio: cdl.nome_colegio,
    idade_criancas: cdl.idade_criancas || null,
    quantidade_criancas: cdl.quantidade_criancas ? Number(cdl.quantidade_criancas) : null,
    livro_atividade: cdl.livro_atividade || null,
    observacoes: cdl.observacoes || null,
  }
  if (id) {
    const { data } = await supabase.from('evento_cdl').update(payload).eq('id', id).select().single()
    return data
  }
  const { data } = await supabase.from('evento_cdl').insert([payload]).select().single()
  return data
}

async function saveEvento(e, criador_id) {
  const p = {
    nome:e.nome, descricao:e.descricao, data_inicio:e.data_inicio, data_fim:e.data_fim,
    local:e.local, categoria:e.categoria||null, objetivo:e.objetivo||null,
    forma_participacao:e.forma_participacao||null, expectativa_publico:e.expectativa_publico?Number(e.expectativa_publico):null,
    status:e.status, imagem_url:e.imagem_url||null, tipo_evento:e.tipo_evento||'padrao',
  }
  if (e.id) {
    const { data } = await supabase.from('eventos').update(p).eq('id',e.id).select('*, usuarios(id,nome)').single()
    return data
  }
  const { data } = await supabase.from('eventos').insert([{...p, criador_id}]).select('*, usuarios(id,nome)').single()
  return data
}
async function deleteEvento(id) { await supabase.from('eventos').delete().eq('id',id) }

// Participantes
async function addParticipante(evento_id, nome, email, status) {
  const { data } = await supabase.from('evento_participantes').insert([{evento_id,nome,email:email||null,status}]).select().single()
  return data
}
async function updateParticipante(id, updates) {
  const { data } = await supabase.from('evento_participantes').update(updates).eq('id',id).select().single()
  return data
}
async function deleteParticipante(id) { await supabase.from('evento_participantes').delete().eq('id',id) }

// Autores
async function addAutor(evento_id, nome, observacoes) {
  const { data } = await supabase.from('evento_autores').insert([{evento_id,nome,status:'convidado',observacoes:observacoes||null}]).select('*, evento_sessoes(*)').single()
  return data
}
async function updateAutor(id, updates) {
  const { data } = await supabase.from('evento_autores').update(updates).eq('id',id).select('*, evento_sessoes(*)').single()
  return data
}
async function deleteAutor(id) { await supabase.from('evento_autores').delete().eq('id',id) }

// Sessões
async function addSessao(autor_id, evento_id, payload) {
  const { data } = await supabase.from('evento_sessoes').insert([{...payload, autor_id, evento_id}]).select().single()
  return data
}
async function updateSessao(id, payload) {
  const { data } = await supabase.from('evento_sessoes').update(payload).eq('id',id).select().single()
  return data
}
async function deleteSessao(id) { await supabase.from('evento_sessoes').delete().eq('id',id) }

// Produtos
async function addProduto(evento_id, p) {
  const { data } = await supabase.from('evento_produtos').insert([{...p, evento_id}]).select().single()
  return data
}
async function updateProduto(id, p) {
  const { data } = await supabase.from('evento_produtos').update(p).eq('id',id).select().single()
  return data
}
async function deleteProduto(id) { await supabase.from('evento_produtos').delete().eq('id',id) }

// Brindes
async function addBrinde(evento_id, b) {
  const { data } = await supabase.from('evento_brindes').insert([{...b, evento_id}]).select().single()
  return data
}
async function updateBrinde(id, b) {
  const { data } = await supabase.from('evento_brindes').update(b).eq('id',id).select().single()
  return data
}
async function deleteBrinde(id) { await supabase.from('evento_brindes').delete().eq('id',id) }

// Upload de arquivo
async function uploadArquivo(file, pasta) {
  const ext = file.name.split('.').pop()
  const path = `${pasta}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('eventos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('eventos').getPublicUrl(path)
  return { url: data.publicUrl, nome: file.name }
}
async function addMaterial(evento_id, nome, url, tipo) {
  const { data } = await supabase.from('evento_materiais').insert([{evento_id,nome,url,tipo}]).select().single()
  return data
}
async function deleteMaterial(id, url) {
  await supabase.from('evento_materiais').delete().eq('id',id)
  const path = url.split('/eventos/')[1]
  if (path) await supabase.storage.from('eventos').remove([path])
}

// ── MODAL EVENTO ───────────────────────────────────────────
function ModalEvento({ evento, usuarios, criador_id, onSave, onClose }) {
  const EMPTY = {
    nome:'', descricao:'', data_inicio:hoje(), data_fim:hoje(), local:'',
    categoria:'', objetivo:'', forma_participacao:'', expectativa_publico:'',
    status:'planejamento', imagem_url:'', tipo_evento:'padrao',
    cdl_nome_colegio:'', cdl_idade:'', cdl_quantidade:'', cdl_livro:'', cdl_observacoes:'',
  }
  const [form, setForm] = useState(evento ? {
    nome:evento.nome, descricao:evento.descricao, data_inicio:evento.data_inicio,
    data_fim:evento.data_fim, local:evento.local, categoria:evento.categoria||'',
    objetivo:evento.objetivo||'', forma_participacao:evento.forma_participacao||'',
    expectativa_publico:evento.expectativa_publico||'', status:evento.status,
    imagem_url:evento.imagem_url||'', tipo_evento:evento.tipo_evento||'padrao',
    cdl_nome_colegio:evento._cdl?.nome_colegio||'', cdl_idade:evento._cdl?.idade_criancas||'',
    cdl_quantidade:evento._cdl?.quantidade_criancas||'', cdl_livro:evento._cdl?.livro_atividade||'',
    cdl_observacoes:evento._cdl?.observacoes||'',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const imgRef = useRef()

  async function handleImgUpload(file) {
    if (!file) return
    setUploadingImg(true)
    try {
      const { url } = await uploadArquivo(file, 'imagens')
      setForm(f=>({...f, imagem_url:url}))
    } catch(e) { console.error(e) } finally { setUploadingImg(false) }
  }

  async function save() {
    const nomeOk = form.tipo_evento==='cdl' ? true : form.nome.trim()
    if (!nomeOk||!form.descricao.trim()||!form.local.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        id: evento?.id,
        _cdl: form.tipo_evento === 'cdl' ? {
          nome_colegio: form.cdl_nome_colegio,
          idade_criancas: form.cdl_idade,
          quantidade_criancas: form.cdl_quantidade,
          livro_atividade: form.cdl_livro,
          observacoes: form.cdl_observacoes,
          id: evento?._cdl?.id,
        } : null
      }, criador_id)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:620,maxHeight:'92vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">{evento?'Editar Evento':'Novo Evento'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Tipo de evento</label>
            <div style={{display:'flex',gap:8}}>
              {TIPO_EVENTO.map(t=>(
                <button key={t.v} type="button" onClick={()=>setForm(f=>({...f,tipo_evento:t.v,forma_participacao:t.v==='cdl'?'evento_interno':f.forma_participacao}))}
                  style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                    borderColor:form.tipo_evento===t.v?'var(--accent)':'var(--border)',
                    background:form.tipo_evento===t.v?'var(--accent-glow)':'transparent',
                    color:form.tipo_evento===t.v?'var(--accent)':'var(--text-muted)'}}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          {form.tipo_evento !== 'cdl' && (
            <div className="form-group">
              <label className="form-label">Nome do evento *</label>
              <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Feira Católica São Paulo 2026"/>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data início *</label>
              <input className="form-input" type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data fim *</label>
              <input className="form-input" type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Local *</label>
            <input className="form-input" value={form.local} onChange={e=>setForm(f=>({...f,local:e.target.value}))} placeholder="Nome e cidade do local"/>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <textarea className="form-textarea" rows={3} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Descreva o evento..."/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <select className="form-select" value={form.objetivo} onChange={e=>setForm(f=>({...f,objetivo:e.target.value}))}>
                <option value="">Selecionar...</option>
                {Object.entries(OBJETIVO_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <input className="form-input" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} placeholder="Ex: Feira, Congresso, Lançamento"/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Forma de participação</label>
              <select className="form-select" value={form.forma_participacao} onChange={e=>setForm(f=>({...f,forma_participacao:e.target.value}))}>
                <option value="">Selecionar...</option>
                {Object.entries(FORMA_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {form.tipo_evento !== 'cdl' && (
              <div className="form-group">
                <label className="form-label">Expectativa de público</label>
                <input className="form-input" type="number" value={form.expectativa_publico} onChange={e=>setForm(f=>({...f,expectativa_publico:e.target.value}))} placeholder="0"/>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Status *</label>
            <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {STATUS_EVENTO.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          {/* Campos específicos CDL */}
          {form.tipo_evento === 'cdl' && (
            <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>
                📚 Dados do Caminho do Livro
              </div>
              <div className="form-grid" style={{gap:10}}>
                <div className="form-group">
                  <label className="form-label">Nome do colégio *</label>
                  <input className="form-input" value={form.cdl_nome_colegio}
                    onChange={e=>setForm(f=>({...f,cdl_nome_colegio:e.target.value}))}
                    placeholder="Ex: Colégio Santo Antônio"/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Idade das crianças</label>
                    <input className="form-input" value={form.cdl_idade}
                      onChange={e=>setForm(f=>({...f,cdl_idade:e.target.value}))}
                      placeholder="Ex: 7 a 9 anos"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantidade de crianças</label>
                    <input className="form-input" type="number" value={form.cdl_quantidade}
                      onChange={e=>setForm(f=>({...f,cdl_quantidade:e.target.value}))}
                      placeholder="0"/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Livro escolhido para atividade</label>
                  <input className="form-input" value={form.cdl_livro}
                    onChange={e=>setForm(f=>({...f,cdl_livro:e.target.value}))}
                    placeholder="Título do livro"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-textarea" rows={2} value={form.cdl_observacoes}
                    onChange={e=>setForm(f=>({...f,cdl_observacoes:e.target.value}))}/>
                </div>
              </div>
            </div>
          )}

          {/* Imagem */}
          <div className="form-group">
            <label className="form-label">Imagem principal</label>
            <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImgUpload(e.target.files[0])}/>
            {form.imagem_url
              ? <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <img src={form.imagem_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:8,border:'1px solid var(--border)'}}/>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>imgRef.current?.click()} disabled={uploadingImg}>{uploadingImg?'Enviando...':'Trocar imagem'}</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--red)'}} onClick={()=>setForm(f=>({...f,imagem_url:''}))}>Remover</button>
                  </div>
                </div>
              : <div onClick={()=>imgRef.current?.click()}
                  style={{border:'2px dashed var(--border)',borderRadius:8,padding:'20px',textAlign:'center',cursor:'pointer',background:'var(--surface-2)'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  <Upload size={20} color="var(--accent)" style={{marginBottom:6}}/>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{uploadingImg?'Enviando...':'Clique para enviar imagem'}</div>
                </div>
            }
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||(form.tipo_evento!=='cdl'&&!form.nome.trim())||!form.descricao.trim()||!form.local.trim()||(form.tipo_evento==='cdl'&&!form.cdl_nome_colegio.trim())}>
            {saving?'Salvando...':'Salvar evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SEÇÃO PARTICIPANTES ────────────────────────────────────
function SecaoParticipantes({ participantes, setParticipantes, evento_id, canManage, showToast }) {
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({nome:'',email:'',status:'pendente'})
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const novo = await addParticipante(evento_id, form.nome, form.email, form.status)
      setParticipantes(p=>[...p, novo])
      setForm({nome:'',email:'',status:'pendente'})
      setModal(false)
      showToast('Participante adicionado!')
    } finally { setSaving(false) }
  }
  async function remove(id) {
    if (!window.confirm('Remover participante?')) return
    await deleteParticipante(id)
    setParticipantes(p=>p.filter(x=>x.id!==id))
    showToast('Removido!')
  }
  async function changeStatus(id, status) {
    const upd = await updateParticipante(id, {status})
    setParticipantes(p=>p.map(x=>x.id===id?upd:x))
  }

  const filtrados = participantes.filter(p=>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.email||'').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <input className="search-input" style={{width:220}} placeholder="Buscar participante..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>{participantes.length} total</span>
        </div>
        {canManage && <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}><Plus size={13}/> Adicionar</button>}
      </div>

      {filtrados.length===0
        ? <div className="empty-state"><p>Nenhum participante {busca?'encontrado':'cadastrado'}.</p></div>
        : <div className="table-card"><table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th>{canManage&&<th></th>}</tr></thead>
            <tbody>{filtrados.map(p=>{
              const sp = STATUS_PART.find(s=>s.v===p.status)||STATUS_PART[1]
              return (
                <tr key={p.id}>
                  <td className="td-strong">{p.nome}</td>
                  <td className="td-muted" style={{fontSize:12}}>{p.email||'—'}</td>
                  <td>
                    {canManage
                      ? <select className="form-select" style={{padding:'3px 8px',fontSize:11,width:'auto'}} value={p.status} onChange={e=>changeStatus(p.id,e.target.value)}>
                          {STATUS_PART.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                        </select>
                      : <span className={`badge ${sp.cls}`} style={{fontSize:10}}>{sp.l}</span>
                    }
                  </td>
                  {canManage && <td><button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(p.id)}><Trash2 size={12}/></button></td>}
                </tr>
              )
            })}</tbody>
          </table></div>
      }

      {modal && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header"><h2 className="modal-title">Adicionar Participante</h2><button className="btn btn-ghost btn-icon" onClick={()=>setModal(false)}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} autoFocus/></div>
              <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {STATUS_PART.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={add} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'Adicionar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SEÇÃO AUTORES & SESSÕES ────────────────────────────────
function SecaoAutores({ autores, setAutores, evento_id, canManage, showToast }) {
  const [modalAutor, setModalAutor]   = useState(false)
  const [editAutor, setEditAutor]     = useState(null)
  const [modalSessao, setModalSessao] = useState(null) // autor obj
  const [editSessao, setEditSessao]   = useState(null)
  const [formAutor, setFormAutor]     = useState({nome:'',observacoes:''})
  const [formSessao, setFormSessao]   = useState({data_sessao:hoje(),hora_inicio:'',hora_fim:'',local_sessao:'',observacoes:''})
  const [saving, setSaving]           = useState(false)

  function checkConflito(autor, novaS, ignoreSessaoId) {
    const outras = (autor.evento_sessoes||[]).filter(s=>s.id!==ignoreSessaoId && s.data_sessao===novaS.data_sessao)
    return outras.some(s => novaS.hora_inicio < s.hora_fim && novaS.hora_fim > s.hora_inicio)
  }

  async function saveAutor() {
    if (!formAutor.nome.trim()) return
    setSaving(true)
    try {
      if (editAutor) {
        const upd = await updateAutor(editAutor.id, {nome:formAutor.nome, observacoes:formAutor.observacoes||null})
        setAutores(p=>p.map(x=>x.id===editAutor.id?{...upd,evento_sessoes:editAutor.evento_sessoes}:x))
        showToast('Autor atualizado!')
      } else {
        const novo = await addAutor(evento_id, formAutor.nome, formAutor.observacoes)
        setAutores(p=>[...p,novo])
        showToast('Autor adicionado!')
      }
      setModalAutor(false); setEditAutor(null); setFormAutor({nome:'',observacoes:''})
    } finally { setSaving(false) }
  }

  async function changeStatusAutor(id, status) {
    const upd = await updateAutor(id, {status})
    setAutores(p=>p.map(x=>x.id===id?{...upd,evento_sessoes:x.evento_sessoes}:x))
  }

  async function removeAutor(id) {
    if (!window.confirm('Excluir autor e todas as sessões?')) return
    await deleteAutor(id)
    setAutores(p=>p.filter(x=>x.id!==id))
    showToast('Removido!')
  }

  async function saveSessao(autor) {
    if (!formSessao.data_sessao||!formSessao.hora_inicio||!formSessao.hora_fim) return
    if (formSessao.hora_fim <= formSessao.hora_inicio) { alert('Horário de fim deve ser após o início.'); return }
    if (checkConflito(autor, formSessao, editSessao?.id)) {
      if (!window.confirm('⚠️ Conflito de horário com outra sessão deste autor. Continuar mesmo assim?')) return
    }
    setSaving(true)
    try {
      if (editSessao) {
        const upd = await updateSessao(editSessao.id, formSessao)
        setAutores(p=>p.map(a=>a.id===autor.id?{...a,evento_sessoes:(a.evento_sessoes||[]).map(s=>s.id===editSessao.id?upd:s)}:a))
        showToast('Sessão atualizada!')
      } else {
        const nova = await addSessao(autor.id, evento_id, formSessao)
        setAutores(p=>p.map(a=>a.id===autor.id?{...a,evento_sessoes:[...(a.evento_sessoes||[]),nova]}:a))
        showToast('Sessão adicionada!')
      }
      setModalSessao(null); setEditSessao(null)
      setFormSessao({data_sessao:hoje(),hora_inicio:'',hora_fim:'',local_sessao:'',observacoes:''})
    } finally { setSaving(false) }
  }

  async function removeSessao(autorId, sessaoId) {
    if (!window.confirm('Excluir sessão?')) return
    await deleteSessao(sessaoId)
    setAutores(p=>p.map(a=>a.id===autorId?{...a,evento_sessoes:(a.evento_sessoes||[]).filter(s=>s.id!==sessaoId)}:a))
    showToast('Sessão removida!')
  }

  return (
    <div>
      {canManage && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
          <button className="btn btn-primary btn-sm" onClick={()=>{ setEditAutor(null); setFormAutor({nome:'',observacoes:''}); setModalAutor(true) }}>
            <Plus size={13}/> Adicionar autor
          </button>
        </div>
      )}

      {autores.length===0
        ? <div className="empty-state"><p>Nenhum autor convidado.</p></div>
        : <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {autores.map(a=>{
              const sa = STATUS_AUTOR.find(s=>s.v===a.status)||STATUS_AUTOR[0]
              return (
                <div key={a.id} className="table-card" style={{padding:'14px 18px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{a.nome}</span>
                        <span className={`badge ${sa.cls}`} style={{fontSize:10}}>{sa.l}</span>
                      </div>
                      {a.observacoes&&<div style={{fontSize:12,color:'var(--text-muted)'}}>{a.observacoes}</div>}
                    </div>
                    {canManage && (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <select className="form-select" style={{padding:'3px 8px',fontSize:11,width:'auto'}} value={a.status} onChange={e=>changeStatusAutor(a.id,e.target.value)}>
                          {STATUS_AUTOR.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{ setEditAutor(a); setFormAutor({nome:a.nome,observacoes:a.observacoes||''}); setModalAutor(true) }}><Pencil size={12}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>removeAutor(a.id)}><Trash2 size={12}/></button>
                      </div>
                    )}
                  </div>

                  {/* Sessões */}
                  <div style={{paddingTop:10,borderTop:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                        Sessões de autógrafos ({(a.evento_sessoes||[]).length})
                      </span>
                      {canManage && a.status==='aceito' && (
                        <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>{ setModalSessao(a); setEditSessao(null); setFormSessao({data_sessao:hoje(),hora_inicio:'',hora_fim:'',local_sessao:'',observacoes:''}) }}>
                          <Plus size={11}/> Nova sessão
                        </button>
                      )}
                      {canManage && a.status!=='aceito' && (
                        <span style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>Aceite o convite para adicionar sessões</span>
                      )}
                    </div>
                    {(a.evento_sessoes||[]).length===0
                      ? <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>Nenhuma sessão agendada.</p>
                      : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {(a.evento_sessoes||[]).sort((x,y)=>x.data_sessao.localeCompare(y.data_sessao)||(x.hora_inicio.localeCompare(y.hora_inicio))).map(s=>(
                            <div key={s.id} style={{background:'var(--surface-2)',borderRadius:6,padding:'8px 12px',display:'flex',alignItems:'center',gap:10,justifyContent:'space-between'}}>
                              <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                                <span style={{color:'var(--accent)',fontWeight:600}}>{fmtData(s.data_sessao)}</span>
                                <span style={{color:'var(--text)'}}>{s.hora_inicio.slice(0,5)} – {s.hora_fim.slice(0,5)}</span>
                                {s.local_sessao&&<span style={{color:'var(--text-muted)'}}><MapPin size={10} style={{marginRight:2}}/>{s.local_sessao}</span>}
                                {s.observacoes&&<span style={{color:'var(--text-muted)',fontStyle:'italic'}}>{s.observacoes}</span>}
                              </div>
                              {canManage && (
                                <div className="actions-cell">
                                  <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{ setModalSessao(a); setEditSessao(s); setFormSessao({data_sessao:s.data_sessao,hora_inicio:s.hora_inicio.slice(0,5),hora_fim:s.hora_fim.slice(0,5),local_sessao:s.local_sessao||'',observacoes:s.observacoes||''}) }}><Pencil size={11}/></button>
                                  <button className="btn btn-danger btn-icon btn-sm" onClick={()=>removeSessao(a.id,s.id)}><Trash2 size={11}/></button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                </div>
              )
            })}
          </div>
      }

      {/* Modal autor */}
      {modalAutor && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header"><h2 className="modal-title">{editAutor?'Editar Autor':'Novo Autor'}</h2><button className="btn btn-ghost btn-icon" onClick={()=>{ setModalAutor(false); setEditAutor(null) }}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome do autor *</label><input className="form-input" value={formAutor.nome} onChange={e=>setFormAutor(f=>({...f,nome:e.target.value}))} autoFocus/></div>
              <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" rows={2} value={formAutor.observacoes} onChange={e=>setFormAutor(f=>({...f,observacoes:e.target.value}))}/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={()=>{ setModalAutor(false); setEditAutor(null) }}>Cancelar</button><button className="btn btn-primary" onClick={saveAutor} disabled={saving||!formAutor.nome.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
          </div>
        </div>
      )}

      {/* Modal sessão */}
      {modalSessao && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header"><h2 className="modal-title">{editSessao?'Editar Sessão':'Nova Sessão'} — {modalSessao.nome}</h2><button className="btn btn-ghost btn-icon" onClick={()=>{ setModalSessao(null); setEditSessao(null) }}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Data *</label><input className="form-input" type="date" value={formSessao.data_sessao} onChange={e=>setFormSessao(f=>({...f,data_sessao:e.target.value}))}/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Início *</label><input className="form-input" type="time" value={formSessao.hora_inicio} onChange={e=>setFormSessao(f=>({...f,hora_inicio:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Fim *</label><input className="form-input" type="time" value={formSessao.hora_fim} onChange={e=>setFormSessao(f=>({...f,hora_fim:e.target.value}))}/></div>
              </div>
              <div className="form-group"><label className="form-label">Local da sessão</label><input className="form-input" value={formSessao.local_sessao} onChange={e=>setFormSessao(f=>({...f,local_sessao:e.target.value}))} placeholder="Ex: Stand principal"/></div>
              <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" rows={2} value={formSessao.observacoes} onChange={e=>setFormSessao(f=>({...f,observacoes:e.target.value}))}/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={()=>{ setModalSessao(null); setEditSessao(null) }}>Cancelar</button><button className="btn btn-primary" onClick={()=>saveSessao(modalSessao)} disabled={saving||!formSessao.data_sessao||!formSessao.hora_inicio||!formSessao.hora_fim}>{saving?'Salvando...':'Salvar sessão'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SEÇÃO PRODUTOS E BRINDES ───────────────────────────────
function SecaoProdutosBrindes({ produtos, setProdutos, brindes, setBrindes, evento_id, canManage, showToast }) {
  const [modalProd, setModalProd]     = useState(false)
  const [editProd, setEditProd]       = useState(null)
  const [formProd, setFormProd]       = useState({nome:'',tipo:'livro',observacoes:''})
  const [modalBrinde, setModalBrinde] = useState(false)
  const [editBrinde, setEditBrinde]   = useState(null)
  const [formBrinde, setFormBrinde]   = useState({nome:'',quantidade_prevista:'',descricao:'',status_logistico:'planejado'})
  const [saving, setSaving]           = useState(false)

  async function saveProd() {
    if (!formProd.nome.trim()) return
    setSaving(true)
    try {
      if (editProd) { const u=await updateProduto(editProd.id,formProd); setProdutos(p=>p.map(x=>x.id===editProd.id?u:x)); showToast('Atualizado!') }
      else { const n=await addProduto(evento_id,formProd); setProdutos(p=>[...p,n]); showToast('Produto adicionado!') }
      setModalProd(false); setEditProd(null); setFormProd({nome:'',tipo:'livro',observacoes:''})
    } finally { setSaving(false) }
  }
  async function removeProd(id) {
    if (!window.confirm('Excluir produto?')) return
    await deleteProduto(id); setProdutos(p=>p.filter(x=>x.id!==id)); showToast('Removido!')
  }
  async function saveBrinde() {
    if (!formBrinde.nome.trim()) return
    setSaving(true)
    const payload = {...formBrinde, quantidade_prevista:formBrinde.quantidade_prevista?Number(formBrinde.quantidade_prevista):null}
    try {
      if (editBrinde) { const u=await updateBrinde(editBrinde.id,payload); setBrindes(p=>p.map(x=>x.id===editBrinde.id?u:x)); showToast('Atualizado!') }
      else { const n=await addBrinde(evento_id,payload); setBrindes(p=>[...p,n]); showToast('Brinde adicionado!') }
      setModalBrinde(false); setEditBrinde(null); setFormBrinde({nome:'',quantidade_prevista:'',descricao:'',status_logistico:'planejado'})
    } finally { setSaving(false) }
  }
  async function removeBrinde(id) {
    if (!window.confirm('Excluir brinde?')) return
    await deleteBrinde(id); setBrindes(p=>p.filter(x=>x.id!==id)); showToast('Removido!')
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      {/* Produtos */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🛍️ Produtos em destaque</span>
          {canManage && <button className="btn btn-primary btn-sm" onClick={()=>{ setEditProd(null); setFormProd({nome:'',tipo:'livro',observacoes:''}); setModalProd(true) }}><Plus size={12}/></button>}
        </div>
        {produtos.length===0
          ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhum produto.</p>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {produtos.map(p=>(
                <div key={p.id} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{p.nome}</div>
                      <span className="badge badge-indigo" style={{fontSize:9,marginTop:4}}>{TIPO_PRODUTO_LABEL[p.tipo]||p.tipo}</span>
                      {p.observacoes&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{p.observacoes}</div>}
                    </div>
                    {canManage && <div className="actions-cell">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{ setEditProd(p); setFormProd({nome:p.nome,tipo:p.tipo,observacoes:p.observacoes||''}); setModalProd(true) }}><Pencil size={11}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={()=>removeProd(p.id)}><Trash2 size={11}/></button>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Brindes */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🎁 Brindes</span>
          {canManage && <button className="btn btn-primary btn-sm" onClick={()=>{ setEditBrinde(null); setFormBrinde({nome:'',quantidade_prevista:'',descricao:'',status_logistico:'planejado'}); setModalBrinde(true) }}><Plus size={12}/></button>}
        </div>
        {brindes.length===0
          ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhum brinde.</p>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {brindes.map(b=>{
                const sb = STATUS_BRINDE.find(s=>s.v===b.status_logistico)||STATUS_BRINDE[0]
                return (
                  <div key={b.id} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{b.nome}</div>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                          <span className={`badge ${sb.cls}`} style={{fontSize:9}}>{sb.l}</span>
                          {b.quantidade_prevista&&<span style={{fontSize:11,color:'var(--text-muted)'}}>Qtd: {b.quantidade_prevista}</span>}
                        </div>
                        {b.descricao&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{b.descricao}</div>}
                      </div>
                      {canManage && <div className="actions-cell">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{ setEditBrinde(b); setFormBrinde({nome:b.nome,quantidade_prevista:b.quantidade_prevista||'',descricao:b.descricao||'',status_logistico:b.status_logistico}); setModalBrinde(true) }}><Pencil size={11}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>removeBrinde(b.id)}><Trash2 size={11}/></button>
                      </div>}
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>

      {modalProd && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header"><h2 className="modal-title">{editProd?'Editar Produto':'Novo Produto'}</h2><button className="btn btn-ghost btn-icon" onClick={()=>{ setModalProd(false); setEditProd(null) }}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={formProd.nome} onChange={e=>setFormProd(f=>({...f,nome:e.target.value}))} autoFocus/></div>
              <div className="form-group"><label className="form-label">Tipo</label>
                <select className="form-select" value={formProd.tipo} onChange={e=>setFormProd(f=>({...f,tipo:e.target.value}))}>
                  {TIPO_PRODUTO.map(t=><option key={t} value={t}>{TIPO_PRODUTO_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" rows={2} value={formProd.observacoes} onChange={e=>setFormProd(f=>({...f,observacoes:e.target.value}))}/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={()=>{ setModalProd(false); setEditProd(null) }}>Cancelar</button><button className="btn btn-primary" onClick={saveProd} disabled={saving||!formProd.nome.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
          </div>
        </div>
      )}

      {modalBrinde && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header"><h2 className="modal-title">{editBrinde?'Editar Brinde':'Novo Brinde'}</h2><button className="btn btn-ghost btn-icon" onClick={()=>{ setModalBrinde(false); setEditBrinde(null) }}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={formBrinde.nome} onChange={e=>setFormBrinde(f=>({...f,nome:e.target.value}))} autoFocus/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Quantidade prevista</label><input className="form-input" type="number" value={formBrinde.quantidade_prevista} onChange={e=>setFormBrinde(f=>({...f,quantidade_prevista:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Status logístico</label>
                  <select className="form-select" value={formBrinde.status_logistico} onChange={e=>setFormBrinde(f=>({...f,status_logistico:e.target.value}))}>
                    {STATUS_BRINDE.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" rows={2} value={formBrinde.descricao} onChange={e=>setFormBrinde(f=>({...f,descricao:e.target.value}))}/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={()=>{ setModalBrinde(false); setEditBrinde(null) }}>Cancelar</button><button className="btn btn-primary" onClick={saveBrinde} disabled={saving||!formBrinde.nome.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SEÇÃO MATERIAIS ────────────────────────────────────────
function SecaoMateriais({ materiais, setMateriais, evento_id, canManage, showToast }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const { url, nome } = await uploadArquivo(file, 'materiais')
      const tipo = file.name.split('.').pop().toLowerCase()
      const mat = await addMaterial(evento_id, nome, url, tipo)
      setMateriais(p=>[...p, mat])
      showToast('Material enviado!')
    } catch(e) { showToast('Erro ao enviar','error') } finally { setUploading(false) }
  }
  async function remove(m) {
    if (!window.confirm('Excluir material?')) return
    await deleteMaterial(m.id, m.url)
    setMateriais(p=>p.filter(x=>x.id!==m.id))
    showToast('Removido!')
  }

  return (
    <div>
      {canManage && (
        <div style={{marginBottom:12}}>
          <input ref={fileRef} type="file" style={{display:'none'}} accept=".pdf,.pptx,.docx,.xlsx,.png,.jpg,.jpeg"
            onChange={e=>handleUpload(e.target.files[0])}/>
          <button className="btn btn-primary btn-sm" onClick={()=>fileRef.current?.click()} disabled={uploading}>
            <Upload size={13}/> {uploading?'Enviando...':'Enviar material'}
          </button>
          <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>PDF, PPTX, DOCX, XLSX, imagens</span>
        </div>
      )}
      {materiais.length===0
        ? <div className="empty-state"><p>Nenhum material enviado.</p></div>
        : <div className="table-card"><table>
            <thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead>
            <tbody>{materiais.map(m=>(
              <tr key={m.id}>
                <td className="td-strong">{m.nome}</td>
                <td><span className="badge badge-indigo" style={{fontSize:9,textTransform:'uppercase'}}>{m.tipo||'—'}</span></td>
                <td>
                  <div className="actions-cell">
                    <a href={m.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon btn-sm"><ExternalLink size={12}/></a>
                    {canManage && <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(m)}><Trash2 size={12}/></button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
      }
    </div>
  )
}

// ── DETALHE EVENTO ─────────────────────────────────────────
function DetalheEvento({ eventoId, onBack, onEdit, isAdmin, showToast }) {
  const { usuario } = useAuth()
  const [evento, setEvento]               = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [autores, setAutores]             = useState([])
  const [produtos, setProdutos]           = useState([])
  const [brindes, setBrindes]             = useState([])
  const [materiais, setMateriais]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [aba, setAba]                     = useState('info')
  const [cdl, setCdl]                     = useState(null)

  useEffect(()=>{
    getEvento(eventoId).then(e=>{
      if (!e) return
      setEvento(e)
      setCdl(e._cdl || null)
      setParticipantes(e.evento_participantes||[])
      setAutores(e.evento_autores||[])
      setProdutos(e.evento_produtos||[])
      setBrindes(e.evento_brindes||[])
      setMateriais(e.evento_materiais||[])
    }).finally(()=>setLoading(false))
  },[eventoId])

  if (loading) return <div className="loading"><div className="spinner"/></div>
  if (!evento) return <div className="empty-state"><p>Evento não encontrado.</p></div>

  const isOwner = evento.criador_id === usuario?.id
  const canManageAll = isAdmin
  const canManage = isAdmin || isOwner

  const se = STATUS_EVENTO.find(s=>s.v===evento.status)||STATUS_EVENTO[0]

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronLeft size={18}/></button>
        <div style={{flex:1}}>
          {evento.imagem_url && (
            <div style={{marginBottom:14,borderRadius:12,overflow:'hidden',maxHeight:220,background:'var(--surface-2)'}}>
              <img src={evento.imagem_url} alt={evento.nome} style={{width:'100%',objectFit:'cover',maxHeight:220}}/>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <h1 className="page-title" style={{margin:0}}>{evento.nome}</h1>
            <span className={`badge ${se.cls}`}>{se.l}</span>
          </div>
          <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)',flexWrap:'wrap'}}>
            <span><Calendar size={12} style={{marginRight:4}}/>{fmtData(evento.data_inicio)}{evento.data_fim!==evento.data_inicio?` → ${fmtData(evento.data_fim)}`:''}</span>
            <span><MapPin size={12} style={{marginRight:4}}/>{evento.local}</span>
            {evento.categoria&&<span>{evento.categoria}</span>}
            {evento.usuarios&&<span>Criado por {evento.usuarios.nome}</span>}
          </div>
        </div>
        {canManage && (
          <button className="btn btn-ghost" onClick={()=>onEdit(evento)}><Pencil size={14}/> Editar</button>
        )}
      </div>

      {/* Abas */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:20,flexWrap:'wrap'}}>
        {[
          {k:'info',l:'Informações'},
          {k:'participantes',l:`Participantes (${participantes.length})`},
          {k:'autores',l:`Autores (${autores.length})`},
          {k:'produtos',l:`Produtos & Brindes`},
          {k:'materiais',l:`Materiais (${materiais.length})`},
          ...(evento.tipo_evento==='cdl' ? [{k:'cdl',l:'📚 Caminho do Livro'}] : []),
        ].map(({k,l})=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{padding:'9px 16px',fontSize:13,fontWeight:aba===k?700:400,cursor:'pointer',
              background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',
              color:aba===k?'var(--accent)':'var(--text-muted)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* INFO */}
      {aba==='info' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div className="table-card" style={{padding:'16px 20px',gridColumn:'1/-1'}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:8}}>Descrição</div>
            <p style={{fontSize:13,color:'var(--text)',lineHeight:1.6,margin:0}}>{evento.descricao}</p>
          </div>
          {[
            {l:'Objetivo',     v:OBJETIVO_LABEL[evento.objetivo]||'—'},
            {l:'Participação', v:FORMA_LABEL[evento.forma_participacao]||'—'},
            {l:'Expectativa',  v:evento.expectativa_publico?`${evento.expectativa_publico.toLocaleString('pt-BR')} pessoas`:'—'},
            {l:'Categoria',    v:evento.categoria||'—'},
          ].map(({l,v})=>(
            <div key={l} className="table-card" style={{padding:'14px 18px'}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* CDL específico */}
      {aba==='cdl' && (
        <div>
          {cdl
            ? <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {[
                  {l:'Colégio',               v:cdl.nome_colegio||'—'},
                  {l:'Idade das crianças',     v:cdl.idade_criancas||'—'},
                  {l:'Quantidade de crianças', v:cdl.quantidade_criancas?.toLocaleString('pt-BR')||'—'},
                  {l:'Livro para atividade',   v:cdl.livro_atividade||'—'},
                ].map(({l,v})=>(
                  <div key={l} className="table-card" style={{padding:'14px 18px'}}>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{v}</div>
                  </div>
                ))}
                {cdl.observacoes && (
                  <div className="table-card" style={{padding:'14px 18px',gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:6}}>Observações</div>
                    <p style={{fontSize:13,color:'var(--text)',margin:0,lineHeight:1.5}}>{cdl.observacoes}</p>
                  </div>
                )}
              </div>
            : <div className="empty-state"><p>Nenhum dado CDL registrado ainda.</p></div>
          }
        </div>
      )}

      {aba==='participantes' && (
        <SecaoParticipantes participantes={participantes} setParticipantes={setParticipantes}
          evento_id={evento.id} canManage={canManage} showToast={showToast}/>
      )}
      {aba==='autores' && (
        <SecaoAutores autores={autores} setAutores={setAutores}
          evento_id={evento.id} canManage={canManage} showToast={showToast}/>
      )}
      {aba==='produtos' && (
        <SecaoProdutosBrindes produtos={produtos} setProdutos={setProdutos}
          brindes={brindes} setBrindes={setBrindes}
          evento_id={evento.id} canManage={canManage} showToast={showToast}/>
      )}
      {aba==='materiais' && (
        <SecaoMateriais materiais={materiais} setMateriais={setMateriais}
          evento_id={evento.id} canManage={canManage} showToast={showToast}/>
      )}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Eventos() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'

  const [eventos, setEventos]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [detalhe, setDetalhe]       = useState(null)
  const [modalEvento, setModalEvento] = useState(false)
  const [editEvento, setEditEvento]   = useState(null)
  const [busca, setBusca]             = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDataIni, setFiltroDataIni] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [toast, showToast]            = useToast()

  async function carregar() {
    setLoading(true)
    try { setEventos(await getEventos()) } finally { setLoading(false) }
  }
  useEffect(()=>{ carregar() },[])

  async function handleSaveEvento(e) {
    const salvo = await saveEvento(e, usuario?.id)
    // Salva dados CDL se for esse tipo
    if (e.tipo_evento === 'cdl' && e._cdl) {
      const cdlSalvo = await saveCDL(salvo.id, e._cdl, e._cdl.id||null)
      salvo._cdl = cdlSalvo
    }
    if (e.id) setEventos(p=>p.map(x=>x.id===e.id?salvo:x))
    else setEventos(p=>[salvo,...p])
    setModalEvento(false); setEditEvento(null)
    showToast(e.id?'Evento atualizado!':'Evento criado!')
  }

  async function handleDelete(e) {
    const temParticipantes = (e._count_participantes||0) > 0
    const msg = temParticipantes
      ? `Este evento pode ter participantes cadastrados. Excluir mesmo assim?`
      : `Excluir "${e.nome}"?`
    if (!window.confirm(msg)) return
    await deleteEvento(e.id)
    setEventos(p=>p.filter(x=>x.id!==e.id))
    showToast('Evento excluído!')
  }

  const canDelete = (e) => isAdmin || e.criador_id === usuario?.id
  const canEdit   = (e) => isAdmin || e.criador_id === usuario?.id

  const filtrados = eventos.filter(e=>{
    if (filtroStatus && e.status !== filtroStatus) return false
    if (filtroDataIni && e.data_inicio < filtroDataIni) return false
    if (filtroDataFim && e.data_fim > filtroDataFim) return false
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase()) &&
        !(e.local||'').toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  if (detalhe) return (
    <>
      <DetalheEvento
        eventoId={detalhe}
        onBack={()=>setDetalhe(null)}
        onEdit={e=>{ setEditEvento(e); setModalEvento(true) }}
        isAdmin={isAdmin}
        showToast={showToast}
      />
      {modalEvento && (
        <ModalEvento evento={editEvento} criador_id={usuario?.id}
          onSave={handleSaveEvento} onClose={()=>{ setModalEvento(false); setEditEvento(null) }}/>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Calendar size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Eventos</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {filtrados.length} evento{filtrados.length!==1?'s':''}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={()=>{ setEditEvento(null); setModalEvento(true) }}>
          <Plus size={14}/> Criar evento
        </button>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
        <input className="search-input" style={{flex:'1 1 200px'}} placeholder="Buscar por nome ou local..."
          value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
          value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_EVENTO.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <input type="date" className="form-input" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
          value={filtroDataIni} onChange={e=>setFiltroDataIni(e.target.value)} title="Data início"/>
        <input type="date" className="form-input" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
          value={filtroDataFim} onChange={e=>setFiltroDataFim(e.target.value)} title="Data fim"/>
      </div>

      {/* Lista */}
      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : filtrados.length===0
          ? <div className="empty-state"><p>Nenhum evento encontrado.</p></div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
              {filtrados.map(e=>{
                const se = STATUS_EVENTO.find(s=>s.v===e.status)||STATUS_EVENTO[0]
                return (
                  <div key={e.id} className="table-card" style={{padding:0,overflow:'hidden',cursor:'pointer'}}
                    onClick={()=>setDetalhe(e.id)}>
                    {e.imagem_url
                      ? <img src={e.imagem_url} alt={e.nome} style={{width:'100%',height:140,objectFit:'cover'}}/>
                      : <div style={{height:8,background:`var(--accent)`}}/>
                    }
                    <div style={{padding:'14px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <span className={`badge ${se.cls}`} style={{fontSize:10}}>{se.l}</span>
                        {e.tipo_evento==='cdl' && <span style={{fontSize:10,background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.3)',borderRadius:4,padding:'1px 6px',fontWeight:700}}>📚 CDL</span>}
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{e.categoria||''}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:6}}>{e.nome}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:3}}>
                        <span><Calendar size={11} style={{marginRight:4}}/>{fmtData(e.data_inicio)}{e.data_fim!==e.data_inicio?` → ${fmtData(e.data_fim)}`:''}</span>
                        <span><MapPin size={11} style={{marginRight:4}}/>{e.local}</span>
                        {e.usuarios&&<span style={{fontSize:11}}>Responsável: {e.usuarios.nome}</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6,marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)'}}
                        onClick={ev=>ev.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>setDetalhe(e.id)}>Ver detalhes</button>
                        {canEdit(e)&&<button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{ setEditEvento(e); setModalEvento(true) }}><Pencil size={13}/></button>}
                        {canDelete(e)&&<button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelete(e)}><Trash2 size={13}/></button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
      }

      {modalEvento && (
        <ModalEvento evento={editEvento} criador_id={usuario?.id}
          onSave={handleSaveEvento} onClose={()=>{ setModalEvento(false); setEditEvento(null) }}/>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
