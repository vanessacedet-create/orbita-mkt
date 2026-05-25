import { useEffect, useState, useRef } from 'react'
import { useViewAs } from '../context/ViewAsContext'
import { useAuth } from '../context/AuthContext'
import { canAccessGroup } from '../context/AuthContext'   // ← Adicionado
import { PERFIL_GRUPO } from '../context/AuthContext'
import {
  getCampanhas, getCampanha, createCampanha, updateCampanha, deleteCampanha, reordenarCampanhas,
  getParceiros, getParceirosAtivos, getLivros, getUsuarios,
  addParceiroCampanha, updateParceiroCampanha, removeParceiroCampanha,
  getDivulgacoesParceiro, createDivulgacaoCampanha, updateDivulgacaoCampanha, deleteDivulgacaoCampanha,
  importarDivulgacoesPromocao,
  getLivrosDestaqueParceiro, addLivroDestaqueParceiro, removeLivroDestaqueParceiro, importarLivrosDestaquePlanilha,
  getDivulgacoesLibraria, createDivulgacaoLibraria, updateDivulgacaoLibraria, deleteDivulgacaoLibraria,
  getLancamentoLivros, addLancamentoLivro, removeLancamentoLivro,
  addLancamentoParceiro, updateLancamentoParceiro, removeLancamentoParceiro, getLancamentoParceiro,
  addLivroCampanha, removeLivroCampanha
} from '../lib/supabase'
import {
  Plus, Pencil, Trash2, X, ChevronLeft, BookOpen, Upload,
  Users, Link, BarChart2, Calendar, CheckCircle, Clock, AlertCircle, Bell
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

// Helper: formata data com segurança — evita RangeError se a data for inválida
function fmtDate(dateStr, fmt, opts) {
  if (!dateStr || String(dateStr).trim() === '') return '—'
  try {
    const s = String(dateStr).trim()
    const d = new Date(s.length === 10 ? s + 'T12:00:00' : s)
    if (isNaN(d.getTime())) return '—'
    return format(d, fmt, opts)
  } catch { return '—' }
}

import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── CONSTANTES ─────────────────────────────────────────────
const TIPOS_CAMPANHA = ['Lançamento', 'Geral', 'Promoção', 'Book Time']

const STATUS_CAMPANHA = [
  { value: 'planejamento', label: 'Planejada',     cls: 'badge-indigo', icon: Clock },
  { value: 'em_andamento', label: 'Em andamento',  cls: 'badge-amber',  icon: BarChart2 },
  { value: 'concluida',    label: 'Concluída',     cls: 'badge-green',  icon: CheckCircle },
  { value: 'cancelada',    label: 'Cancelada',     cls: 'badge-red',    icon: X },
]

const STATUS_PARCEIRO = [
  { value: 'convidado',         label: 'Convidado',          cls: 'badge-indigo' },
  { value: 'confirmado',        label: 'Confirmado',         cls: 'badge-amber'  },
  { value: 'agendado',          label: 'Agendado',           cls: 'badge-cyan'   },
  { value: 'recusou',           label: 'Recusou',            cls: 'badge-red'    },
  { value: 'publicado',         label: 'Publicado',          cls: 'badge-green'  },
  { value: 'nao_publicou',      label: 'Não publicou',       cls: 'badge-red'    },
  { value: 'sem_retorno',       label: 'Sem retorno',        cls: 'badge-gray'   },
]

const ETAPAS = [
  { id: 'planejamento', label: 'Planejada' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida',    label: 'Concluída' },
  { id: 'cancelada',    label: 'Cancelada' },
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
  const confirmados = parceiros.filter(p => ['confirmado','publicado'].includes(p.status)).length
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
  const { perfilAtivo: _pa } = useViewAs()
  const _g = PERFIL_GRUPO[_pa] || null
  const gruposLivros = _g ? [_g] : null

  const EMPTY = {
    nome: '',
    tipo: '',
    status: 'planejamento',
    data_inicio: '',
    data_fim: '',
    descricao: '',
    livro_ids: [],
    parceiro_ids: [],
    adicionar_lancamentos_auto: false
  }

  const livrosCadastrados = Array.isArray(livros?.data) ? livros.data : Array.isArray(livros) ? livros : []
  const parceirosCadastrados = Array.isArray(parceiros) ? parceiros : []

  const [form, setForm] = useState(campanha ? {
    nome: campanha.nome || '',
    tipo: campanha.tipo || '',
    status: campanha.status || 'planejamento',
    data_inicio: campanha.data_inicio || '',
    data_fim: campanha.data_fim || '',
    descricao: campanha.descricao || '',
    livro_ids: (campanha.campanha_livros || []).map(cl => cl.livros?.id || cl.livro_id).filter(Boolean),
    parceiro_ids: (campanha.campanha_parceiros || []).map(cp => cp.parceiros?.id || cp.parceiro_id).filter(Boolean),
    adicionar_lancamentos_auto: false,
    _livroCache: Object.fromEntries(
      (campanha.campanha_livros || [])
        .map(cl => cl.livros)
        .filter(Boolean)
        .map(l => [l.id, l])
    )
  } : EMPTY)

  const [livroSearch, setLivroSearch] = useState('')
  const [livroResults, setLivroResults] = useState([])
  const [livroOpen, setLivroOpen] = useState(false)
  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (!livroSearch || livroSearch.length < 2) {
      setLivroResults([])
      setLivroOpen(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        const { data } = await getLivros({
          page: 0,
          pageSize: 50,
          search: livroSearch,
          grupos: gruposLivros
        })
        setLivroResults(data || [])
        setLivroOpen(true)
      } catch {
        setLivroResults([])
      }
    }, 300)

    return () => clearTimeout(t)
  }, [livroSearch, _pa])

  function toggleLivro(id) {
    const livroObj =
      livroResults.find(x => x.id === id) ||
      livrosCadastrados.find(x => x.id === id)

    setForm(f => ({
      ...f,
      livro_ids: f.livro_ids.includes(id)
        ? f.livro_ids.filter(x => x !== id)
        : [...f.livro_ids, id],
      _livroCache: {
        ...(f._livroCache || {}),
        ...(livroObj ? { [id]: livroObj } : {})
      }
    }))
  }

  function toggleParceiro(id) {
    setForm(f => ({
      ...f,
      parceiro_ids: f.parceiro_ids.includes(id)
        ? f.parceiro_ids.filter(x => x !== id)
        : [...f.parceiro_ids, id]
    }))
  }

  function getLivroSelecionado(id) {
    return (
      form._livroCache?.[id] ||
      livrosCadastrados.find(l => l.id === id) ||
      null
    )
  }

  const parceirosFiltrados = parceirosCadastrados.filter(p =>
    normalizar(p.nome).includes(normalizar(parceiroSearch))
  )

  async function save() {
    if (!form.nome.trim()) {
      showToast('Informe o nome da campanha.', 'error')
      return
    }

    setSaving(true)
    try {
      await onSave({
        ...form,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null
      })
      onClose()
    } catch (e) {
      console.error(e)
      showToast('Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <h2 className="modal-title">{campanha ? 'Editar campanha' : 'Nova campanha'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome da campanha *</label>
            <input
              className="form-input"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Black Maio"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select
                className="form-select"
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                {TIPOS_CAMPANHA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_CAMPANHA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data de início</label>
              <input
                className="form-input"
                type="date"
                value={form.data_inicio || ''}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data de fim</label>
              <input
                className="form-input"
                type="date"
                value={form.data_fim || ''}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Observações, objetivo da campanha, orientações internas..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Livros vinculados</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                value={livroSearch}
                onChange={e => setLivroSearch(e.target.value)}
                placeholder="Buscar livro por título, ISBN ou SKU..."
                autoComplete="off"
              />

              {livroOpen && livroResults.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:250, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', maxHeight:220, overflowY:'auto' }}>
                  {livroResults.map(l => {
                    const selected = form.livro_ids.includes(l.id)
                    return (
                      <div
                        key={l.id}
                        onClick={() => toggleLivro(l.id)}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:selected ? 'var(--accent-glow)' : 'transparent' }}
                        onMouseEnter={e=>e.currentTarget.style.background=selected?'var(--accent-glow)':'var(--surface-2)'}
                        onMouseLeave={e=>e.currentTarget.style.background=selected?'var(--accent-glow)':'transparent'}
                      >
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{selected ? '✓ ' : ''}{l.titulo}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{l.autor}{l.isbn ? ` · ${l.isbn}` : ''}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {form.livro_ids.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {form.livro_ids.map(id => {
                  const livro = getLivroSelecionado(id)
                  return (
                    <span key={id} className="badge badge-indigo" style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                      {livro?.titulo || 'Livro selecionado'}
                      <button
                        type="button"
                        onClick={() => toggleLivro(id)}
                        style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', padding:0, display:'flex' }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Parceiros participantes</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                value={parceiroSearch}
                onChange={e => { setParceiroSearch(e.target.value); setParceiroOpen(true) }}
                onFocus={() => setParceiroOpen(true)}
                placeholder="Buscar parceiro..."
                autoComplete="off"
              />

              {parceiroOpen && parceiroSearch && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:250, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', maxHeight:220, overflowY:'auto' }}>
                  {parceirosFiltrados.length === 0 ? (
                    <div style={{ padding:'10px 14px', fontSize:13, color:'var(--text-muted)' }}>Nenhum parceiro encontrado.</div>
                  ) : parceirosFiltrados.map(p => {
                    const selected = form.parceiro_ids.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleParceiro(p.id)}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:selected ? 'var(--accent-glow)' : 'transparent' }}
                        onMouseEnter={e=>e.currentTarget.style.background=selected?'var(--accent-glow)':'var(--surface-2)'}
                        onMouseLeave={e=>e.currentTarget.style.background=selected?'var(--accent-glow)':'transparent'}
                      >
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{selected ? '✓ ' : ''}{p.nome}</div>
                        {p.tipo_parceria && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.tipo_parceria}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {form.parceiro_ids.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {form.parceiro_ids.map(id => {
                  const parceiro = parceirosCadastrados.find(p => p.id === id)
                  return (
                    <span key={id} className="badge badge-green" style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                      {parceiro?.nome || 'Parceiro selecionado'}
                      <button
                        type="button"
                        onClick={() => toggleParceiro(id)}
                        style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', padding:0, display:'flex' }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {!campanha && (
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-muted)', cursor:'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.adicionar_lancamentos_auto}
                onChange={e => setForm(f => ({ ...f, adicionar_lancamentos_auto: e.target.checked }))}
              />
              Adicionar lançamentos automaticamente conforme o período da campanha
            </label>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar campanha'}
          </button>
        </div>

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

// ── TIPOS DE DIVULGAÇÃO ────────────────────────────────────
const TIPOS_DIVULGACAO = [
  { value: 'stories_estatico', label: 'Stories Estático',      temLink: false },
  { value: 'stories_dinamico', label: 'Stories Dinâmico',      temLink: false },
  { value: 'feed',             label: 'Feed',                  temLink: true  },
  { value: 'reels',            label: 'Reels',                 temLink: true  },
  { value: 'tiktok',           label: 'TikTok',                temLink: true  },
  { value: 'youtube',          label: 'Vídeo no YouTube',      temLink: true  },
  { value: 'shorts',           label: 'Shorts',                temLink: true  },
  { value: 'twitter',          label: 'Twitter/X',             temLink: true  },
  { value: 'grupo_interno',    label: 'Grupo interno',         temLink: false },
  // Compatibilidade retroativa
  { value: 'stories',          label: 'Stories (legado)',      temLink: false },
]

// ── MODAL PARCEIRO NA CAMPANHA ─────────────────────────────
function ModalParceiro({ cp, campanha, onSave, onClose }) {
  const [form, setForm] = useState({
    status:      cp.status || 'convidado',
    data_inicio: cp.data_inicio || '',
    data_fim:    cp.data_fim    || '',
    observacoes: cp.observacoes || '',
  })
  const [divulgacoes, setDivulgacoes]   = useState([])
  const [loadingDiv, setLoadingDiv]     = useState(true)
  const [modalDiv, setModalDiv]         = useState(null)
  const [modalImportarDiv, setModalImportarDiv] = useState(false)
  const [livrosDestaque, setLivrosDestaque] = useState([])
  const [adicionarLivroOpen, setAdicionarLivroOpen] = useState(false)
  const [modalImportarLivros, setModalImportarLivros] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [toast, showToast]              = useToast()

  useEffect(() => {
    getDivulgacoesParceiro(cp.id)
      .then(setDivulgacoes)
      .finally(() => setLoadingDiv(false))
    getLivrosDestaqueParceiro(cp.id)
      .then(setLivrosDestaque)
      .catch(console.error)
  }, [cp.id])

  async function handleAddLivroDestaque(livro) {
    try {
      const novo = await addLivroDestaqueParceiro(cp.id, livro.id)
      setLivrosDestaque(prev => [...prev.filter(l=>l.livro_id!==livro.id), novo])
      showToast('Livro adicionado!')
    } catch(e) { showToast('Erro ao adicionar','error') }
  }

  async function handleRemoveLivroDestaque(id) {
    await removeLivroDestaqueParceiro(id)
    setLivrosDestaque(prev => prev.filter(l => l.id !== id))
    showToast('Removido!')
  }

  async function salvarStatus() {
    setSaving(true)
    try {
      await onSave(cp.id, {
        status:      form.status,
        data_inicio: form.data_inicio || null,
        data_fim:    form.data_fim    || null,
        observacoes: form.observacoes,
      })
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
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:560, maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10}}>
          <h2 className="modal-title">{cp.parceiros?.nome}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Datas da campanha */}
        {(campanha?.data_inicio || campanha?.data_fim) && (
          <div style={{display:'flex',gap:16,marginBottom:16,padding:'10px 14px',background:'var(--surface-2)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
            <Calendar size={13} style={{marginTop:1,flexShrink:0}}/>
            {campanha.data_inicio && <span>Início: <strong style={{color:'var(--text)'}}>{fmtDate(campanha.data_inicio, 'dd MMM yyyy', {locale:ptBR})}</strong></span>}
            {campanha.data_fim    && <span>Término: <strong style={{color:'var(--text)'}}>{fmtDate(campanha.data_fim, 'dd MMM yyyy', {locale:ptBR})}</strong></span>}
          </div>
        )}

        {/* Status + data combinada */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Status do parceiro</label>
            <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {STATUS_PARCEIRO.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data início (parceiro)</label>
              <input className="form-input" type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data fim (parceiro)</label>
              <input className="form-input" type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))}/>
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

        {/* Livros destaque do parceiro */}
        <div style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:16,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>
              📚 Livros destaque ({livrosDestaque.length})
            </span>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setModalImportarLivros(true)}
                style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}>
                <Upload size={11}/> Planilha ISBN
              </button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAdicionarLivroOpen(true)}
                style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}>
                <Plus size={11}/> Adicionar livro
              </button>
            </div>
          </div>
          {adicionarLivroOpen && (
            <div style={{marginBottom:10}}>
              <BuscaLivro livroId={''} livroTitulo={''}
                onChange={async livro=>{ if(!livro)return; await handleAddLivroDestaque(livro); setAdicionarLivroOpen(false) }}
                placeholder="Buscar livro por título ou ISBN..."/>
            </div>
          )}
          {livrosDestaque.length === 0
            ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhum livro destaque definido.</p>
            : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {livrosDestaque.map(ld=>(
                  <div key={ld.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 12px'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{ld.livros?.titulo}</div>
                      {ld.livros?.isbn&&<div style={{fontSize:10,color:'var(--text-muted)'}}>ISBN: {ld.livros.isbn}</div>}
                    </div>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleRemoveLivroDestaque(ld.id)}><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Divulgações */}
        <div style={{borderTop:'1px solid var(--border)',paddingTop:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Divulgações ({divulgacoes.length})</span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-sm btn-primary" onClick={()=>setModalDiv('new')}><Plus size={13}/> Nova divulgação</button>
            </div>
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
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                            <span className="badge badge-indigo" style={{fontSize:11}}>{tipo?.label||d.tipo}</span>
                            {d.origem==='organica'
                              ? <span style={{fontSize:10,background:'rgba(34,197,94,0.12)',color:'#22c55e',borderRadius:4,padding:'1px 6px',fontWeight:600}}>🌱 Orgânica</span>
                              : d.origem==='propria'
                              ? <span style={{fontSize:10,background:'rgba(245,158,11,0.12)',color:'#f59e0b',borderRadius:4,padding:'1px 6px',fontWeight:600}}>⭐ Própria</span>
                              : <span style={{fontSize:10,background:'rgba(249,115,22,0.12)',color:'var(--accent)',borderRadius:4,padding:'1px 6px',fontWeight:600}}>🤝 Combinada</span>
                            }
                            {d.data_divulgacao && <span style={{fontSize:11,color:'var(--text-muted)'}}>{fmtDate(d.data_divulgacao, 'dd/MM/yyyy', {locale:ptBR})}</span>}
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
          onSave={salvarDivulgacao}
          onClose={()=>setModalDiv(null)}
        />
      )}
      {modalImportarDiv && (
        <ModalImportarDivulgacoes
          campanhaId={campanha?.id}
          onImport={()=>getDivulgacoesParceiro(cp.id).then(setDivulgacoes)}
          onClose={()=>setModalImportarDiv(false)}
        />
      )}
      {modalImportarLivros && (
        <ModalImportarLivrosDestaque
          campanhaParceiro_id={cp.id}
          onImport={()=>getLivrosDestaqueParceiro(cp.id).then(setLivrosDestaque)}
          onClose={()=>setModalImportarLivros(false)}
        />
      )}
    </div>
  )
}

// ── MODAL IMPORTAR LIVROS DESTAQUE POR PLANILHA ────────────
function ModalImportarLivrosDestaque({ campanhaParceiro_id, onImport, onClose }) {
  const [preview, setPreview]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]; if(!file)return
    setPreview([]); setResultado(null); setLoading(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(data), {type:'array',cellDates:false})
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:'',raw:true})
      if(!rows.length)return
      function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim()}
      const headers = Object.keys(rows[0])
      const isbnCol = headers.find(h=>/isbn|ean/i.test(h)) || headers[0]
      const isbns = [...new Set(rows.map(r=>String(r[isbnCol]||'').replace(/\.0$/,'').trim()).filter(s=>s.length>=10))]
      setPreview(isbns)
    } catch(e){console.error(e)} finally{setLoading(false)}
  }

  async function salvar() {
    if(!preview.length)return
    setSaving(true)
    try {
      const res = await importarLivrosDestaquePlanilha(campanhaParceiro_id, preview)
      setResultado(res)
      if(res.erros.length===0) onImport()
    } catch(e){console.error(e)} finally{setSaving(false)}
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1300}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header">
          <h2 className="modal-title">Importar livros destaque por ISBN</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        {!resultado ? (<>
          <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--text-muted)'}}>
            Envie uma planilha <strong style={{color:'var(--text)'}}>.xlsx</strong> com uma coluna <strong style={{color:'var(--text)'}}>ISBN</strong>. Cada linha será um livro destaque para este parceiro.
          </div>
          <div style={{border:'2px dashed var(--border)',borderRadius:10,padding:'20px',textAlign:'center',cursor:'pointer',marginBottom:14}}
            onClick={()=>inputRef.current?.click()}>
            <Upload size={20} color="var(--text-muted)" style={{marginBottom:6}}/>
            <p style={{fontSize:13,color:'var(--text-soft)'}}>Clique para selecionar a planilha</p>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleFile}/>
          {loading && <p style={{fontSize:13,color:'var(--text-muted)',textAlign:'center'}}>Lendo ISBNs...</p>}
          {preview.length > 0 && !loading && (
            <div style={{marginBottom:14}}>
              <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{preview.length} ISBN{preview.length!==1?'s':''} encontrado{preview.length!==1?'s':''}:</p>
              <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',maxHeight:140,overflowY:'auto',fontSize:12}}>
                {preview.map((isbn,i)=><div key={i} style={{color:'var(--text)',marginBottom:2}}>• {isbn}</div>)}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            {preview.length > 0 && (
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                {saving?'Importando...':`Adicionar ${preview.length} livro${preview.length!==1?'s':''}`}
              </button>
            )}
          </div>
        </>) : (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:32,marginBottom:10}}>{resultado.naoEncontrados.length===0&&resultado.erros.length===0?'✅':'⚠️'}</div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:6}}>
              {resultado.adicionados} livro{resultado.adicionados!==1?'s':''} adicionado{resultado.adicionados!==1?'s':''}
            </div>
            {resultado.naoEncontrados.length>0&&(
              <div style={{marginTop:10,textAlign:'left',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--red)'}}>
                <strong style={{display:'block',marginBottom:4}}>ISBNs não encontrados no cadastro:</strong>
                {resultado.naoEncontrados.map((isbn,i)=><div key={i}>• {isbn}</div>)}
              </div>
            )}
            <button className="btn btn-primary" style={{marginTop:14}} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL DIVULGAÇÃO ───────────────────────────────────────
// ── BUSCA DE LIVRO (reutilizável) ─────────────────────────
function BuscaLivro({ livroId, livroTitulo, onChange, placeholder }) {
  const { perfilAtivo: _pa } = useViewAs()
  const _g = PERFIL_GRUPO[_pa] || null
  const gruposLivros = _g ? [_g] : null
  const [search, setSearch] = useState(livroTitulo||'')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try { const { data } = await getLivros({ page:0, pageSize:50, search, grupos: gruposLivros }); setResults(data||[]); setOpen(true) } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  function selecionar(l) { onChange(l); setSearch(l.titulo); setOpen(false) }
  function limpar() { onChange(null); setSearch(''); setResults([]) }

  return (
    <div style={{position:'relative'}}>
      <div style={{display:'flex',gap:6}}>
        <input className="form-input" value={search}
          onChange={e=>{ setSearch(e.target.value); if(!e.target.value) limpar() }}
          placeholder={placeholder||'Buscar por título, ISBN ou SKU...'} autoComplete="off"/>
        {livroId && <button className="btn btn-ghost btn-icon" onClick={limpar}><X size={14}/></button>}
      </div>
      {open && results.length > 0 && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:300,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.3)',maxHeight:200,overflowY:'auto'}}>
          {results.map(l=>(
            <div key={l.id} onClick={()=>selecionar(l)} style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--border)',fontSize:13}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{fontWeight:600,color:'var(--text)'}}>{l.titulo}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}{l.isbn?` · ${l.isbn}`:''}</div>
            </div>
          ))}
        </div>
      )}
      {livroId && <div style={{fontSize:11,color:'var(--accent)',marginTop:3}}>📚 {livroTitulo}</div>}
    </div>
  )
}

function ModalDivulgacao({ divulgacao, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const EMPTY_LIVRO = () => ({ _id: Math.random(), livro_id:'', livro_titulo:'' })

  const [origem, setOrigem] = useState(divulgacao?.origem || 'combinada')
  const [tipo, setTipo]     = useState(divulgacao?.tipo || '')
  const [data, setData]     = useState(divulgacao?.data_divulgacao || hoje)
  const [link, setLink]     = useState(divulgacao?.link || '')
  const [curtidas, setCurtidas]       = useState(divulgacao?.curtidas ?? '')
  const [comentarios, setComentarios] = useState(divulgacao?.comentarios ?? '')
  const [visualizacoes, setVisual]    = useState(divulgacao?.visualizacoes ?? '')
  // Múltiplos livros — se editando, começa com o livro atual
  const [livros, setLivros] = useState(
    divulgacao?.livro_id
      ? [{ _id: divulgacao.livro_id, livro_id: divulgacao.livro_id, livro_titulo: divulgacao.livros?.titulo||'' }]
      : [EMPTY_LIVRO()]
  )
  const [saving, setSaving] = useState(false)

  const tipoSel = TIPOS_DIVULGACAO.find(t => t.value === tipo)
  const temLink = tipoSel?.temLink || false

  function addLivro() { setLivros(p => [...p, EMPTY_LIVRO()]) }
  function removeLivro(id) { setLivros(p => p.filter(l => l._id !== id)) }
  function setLivroItem(id, livro) {
    setLivros(p => p.map(l => l._id===id ? { ...l, livro_id: livro?.id||'', livro_titulo: livro?.titulo||'' } : l))
  }

  async function save() {
    if (!tipo) return
    setSaving(true)
    try {
      const base = {
        tipo, origem, data_divulgacao: data||null,
        link: temLink?(link||null):null,
        curtidas: temLink&&curtidas!==''?Number(curtidas):null,
        comentarios: temLink&&comentarios!==''?Number(comentarios):null,
        visualizacoes: temLink&&visualizacoes!==''?Number(visualizacoes):null,
      }
      // Se editando, salva apenas o primeiro livro (comportamento original)
      if (divulgacao?.id) {
        await onSave({ ...base, id: divulgacao.id, livro_id: livros[0]?.livro_id||null })
      } else {
        // Cria uma divulgação por livro (ou uma sem livro se todos vazios)
        const livrosValidos = livros.filter(l => l.livro_id)
        if (livrosValidos.length === 0) {
          await onSave({ ...base, livro_id: null })
        } else {
          for (const l of livrosValidos) {
            await onSave({ ...base, livro_id: l.livro_id })
          }
        }
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={()=>{}}>
      <div className="modal" style={{maxWidth:480, maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header">
          <h2 className="modal-title">{divulgacao ? 'Editar divulgação' : 'Nova divulgação'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">

          {/* Origem */}
          <div className="form-group">
            <label className="form-label">Origem da divulgação</label>
            <div style={{display:'flex',gap:8}}>
              {[{v:'combinada',l:'🤝 Combinada'},{v:'organica',l:'🌱 Orgânica'},{v:'propria',l:'⭐ Própria'}].map(({v,l})=>(
                <button key={v} type="button" onClick={()=>setOrigem(v)}
                  style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:'2px solid',
                    borderColor: origem===v?'var(--accent)':'var(--border)',
                    background: origem===v?'var(--accent-glow)':'transparent',
                    color: origem===v?'var(--accent)':'var(--text-muted)',transition:'all 0.15s'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de divulgação *</label>
            <select className="form-select" value={tipo} onChange={e=>{setTipo(e.target.value);setLink('');setCurtidas('');setComentarios('');setVisual('')}}>
              <option value="">Selecionar...</option>
              {TIPOS_DIVULGACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Livros — múltiplos */}
          <div className="form-group">
            <label className="form-label">Livros divulgados <span style={{color:'var(--text-muted)',fontWeight:400}}>(opcional)</span></label>
            {livros.map((l, i) => (
              <div key={l._id} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                <div style={{flex:1}}>
                  <BuscaLivro livroId={l.livro_id} livroTitulo={l.livro_titulo}
                    onChange={livro=>setLivroItem(l._id,livro)} placeholder="Buscar livro..."/>
                </div>
                {livros.length > 1 && (
                  <button onClick={()=>removeLivro(l._id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',flexShrink:0,padding:4}}>
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            ))}
            {!divulgacao && (
              <button className="btn btn-ghost btn-sm" onClick={addLivro}
                style={{fontSize:11,marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                <Plus size={11}/> Adicionar outro livro
              </button>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Data da divulgação</label>
            <input className="form-input" type="date" value={data} onChange={e=>setData(e.target.value)}/>
          </div>

          {temLink && (
            <div className="form-group">
              <label className="form-label">Link da publicação</label>
              <input className="form-input" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..."/>
            </div>
          )}

          {temLink && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Curtidas</label>
                <input className="form-input" type="number" value={curtidas} onChange={e=>setCurtidas(e.target.value)} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Comentários</label>
                <input className="form-input" type="number" value={comentarios} onChange={e=>setComentarios(e.target.value)} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Visualizações</label>
                <input className="form-input" type="number" value={visualizacoes} onChange={e=>setVisual(e.target.value)} placeholder="0"/>
              </div>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!tipo}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL PARCEIRO DO LANÇAMENTO ──────────────────────────
// Cada divulgação é um registro separado em lancamento_parceiros
// lp        = registro "principal" (status + obs ficam aqui)
// irmãos    = outros registros com mesmo ll_id + parceiro_id
function ModalLancamentoParceiro({ lp, irmaos = [], ll_id, tipoCampanha, onSave, onClose }) {
  const EMPTY_DIV = () => ({ _tmpId: Math.random(), id: null, status: lp.status||'convidado', origem:'combinada', tipo_divulgacao:'', data_combinada:'', data_divulgacao:'', link:'', curtidas:'', comentarios:'', visualizacoes:'' })

  const toDiv = r => ({
    _tmpId: r.id || Math.random(),
    id: r.id,
    status: r.status || lp.status || 'convidado',
    origem: r.origem || 'combinada',
    tipo_divulgacao: r.tipo_divulgacao || '',
    data_combinada: r.data_combinada || '',
    data_divulgacao: r.data_divulgacao || '',
    link: r.link || '',
    curtidas: r.curtidas != null ? r.curtidas : '',
    comentarios: r.comentarios != null ? r.comentarios : '',
    visualizacoes: r.visualizacoes != null ? r.visualizacoes : '',
  })

  const [status, setStatus]           = useState(lp.status || 'convidado')
  const [dataCombinada, setDataCombinada] = useState(lp.data_combinada || lp.data_divulgacao || '')
  const [observacoes, setObservacoes] = useState(lp.observacoes || '')
  const [divs, setDivs]               = useState(() => {
    // Os irmãos são os registros de divulgação (excluir o principal que só guarda status/obs)
    // Inclui qualquer irmão que tenha tipo_divulgacao OU data_divulgacao preenchidos
    const todasDivs = irmaos.filter(r => r.tipo_divulgacao || r.data_divulgacao)
    // Se o próprio lp tem tipo_divulgacao preenchido, inclui também
    if (lp.tipo_divulgacao) todasDivs.unshift(lp)
    return todasDivs.map(toDiv)
  })
  const [saving, setSaving] = useState(false)

  function upd(tmpId, field, val) {
    setDivs(prev => prev.map(d => d._tmpId===tmpId ? {...d, [field]:val} : d))
  }
  function addDiv() { setDivs(prev => [...prev, EMPTY_DIV()]) }
  function removeDiv(tmpId) { setDivs(prev => prev.filter(d => d._tmpId !== tmpId)) }

  async function save() {
    setSaving(true)
    try {
      await onSave({
        lpId: lp.id,
        ll_id,
        parceiro_id: lp.parceiro_id,
        status,
        data_combinada: dataCombinada || null,
        observacoes,
        divs,
      })
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  const stInfo = STATUS_PARCEIRO.find(s=>s.value===status)

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={()=>{}}>
      <div className="modal" style={{maxWidth:520, maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <div>
            <h2 className="modal-title" style={{marginBottom:2}}>{lp.parceiros?.nome}</h2>
            {stInfo && <span className={`badge ${stInfo.cls}`} style={{fontSize:11}}>{stInfo.label}</span>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="form-grid" style={{padding:'16px 0 0'}}>
          {/* Status */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}>
                {STATUS_PARCEIRO.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Data combinada — só para Lançamento */}
            {tipoCampanha !== 'Geral' && (
              <div className="form-group">
                <label className="form-label" style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{color:'var(--amber)'}}>⭐</span> Data combinada
                </label>
                <input className="form-input" type="date" value={dataCombinada}
                  onChange={e=>setDataCombinada(e.target.value)}
                  style={{borderColor: dataCombinada ? 'var(--amber)' : undefined}}/>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={observacoes}
              onChange={e=>setObservacoes(e.target.value)} placeholder="Notas sobre este parceiro..."/>
          </div>
        </div>

        {/* Divulgações — uma linha completa por divulgação */}
        <div style={{borderTop:'1px solid var(--border)', marginTop:16, paddingTop:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>
              Divulgações ({divs.length})
            </span>
            <button className="btn btn-primary btn-sm" onClick={addDiv}
              style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
              <Plus size={13}/> Adicionar divulgação
            </button>
          </div>

          {divs.length === 0
            ? <p style={{fontSize:13,color:'var(--text-muted)',paddingBottom:8}}>
                Nenhuma divulgação registrada. Clique em "+ Adicionar divulgação" para começar.
              </p>
            : <div style={{overflowX:'auto'}}>
                <table style={{fontSize:12,tableLayout:'auto',width:'100%'}}>
                  <thead>
                    <tr>
                      <th style={{width:24,paddingRight:4}}>#</th>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Tipo</th>
                      <th>Data combinada</th>
                      <th>Data divulgada</th>
                      <th style={{width:32}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {divs.map((div, i) => {
                      const tipoSel = TIPOS_DIVULGACAO.find(t=>t.value===div.tipo_divulgacao)
                      const temLink = tipoSel?.temLink || false
                      const origem = div.origem || 'combinada'
                      return (
                        <tr key={div._tmpId}>
                          <td style={{color:'var(--text-muted)',fontWeight:600,fontSize:11,paddingRight:4}}>{i+1}.</td>
                          {/* Status por divulgação */}
                          <td>
                            <select className="form-select" style={{padding:'4px 6px',fontSize:11,minWidth:110}}
                              value={div.status}
                              onChange={e=>upd(div._tmpId,'status',e.target.value)}>
                              {STATUS_PARCEIRO.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                          {/* Origem */}
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              {[{v:'combinada',l:'🤝'},{v:'organica',l:'🌱'},{v:'propria',l:'⭐'}].map(({v,l})=>(
                                <button key={v} type="button" onClick={()=>upd(div._tmpId,'origem',v)}
                                  title={v==='combinada'?'Combinada':'Orgânica'}
                                  style={{width:26,height:26,borderRadius:6,fontSize:12,cursor:'pointer',border:'2px solid',
                                    borderColor:origem===v?'var(--accent)':'var(--border)',
                                    background:origem===v?'var(--accent-glow)':'transparent',
                                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {l}
                                </button>
                              ))}
                            </div>
                          </td>
                          {/* Tipo */}
                          <td>
                            <select className="form-select" style={{padding:'4px 6px',fontSize:11,minWidth:130}}
                              value={div.tipo_divulgacao}
                              onChange={e=>upd(div._tmpId,'tipo_divulgacao',e.target.value)}>
                              <option value="">Selecionar...</option>
                              {TIPOS_DIVULGACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          {/* Data combinada */}
                          <td>
                            <input className="form-input" type="date"
                              style={{padding:'4px 6px',fontSize:11,minWidth:120}}
                              value={div.data_combinada||''}
                              onChange={e=>upd(div._tmpId,'data_combinada',e.target.value)}/>
                          </td>
                          {/* Data divulgada */}
                          <td>
                            <input className="form-input" type="date"
                              style={{padding:'4px 6px',fontSize:11,minWidth:120}}
                              value={div.data_divulgacao}
                              onChange={e=>upd(div._tmpId,'data_divulgacao',e.target.value)}/>
                          </td>
                          {/* Link */}
                          <td>
                            <input className="form-input"
                              style={{padding:'4px 6px',fontSize:11,minWidth:120}}
                              value={div.link}
                              placeholder={temLink?"https://...":"—"}
                              disabled={!temLink}
                              onChange={e=>upd(div._tmpId,'link',e.target.value)}/>
                          </td>
                          {/* Remover */}
                          <td>
                            <button onClick={()=>removeDiv(div._tmpId)}
                              style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',display:'flex',padding:4}}>
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── MODAL EDIÇÃO RÁPIDA DE DIVULGAÇÃO INDIVIDUAL ──────────
function ModalEditarDivulgacao({ div, principal, onSave, onClose }) {
  const [status, setStatus]     = useState(div.status || principal.status || 'convidado')
  const [origem, setOrigem]     = useState(div.origem || 'combinada')
  const [tipo, setTipo]         = useState(div.tipo_divulgacao || '')
  const [dataComb, setDataComb] = useState(div.data_combinada || '')
  const [dataDiv, setDataDiv]   = useState(div.data_divulgacao || '')
  const [link, setLink]         = useState(div.link || '')
  const [saving, setSaving]     = useState(false)
  const tipoSel = TIPOS_DIVULGACAO.find(t=>t.value===tipo)
  const temLink = tipoSel?.temLink || false

  async function salvar() {
    setSaving(true)
    try {
      await onSave({
        status,
        origem,
        tipo_divulgacao: tipo||null,
        data_combinada: dataComb||null,
        data_divulgacao: dataDiv||null,
        link: temLink?(link||null):null,
      })
    } catch(e){console.error(e)} finally{setSaving(false)}
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1200}} onClick={()=>{}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border)'}}>
          <div>
            <h2 className="modal-title" style={{marginBottom:2}}>Editar divulgação</h2>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>{principal.parceiros?.nome}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}>
              {STATUS_PARCEIRO.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {/* Origem */}
          <div className="form-group">
            <label className="form-label">Origem</label>
            <div style={{display:'flex',gap:8}}>
              {[{v:'combinada',l:'🤝 Combinada'},{v:'organica',l:'🌱 Orgânica'},{v:'propria',l:'⭐ Própria'}].map(({v,l})=>(
                <button key={v} type="button" onClick={()=>setOrigem(v)}
                  style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                    borderColor:origem===v?'var(--accent)':'var(--border)',
                    background:origem===v?'var(--accent-glow)':'transparent',
                    color:origem===v?'var(--accent)':'var(--text-muted)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de divulgação</label>
            <select className="form-select" value={tipo} onChange={e=>setTipo(e.target.value)}>
              <option value="">Selecionar...</option>
              {TIPOS_DIVULGACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">⭐ Data combinada</label>
              <input className="form-input" type="date" value={dataComb} onChange={e=>setDataComb(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data divulgada</label>
              <input className="form-input" type="date" value={dataDiv} onChange={e=>setDataDiv(e.target.value)}/>
            </div>
          </div>
          {temLink && (
            <div className="form-group">
              <label className="form-label">Link da publicação</label>
              <input className="form-input" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..."/>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving?'Salvando...':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DETALHE LANÇAMENTO ─────────────────────────────────────
function DetalheLancamento({ campanhaId, tipoCampanha, lancamentoLivros, setLancamentoLivros, parceiros, usuarios = [], reload, showToast }) {
  const { perfilAtivo: _pa } = useViewAs()
  const _g = PERFIL_GRUPO[_pa] || null
  const gruposLivros = _g ? [_g] : null
  const [livroSearch, setLivroSearch]   = useState('')
  const [livroResults, setLivroResults] = useState([])
  const [livroOpen, setLivroOpen]       = useState(false)
  const [expandido, setExpandido]       = useState({})
  const [addParceiroSearch, setAddParceiroSearch] = useState({}) // { [ll_id]: string }
  const [addParceiroOpen, setAddParceiroOpen]     = useState({})
  const [modalParceiro, setModalParceiro]         = useState(null) // lp obj
  const [modalDivLib, setModalDivLib]             = useState(false)
  const [modalDivEdit, setModalDivEdit]           = useState(null) // {div, principal, ll_id}
  const [modalNovaDiv, setModalNovaDiv]           = useState(null) // {principal, ll_id}
  const [filtroTexto, setFiltroTexto]             = useState('')
  const [filtroResp, setFiltroResp]               = useState('')
  const [divulgacoesLib, setDivulgacoesLib]       = useState([])

  // Carrega divulgações da livraria para campanhas Geral
  useEffect(() => {
    if (tipoCampanha === 'Geral') {
      getDivulgacoesLibraria(campanhaId).then(setDivulgacoesLib).catch(console.error)
    }
  }, [campanhaId, tipoCampanha])

  // Busca de livros para adicionar
  useEffect(() => {
    if (!livroSearch || livroSearch.length < 2) { setLivroResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await getLivros({ page:0, pageSize:1000, search: livroSearch, grupos: gruposLivros })
        setLivroResults(data || [])
        setLivroOpen(true)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [livroSearch])

  async function handleAddLivro(livro) {
    if (lancamentoLivros.find(ll => ll.livro_id === livro.id)) {
      showToast('Livro já está na campanha','error'); return
    }
    try {
      const novo = await addLancamentoLivro(campanhaId, livro.id)
      // Enriquece com os dados completos do livro já disponíveis localmente
      const novoCompleto = { ...novo, livros: { ...novo.livros, ...livro }, lancamento_parceiros: [] }
      setLancamentoLivros(prev => [novoCompleto, ...prev])
      setLivroSearch('')
      setLivroResults([])
      setLivroOpen(false)
      setExpandido(prev => ({ ...prev, [novo.id]: true }))
      showToast('Livro adicionado!')
    } catch(e) { console.error(e); showToast('Erro ao adicionar','error') }
  }

  async function handleRemoveLivro(ll) {
    if (!window.confirm(`Remover "${ll.livros?.titulo}" e todos os seus parceiros?`)) return
    await removeLancamentoLivro(ll.id)
    setLancamentoLivros(prev => prev.filter(x => x.id !== ll.id))
    showToast('Livro removido!')
  }

  async function handleAddParceiro(ll_id, parceiro) {
    const ll = lancamentoLivros.find(x => x.id === ll_id)
    if (ll?.lancamento_parceiros?.find(lp => lp.parceiro_id === parceiro.id)) {
      showToast('Parceiro já vinculado a este livro','error'); return
    }
    try {
      const novo = await addLancamentoParceiro(ll_id, parceiro.id)
      setLancamentoLivros(prev => prev.map(x => x.id === ll_id
        ? { ...x, lancamento_parceiros: [novo, ...(x.lancamento_parceiros||[])] }
        : x
      ))
      setAddParceiroSearch(prev => ({ ...prev, [ll_id]: '' }))
      setAddParceiroOpen(prev => ({ ...prev, [ll_id]: false }))
      showToast('Parceiro adicionado!')
    } catch(e) { console.error(e); showToast('Erro ao adicionar','error') }
  }

  async function handleUpdateParceiro({ lpId, ll_id, parceiro_id, status, data_combinada, observacoes, divs }) {
    // 1. Atualiza o registro principal (status + obs + data_combinada)
    await updateLancamentoParceiro(lpId, {
      status,
      observacoes,
      data_combinada: data_combinada||null,
      tipo_divulgacao: null,
      data_divulgacao: null,
      origem: null,
      link: null, curtidas: null, comentarios: null, visualizacoes: null,
    })

    // 2. Irmãos atuais no estado local
    const ll = lancamentoLivros.find(x=>x.id===ll_id)
    const irmaosAtuais = (ll?.lancamento_parceiros||[])
      .filter(lp => lp.id!==lpId && lp.parceiro_id===parceiro_id)

    // 3. Remove irmãos que sumiram do form
    const idsManutidos = divs.filter(d=>d.id).map(d=>d.id)
    for (const irmao of irmaosAtuais) {
      if (!idsManutidos.includes(irmao.id)) {
        await removeLancamentoParceiro(irmao.id)
      }
    }

    // 4. Salva cada divulgação
    for (const d of divs) {
      const ts = TIPOS_DIVULGACAO.find(t=>t.value===d.tipo_divulgacao)
      const tl = ts?.temLink||false
      const payload = {
        status: d.status||status,
        tipo_divulgacao: d.tipo_divulgacao||null,
        data_combinada: d.data_combinada||null,
        data_divulgacao: d.data_divulgacao||null,
        origem: d.origem||'combinada',
        link: tl?(d.link||null):null,
        curtidas: tl&&d.curtidas!==''?Number(d.curtidas):null,
        comentarios: tl&&d.comentarios!==''?Number(d.comentarios):null,
        visualizacoes: tl&&d.visualizacoes!==''?Number(d.visualizacoes):null,
      }
      if (d.id) {
        // Registro existente — atualiza diretamente pelo id, sem depender do estado local
        await updateLancamentoParceiro(d.id, payload)
      } else {
        // Nova divulgação — cria irmão
        const novo = await addLancamentoParceiro(ll_id, parceiro_id)
        await updateLancamentoParceiro(novo.id, payload)
      }
    }

    // 5. Recarrega todos os lancamento_livros do banco para garantir consistência
    const refreshed = await getLancamentoLivros(campanhaId)
    setLancamentoLivros(refreshed)
    showToast('Atualizado!')
  }

  async function handleRemoveParceiro(ll_id, parceiro_id) {
    if (!window.confirm('Remover este parceiro e todas as suas divulgações deste livro?')) return
    const ll = lancamentoLivros.find(x=>x.id===ll_id)
    const todos = (ll?.lancamento_parceiros||[]).filter(lp => lp.parceiro_id===parceiro_id)
    for (const lp of todos) await removeLancamentoParceiro(lp.id)
    setLancamentoLivros(prev => prev.map(x => x.id===ll_id
      ? { ...x, lancamento_parceiros: (x.lancamento_parceiros||[]).filter(lp => lp.parceiro_id!==parceiro_id) }
      : x
    ))
    showToast('Removido!')
  }

  // Para contagem, agrupa por parceiro único
  const totalParceiros = lancamentoLivros.reduce((a,ll) => {
    const unicos = new Set((ll.lancamento_parceiros||[]).map(lp=>lp.parceiro_id))
    return a + unicos.size
  }, 0)
  const totalPublicados = lancamentoLivros.reduce((a,ll) => {
    const publicadoIds = new Set((ll.lancamento_parceiros||[]).filter(lp=>lp.status==='publicado').map(lp=>lp.parceiro_id))
    return a + publicadoIds.size
  }, 0)

  return (
    <div>
      {/* Busca de livro para adicionar */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>
              Livros desta campanha ({lancamentoLivros.length})
            </span>
            {tipoCampanha === 'Geral' && (
              <button className="btn btn-primary btn-sm" onClick={()=>setModalDivLib(true)}
                style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}>
                <BookOpen size={13}/> Divulgação da Livraria
              </button>
            )}
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>
            {totalParceiros} parceiro{totalParceiros!==1?'s':''} · {totalPublicados} publicado{totalPublicados!==1?'s':''}
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>
          <div style={{position:'relative',flex:'1 1 240px'}}>
            <input
              className="form-input"
              value={livroSearch}
              onChange={e=>setLivroSearch(e.target.value)}
              placeholder="🔍 Adicionar livro por título, ISBN ou SKU..."
              autoComplete="off"
            />
          {livroOpen && livroResults.length > 0 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.3)',maxHeight:220,overflowY:'auto'}}>
              {livroResults.map(l=>(
                <div key={l.id} onClick={()=>handleAddLivro(l)}
                  style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{l.titulo}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}{l.isbn?` · ISBN: ${l.isbn}`:''}</div>
                </div>
              ))}
            </div>
          )}
          </div>
          <input className="form-input" value={filtroTexto}
            onChange={e=>setFiltroTexto(e.target.value)}
            placeholder="🔎 Filtrar por livro ou parceiro..."
            style={{flex:'1 1 180px'}}/>
          <select className="form-select" style={{flex:'0 0 auto',minWidth:160,fontSize:12,padding:'6px 10px'}}
            value={filtroResp} onChange={e=>setFiltroResp(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          {(filtroTexto||filtroResp) && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{setFiltroTexto('');setFiltroResp('')}}>
              <X size={12}/> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista de livros */}
      {(() => {
        const q = filtroTexto.toLowerCase().trim()
        const livrosFiltrados = lancamentoLivros.filter(ll => {
          if (q && !(
            (ll.livros?.titulo||'').toLowerCase().includes(q) ||
            (ll.livros?.isbn||'').replace(/-/g,'').includes(q.replace(/-/g,'')) ||
            (ll.lancamento_parceiros||[]).some(lp=>(lp.parceiros?.nome||'').toLowerCase().includes(q))
          )) return false
          if (filtroResp) {
            const temResp = (ll.lancamento_parceiros||[]).some(lp =>
              lp.parceiros?.responsavel_interno_id === filtroResp
            )
            if (!temResp) return false
          }
          return true
        })
        return livrosFiltrados.length === 0
        ? <div className="empty-state"><p>{filtroTexto ? 'Nenhum resultado para o filtro.' : 'Nenhum livro adicionado ainda. Busque acima para começar.'}</p></div>
        : <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {livrosFiltrados.map(ll => {
              const lps = ll.lancamento_parceiros || []
              const aberto = expandido[ll.id] !== false
              const parceirosFiltrados = parceiros.filter(p =>
                p.nome.toLowerCase().includes((addParceiroSearch[ll.id]||'').toLowerCase())
              )
              return (
                <div key={ll.id} className="table-card">
                  {/* Header do livro */}
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',cursor:'pointer',borderBottom: aberto ? '1px solid var(--border)' : 'none'}}
                    onClick={()=>setExpandido(prev=>({...prev,[ll.id]:!aberto}))}>
                    <BookOpen size={16} color="var(--accent)" style={{flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{ll.livros?.titulo}</div>
                      {ll.livros?.autor && <div style={{fontSize:12,color:'var(--text-muted)'}}>{ll.livros.autor}{ll.livros.isbn?` · ISBN: ${ll.livros.isbn}`:''}</div>}
                      {ll.livros?.data_lancamento && (
                        <div style={{fontSize:11,color:'var(--accent)',marginTop:2,fontWeight:600}}>
                          📅 {fmtDate(ll.livros.data_lancamento, 'dd MMM yyyy', {locale:ptBR})}
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:12,color:'var(--text-muted)'}}>{lps.length} parceiro{lps.length!==1?'s':''}</span>
                      <span style={{fontSize:12,color:'var(--green)'}}>{lps.filter(lp=>lp.status==='publicado').length} publicado{lps.filter(lp=>lp.status==='publicado').length!==1?'s':''}</span>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={e=>{e.stopPropagation();handleRemoveLivro(ll)}}><Trash2 size={12}/></button>
                    </div>
                  </div>

                  {/* Parceiros do livro */}
                  {aberto && (
                    <div style={{padding:'14px 18px'}}>
                      {/* Campo adicionar parceiro */}
                      <div style={{position:'relative',marginBottom:12,maxWidth:360}}>
                        <input
                          className="form-input"
                          placeholder="Adicionar parceiro..."
                          value={addParceiroSearch[ll.id]||''}
                          onChange={e=>setAddParceiroSearch(prev=>({...prev,[ll.id]:e.target.value}))}
                          onFocus={()=>setAddParceiroOpen(prev=>({...prev,[ll.id]:true}))}
                          autoComplete="off"
                        />
                        {addParceiroOpen[ll.id] && (addParceiroSearch[ll.id]||'').length > 0 && (
                          <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:150,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:180,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                            {parceirosFiltrados.length===0
                              ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado.</div>
                              : parceirosFiltrados.map(p=>(
                                <div key={p.id} onClick={()=>handleAddParceiro(ll.id, p)}
                                  style={{padding:'10px 14px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)'}}
                                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  <div style={{color:'var(--text)'}}>{p.nome}</div>
                                  {p.tipo_parceria&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{p.tipo_parceria}</div>}
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>

                      {/* Tabela de parceiros — agrupada por parceiro */}
                      {(() => {
                        // Agrupa: um grupo por parceiro_id. O primeiro registro é o "principal" (mais antigo)
                        const grupos = []
                        const seen = {}
                        // Uma linha numerada por divulgação, com todos os campos
                        for (const lp of lps) {
                          if (!seen[lp.parceiro_id]) {
                            seen[lp.parceiro_id] = true
                            const irmaos = lps.filter(x => x.parceiro_id===lp.parceiro_id && x.id!==lp.id)
                            grupos.push({ principal: lp, irmaos })
                          }
                        }
                        if (grupos.length === 0) return <p style={{fontSize:13,color:'var(--text-muted)',paddingLeft:4}}>Nenhum parceiro vinculado ainda.</p>

                        // Monta linhas: 1 linha completa por divulgação registrada
                        // Se parceiro não tem divulgação, aparece 1 linha só com parceiro/status/responsável
                        const linhas = []
                        for (const { principal, irmaos } of grupos) {
                          const resp = principal.parceiros?.responsavel_interno_id
                            ? usuarios.find(u=>u.id===principal.parceiros.responsavel_interno_id)
                            : null
                          const divulgacoes = [principal, ...irmaos].filter(lp => lp.tipo_divulgacao)
                          if (divulgacoes.length === 0) {
                            // Sem divulgação ainda — 1 linha só com parceiro/status
                            linhas.push({ principal, irmaos, resp, div: null })
                          } else {
                            // 1 linha por divulgação, todas com parceiro/status/responsável
                            divulgacoes.forEach(div => {
                              linhas.push({ principal, irmaos, resp, div })
                            })
                          }
                        }

                        return (
                          <table>
                            <thead>
                              <tr>
                                <th style={{width:28,color:'var(--text-muted)',fontWeight:400}}>#</th>
                                <th>Parceiro</th>
                                <th>Status</th>
                                <th>Responsável</th>
                                <th>Origem</th>
                                <th>Tipo</th>
                                <th>Data combinada</th>
                                <th>Data divulgada</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {linhas.map((linha, idx) => {
                                const { principal, irmaos, resp, div } = linha
                                const t = div ? TIPOS_DIVULGACAO.find(x=>x.value===div.tipo_divulgacao) : null
                                // Mostra nome só na primeira linha do parceiro
                                const primeiraDoP = idx===0 || linhas[idx-1].principal.parceiro_id !== principal.parceiro_id
                                const ultimaDoP = idx===linhas.length-1 || linhas[idx+1].principal.parceiro_id !== principal.parceiro_id
                                return (
                                  <tr key={div ? `d-${div.id}` : `p-${principal.id}`}
                                    style={{borderTop: primeiraDoP && idx>0 ? '2px solid var(--border)' : undefined}}>
                                    <td style={{fontSize:11,color:'var(--text-muted)',fontWeight:600,paddingRight:4}}>
                                      {primeiraDoP ? idx+1 : ''}
                                    </td>
                                    <td className="td-strong">
                                      {primeiraDoP ? (principal.parceiros?.nome||'—') : <span style={{color:'var(--text-muted)',fontSize:11}}>↳</span>}
                                    </td>
                                    <td>
                                      {/* Status: para cada divulgação, usa o status do registro div se disponível */}
                                      <StatusBadge value={div?.status||principal.status} options={STATUS_PARCEIRO}/>
                                    </td>
                                    <td style={{fontSize:12}}>
                                      {resp ? <span style={{fontWeight:600,color:'var(--text)'}}>{resp.nome}</span> : <span className="td-muted">—</span>}
                                    </td>
                                    <td style={{fontSize:11}}>
                                      {div?.origem==='organica'
                                        ? <span style={{color:'#22c55e',fontWeight:600}}>🌱</span>
                                        : div?.origem
                                          ? <span style={{color:'var(--accent)',fontWeight:600}}>🤝</span>
                                          : <span className="td-muted">—</span>}
                                    </td>
                                    <td>
                                      {t
                                        ? <span className="badge badge-indigo" style={{fontSize:10}}>{t.label}</span>
                                        : <span className="td-muted">—</span>}
                                    </td>
                                    <td className="td-muted" style={{fontSize:12}}>
                                      {(div?.data_combinada||principal.data_combinada) ? fmtDate(div?.data_combinada||principal.data_combinada,'dd/MM/yy',{locale:ptBR}) : '—'}
                                    </td>
                                    <td className="td-muted" style={{fontSize:12}}>
                                      {div?.data_divulgacao ? fmtDate(div.data_divulgacao,'dd/MM/yy',{locale:ptBR}) : '—'}
                                    </td>
                                    <td>
                                      <div className="actions-cell" style={{gap:4,flexWrap:'nowrap'}}>
                                        {/* Botão + nova divulgação — aparece na última linha do parceiro */}
                                        {ultimaDoP && (
                                          <button className="btn btn-primary btn-sm" title="Nova divulgação"
                                            style={{fontSize:10,padding:'3px 7px',display:'flex',alignItems:'center',gap:2,whiteSpace:'nowrap'}}
                                            onClick={()=>setModalNovaDiv({principal, ll_id:ll.id})}>
                                            <Plus size={11}/> Div.
                                          </button>
                                        )}
                                        {/* Editar divulgação — se tem div com tipo, abre edição rápida; senão abre modal completo */}
                                        {div && div.tipo_divulgacao ? (
                                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar esta divulgação"
                                            onClick={()=>setModalDivEdit({div, principal, ll_id:ll.id})}>
                                            <Pencil size={12}/>
                                          </button>
                                        ) : (
                                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar parceiro"
                                            onClick={()=>setModalParceiro({lp: principal, irmaos, ll_id:ll.id, tipoCampanha})}>
                                            <Pencil size={12}/>
                                          </button>
                                        )}
                                        {/* Excluir divulgação OU remover parceiro */}
                                        {div
                                          ? <button className="btn btn-danger btn-icon btn-sm" title="Excluir divulgação"
                                              onClick={async()=>{
                                                if(!window.confirm('Excluir esta divulgação?'))return
                                                await removeLancamentoParceiro(div.id)
                                                const refreshed = await getLancamentoLivros(campanhaId)
                                                setLancamentoLivros(refreshed)
                                                showToast('Divulgação removida!')
                                              }}>
                                              <Trash2 size={12}/>
                                            </button>
                                          : <button className="btn btn-danger btn-icon btn-sm" title="Remover parceiro"
                                              onClick={()=>handleRemoveParceiro(ll.id, principal.parceiro_id)}>
                                              <Trash2 size={12}/>
                                            </button>
                                        }
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      })()}

      {/* ── DIVULGAÇÕES DA LIVRARIA (só Geral) ── */}
      {tipoCampanha === 'Geral' && (
        <div style={{marginTop:24}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>
              📚 Divulgações da Livraria ({divulgacoesLib.length})
            </span>
          </div>
          {divulgacoesLib.length === 0
            ? <div style={{padding:'16px',background:'var(--surface-2)',border:'1px dashed var(--border)',borderRadius:8,fontSize:13,color:'var(--text-muted)',textAlign:'center'}}>
                Nenhuma divulgação registrada. Clique em "Divulgação da Livraria" para adicionar.
              </div>
            : <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Parceiro</th>
                      <th>Origem</th>
                      <th>Tipo</th>
                      <th>Data</th>
                      <th>Link</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {divulgacoesLib.map(d => {
                      const tipo = TIPOS_DIVULGACAO.find(t=>t.value===d.tipo_divulgacao)
                      return (
                        <tr key={d.id}>
                          <td style={{fontWeight:600,fontSize:13}}>{d.parceiros?.nome||'—'}</td>
                          <td>
                            {d.origem==='organica'
                              ? <span style={{fontSize:11,color:'#22c55e',fontWeight:600}}>🌱 Orgânica</span>
                              : <span style={{fontSize:11,color:'var(--accent)',fontWeight:600}}>🤝 Combinada</span>}
                          </td>
                          <td>{tipo ? <span className="badge badge-indigo" style={{fontSize:11}}>{tipo.label}</span> : '—'}</td>
                          <td className="td-muted" style={{fontSize:12}}>{d.data_divulgacao ? fmtDate(d.data_divulgacao, 'dd/MM/yyyy', {locale:ptBR}) : '—'}</td>
                          <td>{d.link ? <a href={d.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--accent)'}}>🔗 Ver</a> : '—'}</td>
                          <td>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={async()=>{
                              if(!window.confirm('Excluir esta divulgação?'))return
                              await deleteDivulgacaoLibraria(d.id)
                              setDivulgacoesLib(prev=>prev.filter(x=>x.id!==d.id))
                            }}><Trash2 size={12}/></button>
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

      {/* Modal nova divulgação rápida */}
      {modalNovaDiv && (
        <ModalEditarDivulgacao
          div={{status: modalNovaDiv.principal.status||'convidado', origem:'combinada', tipo_divulgacao:'', data_combinada:'', data_divulgacao:'', link:''}}
          principal={modalNovaDiv.principal}
          onSave={async(updates) => {
            const novo = await addLancamentoParceiro(modalNovaDiv.ll_id, modalNovaDiv.principal.parceiro_id)
            await updateLancamentoParceiro(novo.id, updates)
            const refreshed = await getLancamentoLivros(campanhaId)
            setLancamentoLivros(refreshed)
            setModalNovaDiv(null)
            showToast('Divulgação adicionada!')
          }}
          onClose={()=>setModalNovaDiv(null)}
        />
      )}

      {/* Modal edição rápida de divulgação individual */}
      {modalDivEdit && (() => {
        const { div, principal, ll_id } = modalDivEdit
        const [editDiv, setEditDiv] = [div, () => {}] // readonly ref — usamos state no componente filho
        return (
          <ModalEditarDivulgacao
            div={div}
            principal={principal}
            onSave={async(updates) => {
              await updateLancamentoParceiro(div.id, updates)
              const refreshed = await getLancamentoLivros(campanhaId)
              setLancamentoLivros(refreshed)
              setModalDivEdit(null)
              showToast('Divulgação atualizada!')
            }}
            onClose={()=>setModalDivEdit(null)}
          />
        )
      })()}

      {modalParceiro && (
        <ModalLancamentoParceiro
          lp={modalParceiro.lp}
          irmaos={modalParceiro.irmaos}
          ll_id={modalParceiro.ll_id}
          tipoCampanha={modalParceiro.tipoCampanha}
          onSave={handleUpdateParceiro}
          onClose={()=>setModalParceiro(null)}
        />
      )}
      {modalDivLib && (
        <ModalDivulgacaoLibraria
          campanhaId={campanhaId}
          parceiros={parceiros}
          onSave={async()=>{ const d=await getDivulgacoesLibraria(campanhaId); setDivulgacoesLib(d) }}
          onClose={()=>setModalDivLib(false)}
        />
      )}
    </div>
  )
}


// ── MODAL IMPORTAR LIVROS POR ISBN ────────────────────────
function ModalImportarLivros({ campanhaId, livrosExistentes, onImport, onClose }) {
  const { perfilAtivo: _pa } = useViewAs()
  const _g = PERFIL_GRUPO[_pa] || null
  const gruposLivros = _g ? [_g] : null
  const [preview, setPreview]   = useState([])  // [{isbn, titulo, id, encontrado}]
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPreview([]); setResultado(null)
    setLoading(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Encontra coluna ISBN (aceita variações)
      const headers = rows.length ? Object.keys(rows[0]) : []
      const isbnCol = headers.find(h => /isbn|ean/i.test(h)) || headers[0]

      const isbns = [...new Set(
        rows.map(r => String(r[isbnCol]||'').replace(/\D/g,'')).filter(s => s.length >= 10)
      )]

      // Busca cada ISBN no banco
      const resultados = await Promise.all(isbns.map(async isbn => {
        try {
          const { data: livros } = await getLivros({ page:0, pageSize:5, search: isbn, grupos: gruposLivros })
          const encontrado = livros?.find(l => (l.isbn||'').replace(/\D/g,'') === isbn || (l.sku||'') === isbn)
          return { isbn, titulo: encontrado?.titulo || null, id: encontrado?.id || null, encontrado: !!encontrado }
        } catch { return { isbn, titulo: null, id: null, encontrado: false } }
      }))
      setPreview(resultados)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function salvar() {
    const para_adicionar = preview.filter(p => p.encontrado && !livrosExistentes.find(cl => cl.livros?.id === p.id))
    if (!para_adicionar.length) return
    setSaving(true)
    try {
      const novos = []
      for (const p of para_adicionar) {
        const cl = await addLivroCampanha(campanhaId, p.id)
        novos.push(cl)
      }
      setResultado({ adicionados: novos.length, naoEncontrados: preview.filter(p => !p.encontrado).length })
      onImport(novos)
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  const jaNaCampanha = (id) => livrosExistentes.some(cl => cl.livros?.id === id)
  const paraAdicionar = preview.filter(p => p.encontrado && !jaNaCampanha(p.id))

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={()=>{}}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-header">
          <h2 className="modal-title">Importar livros por ISBN</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {!resultado ? (
          <>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--text-muted)'}}>
              Envie uma planilha <strong style={{color:'var(--text)'}}>.xlsx</strong> com uma coluna <strong style={{color:'var(--text)'}}>ISBN</strong> (ou EAN). O sistema busca cada livro no cadastro e vincula à campanha.
            </div>

            <div style={{border:'2px dashed var(--border)',borderRadius:10,padding:'24px 20px',textAlign:'center',cursor:'pointer',marginBottom:16}}
              onClick={()=>inputRef.current?.click()}>
              <Upload size={22} color="var(--text-muted)" style={{marginBottom:8}}/>
              <p style={{fontSize:13,color:'var(--text-soft)'}}>Clique para selecionar a planilha</p>
              <p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>.xlsx · coluna ISBN obrigatória</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleFile}/>

            {loading && <div style={{textAlign:'center',padding:'12px 0',fontSize:13,color:'var(--text-muted)'}}>Buscando livros no cadastro...</div>}

            {preview.length > 0 && !loading && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Resultado — {preview.length} ISBN{preview.length!==1?'s':''}
                </div>
                <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
                  {preview.map((p,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--border)',fontSize:12}}>
                      <div style={{width:16,height:16,borderRadius:'50%',flexShrink:0,
                        background: jaNaCampanha(p.id) ? 'var(--amber)' : p.encontrado ? 'var(--green)' : 'var(--red)',
                        display:'flex',alignItems:'center',justifyContent:'center'}}>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {p.encontrado ? p.titulo : `ISBN ${p.isbn}`}
                        </div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>
                          {jaNaCampanha(p.id) ? '⚠ Já na campanha' : p.encontrado ? `✓ ISBN ${p.isbn}` : '✗ Não encontrado no cadastro'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {preview.filter(p=>!p.encontrado).length > 0 && (
                  <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>
                    ISBNs não encontrados precisam ser cadastrados em <strong>Cortesias → Livros</strong> primeiro.
                  </p>
                )}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              {paraAdicionar.length > 0 && (
                <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                  {saving ? 'Adicionando...' : `Adicionar ${paraAdicionar.length} livro${paraAdicionar.length!==1?'s':''}`}
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:36,marginBottom:12}}>✅</div>
            <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>Livros adicionados!</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>
              {resultado.adicionados} livro{resultado.adicionados!==1?'s':''} vinculado{resultado.adicionados!==1?'s':''} à campanha
              {resultado.naoEncontrados > 0 && ` · ${resultado.naoEncontrados} ISBN${resultado.naoEncontrados!==1?'s':''} não encontrado${resultado.naoEncontrados!==1?'s':''}`}
            </div>
            <button className="btn btn-primary" style={{marginTop:16}} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}


// ── MODAL IMPORTAR DIVULGAÇÕES POR PLANILHA (Promoção) ────
function ModalImportarDivulgacoes({ campanhaId, onImport, onClose }) {
  const [preview, setPreview]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPreview([]); setResultado(null); setLoading(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(data), { type:'array', cellDates:false })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'', raw:true })
      if (!rows.length) return

      function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
      function getCol(row, ...keys){ const h=Object.keys(row).find(k=>keys.includes(norm(k))); return h?String(row[h]).trim():'' }

      const parsed = rows.map((row,i) => ({
        parceiro_nome: getCol(row,'parceiro','nome','name'),
        isbn:          getCol(row,'isbn','ean').replace(/\.0$/,''),
        tipo:          getCol(row,'tipo','type') || '',
        origem:        getCol(row,'origem','origin') || 'combinada',
        data_divulgacao: getCol(row,'data','data divulgacao','data_divulgacao') || null,
        _linha: i+2
      })).filter(r => r.parceiro_nome || r.isbn)

      setPreview(parsed)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function salvar() {
    if (!preview.length) return
    setSaving(true)
    try {
      const res = await importarDivulgacoesPromocao(campanhaId, preview)
      setResultado(res)
      if (res.erros.length === 0) { onImport(); setTimeout(onClose, 2000) }
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-header">
          <h2 className="modal-title">Importar divulgações por planilha</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {!resultado ? (<>
          <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--text-muted)'}}>
            <strong style={{color:'var(--text)',display:'block',marginBottom:4}}>Colunas esperadas na planilha:</strong>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['Parceiro','ISBN','Tipo','Origem','Data'].map(c=>(
                <span key={c} className="badge badge-indigo" style={{fontSize:11}}>{c}</span>
              ))}
            </div>
            <div style={{marginTop:6}}>Origem: <strong>combinada</strong> ou <strong>organica</strong> (padrão: combinada)</div>
          </div>

          <div style={{border:'2px dashed var(--border)',borderRadius:10,padding:'24px 20px',textAlign:'center',cursor:'pointer',marginBottom:16}}
            onClick={()=>inputRef.current?.click()}>
            <Upload size={22} color="var(--text-muted)" style={{marginBottom:8}}/>
            <p style={{fontSize:13,color:'var(--text-soft)'}}>Clique para selecionar a planilha</p>
            <p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>.xlsx</p>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleFile}/>

          {loading && <div style={{textAlign:'center',fontSize:13,color:'var(--text-muted)',padding:'8px 0'}}>Lendo planilha...</div>}

          {preview.length > 0 && !loading && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>{preview.length} linha{preview.length!==1?'s':''} encontrada{preview.length!==1?'s':''}</div>
              <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxHeight:200,overflowY:'auto'}}>
                <table style={{fontSize:12}}>
                  <thead><tr><th>Parceiro</th><th>ISBN</th><th>Tipo</th><th>Origem</th></tr></thead>
                  <tbody>
                    {preview.slice(0,5).map((r,i)=>(
                      <tr key={i}>
                        <td>{r.parceiro_nome||'—'}</td>
                        <td>{r.isbn||'—'}</td>
                        <td>{r.tipo||'—'}</td>
                        <td>{r.origem==='organica'?'🌱 Orgânica':'🤝 Combinada'}</td>
                      </tr>
                    ))}
                    {preview.length>5&&<tr><td colSpan={4} style={{color:'var(--text-muted)',textAlign:'center'}}>...e mais {preview.length-5}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            {preview.length > 0 && (
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                {saving?'Importando...':`Importar ${preview.length} registro${preview.length!==1?'s':''}`}
              </button>
            )}
          </div>
        </>) : (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:36,marginBottom:12}}>{resultado.erros.length===0?'✅':'⚠️'}</div>
            <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>
              {resultado.erros.length===0?'Importação concluída!':'Importado com erros'}
            </div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>{resultado.criados} registro{resultado.criados!==1?'s':''} criado{resultado.criados!==1?'s':''}</div>
            {resultado.erros.length>0&&(
              <div style={{marginTop:12,textAlign:'left',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--red)',maxHeight:140,overflowY:'auto'}}>
                {resultado.erros.map((e,i)=><div key={i}>• {e}</div>)}
              </div>
            )}
            <button className="btn btn-primary" style={{marginTop:16}} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DETALHE DA CAMPANHA ─────────────────────────────────────

// ── MODAL DIVULGAÇÃO DA LIVRARIA ──────────────────────────
// Adiciona uma nova divulgação para um parceiro específico na campanha Geral
function ModalDivulgacaoLibraria({ campanhaId, parceiros, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)

  const [parceiroId, setParceiroId]     = useState('')
  const [parceiroNome, setParceiroNome] = useState('')
  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen] = useState(false)
  const [tipo, setTipo]                 = useState('')
  const [data, setData]                 = useState(hoje)
  const [link, setLink]                 = useState('')
  const [origem, setOrigem]             = useState('combinada')
  const [saving, setSaving]             = useState(false)
  const [toast, showToast]              = useToast()

  const tipoSel = TIPOS_DIVULGACAO.find(t=>t.value===tipo)
  const temLink = tipoSel?.temLink || false

  // Busca todos os parceiros cadastrados filtrados pelo texto digitado
  const parceirosDisponiveis = (parceiros||[]).filter(p =>
    p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())
  )

  function selecionarParceiro(p) {
    setParceiroId(p.id)
    setParceiroNome(p.nome)
    setParceiroSearch(p.nome)
    setParceiroOpen(false)
  }

  async function salvar() {
    if (!parceiroId || !tipo) return
    setSaving(true)
    try {
      await createDivulgacaoLibraria({
        campanha_id: campanhaId,
        parceiro_id: parceiroId,
        tipo_divulgacao: tipo,
        data_divulgacao: data||null,
        origem: origem,
        link: link||null,
      })
      onSave && await onSave()
      showToast('Divulgação registrada!')
      setTimeout(onClose, 1000)
    } catch(e) { showToast('Erro ao salvar','error'); console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" style={{zIndex:1100}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">Nova divulgação da Livraria</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          {/* Parceiro — busca em todos os cadastrados */}
          <div className="form-group" style={{position:'relative'}}>
            <label className="form-label">Nome do parceiro *</label>
            <input className="form-input"
              value={parceiroSearch}
              onChange={e=>{ setParceiroSearch(e.target.value); setParceiroId(''); setParceiroOpen(true) }}
              onFocus={()=>setParceiroOpen(true)}
              placeholder="Buscar parceiro..."
              autoComplete="off"/>
            {parceiroId && <div style={{fontSize:11,color:'var(--accent)',marginTop:3}}>✓ {parceiroNome}</div>}
            {parceiroOpen && parceiroSearch && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:300,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:200,overflowY:'auto',boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
                {parceirosDisponiveis.length===0
                  ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado</div>
                  : parceirosDisponiveis.map(p=>(
                      <div key={p.id} onClick={()=>selecionarParceiro(p)}
                        style={{padding:'9px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)',fontSize:13}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{fontWeight:600,color:'var(--text)'}}>{p.nome}</div>
                        {p.tipo_parceria&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{p.tipo_parceria}</div>}
                      </div>
                    ))
                }
              </div>
            )}
          </div>

          {/* Origem */}
          <div className="form-group">
            <label className="form-label">Origem da divulgação</label>
            <div style={{display:'flex',gap:8}}>
              {[{v:'combinada',l:'🤝 Combinada'},{v:'organica',l:'🌱 Orgânica'},{v:'propria',l:'⭐ Própria'}].map(({v,l})=>(
                <button key={v} type="button" onClick={()=>setOrigem(v)}
                  style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:'2px solid',
                    borderColor:origem===v?'var(--accent)':'var(--border)',
                    background:origem===v?'var(--accent-glow)':'transparent',
                    color:origem===v?'var(--accent)':'var(--text-muted)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de divulgação *</label>
            <select className="form-select" value={tipo} onChange={e=>setTipo(e.target.value)}>
              <option value="">Selecionar...</option>
              {TIPOS_DIVULGACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Data */}
          <div className="form-group">
            <label className="form-label">Data divulgada</label>
            <input className="form-input" type="date" value={data} onChange={e=>setData(e.target.value)}/>
          </div>

          {/* Link — só para tipos com link */}
          {temLink && (
            <div className="form-group">
              <label className="form-label">Link da publicação</label>
              <input className="form-input" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..."/>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!parceiroId||!tipo}>
            {saving?'Salvando...':'Registrar divulgação'}
          </button>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

function DetalheCampanha({ campanhaId, onBack, livros, parceiros, usuarios = [] }) {
  const [campanha, setCampanha]           = useState(null)
  const [loading, setLoading]             = useState(true)
  const [modalParceiro, setModalParceiro] = useState(null)
  const [modalEdicao, setModalEdicao]         = useState(false)
  const [modalImportarLivros, setModalImportarLivros] = useState(false)
  const [addParceiroSearch, setAddParceiroSearch] = useState('')
  const [addParceiroOpen, setAddParceiroOpen]     = useState(false)
  const [lancamentoLivros, setLancamentoLivros]   = useState([])
  const [filtroCampanha, setFiltroCampanha]       = useState('')
  const [filtroRespCamp, setFiltroRespCamp]       = useState('')
  const [toast, showToast]                = useToast()

  async function reload() {
    const c = await getCampanha(campanhaId)
    setCampanha(c)
    if ((c.tipo === 'Lançamento' || c.tipo === 'Geral' || c.tipo === 'Book Time')) {
      const ll = await getLancamentoLivros(campanhaId)
      setLancamentoLivros(ll)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [campanhaId])

  async function handleImportarLivros(novos) {
    // novos = array of campanha_livros records returned by addLivroCampanha
    setCampanha(prev => ({
      ...prev,
      campanha_livros: [...(prev.campanha_livros||[]), ...novos]
    }))
    setModalImportarLivros(false)
  }

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
  const confirmados = cps.filter(p=>['confirmado','publicado'].includes(p.status)).length
  const totalCurtidas    = cps.reduce((a,p)=>a+(p.curtidas||0),0)
  const totalVisualizacoes = cps.reduce((a,p)=>a+(p.visualizacoes||0),0)
  const totalVendidos    = cps.reduce((a,p)=>a+(p.livros_vendidos||0),0)

  const parceirosFiltrados = parceiros.filter(p =>
    p.nome.toLowerCase().includes(addParceiroSearch.toLowerCase())
  )
  const cpsFiltrados = cps.filter(cp => {
    if (filtroCampanha && !(cp.parceiros?.nome||'').toLowerCase().includes(filtroCampanha.toLowerCase())) return false
    if (filtroRespCamp && cp.parceiros?.responsavel_interno_id !== filtroRespCamp) return false
    return true
  })

  // Etapa atual baseada nos parceiros
  // 0=Planejamento, 1=Envio Cortesia, 2=Aprovação, 3=Monitoramento, 4=Resultados
  const etapaAtual = campanha.status === 'cancelada' ? 3
    : campanha.status === 'concluida' ? 2
    : campanha.status === 'em_andamento' ? 1
    : 0

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
            {campanha.data_inicio && <span><Calendar size={12} style={{marginRight:4}}/>Início: {fmtDate(campanha.data_inicio, 'dd MMM yyyy', {locale:ptBR})}</span>}
            {campanha.data_fim    && <span>Fim: {fmtDate(campanha.data_fim, 'dd MMM yyyy', {locale:ptBR})}</span>}
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

      {(campanha.tipo === 'Lançamento' || campanha.tipo === 'Geral' || campanha.tipo === 'Book Time')
        ? <DetalheLancamento
            campanhaId={campanhaId}
            tipoCampanha={campanha.tipo}
            lancamentoLivros={lancamentoLivros}
            setLancamentoLivros={setLancamentoLivros}
            parceiros={parceiros}
            usuarios={usuarios}
            reload={reload}
            showToast={showToast}
          />
        : <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Parceiros */}
            <div className="table-card">
              <div className="table-toolbar" style={{flexWrap:'wrap',gap:8}}>
                <span className="table-title">Parceiros ({cps.length})</span>
                <input className="search-input" style={{flex:1,minWidth:140,maxWidth:220}}
                  placeholder="🔎 Filtrar parceiro..."
                  value={filtroCampanha} onChange={e=>setFiltroCampanha(e.target.value)}/>
                <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
                  value={filtroRespCamp} onChange={e=>setFiltroRespCamp(e.target.value)}>
                  <option value="">Todos os responsáveis</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                {(filtroCampanha||filtroRespCamp) && (
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setFiltroCampanha('');setFiltroRespCamp('')}}>
                    <X size={12}/> Limpar
                  </button>
                )}
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
              {cpsFiltrados.length===0
                ? <div className="empty-state"><p>{filtroRespCamp||filtroCampanha ? 'Nenhum resultado para o filtro.' : 'Nenhum parceiro adicionado ainda.'}</p></div>
                : <table>
                    <thead><tr><th>Parceiro</th><th>Status</th><th>Responsável</th><th>Período</th><th>Divulgações</th><th></th></tr></thead>
                    <tbody>
                      {cpsFiltrados.map(cp=>(
                        <tr key={cp.id}>
                          <td className="td-strong">{cp.parceiros?.nome||'—'}</td>
                          <td><StatusBadge value={cp.status} options={STATUS_PARCEIRO}/></td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>
                            {(() => {
                              const resp = cp.parceiros?.responsavel_interno_id ? usuarios.find(u=>u.id===cp.parceiros.responsavel_interno_id) : null
                              return resp ? <span style={{fontWeight:600,color:'var(--text)'}}>{resp.nome}</span> : <span className="td-muted">—</span>
                            })()}
                          </td>
                          <td className="td-muted" style={{fontSize:12}}>
                            {cp.data_inicio ? fmtDate(cp.data_inicio, 'dd/MM', {locale:ptBR}) : '—'}
                            {cp.data_fim ? <span> → {fmtDate(cp.data_fim, 'dd/MM', {locale:ptBR})}</span> : ''}
                          </td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>—</td>
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
            <div className="table-card" style={{padding:'16px 20px'}}>
              <div style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:12}}>Progresso</div>
              <ProgressoParceiros parceiros={cps}/>
            </div>
          </div>
      }

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


// ── LISTA DE CAMPANHAS ─────────────────────────────────────
export default function Campanhas() {
 const { usuario } = useAuth()
const { perfilAtivo } = useViewAs()

const perfilEfetivo = perfilAtivo || usuario?.perfil
const ehAdmin = ['administrador', 'gerente'].includes(usuario?.perfil)
const grupoDoPerfil = PERFIL_GRUPO[perfilEfetivo] || null

const [filtroGrupoAdmin, setFiltroGrupoAdmin] = useState('todos')

const grupoCampanhas = ehAdmin
  ? (filtroGrupoAdmin === 'todos' ? null : filtroGrupoAdmin)
  : grupoDoPerfil

const gruposLivros = grupoCampanhas ? [grupoCampanhas] : null

  const [campanhas, setCampanhas]   = useState([])
  const [dragId, setDragId]         = useState(null)
  const [dragOver, setDragOver]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [detalhe, setDetalhe]       = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [search, setSearch]         = useState('')
  const [livros, setLivros]         = useState({ data: [] })
  const [parceiros, setParceiros]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [toast, showToast]          = useToast()

  async function reload() {
    const [cs, ps, ls, us] = await Promise.all([
      getCampanhas({ grupo: grupoCampanhas }),
      getParceirosAtivos(),
      getLivros({ page:0, pageSize:5000, grupos: gruposLivros }),
      getUsuarios(),
    ])

    const campanhasFiltradas = ehAdmin
  ? cs
  : cs.filter(c => canAccessGroup(perfilEfetivo, c.grupo || 'influencers'))

    setCampanhas(campanhasFiltradas)
    setParceiros(ps)
    setLivros(ls)
    setUsuarios(us||[])
  }

  useEffect(() => { 
    reload().finally(()=>setLoading(false)) 
  }, [grupoCampanhas, usuario?.perfil])

  async function handleCreate(form) {
    const { parceiro_ids = [], ...rest } = form
   const grupoNovaCampanha = ehAdmin
  ? (grupoCampanhas || 'influencers')
  : grupoDoPerfil

const campanha = await createCampanha({
  ...rest,
  grupo: grupoNovaCampanha
})
    for (const pid of parceiro_ids) {
      await addParceiroCampanha(campanha.id, pid)
    }
    await reload()
    const autoLivros = campanha._livrosAutoAdicionados || 0
    if (autoLivros > 0) {
      showToast(`Campanha criada! ${autoLivros} livro${autoLivros!==1?'s':''} do período adicionado${autoLivros!==1?'s':''} automaticamente.`)
    } else {
      showToast('Campanha criada!')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta campanha?')) return
    await deleteCampanha(id)
    setCampanhas(prev=>prev.filter(c=>c.id!==id))
    showToast('Excluída!')
  }

  async function handleDragEnd(fromId, toId) {
    if (!fromId || !toId || fromId === toId) { setDragId(null); setDragOver(null); return }
    const allIds = campanhas.map(c => c.id)
    const fromIdx = allIds.indexOf(fromId)
    const toIdx = allIds.indexOf(toId)
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOver(null); return }
    const reordenadas = [...campanhas]
    const [moved] = reordenadas.splice(fromIdx, 1)
    reordenadas.splice(toIdx, 0, moved)
    setCampanhas(reordenadas)
    setDragId(null); setDragOver(null)
    const ordens = reordenadas.map((c, i) => ({ id: c.id, ordem: i }))
    try { await reordenarCampanhas(ordens) } catch(e) { console.error(e) }
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
      usuarios={usuarios}
    />
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-subtitle">{campanhas.length} campanha{campanhas.length!==1?'s':''} · {campanhas.filter(c=>c.status==='em_andamento').length} em andamento</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {(['administrador', 'gerente', 'estagiario_parceiras', 'analista_parceiras', 'supervisor_parceiras'].includes(usuario?.perfil)) && (
            <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={16}/> Nova Campanha</button>
          )}
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6}}>
          <button className={`btn btn-sm ${filtroStatus==='todos'?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltroStatus('todos')}>Todas</button>
          {STATUS_CAMPANHA.map(s=>(
            <button key={s.value} className={`btn btn-sm ${filtroStatus===s.value?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltroStatus(s.value)}>{s.label}</button>
          ))}
        </div>
        <input className="search-input" style={{marginLeft:'auto'}} placeholder="Buscar campanha..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/></div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state" style={{marginTop:40}}><p>Nenhuma campanha encontrada.</p></div>
      ) : (
        // Aqui vai o conteúdo original de renderização dos cards que você tinha
        (() => {
          const ORDEM_TIPOS = ['Promoção', 'Lançamento', 'Geral']
          const grupos = ORDEM_TIPOS.map(tipo => ({
            tipo,
            items: filtradas.filter(c => c.tipo === tipo)
          })).filter(g => g.items.length > 0)
          const semTipo = filtradas.filter(c => !ORDEM_TIPOS.includes(c.tipo))
          if (semTipo.length > 0) grupos.push({ tipo: 'Outros', items: semTipo })

          function renderCard(c) {
            const sc = STATUS_CAMPANHA.find(s => s.value === c.status) || STATUS_CAMPANHA[0]
            const cps = c.campanha_parceiros || []
            const hoje = new Date().toISOString().slice(0, 10)
            const urgente = c.data_fim && c.data_fim <= hoje && c.status === 'em_andamento'
            const isDragging = dragId === c.id
            const isOver = dragOver === c.id

            const livrosCampanha = c.campanha_livros || []
            const parceirosDiretos = cps
              .map(cp => cp.parceiro_id || cp.parceiros?.id)
              .filter(Boolean)

            const parceirosLancamento = (c.lancamento_livros || [])
              .flatMap(ll => ll.lancamento_parceiros || [])
              .map(lp => lp.parceiro_id || lp.parceiros?.id)
              .filter(Boolean)

            const totalParceiros = new Set([...parceirosDiretos, ...parceirosLancamento]).size || cps.length
            const publicados = cps.filter(cp => cp.status === 'publicado').length
            const confirmados = cps.filter(cp => ['confirmado', 'publicado'].includes(cp.status)).length

            return (
              <div
                key={c.id}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(c.id) }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(c.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); handleDragEnd(dragId, c.id) }}
                onDragEnd={() => { setDragId(null); setDragOver(null) }}
                className="table-card"
                style={{
                  padding: '18px 20px',
                  cursor: 'grab',
                  border: isOver
                    ? '2px solid var(--accent)'
                    : urgente
                      ? '1px solid rgba(245,101,101,0.3)'
                      : '1px solid var(--border)',
                  opacity: isDragging ? 0.4 : 1,
                  minHeight: 118
                }}
                onClick={() => !dragId && setDetalhe(c.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 7, lineHeight: 1.35 }}>
                      {c.nome}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${sc.cls}`}>{sc.label}</span>
                      {urgente && <span className="badge badge-red">⚠ Vencida</span>}
                    </div>
                  </div>

                  <button
                    className="btn btn-danger btn-icon btn-sm"
                    title="Excluir campanha"
                    onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                    marginBottom: 12
                  }}
                >
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                      Início
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {c.data_inicio ? fmtDate(c.data_inicio, 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                      Fim
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: urgente ? 'var(--red)' : 'var(--text)' }}>
                      {c.data_fim ? fmtDate(c.data_fim, 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                      Parceiros
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {totalParceiros}
                    </div>
                  </div>
                </div>

                {livrosCampanha.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <BookOpen size={12} />
                    {livrosCampanha.length} livro{livrosCampanha.length !== 1 ? 's' : ''} vinculado{livrosCampanha.length !== 1 ? 's' : ''}
                  </div>
                )}

                {cps.length > 0 ? (
                  <ProgressoParceiros parceiros={cps} />
                ) : totalParceiros > 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {totalParceiros} parceiro{totalParceiros !== 1 ? 's' : ''} vinculado{totalParceiros !== 1 ? 's' : ''} aos livros da campanha.
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Nenhum parceiro vinculado ainda.
                  </div>
                )}

                {(confirmados > 0 || publicados > 0) && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    {confirmados} confirmado{confirmados !== 1 ? 's' : ''} · {publicados} publicado{publicados !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div>
              {grupos.map(grupo => (
                <div key={grupo.tipo} style={{marginBottom:32}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                    <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-muted)',margin:0}}>
                      {grupo.tipo}
                    </h2>
                    <span style={{fontSize:12,color:'var(--text-muted)',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:20,padding:'1px 8px'}}>
                      {grupo.items.length}
                    </span>
                    <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
                    {grupo.items.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          )
        })()
      )}

      {modal && <ModalCampanha livros={livros} parceiros={parceiros} onSave={handleCreate} onClose={()=>setModal(false)}/>} 
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
