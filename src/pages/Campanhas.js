import { useEffect, useState } from 'react'
import {
  getCampanhas, getCampanha, createCampanha, updateCampanha, deleteCampanha,
  getParceiros, getLivros,
  addParceiroCampanha, updateParceiroCampanha, removeParceiroCampanha,
  getFollowUps, registrarContato,
  getDivulgacoesParceiro, createDivulgacaoCampanha, updateDivulgacaoCampanha, deleteDivulgacaoCampanha
} from '../lib/supabase'
import {
  Plus, Pencil, Trash2, X, ChevronLeft, BookOpen,
  Users, Link, BarChart2, Calendar, CheckCircle, Clock, AlertCircle, Phone, Bell
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── CONSTANTES ─────────────────────────────────────────────
const TIPOS_CAMPANHA = ['Lançamento', 'Relançamento', 'Promoção', 'Sazonal', 'Institucional', 'Outro']

const STATUS_CAMPANHA = [
  { value: 'planejamento', label: 'Planejada',     cls: 'badge-indigo', icon: Clock },
  { value: 'em_andamento', label: 'Em andamento',  cls: 'badge-amber',  icon: BarChart2 },
  { value: 'concluida',    label: 'Encerrada',     cls: 'badge-green',  icon: CheckCircle },
  { value: 'cancelada',    label: 'Cancelada',     cls: 'badge-red',    icon: X },
]

const STATUS_PARCEIRO = [
  { value: 'convidado',         label: 'Convidado',          cls: 'badge-indigo' },
  { value: 'confirmado',        label: 'Confirmado',         cls: 'badge-amber'  },
  { value: 'recusou',           label: 'Recusou',            cls: 'badge-red'    },
  { value: 'conteudo_aprovado', label: 'Conteúdo aprovado',  cls: 'badge-amber'  },
  { value: 'publicado',         label: 'Publicado',          cls: 'badge-green'  },
  { value: 'nao_publicou',      label: 'Não publicou',       cls: 'badge-red'    },
]

const ETAPAS = [
  { id: 'planejamento',  label: 'Planejamento' },
  { id: 'cortesia',      label: 'Envio de Cortesia' },
  { id: 'aprovacao',     label: 'Aprovação de conteúdo' },
  { id: 'monitoramento', label: 'Monitoramento' },
  { id: 'resultados',    label: 'Análise de resultados' },
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

function normalizar(str) {
  return (str||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

// ── BADGE STATUS ───────────────────────────────────────────
function StatusBadge({ value, options }) {
  const s = options.find(x => x.value === value) || options[0]
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// ── PROGRESSO PARCEIROS ────────────────────────────────────
function ProgressoParceiros({ parceiros }) {
  const total      = parceiros.length
  const publicados = parceiros.filter(p => p.status === 'publicado').length
  const confirmados = parceiros.filter(p => ['confirmado','conteudo_aprovado','publicado'].includes(p.status)).length
  const recusaram  = parceiros.filter(p => p.status === 'recusou' || p.status === 'nao_publicou').length
  const pct        = total > 0 ? Math.round((publicados / total) * 100) : 0

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
        <span>{publicados} publicado{publicados!==1?'s':''} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height:4, borderRadius:99, background:'var(--surface-3)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:'var(--green)', borderRadius:99, transition:'width 0.3s' }}/>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:5, fontSize:11 }}>
        <span style={{ color:'var(--text-muted)' }}>✓ {confirmados} confirmados</span>
        {recusaram > 0 && <span style={{ color:'var(--red)' }}>✗ {recusaram} recusaram</span>}
      </div>
    </div>
  )
}

// ── MODAL CAMPANHA (criar/editar) ──────────────────────────
function ModalCampanha({ campanha, livros, parceiros, onSave, onClose }) {
  const EMPTY = { nome:'', tipo:'', status:'planejamento', data_inicio:'', data_fim:'', descricao:'', livro_ids:[], parceiro_ids:[] }
  const [form, setForm]         = useState(campanha ? {
    nome: campanha.nome, tipo: campanha.tipo||'', status: campanha.status,
    data_inicio: campanha.data_inicio||'', data_fim: campanha.data_fim||'',
    descricao: campanha.descricao||'',
    livro_ids: (campanha.campanha_livros||[]).map(cl => cl.livros?.id).filter(Boolean),
    parceiro_ids: (campanha.campanha_parceiros||[]).map(cp => cp.parceiros?.id).filter(Boolean)
  } : EMPTY)
  const [livroSearch, setLivroSearch]       = useState('')
  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, showToast]      = useToast()

  const livrosFiltrados = livros.data?.filter(l =>
    normalizar(l.titulo).includes(normalizar(livroSearch)) ||
    (l.isbn||'').includes(livroSearch)
  ) || []

  function toggleLivro(id) {
    setForm(f => ({
      ...f,
      livro_ids: f.livro_ids.includes(id) ? f.livro_ids.filter(x=>x!==id) : [...f.livro_ids, id]
    }))
  }

  function toggleParceiro(id) {
    setForm(f => ({
      ...f,
      parceiro_ids: f.parceiro_ids.includes(id) ? f.parceiro_ids.filter(x=>x!==id) : [...f.parceiro_ids, id]
    }))
  }

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch { showToast('Erro ao salvar','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:560}}>
        <div className="modal-header">
          <h2 className="modal-title">{campanha?'Editar Campanha':'Nova Campanha'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome da campanha *</label>
            <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Lançamento Coleção Inverno 2026"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                <option value="">Selecionar...</option>
                {TIPOS_CAMPANHA.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS_CAMPANHA.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
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
          <div className="form-group">
            <label className="form-label">Descrição / Objetivo</label>
            <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Descreva os objetivos e estratégia da campanha..."/>
          </div>

          {/* Livros vinculados */}
          <div className="form-group">
            <label className="form-label">
              Livros vinculados
              {form.livro_ids.length > 0 && <span style={{color:'var(--accent)',marginLeft:6}}>({form.livro_ids.length} selecionado{form.livro_ids.length>1?'s':''})</span>}
            </label>
            {form.livro_ids.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                {form.livro_ids.map(id => {
                  const l = livros.data?.find(x=>x.id===id)
                  return l ? (
                    <div key={id} style={{display:'flex',alignItems:'center',gap:6,background:'var(--accent-glow)',border:'1px solid rgba(224,96,48,0.2)',borderRadius:20,padding:'3px 10px 3px 10px',fontSize:12}}>
                      <span style={{color:'var(--accent)'}}>{l.titulo}</span>
                      <button onClick={()=>toggleLivro(id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex'}}><X size={11}/></button>
                    </div>
                  ) : null
                })}
              </div>
            )}
            <input className="form-input" placeholder="Buscar livro por título ou ISBN..." value={livroSearch} onChange={e=>setLivroSearch(e.target.value)} style={{marginBottom:6}}/>
            {livroSearch && (
              <div style={{border:'1px solid var(--border)',borderRadius:8,maxHeight:160,overflowY:'auto',background:'var(--surface-2)'}}>
                {livrosFiltrados.length===0
                  ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum livro encontrado.</div>
                  : livrosFiltrados.map(l => {
                    const sel = form.livro_ids.includes(l.id)
                    return (
                      <div key={l.id} onClick={()=>{if(!sel){toggleLivro(l.id);setLivroSearch('')}}}
                        style={{padding:'9px 14px',cursor:sel?'default':'pointer',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,opacity:sel?.5:1}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:'var(--text)'}}>{l.titulo}</div>
                          {l.autor && <div style={{fontSize:11.5,color:'var(--text-muted)'}}>{l.autor}</div>}
                        </div>
                        {sel ? <span style={{fontSize:11,color:'var(--text-muted)'}}>adicionado</span> : <Plus size={13} color="var(--accent)"/>}
                      </div>
                    )
                  })
                }
              </div>
            )}
            <p style={{fontSize:11.5,color:'var(--text-muted)',marginTop:4}}>Deixe em branco para campanha genérica (sem livro específico).</p>
          </div>

          {/* Parceiros vinculados */}
          <div className="form-group">
            <label className="form-label">
              Parceiros
              {form.parceiro_ids.length > 0 && <span style={{color:'var(--accent)',marginLeft:6}}>({form.parceiro_ids.length} selecionado{form.parceiro_ids.length>1?'s':''})</span>}
            </label>
            {form.parceiro_ids.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                {form.parceiro_ids.map(id => {
                  const p = parceiros.find(x=>x.id===id)
                  return p ? (
                    <div key={id} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:20,padding:'3px 10px',fontSize:12}}>
                      <span style={{color:'var(--indigo)'}}>{p.nome}</span>
                      <button onClick={()=>toggleParceiro(id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex'}}><X size={11}/></button>
                    </div>
                  ) : null
                })}
              </div>
            )}
            <div style={{position:'relative'}}>
              <input className="form-input" placeholder="Buscar parceiro por nome..."
                value={parceiroSearch}
                onChange={e=>{setParceiroSearch(e.target.value);setParceiroOpen(true)}}
                onFocus={()=>setParceiroOpen(true)}
                autoComplete="off"
              />
              {parceiroOpen && parceiroSearch && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:160,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                  {parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).length===0
                    ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado.</div>
                    : parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).map(p=>{
                        const sel = form.parceiro_ids.includes(p.id)
                        return (
                          <div key={p.id} onClick={()=>{if(!sel){toggleParceiro(p.id);setParceiroSearch('');setParceiroOpen(false)}}}
                            style={{padding:'9px 14px',cursor:sel?'default':'pointer',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,opacity:sel?.5:1}}
                            onMouseEnter={e=>{if(!sel)e.currentTarget.style.background='var(--surface-2)'}}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                          >
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,color:'var(--text)'}}>{p.nome}</div>
                              {p.tipo_parceria&&<div style={{fontSize:11.5,color:'var(--text-muted)'}}>{p.tipo_parceria}</div>}
                            </div>
                            {sel ? <span style={{fontSize:11,color:'var(--text-muted)'}}>adicionado</span> : <Plus size={13} color="var(--indigo)"/>}
                          </div>
                        )
                      })
                  }
                </div>
              )}
            </div>
            <p style={{fontSize:11.5,color:'var(--text-muted)',marginTop:4}}>Parceiros podem ser adicionados ou removidos depois também.</p>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>
            {saving?'Salvando...':campanha?'Salvar':'Criar campanha'}
          </button>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

// ── TIPOS DE DIVULGAÇÃO ────────────────────────────────────
const TIPOS_DIVULGACAO = [
  { value: 'stories',          label: 'Stories',               temLink: false },
  { value: 'feed',             label: 'Feed',                  temLink: true  },
  { value: 'reels',            label: 'Reels',                 temLink: true  },
  { value: 'tiktok',           label: 'TikTok',                temLink: true  },
  { value: 'youtube',          label: 'Vídeo no YouTube',      temLink: true  },
  { value: 'shorts',           label: 'Shorts',                temLink: true  },
  { value: 'twitter',          label: 'Twitter/X',             temLink: true  },
  { value: 'grupo_interno',    label: 'Grupo interno',         temLink: false },
]

// ── MODAL PARCEIRO NA CAMPANHA ─────────────────────────────
function ModalParceiro({ cp, campanha, onSave, onClose }) {
  const [form, setForm] = useState({
    status:                    cp.status || 'convidado',
    data_publicacao_combinada: cp.data_publicacao_combinada || '',
    observacoes:               cp.observacoes || '',
  })
  const [divulgacoes, setDivulgacoes]   = useState([])
  const [loadingDiv, setLoadingDiv]     = useState(true)
  const [modalDiv, setModalDiv]         = useState(null) // null | 'new' | divulgacao obj
  const [saving, setSaving]             = useState(false)
  const [toast, showToast]              = useToast()

  useEffect(() => {
    getDivulgacoesParceiro(cp.id)
      .then(setDivulgacoes)
      .finally(() => setLoadingDiv(false))
  }, [cp.id])

  async function salvarStatus() {
    setSaving(true)
    try {
      await onSave(cp.id, { status: form.status, data_publicacao_combinada: form.data_publicacao_combinada || null, observacoes: form.observacoes })
      showToast('Salvo!')
    } catch(e) { console.error(e); showToast('Erro ao salvar','error') }
    finally { setSaving(false) }
  }

  async function salvarDivulgacao(dados) {
    try {
      if (dados.id) {
        const upd = await updateDivulgacaoCampanha(dados.id, dados)
        setDivulgacoes(prev => prev.map(d => d.id === upd.id ? upd : d))
      } else {
        const nova = await createDivulgacaoCampanha({ ...dados, campanha_parceiro_id: cp.id })
        setDivulgacoes(prev => [nova, ...prev])
      }
      setModalDiv(null)
      showToast('Divulgação salva!')
    } catch(e) { console.error(e); showToast('Erro ao salvar','error') }
  }

  async function excluirDivulgacao(id) {
    if (!window.confirm('Excluir esta divulgação?')) return
    await deleteDivulgacaoCampanha(id)
    setDivulgacoes(prev => prev.filter(d => d.id !== id))
    showToast('Excluída!')
  }

  const livrosDaCampanha = (campanha?.campanha_livros || []).map(cl => cl.livros).filter(Boolean)

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:560, maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10}}>
          <h2 className="modal-title">{cp.parceiros?.nome}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Datas da campanha */}
        {(campanha?.data_inicio || campanha?.data_fim) && (
          <div style={{display:'flex',gap:16,marginBottom:16,padding:'10px 14px',background:'var(--surface-2)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
            <Calendar size={13} style={{marginTop:1,flexShrink:0}}/>
            {campanha.data_inicio && <span>Início: <strong style={{color:'var(--text)'}}>{format(new Date(campanha.data_inicio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</strong></span>}
            {campanha.data_fim    && <span>Término: <strong style={{color:'var(--text)'}}>{format(new Date(campanha.data_fim+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</strong></span>}
          </div>
        )}

        {/* Status + data combinada */}
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status do parceiro</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS_PARCEIRO.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data combinada com parceiro</label>
              <input className="form-input" type="date" value={form.data_publicacao_combinada} onChange={e=>setForm(f=>({...f,data_publicacao_combinada:e.target.value}))}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas sobre este parceiro..."/>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button className="btn btn-primary btn-sm" onClick={salvarStatus} disabled={saving}>{saving?'Salvando...':'Salvar status'}</button>
          </div>
        </div>

        {/* Divulgações */}
        <div style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Divulgações ({divulgacoes.length})</span>
            <button className="btn btn-sm btn-primary" onClick={()=>setModalDiv('new')}><Plus size={13}/> Nova divulgação</button>
          </div>

          {loadingDiv ? <div style={{padding:'12px 0',color:'var(--text-muted)',fontSize:13}}>Carregando...</div>
          : divulgacoes.length === 0
            ? <div style={{padding:'12px 14px',background:'var(--surface-2)',borderRadius:8,fontSize:13,color:'var(--text-muted)',textAlign:'center'}}>Nenhuma divulgação registrada ainda.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {divulgacoes.map(d => {
                  const tipo = TIPOS_DIVULGACAO.find(t=>t.value===d.tipo)
                  return (
                    <div key={d.id} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span className="badge badge-indigo" style={{fontSize:11}}>{tipo?.label||d.tipo}</span>
  
                            {d.livros?.titulo && <span style={{fontSize:11,color:'var(--accent)'}}>📚 {d.livros.titulo}</span>}
                          </div>
                          {d.link && <a href={d.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--accent)',display:'flex',alignItems:'center',gap:4,marginBottom:4}}><Link size={11}/>Ver publicação</a>}
                          {(d.curtidas||d.comentarios||d.visualizacoes) && (
                            <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',gap:10}}>
                              {d.curtidas      != null && <span>❤️ {d.curtidas.toLocaleString('pt-BR')}</span>}
                              {d.comentarios   != null && <span>💬 {d.comentarios.toLocaleString('pt-BR')}</span>}
                              {d.visualizacoes != null && <span>👁 {d.visualizacoes.toLocaleString('pt-BR')}</span>}
                            </div>
                          )}
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>setModalDiv(d)}><Pencil size={12}/></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={()=>excluirDivulgacao(d.id)}><Trash2 size={12}/></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>

      {/* Modal de nova/editar divulgação */}
      {modalDiv && (
        <ModalDivulgacao
          divulgacao={modalDiv === 'new' ? null : modalDiv}
          livros={livrosDaCampanha}
          onSave={salvarDivulgacao}
          onClose={()=>setModalDiv(null)}
        />
      )}
    </div>
  )
}

// ── MODAL DIVULGAÇÃO ───────────────────────────────────────
function ModalDivulgacao({ divulgacao, livros, onSave, onClose }) {
  const EMPTY = { tipo:'', link:'', curtidas:'', comentarios:'', visualizacoes:'', livro_id:'' }
  const [form, setForm] = useState(divulgacao ? {
    id: divulgacao.id,
    tipo: divulgacao.tipo||'',
    link: divulgacao.link||'',
    curtidas: divulgacao.curtidas??'',
    comentarios: divulgacao.comentarios??'',
    visualizacoes: divulgacao.visualizacoes??'',
    livro_id: divulgacao.livro_id||'',
  } : EMPTY)
  const [saving, setSaving] = useState(false)

  const tipoSel = TIPOS_DIVULGACAO.find(t => t.value === form.tipo)
  const temLink = tipoSel?.temLink || false

  async function save() {
    if (!form.tipo) return
    setSaving(true)
    try {
      const payload = {
        tipo: form.tipo,
        livro_id:     form.livro_id || null,
        link:         temLink ? (form.link||null) : null,
        curtidas:     temLink && form.curtidas     !== '' ? Number(form.curtidas)     : null,
        comentarios:  temLink && form.comentarios  !== '' ? Number(form.comentarios)  : null,
        visualizacoes:temLink && form.visualizacoes!== '' ? Number(form.visualizacoes): null,
      }
      if (form.id) payload.id = form.id
      await onSave(payload)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header">
          <h2 className="modal-title">{divulgacao ? 'Editar divulgação' : 'Nova divulgação'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Tipo de divulgação *</label>
            <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value,link:'',curtidas:'',comentarios:'',visualizacoes:''}))}>
              <option value="">Selecionar...</option>
              {TIPOS_DIVULGACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>



          {livros.length > 0 && (
            <div className="form-group">
              <label className="form-label">Livro divulgado <span style={{color:'var(--text-muted)',fontWeight:400}}>(opcional)</span></label>
              <select className="form-select" value={form.livro_id} onChange={e=>setForm(f=>({...f,livro_id:e.target.value}))}>
                <option value="">Campanha como um todo</option>
                {livros.map(l=><option key={l.id} value={l.id}>{l.titulo}</option>)}
              </select>
            </div>
          )}

          {temLink && (
            <div className="form-group">
              <label className="form-label">Link da publicação</label>
              <input className="form-input" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://..."/>
            </div>
          )}

          {temLink && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Curtidas</label>
                <input className="form-input" type="number" value={form.curtidas} onChange={e=>setForm(f=>({...f,curtidas:e.target.value}))} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Comentários</label>
                <input className="form-input" type="number" value={form.comentarios} onChange={e=>setForm(f=>({...f,comentarios:e.target.value}))} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Visualizações</label>
                <input className="form-input" type="number" value={form.visualizacoes} onChange={e=>setForm(f=>({...f,visualizacoes:e.target.value}))} placeholder="0"/>
              </div>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.tipo}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── DETALHE DA CAMPANHA ─────────────────────────────────────
function DetalheCampanha({ campanhaId, onBack, livros, parceiros }) {
  const [campanha, setCampanha]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [modalParceiro, setModalParceiro] = useState(null)
  const [modalEdicao, setModalEdicao]   = useState(false)
  const [addParceiroSearch, setAddParceiroSearch] = useState('')
  const [addParceiroOpen, setAddParceiroOpen]     = useState(false)
  const [toast, showToast]              = useToast()

  async function reload() {
    const c = await getCampanha(campanhaId)
    setCampanha(c)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [campanhaId])

  async function handleUpdateCampanha(form) {
    await updateCampanha(campanhaId, form)
    await reload()
    showToast('Campanha atualizada!')
  }

  async function handleAddParceiro(parceiro) {
    // Evita duplicata
    if ((campanha.campanha_parceiros||[]).find(cp=>cp.parceiros?.id===parceiro.id)) {
      showToast('Parceiro já está na campanha','error'); return
    }
    await addParceiroCampanha(campanhaId, parceiro.id)
    await reload()
    setAddParceiroSearch('')
    setAddParceiroOpen(false)
    showToast('Parceiro adicionado!')
  }

  async function handleUpdateParceiro(id, updates) {
    await updateParceiroCampanha(id, updates)
    await reload()
    showToast('Atualizado!')
  }

  async function handleRemoveParceiro(id) {
    if (!window.confirm('Remover este parceiro da campanha?')) return
    await removeParceiroCampanha(id)
    await reload()
    showToast('Removido!')
  }

  if (loading) return <div className="loading"><div className="spinner"/></div>
  if (!campanha) return null

  const sc = STATUS_CAMPANHA.find(s=>s.value===campanha.status)||STATUS_CAMPANHA[0]
  const cps = campanha.campanha_parceiros || []
  const publicados  = cps.filter(p=>p.status==='publicado').length
  const confirmados = cps.filter(p=>['confirmado','conteudo_aprovado','publicado'].includes(p.status)).length
  const totalCurtidas    = cps.reduce((a,p)=>a+(p.curtidas||0),0)
  const totalVisualizacoes = cps.reduce((a,p)=>a+(p.visualizacoes||0),0)
  const totalVendidos    = cps.reduce((a,p)=>a+(p.livros_vendidos||0),0)

  const parceirosFiltrados = parceiros.filter(p =>
    p.nome.toLowerCase().includes(addParceiroSearch.toLowerCase())
  )

  // Etapa atual baseada nos parceiros
  // 0=Planejamento, 1=Envio Cortesia, 2=Aprovação, 3=Monitoramento, 4=Resultados
  const etapaAtual = campanha.status === 'concluida' ? 4
    : campanha.status === 'planejamento' ? 0
    : publicados > 0 ? 3
    : cps.some(p => p.status === 'conteudo_aprovado') ? 2
    : cps.some(p => ['confirmado','conteudo_aprovado','publicado'].includes(p.status)) ? 1
    : cps.length > 0 ? 1 : 0

  return (
    <>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',gap:16,marginBottom:24}}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronLeft size={18}/></button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <h1 className="page-title" style={{margin:0}}>{campanha.nome}</h1>
            <StatusBadge value={campanha.status} options={STATUS_CAMPANHA}/>
            {campanha.tipo && <span className="badge badge-indigo">{campanha.tipo}</span>}
          </div>
          {campanha.descricao && <p style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{campanha.descricao}</p>}
          <div style={{display:'flex',gap:16,marginTop:6,fontSize:12,color:'var(--text-muted)'}}>
            {campanha.data_inicio && <span><Calendar size={12} style={{marginRight:4}}/>Início: {format(new Date(campanha.data_inicio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</span>}
            {campanha.data_fim    && <span>Fim: {format(new Date(campanha.data_fim+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</span>}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={()=>setModalEdicao(true)}><Pencil size={14}/> Editar</button>
      </div>

      {/* Linha do tempo de etapas */}
      <div style={{display:'flex',gap:0,marginBottom:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
        {ETAPAS.map((etapa,i)=>{
          const ativa = i <= etapaAtual
          return (
            <div key={etapa.id} style={{flex:1,padding:'10px 14px',textAlign:'center',background:ativa?'var(--accent-glow)':'transparent',borderRight:i<ETAPAS.length-1?'1px solid var(--border)':'none',transition:'background 0.2s'}}>
              <div style={{fontSize:11,fontWeight:700,color:ativa?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{etapa.label}</div>
              <div style={{width:6,height:6,borderRadius:'50%',background:ativa?'var(--accent)':'var(--border)',margin:'6px auto 0'}}/>
            </div>
          )
        })}
      </div>

      {/* Cards de métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Parceiros',     value:cps.length,          color:'var(--text)'},
          {label:'Confirmados',   value:confirmados,          color:'var(--amber)'},
          {label:'Publicados',    value:publicados,           color:'var(--green)'},
          {label:'Curtidas',      value:totalCurtidas.toLocaleString('pt-BR'),   color:'var(--accent)'},
          {label:'Visualizações', value:totalVisualizacoes.toLocaleString('pt-BR'), color:'var(--indigo)'},
        ].map(m=>(
          <div key={m.label} className="table-card" style={{padding:'14px 16px',textAlign:'center'}}>
            <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:4}}>{m.label}</p>
            <p style={{fontSize:26,fontWeight:800,color:m.color}}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
        {/* Parceiros */}
        <div className="table-card">
          <div className="table-toolbar">
            <span className="table-title">Parceiros ({cps.length})</span>
            <div style={{position:'relative'}}>
              <input
                className="search-input"
                placeholder="Adicionar parceiro..."
                value={addParceiroSearch}
                onChange={e=>{setAddParceiroSearch(e.target.value);setAddParceiroOpen(true)}}
                onFocus={()=>setAddParceiroOpen(true)}
                autoComplete="off"
              />
              {addParceiroOpen && addParceiroSearch && (
                <div style={{position:'absolute',top:'100%',right:0,zIndex:100,width:260,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                  {parceirosFiltrados.length===0
                    ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro.</div>
                    : parceirosFiltrados.map(p=>(
                      <div key={p.id} onClick={()=>handleAddParceiro(p)}
                        style={{padding:'10px 14px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      >
                        <div style={{color:'var(--text)'}}>{p.nome}</div>
                        {p.tipo_parceria&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{p.tipo_parceria}</div>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {cps.length===0
            ? <div className="empty-state"><p>Nenhum parceiro adicionado ainda.</p></div>
            : <table>
                <thead><tr><th>Parceiro</th><th>Status</th><th>Publicação</th><th>Métricas</th><th></th></tr></thead>
                <tbody>
                  {cps.map(cp=>(
                    <tr key={cp.id}>
                      <td className="td-strong">{cp.parceiros?.nome||'—'}</td>
                      <td><StatusBadge value={cp.status} options={STATUS_PARCEIRO}/></td>
                      <td className="td-muted" style={{fontSize:12}}>
                        {cp.data_publicacao_combinada
                          ? format(new Date(cp.data_publicacao_combinada+'T12:00:00'),'dd MMM',{locale:ptBR})
                          : '—'}
                        {cp.link_publicacao && (
                          <a href={cp.link_publicacao} target="_blank" rel="noreferrer" style={{marginLeft:6,color:'var(--accent)'}}>
                            <Link size={11}/>
                          </a>
                        )}
                      </td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>
                        {cp.curtidas||cp.visualizacoes||cp.livros_vendidos ? (
                          <span>{cp.curtidas??'—'} ❤️ · {cp.visualizacoes??'—'} 👁 · {cp.livros_vendidos??'—'} 📚</span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>setModalParceiro(cp)}><Pencil size={13}/></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleRemoveParceiro(cp.id)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Livros + resumo */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="table-card" style={{padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:12}}>Livros da campanha</div>
            {(campanha.campanha_livros||[]).length===0
              ? <p style={{fontSize:13,color:'var(--text-muted)'}}>Campanha genérica (sem livros vinculados)</p>
              : (campanha.campanha_livros||[]).map(cl=>(
                <div key={cl.id} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:10}}>
                  <BookOpen size={13} color="var(--accent)" style={{marginTop:2,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{cl.livros?.titulo}</div>
                    {cl.livros?.autor&&<div style={{fontSize:11.5,color:'var(--text-muted)'}}>{cl.livros.autor}</div>}
                  </div>
                </div>
              ))
            }
          </div>

          <div className="table-card" style={{padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:12}}>Progresso</div>
            <ProgressoParceiros parceiros={cps}/>
            {totalVendidos > 0 && (
              <div style={{marginTop:12,padding:'10px 12px',background:'var(--accent-glow)',borderRadius:8,textAlign:'center'}}>
                <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase'}}>Livros vendidos</div>
                <div style={{fontSize:28,fontWeight:800,color:'var(--accent)'}}>{totalVendidos}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalEdicao && (
        <ModalCampanha campanha={campanha} livros={livros} parceiros={parceiros} onSave={handleUpdateCampanha} onClose={()=>setModalEdicao(false)}/>
      )}
      {modalParceiro && (
        <ModalParceiro cp={modalParceiro} campanha={campanha} onSave={handleUpdateParceiro} onClose={()=>setModalParceiro(null)}/>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── FOLLOW-UP TAB ─────────────────────────────────────────
function FollowUpTab() {
  const [dados, setDados]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // { cp, campanha }
  const [formContato, setFormContato] = useState({ data_contato:'', nota_contato:'' })
  const [saving, setSaving]     = useState(false)
  const [filtro, setFiltro]     = useState('pendentes') // 'pendentes' | 'todos'
  const [toast, showToast]      = useToast()

  async function reload() {
    const result = await getFollowUps()
    setDados(result)
  }

  useEffect(() => { reload().finally(()=>setLoading(false)) }, [])

  function abrirModal(cp, campanha) {
    setFormContato({ data_contato: new Date().toISOString().slice(0,10), nota_contato: cp.nota_contato||'' })
    setModal({ cp, campanha })
  }

  async function salvarContato() {
    setSaving(true)
    try {
      await registrarContato(modal.cp.id, formContato)
      await reload()
      showToast('Contato registrado!')
      setModal(null)
    } catch { showToast('Erro ao salvar','error') }
    finally { setSaving(false) }
  }

  const hoje = new Date()

  // Monta lista de lembretes: 1 item por parceiro de cada campanha
  const lembretes = dados.flatMap(campanha => {
    const diasParaInicio = campanha.data_inicio
      ? differenceInDays(new Date(campanha.data_inicio + 'T12:00:00'), hoje)
      : null
    const noJanela = diasParaInicio !== null && diasParaInicio <= 15
    return (campanha.campanha_parceiros||[]).map(cp => ({
      cp,
      campanha,
      diasParaInicio,
      noJanela,
      urgente: diasParaInicio !== null && diasParaInicio <= 3 && diasParaInicio >= 0,
      atrasado: diasParaInicio !== null && diasParaInicio < 0,
    }))
  })

  const filtrados = lembretes.filter(l => {
    if (filtro === 'pendentes') return !l.cp.contato_realizado && l.noJanela
    return true
  })

  const totalPendentes = lembretes.filter(l => !l.cp.contato_realizado && l.noJanela).length

  if (loading) return <div className="loading"><div className="spinner"/></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-up</h1>
          <p className="page-subtitle">Lembretes de contato com parceiros das campanhas</p>
        </div>
        {totalPendentes > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(245,101,101,0.1)',border:'1px solid rgba(245,101,101,0.25)',borderRadius:8,padding:'8px 14px'}}>
            <Bell size={15} color="var(--red)"/>
            <span style={{fontSize:13,fontWeight:600,color:'var(--red)'}}>{totalPendentes} contato{totalPendentes!==1?'s':''} pendente{totalPendentes!==1?'s':''}</span>
          </div>
        )}
      </div>

      {/* Filtro */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button className={`btn btn-sm ${filtro==='pendentes'?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltro('pendentes')}>
          Pendentes {totalPendentes>0&&<span style={{marginLeft:4,background:'var(--red)',color:'#fff',borderRadius:99,padding:'1px 6px',fontSize:10}}>{totalPendentes}</span>}
        </button>
        <button className={`btn btn-sm ${filtro==='todos'?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltro('todos')}>Todos os contatos</button>
      </div>

      {filtrados.length === 0 ? (
        <div className="empty-state" style={{marginTop:40}}>
          <Phone size={32} strokeWidth={1} color="var(--text-muted)"/>
          <p>{filtro==='pendentes' ? 'Nenhum contato pendente no momento! 🎉' : 'Nenhuma campanha com parceiros cadastrados.'}</p>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Campanha</th>
                <th>Início da campanha</th>
                <th>Situação</th>
                <th>Último contato</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(({ cp, campanha, diasParaInicio, urgente, atrasado }) => {
                const jaContatado = cp.contato_realizado
                let situacaoCls = 'badge-indigo'
                let situacaoLabel = `Em ${diasParaInicio} dias`
                if (jaContatado)       { situacaoCls = 'badge-green';  situacaoLabel = 'Contatado' }
                else if (atrasado)     { situacaoCls = 'badge-red';    situacaoLabel = `Campanha iniciada` }
                else if (urgente)      { situacaoCls = 'badge-red';    situacaoLabel = diasParaInicio===0?'Hoje!':diasParaInicio===1?'Amanhã!':`${diasParaInicio} dias ⚠` }
                else if (diasParaInicio <= 7) { situacaoCls = 'badge-amber'; situacaoLabel = `${diasParaInicio} dias` }

                return (
                  <tr key={`${campanha.id}-${cp.id}`} style={{opacity: jaContatado ? 0.65 : 1}}>
                    <td className="td-strong">{cp.parceiros?.nome||'—'}</td>
                    <td>
                      <div style={{fontSize:13,color:'var(--text)'}}>{campanha.nome}</div>
                      {campanha.tipo&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{campanha.tipo}</div>}
                    </td>
                    <td className="td-muted">
                      {campanha.data_inicio
                        ? format(new Date(campanha.data_inicio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})
                        : '—'}
                    </td>
                    <td><span className={`badge ${situacaoCls}`}>{situacaoLabel}</span></td>
                    <td className="td-muted" style={{fontSize:12}}>
                      {cp.data_contato
                        ? format(new Date(cp.data_contato+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})
                        : '—'}
                      {cp.nota_contato && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cp.nota_contato}</div>}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{color: jaContatado ? 'var(--text-muted)' : 'var(--green)', fontWeight:600, whiteSpace:'nowrap'}}
                        onClick={()=>abrirModal(cp, campanha)}
                      >
                        <Phone size={12}/> {jaContatado ? 'Atualizar' : 'Registrar contato'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Contato</h2>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(null)}><X size={16}/></button>
            </div>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{modal.cp.parceiros?.nome}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Campanha: {modal.campanha.nome}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Data do contato</label>
              <input className="form-input" type="date" value={formContato.data_contato} onChange={e=>setFormContato(f=>({...f,data_contato:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" value={formContato.nota_contato} onChange={e=>setFormContato(f=>({...f,nota_contato:e.target.value}))} placeholder="Como foi o contato? Algum combinado?"/>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarContato} disabled={saving||!formContato.data_contato}>
                {saving?'Salvando...':'✓ Confirmar contato'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── LISTA DE CAMPANHAS ─────────────────────────────────────
export default function Campanhas() {
  const [tab, setTab]               = useState('campanhas')
  const [campanhas, setCampanhas]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [detalhe, setDetalhe]       = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [search, setSearch]         = useState('')
  const [livros, setLivros]         = useState({ data: [] })
  const [parceiros, setParceiros]   = useState([])
  const [toast, showToast]          = useToast()

  async function reload() {
    const [cs, ps, ls] = await Promise.all([
      getCampanhas(),
      getParceiros(),
      getLivros({ page:0, pageSize:5000 }),
    ])
    setCampanhas(cs)
    setParceiros(ps)
    setLivros(ls)
  }

  useEffect(() => { reload().finally(()=>setLoading(false)) }, [])

  async function handleCreate(form) {
    const { parceiro_ids = [], ...rest } = form
    const campanha = await createCampanha(rest)
    // Adiciona parceiros se selecionados no modal
    for (const pid of parceiro_ids) {
      await addParceiroCampanha(campanha.id, pid)
    }
    await reload()
    showToast('Campanha criada!')
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta campanha?')) return
    await deleteCampanha(id)
    setCampanhas(prev=>prev.filter(c=>c.id!==id))
    showToast('Excluída!')
  }

  const filtradas = campanhas
    .filter(c => filtroStatus==='todos' || c.status===filtroStatus)
    .filter(c => {
      const q = search.toLowerCase()
      return c.nome.toLowerCase().includes(q) ||
        (c.tipo||'').toLowerCase().includes(q) ||
        (c.campanha_livros||[]).some(cl=>(cl.livros?.titulo||'').toLowerCase().includes(q))
    })

  if (detalhe) return (
    <DetalheCampanha
      campanhaId={detalhe}
      onBack={()=>setDetalhe(null)}
      livros={livros}
      parceiros={parceiros}
    />
  )

  return (
    <>
      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'1px solid var(--border)',paddingBottom:0}}>
        {[{id:'campanhas',label:'Campanhas',icon:BarChart2},{id:'followup',label:'Follow-up',icon:Phone}].map(t=>(
          <button key={t.id}
            className={`tab-btn ${tab===t.id?'active':''}`}
            onClick={()=>setTab(t.id)}
            style={{display:'flex',alignItems:'center',gap:7}}
          >
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {tab==='followup' && <FollowUpTab/>}
      {tab==='campanhas' && <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-subtitle">{campanhas.length} campanha{campanhas.length!==1?'s':''} · {campanhas.filter(c=>c.status==='em_andamento').length} em andamento</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={16}/> Nova Campanha</button>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6}}>
          <button className={`btn btn-sm ${filtroStatus==='todos'?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltroStatus('todos')}>Todas</button>
          {STATUS_CAMPANHA.map(s=>(
            <button key={s.value} className={`btn btn-sm ${filtroStatus===s.value?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltroStatus(s.value)}>{s.label}</button>
          ))}
        </div>
        <input className="search-input" style={{marginLeft:'auto'}} placeholder="Buscar campanha..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : filtradas.length === 0
          ? <div className="empty-state" style={{marginTop:40}}><p>Nenhuma campanha encontrada.</p></div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
              {filtradas.map(c => {
                const sc = STATUS_CAMPANHA.find(s=>s.value===c.status)||STATUS_CAMPANHA[0]
                const cps = c.campanha_parceiros||[]
                const hoje = new Date().toISOString().slice(0,10)
                const urgente = c.data_fim && c.data_fim <= hoje && c.status === 'em_andamento'
                return (
                  <div key={c.id} className="table-card" style={{padding:'18px 20px',cursor:'pointer',border:urgente?'1px solid rgba(245,101,101,0.3)':'1px solid var(--border)',transition:'border-color 0.2s'}}
                    onClick={()=>setDetalhe(c.id)}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <span className={`badge ${sc.cls}`}>{sc.label}</span>
                          {c.tipo && <span className="badge badge-indigo">{c.tipo}</span>}
                          {urgente && <span className="badge badge-red">⚠ Vencida</span>}
                        </div>
                      </div>
                      <button className="btn btn-danger btn-icon btn-sm" style={{marginLeft:8,flexShrink:0}} onClick={e=>{e.stopPropagation();handleDelete(c.id)}}><Trash2 size={13}/></button>
                    </div>

                    {/* Livros */}
                    {(c.campanha_livros||[]).length > 0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
                        {(c.campanha_livros||[]).slice(0,2).map(cl=>(
                          <div key={cl.id} style={{fontSize:11,background:'var(--surface-3)',color:'var(--text-muted)',borderRadius:4,padding:'2px 7px',display:'flex',alignItems:'center',gap:4}}>
                            <BookOpen size={10}/>{cl.livros?.titulo}
                          </div>
                        ))}
                        {(c.campanha_livros||[]).length > 2 && <div style={{fontSize:11,color:'var(--text-muted)'}}>+{(c.campanha_livros||[]).length-2} livros</div>}
                      </div>
                    )}

                    {/* Datas */}
                    {(c.data_inicio||c.data_fim) && (
                      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,display:'flex',gap:10}}>
                        {c.data_inicio&&<span>📅 {format(new Date(c.data_inicio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</span>}
                        {c.data_fim&&<span>→ {format(new Date(c.data_fim+'T12:00:00'),'dd MMM yyyy',{locale:ptBR})}</span>}
                      </div>
                    )}

                    {/* Progresso */}
                    {cps.length > 0 && <ProgressoParceiros parceiros={cps}/>}
                    {cps.length === 0 && <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhum parceiro ainda</p>}
                  </div>
                )
              })}
            </div>
      }

      </>}
      {modal && <ModalCampanha livros={livros} parceiros={parceiros} onSave={handleCreate} onClose={()=>setModal(false)}/>}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
