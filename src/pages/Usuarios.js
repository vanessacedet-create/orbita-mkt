import { useEffect, useState } from 'react'
import { getUsuarios, createUsuarioAdmin, updateUsuario } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Users, Plus, X, Copy, Check, Pencil } from 'lucide-react'

const PERFIS = [
  { v:'administrador',          l:'Administrador',            grupo:'Gestão' },
  { v:'gerente',                l:'Gerente',                  grupo:'Gestão' },
  { v:'supervisor_proprias',    l:'Supervisor Próprias',      grupo:'Próprias' },
  { v:'analista_proprias',      l:'Analista Próprias',        grupo:'Próprias' },
  { v:'estagiario_proprias',    l:'Estagiário Próprias',      grupo:'Próprias' },
  { v:'analista_influencers',   l:'Analista Influencers',     grupo:'Influencers' },
  { v:'estagiario_influencers', l:'Estagiário Influencers',   grupo:'Influencers' },
  { v:'analista_marketplaces',  l:'Analista Mkt & Eventos',   grupo:'Mkt & Eventos' },
  { v:'estagiario_marketplaces',l:'Estagiário Mkt & Eventos', grupo:'Mkt & Eventos' },
]

const PERFIL_COR = {
  administrador:          'var(--accent)',
  gerente:                '#6366f1',
  supervisor_proprias:    '#8b5cf6',
  analista_proprias:      '#06b6d4',
  estagiario_proprias:    '#06b6d4',
  analista_influencers:   '#22c55e',
  estagiario_influencers: '#22c55e',
  analista_marketplaces:  '#f97316',
  estagiario_marketplaces:'#f97316',
}

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}

function ModalNovoUsuario({ onSave, onClose }) {
  const [form, setForm]     = useState({ nome:'', email:'', perfil:'estagiario_influencers', senha:'' })
  const [saving, setSaving] = useState(false)
  const [copiado, setCopiado] = useState(false)

  function gerarSenha() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!'
    const senha = Array.from({length:12}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('')
    setForm(f=>({...f, senha}))
  }

  async function copiarSenha() {
    await navigator.clipboard.writeText(form.senha)
    setCopiado(true)
    setTimeout(()=>setCopiado(false), 2000)
  }

  async function save() {
    if (!form.nome.trim()||!form.email.trim()||!form.senha.trim()) return
    setSaving(true)
    try { await onSave(form) }
    finally { setSaving(false) }
  }

  // Agrupa perfis por grupo para o select
  const grupos = [...new Set(PERFIS.map(p=>p.grupo))]

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header">
          <h2 className="modal-title">Novo Usuário</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome do usuário"/>
          </div>
          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@cedet.com.br"/>
          </div>
          <div className="form-group">
            <label className="form-label">Perfil *</label>
            <select className="form-select" value={form.perfil} onChange={e=>setForm(f=>({...f,perfil:e.target.value}))}>
              {grupos.map(g=>(
                <optgroup key={g} label={g}>
                  {PERFIS.filter(p=>p.grupo===g).map(p=>(
                    <option key={p.v} value={p.v}>{p.l}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Senha inicial *</label>
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" style={{flex:1}} value={form.senha}
                onChange={e=>setForm(f=>({...f,senha:e.target.value}))}
                placeholder="Mínimo 8 caracteres" type="text"/>
              <button className="btn btn-ghost btn-sm" onClick={gerarSenha} style={{whiteSpace:'nowrap'}}>Gerar</button>
              {form.senha && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={copiarSenha} title="Copiar senha">
                  {copiado ? <Check size={14} color="var(--green)"/> : <Copy size={14}/>}
                </button>
              )}
            </div>
            <p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Anote a senha — o usuário precisará dela para o primeiro acesso.</p>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}
            disabled={saving||!form.nome.trim()||!form.email.trim()||!form.senha.trim()}>
            {saving?'Criando...':'Criar usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { usuario: eu } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [busca, setBusca]       = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [toast, showToast]      = useToast()

  useEffect(()=>{ getUsuarios().then(setUsuarios).finally(()=>setLoading(false)) },[])

  async function handleCriar(form) {
    try {
      await createUsuarioAdmin({ nome:form.nome, email:form.email, perfil:form.perfil, password:form.senha })
      const lista = await getUsuarios()
      setUsuarios(lista)
      setModal(false)
      showToast('Usuário criado com sucesso!')
    } catch(e) {
      showToast(e.message||'Erro ao criar usuário','error')
    }
  }

  const [editandoPerfil, setEditandoPerfil] = useState(null) // user id being edited

  async function handleChangePerfil(userId, novoPerfil) {
    try {
      const upd = await updateUsuario(userId, { perfil: novoPerfil })
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, perfil: upd.perfil } : u))
      setEditandoPerfil(null)
      showToast('Perfil atualizado!')
    } catch(e) { showToast('Erro ao atualizar', 'error') }
  }

  const filtrados = usuarios.filter(u=>{
    if (filtroPerfil && u.perfil !== filtroPerfil) return false
    if (busca && !(u.nome||'').toLowerCase().includes(busca.toLowerCase()) &&
        !(u.email||'').toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  // Agrupa por grupo de perfil para exibição
  const grupos = [...new Set(PERFIS.map(p=>p.grupo))]

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Usuários</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{usuarios.length} cadastrado{usuarios.length!==1?'s':''}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={14}/> Novo usuário</button>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
        <input className="search-input" style={{flex:'1 1 200px'}} placeholder="Buscar por nome ou e-mail..."
          value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
          value={filtroPerfil} onChange={e=>setFiltroPerfil(e.target.value)}>
          <option value="">Todos os perfis</option>
          {grupos.map(g=>(
            <optgroup key={g} label={g}>
              {PERFIS.filter(p=>p.grupo===g).map(p=>(
                <option key={p.v} value={p.v}>{p.l}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : filtrados.length === 0
          ? <div className="empty-state"><p>Nenhum usuário encontrado.</p></div>
          : <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(u=>{
                    const p = PERFIS.find(x=>x.v===u.perfil)
                    const cor = PERFIL_COR[u.perfil] || 'var(--text-muted)'
                    const isEu = u.id === eu?.id
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{
                              width:30,height:30,borderRadius:'50%',
                              background:`${cor}22`,border:`2px solid ${cor}`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:12,fontWeight:800,color:cor,flexShrink:0
                            }}>
                              {(u.nome||'?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>
                                {u.nome||'—'}
                                {isEu && <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:6}}>(você)</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{u.email||'—'}</td>
                        <td>
                          {editandoPerfil === u.id
                            ? <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <select className="form-select" style={{padding:'3px 8px',fontSize:11}}
                                  defaultValue={u.perfil}
                                  onChange={e=>handleChangePerfil(u.id, e.target.value)}
                                  autoFocus
                                  onBlur={()=>setEditandoPerfil(null)}>
                                  {grupos.map(g=>(
                                    <optgroup key={g} label={g}>
                                      {PERFIS.filter(pp=>pp.grupo===g).map(pp=>(
                                        <option key={pp.v} value={pp.v}>{pp.l}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            : <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{
                                  fontSize:11,fontWeight:700,
                                  background:`${cor}18`,
                                  border:`1px solid ${cor}40`,
                                  color:cor,borderRadius:20,
                                  padding:'3px 10px',display:'inline-block'
                                }}>
                                  {p?.l||u.perfil||'—'}
                                </span>
                                {!isEu && eu?.perfil==='administrador' && (
                                  <button className="btn btn-ghost btn-icon btn-sm"
                                    title="Alterar perfil"
                                    onClick={()=>setEditandoPerfil(u.id)}
                                    style={{opacity:0.5}}
                                    onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                                    onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}>
                                    <Pencil size={11}/>
                                  </button>
                                )}
                              </div>
                          }
                        </td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{p?.grupo||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
      }

      {modal && <ModalNovoUsuario onSave={handleCriar} onClose={()=>setModal(false)}/>}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
