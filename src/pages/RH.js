import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Users, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
  MessageSquare, Calendar, UserCheck, AlertCircle, CheckCircle, Clock
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

function diffDias(ini, fim) {
  if (!ini || !fim) return 0
  return Math.round((new Date(fim) - new Date(ini)) / 86400000) + 1
}

const TIPO_CONTRATO = ['CLT','PJ','Freelancer']
const STATUS_COLAB  = [
  {v:'ativo',      l:'Ativo',      cls:'badge-green'},
  {v:'inativo',    l:'Inativo',    cls:'badge-amber'},
  {v:'desligado',  l:'Desligado',  cls:'badge-red'},
]
const TIPO_AUSENCIA = [
  {v:'ferias',   l:'Férias'},
  {v:'folga',    l:'Folga'},
  {v:'atestado', l:'Atestado'},
  {v:'licenca',  l:'Licença'},
]
const STATUS_AUSENCIA = [
  {v:'planejado', l:'Planejado', cls:'badge-indigo'},
  {v:'aprovado',  l:'Aprovado',  cls:'badge-amber'},
  {v:'concluido', l:'Concluído', cls:'badge-green'},
]
const TIPO_FEEDBACK = [
  {v:'positivo',     l:'Positivo',     cor:'#22c55e'},
  {v:'construtivo',  l:'Construtivo',  cor:'#f97316'},
  {v:'alerta',       l:'Alerta',       cor:'#ef4444'},
]

// ── SUPABASE HELPERS ───────────────────────────────────────
async function getGrupos() {
  const { data } = await supabase.from('rh_grupos').select('*').order('nome')
  return data || []
}
async function saveGrupo(g) {
  if (g.id) {
    const { data } = await supabase.from('rh_grupos').update({nome:g.nome,descricao:g.descricao,responsavel:g.responsavel}).eq('id',g.id).select().single()
    return data
  }
  const { data } = await supabase.from('rh_grupos').insert([{nome:g.nome,descricao:g.descricao,responsavel:g.responsavel}]).select().single()
  return data
}
async function deleteGrupo(id) {
  await supabase.from('rh_grupos').delete().eq('id',id)
}

async function getColaboradores() {
  const { data } = await supabase.from('rh_colaboradores').select('*, rh_grupos(id,nome)').order('nome')
  return data || []
}
async function saveColaborador(c) {
  const payload = {
    nome:c.nome, cargo:c.cargo, grupo_id:c.grupo_id||null,
    data_entrada:c.data_entrada, tipo_contrato:c.tipo_contrato, status:c.status,
    email:c.email||null, telefone:c.telefone||null,
    data_nascimento:c.data_nascimento||null, endereco:c.endereco||null,
    gestor_direto:c.gestor_direto||null, observacoes:c.observacoes||null,
  }
  if (c.id) {
    const { data } = await supabase.from('rh_colaboradores').update(payload).eq('id',c.id).select('*, rh_grupos(id,nome)').single()
    return data
  }
  const { data } = await supabase.from('rh_colaboradores').insert([payload]).select('*, rh_grupos(id,nome)').single()
  return data
}
async function deleteColaborador(id) {
  await supabase.from('rh_colaboradores').delete().eq('id',id)
}

async function getAusencias(colaborador_id) {
  const { data } = await supabase.from('rh_ausencias').select('*').eq('colaborador_id',colaborador_id).order('data_inicio',{ascending:false})
  return data || []
}
async function getTodasAusencias() {
  const { data } = await supabase.from('rh_ausencias').select('*, rh_colaboradores(id,nome,rh_grupos(nome))').order('data_inicio',{ascending:true})
  return data || []
}
async function saveAusencia(a) {
  const payload = {colaborador_id:a.colaborador_id,tipo:a.tipo,data_inicio:a.data_inicio,data_fim:a.data_fim,status:a.status,observacoes:a.observacoes||null}
  if (a.id) {
    const { data } = await supabase.from('rh_ausencias').update(payload).eq('id',a.id).select().single()
    return data
  }
  const { data } = await supabase.from('rh_ausencias').insert([payload]).select().single()
  return data
}
async function deleteAusencia(id) {
  await supabase.from('rh_ausencias').delete().eq('id',id)
}

async function getFeedbacks(colaborador_id) {
  const { data } = await supabase.from('rh_feedbacks').select('*').eq('colaborador_id',colaborador_id).order('data',{ascending:false})
  return data || []
}
async function saveFeedback(f) {
  const payload = {colaborador_id:f.colaborador_id,tipo:f.tipo,descricao:f.descricao,data:f.data,relacionado_a:f.relacionado_a||null}
  if (f.id) {
    const { data } = await supabase.from('rh_feedbacks').update(payload).eq('id',f.id).select().single()
    return data
  }
  const { data } = await supabase.from('rh_feedbacks').insert([payload]).select().single()
  return data
}
async function deleteFeedback(id) {
  await supabase.from('rh_feedbacks').delete().eq('id',id)
}

// ── MODAL GRUPO ────────────────────────────────────────────
function ModalGrupo({ grupo, onSave, onClose }) {
  const [form, setForm] = useState({
    nome: grupo?.nome||'', descricao: grupo?.descricao||'', responsavel: grupo?.responsavel||''
  })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave({...form, id: grupo?.id}) } finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header">
          <h2 className="modal-title">{grupo ? 'Editar Grupo' : 'Novo Grupo'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Influenciadores"/>
          </div>
          <div className="form-group">
            <label className="form-label">Responsável</label>
            <input className="form-input" value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} placeholder="Nome do responsável"/>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" rows={2} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>
            {saving?'Salvando...':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL COLABORADOR ──────────────────────────────────────
function ModalColaborador({ colab, grupos, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const EMPTY = {nome:'',cargo:'',grupo_id:'',data_entrada:hoje,tipo_contrato:'CLT',status:'ativo',email:'',telefone:'',data_nascimento:'',endereco:'',gestor_direto:'',observacoes:''}
  const [form, setForm] = useState(colab ? {
    nome:colab.nome,cargo:colab.cargo,grupo_id:colab.grupo_id||'',
    data_entrada:colab.data_entrada||hoje,tipo_contrato:colab.tipo_contrato||'CLT',
    status:colab.status||'ativo',email:colab.email||'',telefone:colab.telefone||'',
    data_nascimento:colab.data_nascimento||'',endereco:colab.endereco||'',
    gestor_direto:colab.gestor_direto||'',observacoes:colab.observacoes||'',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [aba, setAba] = useState('basico')

  async function save() {
    if (!form.nome.trim()||!form.cargo.trim()) return
    setSaving(true)
    try { await onSave({...form, id:colab?.id}) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:580,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">{colab?'Editar Colaborador':'Novo Colaborador'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        {/* Abas */}
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {[{k:'basico',l:'Dados básicos'},{k:'contato',l:'Contato'},{k:'extra',l:'Adicional'}].map(({k,l})=>(
            <button key={k} onClick={()=>setAba(k)}
              style={{padding:'8px 16px',fontSize:12,fontWeight:aba===k?700:400,cursor:'pointer',
                background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',
                color:aba===k?'var(--accent)':'var(--text-muted)',transition:'all 0.15s'}}>
              {l}
            </button>
          ))}
        </div>

        {aba==='basico' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nome completo *</label>
              <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cargo *</label>
                <input className="form-input" value={form.cargo} onChange={e=>setForm(f=>({...f,cargo:e.target.value}))} placeholder="Ex: Analista de Marketing"/>
              </div>
              <div className="form-group">
                <label className="form-label">Grupo</label>
                <select className="form-select" value={form.grupo_id} onChange={e=>setForm(f=>({...f,grupo_id:e.target.value}))}>
                  <option value="">Sem grupo</option>
                  {grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data de entrada *</label>
                <input className="form-input" type="date" value={form.data_entrada} onChange={e=>setForm(f=>({...f,data_entrada:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de contrato *</label>
                <select className="form-select" value={form.tipo_contrato} onChange={e=>setForm(f=>({...f,tipo_contrato:e.target.value}))}>
                  {TIPO_CONTRATO.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS_COLAB.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
        )}

        {aba==='contato' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@empresa.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} placeholder="(00) 00000-0000"/>
            </div>
            <div className="form-group">
              <label className="form-label">Endereço</label>
              <input className="form-input" value={form.endereco} onChange={e=>setForm(f=>({...f,endereco:e.target.value}))} placeholder="Cidade, Estado"/>
            </div>
          </div>
        )}

        {aba==='extra' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Data de nascimento</label>
              <input className="form-input" type="date" value={form.data_nascimento} onChange={e=>setForm(f=>({...f,data_nascimento:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Gestor direto</label>
              <input className="form-input" value={form.gestor_direto} onChange={e=>setForm(f=>({...f,gestor_direto:e.target.value}))} placeholder="Nome do gestor"/>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" rows={3} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas internas..."/>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()||!form.cargo.trim()}>
            {saving?'Salvando...':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL AUSÊNCIA ─────────────────────────────────────────
function ModalAusencia({ ausencia, colaborador_id, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({
    tipo: ausencia?.tipo||'ferias',
    data_inicio: ausencia?.data_inicio||hoje,
    data_fim: ausencia?.data_fim||hoje,
    status: ausencia?.status||'planejado',
    observacoes: ausencia?.observacoes||'',
  })
  const [saving, setSaving] = useState(false)
  const dias = diffDias(form.data_inicio, form.data_fim)

  async function save() {
    setSaving(true)
    try { await onSave({...form, id:ausencia?.id, colaborador_id}) } finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header">
          <h2 className="modal-title">{ausencia?'Editar Ausência':'Nova Ausência'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                {TIPO_AUSENCIA.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS_AUSENCIA.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data início</label>
              <input className="form-input" type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data fim</label>
              <input className="form-input" type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))}/>
            </div>
          </div>
          {dias > 0 && <div style={{fontSize:12,color:'var(--accent)',textAlign:'center',marginTop:-8}}>
            {dias} dia{dias!==1?'s':''}
          </div>}
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL FEEDBACK ─────────────────────────────────────────
function ModalFeedback({ feedback, colaborador_id, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({
    tipo: feedback?.tipo||'positivo',
    descricao: feedback?.descricao||'',
    data: feedback?.data||hoje,
    relacionado_a: feedback?.relacionado_a||'',
  })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!form.descricao.trim()) return
    setSaving(true)
    try { await onSave({...form, id:feedback?.id, colaborador_id}) } finally { setSaving(false) }
  }
  const tipoCor = TIPO_FEEDBACK.find(t=>t.v===form.tipo)?.cor
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header" style={{borderBottom:`3px solid ${tipoCor}`}}>
          <h2 className="modal-title">{feedback?'Editar Feedback':'Novo Feedback'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div style={{display:'flex',gap:6}}>
                {TIPO_FEEDBACK.map(t=>(
                  <button key={t.v} type="button" onClick={()=>setForm(f=>({...f,tipo:t.v}))}
                    style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',
                      border:`2px solid ${form.tipo===t.v?t.cor:'var(--border)'}`,
                      background:form.tipo===t.v?`${t.cor}18`:'transparent',
                      color:form.tipo===t.v?t.cor:'var(--text-muted)'}}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Relacionado a</label>
              <input className="form-input" value={form.relacionado_a} onChange={e=>setForm(f=>({...f,relacionado_a:e.target.value}))} placeholder="Projeto, campanha..."/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <textarea className="form-textarea" rows={4} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Descreva o feedback..."/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.descricao.trim()}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── PERFIL DO COLABORADOR ──────────────────────────────────
function PerfilColaborador({ colab, grupos, onEdit, onBack, toast, showToast }) {
  const [ausencias, setAusencias]   = useState([])
  const [feedbacks, setFeedbacks]   = useState([])
  const [modalAus, setModalAus]     = useState(false)
  const [editAus, setEditAus]       = useState(null)
  const [modalFeed, setModalFeed]   = useState(false)
  const [editFeed, setEditFeed]     = useState(null)
  const [aba, setAba]               = useState('ausencias')

  useEffect(() => {
    getAusencias(colab.id).then(setAusencias)
    getFeedbacks(colab.id).then(setFeedbacks)
  }, [colab.id])

  async function handleSaveAus(a) {
    const salva = await saveAusencia(a)
    if (a.id) setAusencias(prev=>prev.map(x=>x.id===a.id?salva:x))
    else setAusencias(prev=>[salva,...prev])
    setModalAus(false); setEditAus(null); showToast('Ausência salva!')
  }
  async function handleDeleteAus(id) {
    if (!window.confirm('Excluir ausência?')) return
    await deleteAusencia(id)
    setAusencias(prev=>prev.filter(x=>x.id!==id))
    showToast('Removida!')
  }
  async function handleSaveFeed(f) {
    const salvo = await saveFeedback(f)
    if (f.id) setFeedbacks(prev=>prev.map(x=>x.id===f.id?salvo:x))
    else setFeedbacks(prev=>[salvo,...prev])
    setModalFeed(false); setEditFeed(null); showToast('Feedback salvo!')
  }
  async function handleDeleteFeed(id) {
    if (!window.confirm('Excluir feedback?')) return
    await deleteFeedback(id)
    setFeedbacks(prev=>prev.filter(x=>x.id!==id))
    showToast('Removido!')
  }

  const sc = STATUS_COLAB.find(s=>s.v===colab.status)||STATUS_COLAB[0]
  const grupo = grupos.find(g=>g.id===colab.grupo_id)

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronDown size={18} style={{transform:'rotate(90deg)'}}/></button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h1 className="page-title" style={{margin:0}}>{colab.nome}</h1>
            <span className={`badge ${sc.cls}`}>{sc.l}</span>
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
            {colab.cargo}
            {grupo && <span style={{marginLeft:8,color:'var(--accent)'}}>· {grupo.nome}</span>}
            {colab.tipo_contrato && <span style={{marginLeft:8}}>· {colab.tipo_contrato}</span>}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={()=>onEdit(colab)}><Pencil size={14}/> Editar</button>
      </div>

      {/* Cards info */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
        {[
          {l:'Entrada', v:fmtData(colab.data_entrada)},
          {l:'E-mail',  v:colab.email||'—'},
          {l:'Telefone',v:colab.telefone||'—'},
          {l:'Gestor',  v:colab.gestor_direto||'—'},
        ].map(({l,v})=>(
          <div key={l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:4}}>{l}</div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:16}}>
        {[
          {k:'ausencias',l:`Ausências (${ausencias.length})`},
          {k:'feedbacks',l:`Feedbacks (${feedbacks.length})`},
        ].map(({k,l})=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{padding:'8px 16px',fontSize:13,fontWeight:aba===k?700:400,cursor:'pointer',
              background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',
              color:aba===k?'var(--accent)':'var(--text-muted)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Ausências */}
      {aba==='ausencias' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalAus(true)}>
              <Plus size={14}/> Nova ausência
            </button>
          </div>
          {ausencias.length===0
            ? <div className="empty-state"><p>Nenhuma ausência registrada.</p></div>
            : <div className="table-card">
                <table>
                  <thead><tr><th>Tipo</th><th>Status</th><th>Início</th><th>Fim</th><th>Dias</th><th>Obs.</th><th></th></tr></thead>
                  <tbody>
                    {ausencias.map(a=>{
                      const ta = TIPO_AUSENCIA.find(t=>t.v===a.tipo)
                      const sa = STATUS_AUSENCIA.find(s=>s.v===a.status)||STATUS_AUSENCIA[0]
                      return (
                        <tr key={a.id}>
                          <td style={{fontWeight:600}}>{ta?.l||a.tipo}</td>
                          <td><span className={`badge ${sa.cls}`} style={{fontSize:10}}>{sa.l}</span></td>
                          <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_inicio)}</td>
                          <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_fim)}</td>
                          <td style={{fontSize:12,color:'var(--accent)',fontWeight:700}}>{diffDias(a.data_inicio,a.data_fim)}</td>
                          <td className="td-muted" style={{fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.observacoes||'—'}</td>
                          <td>
                            <div className="actions-cell">
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditAus(a);setModalAus(true)}}><Pencil size={12}/></button>
                              <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDeleteAus(a.id)}><Trash2 size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Feedbacks */}
      {aba==='feedbacks' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalFeed(true)}>
              <Plus size={14}/> Novo feedback
            </button>
          </div>
          {feedbacks.length===0
            ? <div className="empty-state"><p>Nenhum feedback registrado.</p></div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {feedbacks.map(f=>{
                  const tf = TIPO_FEEDBACK.find(t=>t.v===f.tipo)
                  return (
                    <div key={f.id} style={{background:'var(--surface)',border:'1px solid var(--border)',
                      borderLeft:`4px solid ${tf?.cor||'var(--border)'}`,borderRadius:8,padding:'12px 16px'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                            <span style={{fontSize:11,fontWeight:700,color:tf?.cor,textTransform:'uppercase',letterSpacing:'0.05em'}}>{tf?.l}</span>
                            <span style={{fontSize:11,color:'var(--text-muted)'}}>{fmtData(f.data)}</span>
                            {f.relacionado_a && <span style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 7px',color:'var(--text-muted)'}}>{f.relacionado_a}</span>}
                          </div>
                          <p style={{fontSize:13,color:'var(--text)',margin:0,lineHeight:1.5}}>{f.descricao}</p>
                        </div>
                        <div className="actions-cell" style={{flexShrink:0}}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditFeed(f);setModalFeed(true)}}><Pencil size={12}/></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDeleteFeed(f.id)}><Trash2 size={12}/></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      )}

      {modalAus && <ModalAusencia ausencia={editAus} colaborador_id={colab.id} onSave={handleSaveAus} onClose={()=>{setModalAus(false);setEditAus(null)}}/>}
      {modalFeed && <ModalFeedback feedback={editFeed} colaborador_id={colab.id} onSave={handleSaveFeed} onClose={()=>{setModalFeed(false);setEditFeed(null)}}/>}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function RH() {
  const [aba, setAba]                 = useState('equipe')
  const [grupos, setGrupos]           = useState([])
  const [colaboradores, setColabs]    = useState([])
  const [loading, setLoading]         = useState(true)
  const [perfil, setPerfil]           = useState(null)
  const [modalColab, setModalColab]   = useState(false)
  const [editColab, setEditColab]     = useState(null)
  const [modalGrupo, setModalGrupo]   = useState(false)
  const [editGrupo, setEditGrupo]     = useState(null)
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [busca, setBusca]             = useState('')
  const [ausenciasAll, setAusenciasAll] = useState([])
  const [toast, showToast]            = useToast()

  async function carregar() {
    const [gs, cs, aus] = await Promise.all([getGrupos(), getColaboradores(), getTodasAusencias()])
    setGrupos(gs); setColabs(cs); setAusenciasAll(aus)
  }
  useEffect(() => { carregar().finally(()=>setLoading(false)) }, [])

  async function handleSaveColab(c) {
    const salvo = await saveColaborador(c)
    if (c.id) setColabs(prev=>prev.map(x=>x.id===c.id?salvo:x))
    else setColabs(prev=>[...prev,salvo])
    setModalColab(false); setEditColab(null); showToast('Colaborador salvo!')
  }
  async function handleDeleteColab(id) {
    if (!window.confirm('Arquivar este colaborador? Ele será removido permanentemente.')) return
    await deleteColaborador(id)
    setColabs(prev=>prev.filter(x=>x.id!==id))
    showToast('Removido!')
  }
  async function handleSaveGrupo(g) {
    const salvo = await saveGrupo(g)
    if (g.id) setGrupos(prev=>prev.map(x=>x.id===g.id?salvo:x))
    else setGrupos(prev=>[...prev,salvo])
    setModalGrupo(false); setEditGrupo(null); showToast('Grupo salvo!')
  }
  async function handleDeleteGrupo(id) {
    if (!window.confirm('Excluir grupo? Colaboradores não serão afetados.')) return
    await deleteGrupo(id)
    setGrupos(prev=>prev.filter(x=>x.id!==id))
    showToast('Removido!')
  }

  if (loading) return <div className="loading"><div className="spinner"/></div>

  // Se está vendo perfil
  if (perfil) return (
    <PerfilColaborador
      colab={perfil} grupos={grupos}
      onEdit={c=>{setEditColab(c);setModalColab(true)}}
      onBack={()=>setPerfil(null)}
      toast={toast} showToast={showToast}
    />
  )

  const colabsFiltrados = colaboradores.filter(c => {
    if (filtroStatus && c.status !== filtroStatus) return false
    if (filtroGrupo  && c.grupo_id !== filtroGrupo) return false
    if (busca && !(c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cargo.toLowerCase().includes(busca.toLowerCase()))) return false
    return true
  })

  // Calendário de ausências — próximas 4 semanas
  const hoje = new Date().toISOString().slice(0,10)
  const ausenciasFuturas = ausenciasAll.filter(a =>
    a.data_fim >= hoje && ['planejado','aprovado'].includes(a.status)
  ).slice(0, 20)

  // Stats
  const ativos    = colaboradores.filter(c=>c.status==='ativo').length
  const ausentes  = ausenciasAll.filter(a=>a.data_inicio<=hoje&&a.data_fim>=hoje).length
  const desligados= colaboradores.filter(c=>c.status==='desligado').length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>RH</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {ativos} ativo{ativos!==1?'s':''} · {grupos.length} grupo{grupos.length!==1?'s':''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {aba==='equipe' && <button className="btn btn-primary" onClick={()=>setModalColab(true)}><Plus size={14}/> Colaborador</button>}
          {aba==='grupos' && <button className="btn btn-primary" onClick={()=>setModalGrupo(true)}><Plus size={14}/> Novo grupo</button>}
        </div>
      </div>

      {/* Cards resumo */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24}}>
        {[
          {l:'Ativos',     v:ativos,     cor:'#22c55e', icon:UserCheck},
          {l:'Ausentes hoje',v:ausentes, cor:'#f97316', icon:Clock},
          {l:'Desligados', v:desligados, cor:'#ef4444', icon:AlertCircle},
          {l:'Grupos',     v:grupos.length,cor:'var(--accent)',icon:Users},
        ].map(({l,v,cor,icon:Icon})=>(
          <div key={l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderTop:`3px solid ${cor}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>{l}</span>
              <Icon size={15} color={cor} strokeWidth={1.5}/>
            </div>
            <div style={{fontSize:28,fontWeight:800,color:cor,lineHeight:1}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:20}}>
        {[{k:'equipe',l:'Equipe'},{k:'grupos',l:'Grupos'},{k:'ausencias',l:'Ausências'}].map(({k,l})=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{padding:'9px 18px',fontSize:13,fontWeight:aba===k?700:400,cursor:'pointer',
              background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',
              color:aba===k?'var(--accent)':'var(--text-muted)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ABA: EQUIPE */}
      {aba==='equipe' && (
        <div>
          {/* Filtros */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
            <input className="search-input" style={{flex:'1 1 200px'}} placeholder="Buscar por nome ou cargo..."
              value={busca} onChange={e=>setBusca(e.target.value)}/>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
              value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS_COLAB.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
              value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)}>
              <option value="">Todos os grupos</option>
              {grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>

          {colabsFiltrados.length===0
            ? <div className="empty-state"><p>Nenhum colaborador encontrado.</p></div>
            : <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th><th>Cargo</th><th>Grupo</th>
                      <th>Contrato</th><th>Status</th><th>Entrada</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {colabsFiltrados.map(c=>{
                      const sc = STATUS_COLAB.find(s=>s.v===c.status)||STATUS_COLAB[0]
                      const grp = grupos.find(g=>g.id===c.grupo_id)
                      return (
                        <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>setPerfil(c)}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td className="td-strong">{c.nome}</td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.cargo}</td>
                          <td style={{fontSize:12}}>{grp?.nome||<span className="td-muted">—</span>}</td>
                          <td style={{fontSize:11}}><span className="badge badge-indigo">{c.tipo_contrato}</span></td>
                          <td><span className={`badge ${sc.cls}`} style={{fontSize:10}}>{sc.l}</span></td>
                          <td className="td-muted" style={{fontSize:12}}>{fmtData(c.data_entrada)}</td>
                          <td onClick={e=>e.stopPropagation()}>
                            <div className="actions-cell">
                              <button className="btn btn-ghost btn-icon btn-sm"
                                onClick={()=>{setEditColab(c);setModalColab(true)}}><Pencil size={13}/></button>
                              <button className="btn btn-danger btn-icon btn-sm"
                                onClick={()=>handleDeleteColab(c.id)}><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ABA: GRUPOS */}
      {aba==='grupos' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
          {grupos.map(g=>{
            const membros = colaboradores.filter(c=>c.grupo_id===g.id&&c.status==='ativo')
            return (
              <div key={g.id} className="table-card" style={{padding:'16px 20px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{g.nome}</div>
                    {g.responsavel&&<div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Resp: {g.responsavel}</div>}
                    {g.descricao&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{g.descricao}</div>}
                  </div>
                  <div className="actions-cell">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditGrupo(g);setModalGrupo(true)}}><Pencil size={13}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDeleteGrupo(g.id)}><Trash2 size={13}/></button>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                  <Users size={13} color="var(--accent)"/>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>{membros.length} membro{membros.length!==1?'s':''} ativo{membros.length!==1?'s':''}</span>
                </div>
                {membros.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}}>
                    {membros.slice(0,5).map(m=>(
                      <span key={m.id} style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 8px',color:'var(--text-muted)',cursor:'pointer'}}
                        onClick={()=>setPerfil(m)}>
                        {m.nome.split(' ')[0]}
                      </span>
                    ))}
                    {membros.length>5&&<span style={{fontSize:11,color:'var(--text-muted)'}}>+{membros.length-5}</span>}
                  </div>
                )}
              </div>
            )
          })}
          {grupos.length===0&&<div className="empty-state"><p>Nenhum grupo cadastrado ainda.</p></div>}
        </div>
      )}

      {/* ABA: AUSÊNCIAS */}
      {aba==='ausencias' && (
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:12}}>
            Próximas ausências planejadas / aprovadas
          </div>
          {ausenciasFuturas.length===0
            ? <div className="empty-state"><p>Nenhuma ausência futura registrada.</p></div>
            : <div className="table-card">
                <table>
                  <thead><tr><th>Colaborador</th><th>Grupo</th><th>Tipo</th><th>Status</th><th>Início</th><th>Fim</th><th>Dias</th></tr></thead>
                  <tbody>
                    {ausenciasFuturas.map(a=>{
                      const ta = TIPO_AUSENCIA.find(t=>t.v===a.tipo)
                      const sa = STATUS_AUSENCIA.find(s=>s.v===a.status)||STATUS_AUSENCIA[0]
                      return (
                        <tr key={a.id}>
                          <td className="td-strong" style={{cursor:'pointer'}}
                            onClick={()=>setPerfil(colaboradores.find(c=>c.id===a.colaborador_id))}>
                            {a.rh_colaboradores?.nome||'—'}
                          </td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.rh_colaboradores?.rh_grupos?.nome||'—'}</td>
                          <td style={{fontSize:12}}>{ta?.l||a.tipo}</td>
                          <td><span className={`badge ${sa.cls}`} style={{fontSize:10}}>{sa.l}</span></td>
                          <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_inicio)}</td>
                          <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_fim)}</td>
                          <td style={{fontSize:12,color:'var(--accent)',fontWeight:700}}>{diffDias(a.data_inicio,a.data_fim)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Modais */}
      {modalColab && <ModalColaborador colab={editColab} grupos={grupos} onSave={handleSaveColab} onClose={()=>{setModalColab(false);setEditColab(null)}}/>}
      {modalGrupo && <ModalGrupo grupo={editGrupo} onSave={handleSaveGrupo} onClose={()=>{setModalGrupo(false);setEditGrupo(null)}}/>}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
