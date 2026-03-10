import { useEffect, useState } from 'react'
import { getUsuarios, updateUsuario, createUsuarioAdmin } from '../lib/supabase'
import { Plus, Pencil, X, ShieldCheck } from 'lucide-react'

const PERFIS = [
  { value: 'administrador', label: 'Administrador', cls: 'badge-accent', desc: 'Acesso total ao sistema' },
  { value: 'gerente',       label: 'Gerente',       cls: 'badge-indigo', desc: 'Relatórios e aprovações' },
  { value: 'analista',      label: 'Analista',      cls: 'badge-green',  desc: 'Opera os módulos' },
  { value: 'assistente',    label: 'Assistente',    cls: 'badge-gray',   desc: 'Acesso limitado' },
]

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [search, setSearch]     = useState('')

  const EMPTY_NEW  = { nome:'', email:'', senha:'', perfil:'analista' }
  const [formNew, setFormNew]   = useState(EMPTY_NEW)
  const [formEdit, setFormEdit] = useState({ nome:'', perfil:'analista' })

  useEffect(() => {
    getUsuarios().then(setUsuarios).catch(console.error).finally(()=>setLoading(false))
  }, [])

  function showToast(msg, type='success') {
    setToast({msg,type})
    setTimeout(()=>setToast(null), 3000)
  }

  function openEdit(u) {
    setEditing(u)
    setFormEdit({ nome: u.nome, perfil: u.perfil })
    setEditModal(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const u = await updateUsuario(editing.id, formEdit)
      setUsuarios(prev => prev.map(x => x.id===u.id?u:x))
      showToast('Usuário atualizado!')
      setEditModal(false)
    } catch { showToast('Erro ao atualizar', 'error') }
    finally { setSaving(false) }
  }

  async function saveNew() {
    if (!formNew.nome||!formNew.email||!formNew.senha) return
    setSaving(true)
    try {
      await createUsuarioAdmin(formNew)
      showToast('Convite enviado! O usuário receberá um e-mail para confirmar.')
      setModal(false)
      setFormNew(EMPTY_NEW)
      // Recarrega lista após criação
      const lista = await getUsuarios()
      setUsuarios(lista)
    } catch (e) {
      showToast(e.message || 'Erro ao criar usuário', 'error')
    } finally { setSaving(false) }
  }

  const filtered = usuarios.filter(u =>
    (u.nome||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">{usuarios.length} usuário{usuarios.length!==1?'s':''} no sistema</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={16}/> Novo Usuário</button>
      </div>

      {/* Legenda de perfis */}
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
        {PERFIS.map(p=>(
          <div key={p.value} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <span className={`badge ${p.cls}`}>{p.label}</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{p.desc}</span>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Lista de Usuários</span>
          <input className="search-input" placeholder="Buscar usuário..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {loading ? <div className="loading" style={{minHeight:'auto',padding:40}}><div className="spinner"/></div>
        : filtered.length===0 ? <div className="empty-state"><p>Nenhum usuário encontrado.</p></div>
        : (
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Módulos</th><th></th></tr></thead>
            <tbody>
              {filtered.map(u => {
                const perfil = PERFIS.find(p=>p.value===u.perfil)
                return (
                  <tr key={u.id}>
                    <td className="td-strong" style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid rgba(224,96,48,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                        {(u.nome||'?')[0].toUpperCase()}
                      </div>
                      {u.nome||'—'}
                    </td>
                    <td className="td-muted">{u.email||'—'}</td>
                    <td>{perfil ? <span className={`badge ${perfil.cls}`}>{perfil.label}</span> : <span className="td-muted">—</span>}</td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {u.perfil==='administrador' && <span className="badge badge-accent" style={{fontSize:10}}>Todos</span>}
                        {['gerente','analista'].includes(u.perfil) && <>
                          <span className="badge badge-gray" style={{fontSize:10}}>Dashboard</span>
                          <span className="badge badge-gray" style={{fontSize:10}}>Cortesias</span>
                        </>}
                        {u.perfil==='assistente' && <span className="badge badge-gray" style={{fontSize:10}}>Dashboard</span>}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(u)} title="Editar perfil"><Pencil size={14}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal novo usuário */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Novo Usuário</h2>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(false)}><X size={16}/></button>
            </div>
            <div style={{ background:'var(--indigo-light)', border:'1px solid rgba(108,114,245,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:8, alignItems:'flex-start' }}>
              <ShieldCheck size={15} color="var(--indigo)" style={{marginTop:2, flexShrink:0}}/>
              <p style={{ fontSize:12.5, color:'var(--indigo)', lineHeight:1.5 }}>
                O usuário receberá um e-mail do Supabase para confirmar o cadastro antes de fazer login.
              </p>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome completo *</label><input className="form-input" value={formNew.nome} onChange={e=>setFormNew(f=>({...f,nome:e.target.value}))} placeholder="Nome da pessoa"/></div>
              <div className="form-group"><label className="form-label">E-mail *</label><input className="form-input" type="email" value={formNew.email} onChange={e=>setFormNew(f=>({...f,email:e.target.value}))} placeholder="email@cedet.com.br"/></div>
              <div className="form-group"><label className="form-label">Senha provisória *</label><input className="form-input" type="password" value={formNew.senha} onChange={e=>setFormNew(f=>({...f,senha:e.target.value}))} placeholder="Mínimo 6 caracteres"/></div>
              <div className="form-group">
                <label className="form-label">Perfil de Acesso</label>
                <select className="form-select" value={formNew.perfil} onChange={e=>setFormNew(f=>({...f,perfil:e.target.value}))}>
                  {PERFIS.map(p=><option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveNew} disabled={saving||!formNew.nome||!formNew.email||!formNew.senha}>
                {saving?'Criando...':'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar perfil */}
      {editModal && editing && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setEditModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Editar Usuário</h2>
              <button className="btn btn-ghost btn-icon" onClick={()=>setEditModal(false)}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={formEdit.nome} onChange={e=>setFormEdit(f=>({...f,nome:e.target.value}))}/></div>
              <div className="form-group">
                <label className="form-label">Perfil de Acesso</label>
                <select className="form-select" value={formEdit.perfil} onChange={e=>setFormEdit(f=>({...f,perfil:e.target.value}))}>
                  {PERFIS.map(p=><option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={()=>setEditModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
