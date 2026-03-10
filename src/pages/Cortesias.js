import { useEffect, useState, useRef } from 'react'
import {
  getParceiros, createParceiro, updateParceiro, deleteParceiro,
  getLivros, createLivro, updateLivro, deleteLivro,
  getEnvios, createEnvio, updateEnvio, deleteEnvio
} from '../lib/supabase'
import { Plus, Pencil, Trash2, X, BookOpen, Users, Send, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

const TIPOS_PARCERIA = [
  'Livraria de influencer',
  'Booktime',
  'Divulgação editoras próprias',
]

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
    setTimeout(() => setToast(null), 4000)
  }
  return [toast, show]
}

// ── UPLOAD PLANILHA ────────────────────────────────────────
function UploadPlanilha({ onImport, tipo }) {
  const [open, setOpen]           = useState(false)
  const [preview, setPreview]     = useState([])
  const [erros, setErros]         = useState([])
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef                  = useRef()

  const colunasParceiros = ['nome', 'tipo_parceria']
  const colunasLivros    = ['titulo', 'isbn', 'sku', 'autor', 'editora']
  const colunas          = tipo === 'parceiros' ? colunasParceiros : colunasLivros

  const nomeColuna = {
    nome: 'Nome', tipo_parceria: 'Tipo de Parceria',
    titulo: 'Título', isbn: 'ISBN', sku: 'SKU', autor: 'Autor', editora: 'Editora'
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setErros([]); setPreview([]); setResultado(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) { setErros(['A planilha está vazia.']); return }

        const normalized = rows.map(row => {
          const obj = {}
          Object.keys(row).forEach(k => {
            obj[k.toLowerCase().trim().replace(/\s+/g, '_')] = String(row[k]).trim()
          })
          return obj
        })

        const campoObrigatorio = tipo === 'parceiros' ? 'nome' : 'titulo'
        const errosEncontrados = []
        normalized.forEach((row, i) => {
          if (!row[campoObrigatorio]) errosEncontrados.push(`Linha ${i + 2}: campo "${campoObrigatorio}" está vazio.`)
        })

        setErros(errosEncontrados)
        setPreview(normalized.slice(0, 5))
        inputRef.current._allRows = normalized
      } catch {
        setErros(['Erro ao ler o arquivo. Verifique se é um Excel válido (.xlsx).'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    const rows = inputRef.current._allRows
    if (!rows || rows.length === 0) return
    setImporting(true)
    let sucesso = 0, falhas = 0

    for (const row of rows) {
      try {
        if (tipo === 'parceiros') {
          await createParceiro({ nome: row.nome || '', tipo_parceria: row.tipo_parceria || row.tipo || '' })
        } else {
          await createLivro({ titulo: row.titulo || '', isbn: row.isbn || '', sku: row.sku || '', autor: row.autor || '', editora: row.editora || '' })
        }
        sucesso++
      } catch { falhas++ }
    }

    setImporting(false)
    setResultado({ sucesso, falhas })
    onImport()
  }

  function reset() {
    setOpen(false); setPreview([]); setErros([]); setResultado(null)
    if (inputRef.current) { inputRef.current.value = ''; inputRef.current._allRows = null }
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Upload size={15} /> Importar planilha
      </button>

      {open && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && reset()}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">Importar {tipo === 'parceiros' ? 'Parceiros' : 'Livros'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={reset}><X size={16} /></button>
            </div>

            <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <FileSpreadsheet size={15} color="var(--text-muted)" />
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Colunas esperadas na planilha
                </span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {colunas.map(c => <span key={c} className="badge badge-indigo" style={{fontSize:11}}>{nomeColuna[c]}</span>)}
              </div>
              <p style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:8 }}>
                A primeira linha deve ser o cabeçalho.
                {tipo === 'parceiros' ? ' "Nome" é obrigatório.' : ' "Título" é obrigatório.'}
              </p>
            </div>

            {!resultado && (
              <>
                <div
                  style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'28px 20px', textAlign:'center', marginBottom:16, cursor:'pointer' }}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFile({ target: { files: e.dataTransfer.files } }) }}
                >
                  <Upload size={24} color="var(--text-muted)" style={{ marginBottom:8 }} />
                  <p style={{ fontSize:13.5, color:'var(--text-soft)' }}>Clique para selecionar ou arraste o arquivo</p>
                  <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Apenas .xlsx</p>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={handleFile} />

                {erros.length > 0 && (
                  <div style={{ background:'var(--red-light)', border:'1px solid rgba(245,101,101,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                    {erros.map((e,i) => (
                      <div key={i} style={{ display:'flex', gap:7, alignItems:'flex-start', fontSize:12.5, color:'var(--red)' }}>
                        <AlertCircle size={14} style={{ marginTop:2, flexShrink:0 }} /> {e}
                      </div>
                    ))}
                  </div>
                )}

                {preview.length > 0 && erros.length === 0 && (
                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
                      Prévia — {preview.length} de {inputRef.current?._allRows?.length || 0} linhas:
                    </p>
                    <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                      <table style={{ fontSize:12 }}>
                        <thead><tr>{colunas.map(c => <th key={c}>{nomeColuna[c]}</th>)}</tr></thead>
                        <tbody>{preview.map((row,i) => <tr key={i}>{colunas.map(c => <td key={c}>{row[c]||'—'}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {resultado && (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <CheckCircle size={40} color="var(--green)" style={{ marginBottom:12 }} />
                <p style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Importação concluída!</p>
                <p style={{ fontSize:13.5, color:'var(--green)' }}>{resultado.sucesso} {tipo==='parceiros'?'parceiro(s)':'livro(s)'} importado(s)</p>
                {resultado.falhas > 0 && <p style={{ fontSize:13, color:'var(--red)', marginTop:4 }}>{resultado.falhas} linha(s) com erro</p>}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={reset}>{resultado ? 'Fechar' : 'Cancelar'}</button>
              {!resultado && preview.length > 0 && erros.length === 0 && (
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando...' : `Importar ${inputRef.current?._allRows?.length || 0} registros`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
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
  const EMPTY = { parceiro_id:'', livro_id:'', status:'enviado', data_envio:new Date().toISOString().slice(0,10), observacoes:'' }
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { getEnvios().then(setEnvios).catch(console.error).finally(()=>setLoading(false)) }, [])

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(e) { setEditing(e); setForm({ parceiro_id:e.parceiro_id, livro_id:e.livro_id, status:e.status, data_envio:e.data_envio||'', observacoes:e.observacoes||'' }); setModal(true) }
  function close()     { setModal(false); setEditing(null) }

  async function save() {
    if (!form.parceiro_id || !form.livro_id) return
    setSaving(true)
    try {
      if (editing) { const u=await updateEnvio(editing.id,form); setEnvios(prev=>prev.map(e=>e.id===u.id?u:e)); showToast('Atualizado!') }
      else { const n=await createEnvio(form); setEnvios(prev=>[n,...prev]); showToast('Registrado!') }
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir?')) return
    try { await deleteEnvio(id); setEnvios(prev=>prev.filter(e=>e.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  async function quickConfirm(envio) {
    try { const u=await updateEnvio(envio.id,{...envio,status:'divulgado'}); setEnvios(prev=>prev.map(e=>e.id===u.id?u:e)); showToast('Divulgação confirmada!') }
    catch { showToast('Erro','error') }
  }

  const filtered = envios
    .filter(e=>filter==='todos'||e.status===filter)
    .filter(e=>{ const q=search.toLowerCase(); return (e.parceiros?.nome||'').toLowerCase().includes(q)||(e.livros?.titulo||'').toLowerCase().includes(q) })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cortesias</h1>
          <p className="page-subtitle">{envios.length} envio{envios.length!==1?'s':''} registrado{envios.length!==1?'s':''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Registrar Envio</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {['todos','enviado','divulgado','cancelado'].map(f=>(
              <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`} onClick={()=>setFilter(f)}>
                {f==='todos'?'Todos':STATUS_OPTIONS.find(s=>s.value===f)?.label}
              </button>
            ))}
          </div>
          <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {loading?<div className="loading" style={{minHeight:'auto',padding:40}}><div className="spinner"/></div>
        :filtered.length===0?<div className="empty-state"><p>Nenhum envio encontrado.</p></div>
        :(
          <table>
            <thead><tr><th>Parceiro</th><th>Livro</th><th>Data</th><th>Status</th><th>Ação</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e=>{
                const s=STATUS_OPTIONS.find(x=>x.value===e.status)||STATUS_OPTIONS[0]
                return(
                  <tr key={e.id}>
                    <td className="td-strong">{e.parceiros?.nome||'—'}</td>
                    <td>{e.livros?.titulo||'—'}</td>
                    <td className="td-muted">{e.data_envio?format(new Date(e.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR}):'—'}</td>
                    <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    <td>{e.status==='enviado'&&<button className="btn btn-sm btn-ghost" style={{color:'var(--green)',fontSize:12}} onClick={()=>quickConfirm(e)}>✓ Confirmar divulgação</button>}</td>
                    <td><div className="actions-cell"><button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(e)}><Pencil size={14}/></button><button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(e.id)}><Trash2 size={14}/></button></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {modal&&(
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing?'Editar Envio':'Registrar Envio'}</h2><button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Parceiro *</label><select className="form-select" value={form.parceiro_id} onChange={e=>setForm(f=>({...f,parceiro_id:e.target.value}))}><option value="">Selecionar...</option>{parceiros.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Livro *</label><select className="form-select" value={form.livro_id} onChange={e=>setForm(f=>({...f,livro_id:e.target.value}))}><option value="">Selecionar...</option>{livros.map(l=><option key={l.id} value={l.id}>{l.titulo}</option>)}</select></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Data do Envio</label><input className="form-input" type="date" value={form.data_envio} onChange={e=>setForm(f=>({...f,data_envio:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              </div>
              <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas..."/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.parceiro_id||!form.livro_id}>{saving?'Salvando...':editing?'Salvar':'Registrar'}</button></div>
          </div>
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── PARCEIROS TAB ──────────────────────────────────────────
function ParceirosTab({ parceiros, setParceiros }) {
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, showToast]    = useToast()
  const EMPTY = { nome:'', tipo_parceria:'' }
  const [form, setForm] = useState(EMPTY)

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(p) { setEditing(p); setForm({ nome:p.nome, tipo_parceria:p.tipo_parceria||'' }); setModal(true) }
  function close()     { setModal(false); setEditing(null) }
  async function reload() { setParceiros(await getParceiros()) }

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editing) { const u=await updateParceiro(editing.id,form); setParceiros(prev=>prev.map(p=>p.id===u.id?u:p)); showToast('Atualizado!') }
      else { const n=await createParceiro(form); setParceiros(prev=>[...prev,n].sort((a,b)=>a.nome.localeCompare(b.nome))); showToast('Cadastrado!') }
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir?')) return
    try { await deleteParceiro(id); setParceiros(prev=>prev.filter(p=>p.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  const filtered = parceiros.filter(p=>p.nome.toLowerCase().includes(search.toLowerCase())||(p.tipo_parceria||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginBottom:20}}>
        <UploadPlanilha tipo="parceiros" onImport={reload}/>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Parceiro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Parceiros ({parceiros.length})</span>
          <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0?<div className="empty-state"><p>Nenhum parceiro encontrado.</p></div>:(
          <table>
            <thead><tr><th>Nome</th><th>Tipo de Parceria</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id}>
                  <td className="td-strong">{p.nome}</td>
                  <td>{p.tipo_parceria?<span className="badge badge-indigo">{p.tipo_parceria}</span>:<span className="td-muted">—</span>}</td>
                  <td><div className="actions-cell"><button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(p)}><Pencil size={14}/></button><button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(p.id)}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal&&(
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing?'Editar Parceiro':'Novo Parceiro'}</h2><button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome do parceiro"/></div>
              <div className="form-group"><label className="form-label">Tipo de Parceria</label><select className="form-select" value={form.tipo_parceria} onChange={e=>setForm(f=>({...f,tipo_parceria:e.target.value}))}><option value="">Selecionar...</option>{TIPOS_PARCERIA.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button></div>
          </div>
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── LIVROS TAB ─────────────────────────────────────────────
function LivrosTab({ livros, setLivros }) {
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, showToast]    = useToast()
  const EMPTY = { titulo:'', isbn:'', sku:'', autor:'', editora:'' }
  const [form, setForm] = useState(EMPTY)

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(l) { setEditing(l); setForm({ titulo:l.titulo, isbn:l.isbn||'', sku:l.sku||'', autor:l.autor||'', editora:l.editora||'' }); setModal(true) }
  function close()     { setModal(false); setEditing(null) }
  async function reload() { setLivros(await getLivros()) }

  async function save() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      if (editing) { const u=await updateLivro(editing.id,form); setLivros(prev=>prev.map(l=>l.id===u.id?u:l)); showToast('Atualizado!') }
      else { const n=await createLivro(form); setLivros(prev=>[...prev,n].sort((a,b)=>a.titulo.localeCompare(b.titulo))); showToast('Cadastrado!') }
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir?')) return
    try { await deleteLivro(id); setLivros(prev=>prev.filter(l=>l.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  const filtered = livros.filter(l=>
    l.titulo.toLowerCase().includes(search.toLowerCase())||
    (l.autor||'').toLowerCase().includes(search.toLowerCase())||
    (l.isbn||'').toLowerCase().includes(search.toLowerCase())||
    (l.sku||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginBottom:20}}>
        <UploadPlanilha tipo="livros" onImport={reload}/>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Livro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Livros ({livros.length})</span>
          <input className="search-input" placeholder="Buscar título, autor, ISBN ou SKU..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0?<div className="empty-state"><p>Nenhum livro encontrado.</p></div>:(
          <table>
            <thead><tr><th>Título</th><th>Autor</th><th>Editora</th><th>ISBN</th><th>SKU</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l=>(
                <tr key={l.id}>
                  <td className="td-strong">{l.titulo}</td>
                  <td className="td-muted">{l.autor||'—'}</td>
                  <td className="td-muted">{l.editora||'—'}</td>
                  <td className="td-muted">{l.isbn||'—'}</td>
                  <td className="td-muted">{l.sku||'—'}</td>
                  <td><div className="actions-cell"><button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(l)}><Pencil size={14}/></button><button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(l.id)}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal&&(
        <div className="modal-backdrop" onClick={ev=>ev.target===ev.currentTarget&&close()}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing?'Editar Livro':'Novo Livro'}</h2><button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Título do livro"/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Autor</label><input className="form-input" value={form.autor} onChange={e=>setForm(f=>({...f,autor:e.target.value}))} placeholder="Nome do autor"/></div>
                <div className="form-group"><label className="form-label">Editora</label><input className="form-input" value={form.editora} onChange={e=>setForm(f=>({...f,editora:e.target.value}))} placeholder="Editora"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ISBN</label><input className="form-input" value={form.isbn} onChange={e=>setForm(f=>({...f,isbn:e.target.value}))} placeholder="978-..."/></div>
                <div className="form-group"><label className="form-label">SKU</label><input className="form-input" value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="SKU do produto"/></div>
              </div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.titulo.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button></div>
          </div>
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Cortesias() {
  const [tab, setTab]             = useState('envios')
  const [parceiros, setParceiros] = useState([])
  const [livros, setLivros]       = useState([])

  useEffect(() => {
    getParceiros().then(setParceiros).catch(console.error)
    getLivros().then(setLivros).catch(console.error)
  }, [])

  return (
    <div>
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'1px solid var(--border)'}}>
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setTab(id)} className={`btn btn-sm ${tab===id?'btn-primary':'btn-ghost'}`} style={{borderRadius:'8px 8px 0 0',marginBottom:tab===id?'-1px':0}}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>
      {tab==='envios'    && <EnviosTab    parceiros={parceiros} livros={livros}/>}
      {tab==='parceiros' && <ParceirosTab parceiros={parceiros} setParceiros={setParceiros}/>}
      {tab==='livros'    && <LivrosTab    livros={livros} setLivros={setLivros}/>}
    </div>
  )
}
