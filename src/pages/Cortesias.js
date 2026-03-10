import { useEffect, useState } from 'react'
import {
  getParceiros, createParceiro, updateParceiro, deleteParceiro,
  getLivros, createLivro, updateLivro, deleteLivro,
  getEnvios, createEnvio, updateEnvio, deleteEnvio
} from '../lib/supabase'
import { Plus, Pencil, Trash2, X, BookOpen, Users, Send } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CANAIS  = ['Instagram','YouTube','Blog','TikTok','Podcast','Twitter/X','Newsletter','Outro']
const TIPOS   = ['Influencer','Jornalista','Blogueiro','Bookstagram','BookTuber','Livraria','Escola','Outro']
const STATUS_OPTIONS = [
  { value: 'enviado',   label: 'Enviado',   cls: 'badge-amber' },
  { value: 'divulgado', label: 'Divulgado', cls: 'badge-green' },
  { value: 'cancelado', label: 'Cancelado', cls: 'badge-red'   },
]

const TABS = [
  { id: 'envios',    label: 'Envios',    icon: Send },
  { id: 'parceiros', label: 'Parceiros', icon: Users },
  { id: 'livros',    label: 'Livros',    icon: BookOpen },
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  return [toast, show]
}

// ── ENVIOS TAB ─────────────────────────────────────────────
function EnviosTab({ parceiros, livros }) {
  const [envios, setEnvios]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter]   = useState('todos')
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, showToast]    = useToast()

  const EMPTY = { parceiro_id: '', livro_id: '', status: 'enviado', data_envio: new Date().toISOString().slice(0,10), observacoes: '' }
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    getEnvios().then(setEnvios).catch(console.error).finally(() => setLoading(false))
  }, [])

  function openNew()  { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(e){ setEditing(e); setForm({ parceiro_id: e.parceiro_id, livro_id: e.livro_id, status: e.status, data_envio: e.data_envio||'', observacoes: e.observacoes||'' }); setModal(true) }
  function close()    { setModal(false); setEditing(null) }

  async function save() {
    if (!form.parceiro_id || !form.livro_id) return
    setSaving(true)
    try {
      if (editing) {
        const u = await updateEnvio(editing.id, form)
        setEnvios(prev => prev.map(e => e.id === u.id ? u : e))
        showToast('Envio atualizado!')
      } else {
        const n = await createEnvio(form)
        setEnvios(prev => [n, ...prev])
        showToast('Envio registrado!')
      }
      close()
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir este envio?')) return
    try { await deleteEnvio(id); setEnvios(prev => prev.filter(e => e.id !== id)); showToast('Excluído!') }
    catch { showToast('Erro ao excluir', 'error') }
  }

  async function quickConfirm(envio) {
    try {
      const u = await updateEnvio(envio.id, { ...envio, status: 'divulgado' })
      setEnvios(prev => prev.map(e => e.id === u.id ? u : e))
      showToast('Divulgação confirmada!')
    } catch { showToast('Erro', 'error') }
  }

  const filtered = envios
    .filter(e => filter === 'todos' || e.status === filter)
    .filter(e => {
      const q = search.toLowerCase()
      return (e.parceiros?.nome||'').toLowerCase().includes(q) || (e.livros?.titulo||'').toLowerCase().includes(q)
    })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cortesias</h1>
          <p className="page-subtitle">{envios.length} envio{envios.length !== 1 ? 's' : ''} registrado{envios.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Registrar Envio</button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos','enviado','divulgado','cancelado'].map(f => (
              <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`} onClick={()=>setFilter(f)}>
                {f==='todos'?'Todos':STATUS_OPTIONS.find(s=>s.value===f)?.label}
              </button>
            ))}
          </div>
          <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>

        {loading ? <div className="loading" style={{minHeight:'auto',padding:40}}><div className="spinner"/></div>
        : filtered.length === 0 ? <div className="empty-state"><p>Nenhum envio encontrado.</p></div>
        : (
          <table>
            <thead><tr><th>Parceiro</th><th>Livro</th><th>Data</th><th>Status</th><th>Ação</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e => {
                const s = STATUS_OPTIONS.find(x=>x.value===e.status)||STATUS_OPTIONS[0]
                return (
                  <tr key={e.id}>
                    <td className="td-strong">{e.parceiros?.nome||'—'}</td>
                    <td>{e.livros?.titulo||'—'}</td>
                    <td className="td-muted">{e.data_envio ? format(new Date(e.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR}) : '—'}</td>
                    <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    <td>
                      {e.status==='enviado' && (
                        <button className="btn btn-sm btn-ghost" style={{color:'var(--green)',fontSize:12}} onClick={()=>quickConfirm(e)}>
                          ✓ Confirmar divulgação
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(e)}><Pencil size={14}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(e.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing?'Editar Envio':'Registrar Envio'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Parceiro *</label>
                <select className="form-select" value={form.parceiro_id} onChange={e=>setForm(f=>({...f,parceiro_id:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {parceiros.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Livro *</label>
                <select className="form-select" value={form.livro_id} onChange={e=>setForm(f=>({...f,livro_id:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {livros.map(l=><option key={l.id} value={l.id}>{l.titulo}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data do Envio</label>
                  <input className="form-input" type="date" value={form.data_envio} onChange={e=>setForm(f=>({...f,data_envio:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas sobre este envio..."/>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.parceiro_id||!form.livro_id}>
                {saving?'Salvando...':editing?'Salvar':'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── PARCEIROS TAB ──────────────────────────────────────────
function ParceirosTab({ parceiros, setParceiros }) {
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, showToast]  = useToast()

  const EMPTY = { nome:'', email:'', canal:'', tipo:'', seguidores:'', observacoes:'' }
  const [form, setForm] = useState(EMPTY)

  function openNew()  { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(p){ setEditing(p); setForm({...p}); setModal(true) }
  function close()    { setModal(false); setEditing(null) }

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const u = await updateParceiro(editing.id, form)
        setParceiros(prev => prev.map(p => p.id===u.id?u:p))
        showToast('Parceiro atualizado!')
      } else {
        const n = await createParceiro(form)
        setParceiros(prev => [...prev,n].sort((a,b)=>a.nome.localeCompare(b.nome)))
        showToast('Parceiro cadastrado!')
      }
      close()
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir este parceiro?')) return
    try { await deleteParceiro(id); setParceiros(prev=>prev.filter(p=>p.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro ao excluir', 'error') }
  }

  const filtered = parceiros.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.canal||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Parceiro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Parceiros ({parceiros.length})</span>
          <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0 ? <div className="empty-state"><p>Nenhum parceiro encontrado.</p></div> : (
          <table>
            <thead><tr><th>Nome</th><th>Canal</th><th>Tipo</th><th>E-mail</th><th>Seguidores</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id}>
                  <td className="td-strong">{p.nome}</td>
                  <td className="td-muted">{p.canal||'—'}</td>
                  <td>{p.tipo?<span className="badge badge-gray">{p.tipo}</span>:<span className="td-muted">—</span>}</td>
                  <td className="td-muted">{p.email||'—'}</td>
                  <td className="td-muted">{p.seguidores?Number(p.seguidores).toLocaleString('pt-BR'):'—'}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(p)}><Pencil size={14}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(p.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing?'Editar Parceiro':'Novo Parceiro'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome do parceiro"/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Canal</label><select className="form-select" value={form.canal} onChange={e=>setForm(f=>({...f,canal:e.target.value}))}><option value="">Selecionar...</option>{CANAIS.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}><option value="">Selecionar...</option>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com"/></div>
                <div className="form-group"><label className="form-label">Seguidores</label><input className="form-input" type="number" value={form.seguidores} onChange={e=>setForm(f=>({...f,seguidores:e.target.value}))} placeholder="0"/></div>
              </div>
              <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas..."/></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── LIVROS TAB ─────────────────────────────────────────────
function LivrosTab({ livros, setLivros }) {
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, showToast]  = useToast()

  const EMPTY = { titulo:'', autor:'', isbn:'', editora:'', ano:'', sinopse:'' }
  const [form, setForm] = useState(EMPTY)

  function openNew()  { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(l){ setEditing(l); setForm({...l}); setModal(true) }
  function close()    { setModal(false); setEditing(null) }

  async function save() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const u = await updateLivro(editing.id, form)
        setLivros(prev => prev.map(l => l.id===u.id?u:l))
        showToast('Livro atualizado!')
      } else {
        const n = await createLivro(form)
        setLivros(prev => [...prev,n].sort((a,b)=>a.titulo.localeCompare(b.titulo)))
        showToast('Livro cadastrado!')
      }
      close()
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir este livro?')) return
    try { await deleteLivro(id); setLivros(prev=>prev.filter(l=>l.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro ao excluir', 'error') }
  }

  const filtered = livros.filter(l =>
    l.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (l.autor||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Livro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Livros ({livros.length})</span>
          <input className="search-input" placeholder="Buscar título ou autor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0 ? <div className="empty-state"><p>Nenhum livro encontrado.</p></div> : (
          <table>
            <thead><tr><th>Título</th><th>Autor</th><th>Editora</th><th>Ano</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l=>(
                <tr key={l.id}>
                  <td className="td-strong">{l.titulo}</td>
                  <td className="td-muted">{l.autor||'—'}</td>
                  <td className="td-muted">{l.editora||'—'}</td>
                  <td className="td-muted">{l.ano||'—'}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(l)}><Pencil size={14}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(l.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing?'Editar Livro':'Novo Livro'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Título do livro"/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Autor</label><input className="form-input" value={form.autor} onChange={e=>setForm(f=>({...f,autor:e.target.value}))} placeholder="Nome do autor"/></div>
                <div className="form-group"><label className="form-label">Editora</label><input className="form-input" value={form.editora} onChange={e=>setForm(f=>({...f,editora:e.target.value}))} placeholder="Editora"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ISBN</label><input className="form-input" value={form.isbn} onChange={e=>setForm(f=>({...f,isbn:e.target.value}))} placeholder="978-..."/></div>
                <div className="form-group"><label className="form-label">Ano</label><input className="form-input" type="number" value={form.ano} onChange={e=>setForm(f=>({...f,ano:e.target.value}))} placeholder="2024"/></div>
              </div>
              <div className="form-group"><label className="form-label">Sinopse</label><textarea className="form-textarea" value={form.sinopse} onChange={e=>setForm(f=>({...f,sinopse:e.target.value}))} placeholder="Breve descrição..."/></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.titulo.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── MAIN CORTESIAS PAGE ────────────────────────────────────
export default function Cortesias() {
  const [tab, setTab]           = useState('envios')
  const [parceiros, setParceiros] = useState([])
  const [livros, setLivros]     = useState([])

  useEffect(() => {
    getParceiros().then(setParceiros).catch(console.error)
    getLivros().then(setLivros).catch(console.error)
  }, [])

  return (
    <div>
      {/* Tabs de navegação interna */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`btn btn-sm ${tab===id ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              borderRadius:'8px 8px 0 0',
              borderBottom: tab===id ? 'none' : undefined,
              marginBottom: tab===id ? '-1px' : 0,
            }}
          >
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {tab === 'envios'    && <EnviosTab    parceiros={parceiros} livros={livros} />}
      {tab === 'parceiros' && <ParceirosTab parceiros={parceiros} setParceiros={setParceiros} />}
      {tab === 'livros'    && <LivrosTab    livros={livros} setLivros={setLivros} />}
    </div>
  )
}
