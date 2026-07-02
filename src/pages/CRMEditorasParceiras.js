import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getCRMEditoras, createCRMEditora, updateCRMEditora, deleteCRMEditora,
  getStatusHistoryEditora, addStatusHistoryEditora,
  getEditorasParceirasAtivas, getLivrariasParceirasAtivas,
  getAllScoreEditorasMes, getAllScoreLivrariasMes,
  upsertScoreEditora, upsertScoreLivraria,
  calcularScoreEditora, calcularScoreLivraria,
  calcularScoreTrimestralLivraria, calcularScoreTrimestralEditora,
  upsertScoreTrimestralLivraria, upsertScoreTrimestralEditora,
  getScoreTrimestralLivrarias, getScoreTrimestralEditoras,
  importarVendasLivraria, importarVendasEditora,
  getCalendarioPromocoes,
  PIPELINE_EDITORAS, TIPOS_CONTATO, ORIGENS_EDITORAS,
  pipelineInfo, mesAnoLabel, getMesesDisponiveis, corScore, MESES_LABEL,
  getTrimestresDisponiveis, TRIMESTRES_LABEL, trimestreAtual, corClassificacao, classificacaoPorPct,
} from '../lib/crm-editoras-parceiras'
import { getUsuarios } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Building2, Plus, X, ChevronRight, Search,
  Trash2, BarChart2, Library, Upload, Download, FileSpreadsheet,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 4000) }
  return [t, show]
}

const TIPO_CORES = {
  editora:     { cor: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  livraria:    { cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  marketplace: { cor: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  cupom:       { cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
}
function BadgeTipo({ tipo }) {
  const c = TIPO_CORES[tipo] || TIPO_CORES.editora
  const label = TIPOS_CONTATO.find(t => t.value === tipo)?.label || tipo
  return (
    <span style={{ display:'inline-flex', alignItems:'center', background:c.bg, border:`1px solid ${c.cor}55`, borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700, color:c.cor }}>
      {label}
    </span>
  )
}

function BadgeClasse({ cls }) {
  if (!cls || cls === 'N/A') return <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
  const cor = corClassificacao(cls)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:`${cor}22`, border:`2px solid ${cor}`, fontWeight:900, fontSize:14, color:cor }}>
      {cls}
    </span>
  )
}

function CirculoScore({ nota, size = 36 }) {
  const c = corScore(nota)
  if (nota === null || nota === undefined) return <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, borderRadius:'50%', background:c.bg, color:c.cor, fontWeight:800, fontSize:size > 34 ? 13 : 12, border:`${size > 34 ? 2 : 1}px solid ${c.cor}40` }}>
      {nota.toFixed(1)}
    </span>
  )
}

// ── CARD KANBAN ────────────────────────────────────────────
function KanbanCard({ contato, onClick, onDragStart, onDragEnd, isDragging, onDelete }) {
  return (
    <div draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart && onDragStart() }}
      onDragEnd={() => onDragEnd && onDragEnd()}
      onClick={() => !isDragging && onClick()}
      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', cursor:'grab', marginBottom:8, opacity:isDragging?0.4:1, userSelect:'none', position:'relative' }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:4, marginBottom:6 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{contato.nome}</div>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, flexShrink:0, display:'flex' }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <BadgeTipo tipo={contato.tipo} />
      {contato.responsavel_nome && (
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:6 }}>
          <div style={{ width:14, height:14, borderRadius:'50%', background:'var(--surface-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'var(--text-muted)' }}>
            {contato.responsavel_nome[0].toUpperCase()}
          </div>
          <span style={{ fontSize:10, color:'var(--text-muted)' }}>{contato.responsavel_nome}</span>
        </div>
      )}
    </div>
  )
}

// ── MODAL CONTATO ──────────────────────────────────────────
function ModalContato({ contato, onSave, onClose, pipeline, usuarios }) {
  const empty = { nome:'', tipo:'editora', contato:'', email:'', instagram:'', site:'', origem:'', responsavel_id:'', observacao:'' }
  const [form, setForm] = useState(contato ? { ...contato } : empty)
  const [statusInicial, setStatusInicial] = useState('novo_contato')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave(form, statusInicial); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{contato ? 'Editar contato' : 'Novo contato'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome:e.target.value }))} placeholder="Nome da editora ou livraria" />
          </div>
          <div className="form-group">
            <label className="form-label">Modalidade</label>
            <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo:e.target.value }))}>
              {TIPOS_CONTATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Origem</label>
            <select className="form-select" value={form.origem} onChange={e => setForm(f => ({ ...f, origem:e.target.value }))}>
              <option value="">Selecionar...</option>
              {ORIGENS_EDITORAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contato</label>
            <input className="form-input" value={form.contato ?? ''} onChange={e => setForm(f => ({ ...f, contato:e.target.value }))} placeholder="Nome da pessoa" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} placeholder="email@editora.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input className="form-input" value={form.instagram ?? ''} onChange={e => setForm(f => ({ ...f, instagram:e.target.value }))} placeholder="@editora" />
          </div>
          <div className="form-group">
            <label className="form-label">Site</label>
            <input className="form-input" value={form.site ?? ''} onChange={e => setForm(f => ({ ...f, site:e.target.value }))} placeholder="https://" />
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Responsável</label>
            <select className="form-select" value={form.responsavel_id ?? ''} onChange={e => setForm(f => ({ ...f, responsavel_id:e.target.value }))}>
              <option value="">Sem responsável</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Observação</label>
            <textarea className="form-textarea" rows={2} value={form.observacao ?? ''} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} />
          </div>
          {!contato && (
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Status inicial</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {pipeline.map(s => (
                  <button key={s.value} type="button" onClick={() => setStatusInicial(s.value)}
                    style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:`2px solid ${s.cor}`, background:statusInicial===s.value?s.cor:'transparent', color:statusInicial===s.value?'#fff':s.cor, transition:'all 0.15s' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : contato ? 'Salvar' : 'Criar contato'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL DETALHE CONTATO ──────────────────────────────────
function ModalDetalheContato({ contato: inicial, onSave, onClose, pipeline, usuarios }) {
  const { usuario } = useAuth()
  const [contato, setContato] = useState(inicial)
  const [history, setHistory] = useState([])
  const [aba, setAba] = useState('perfil')
  const [novoStatus, setNovoStatus] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => { getStatusHistoryEditora(inicial.id).then(setHistory).catch(console.error) }, [inicial.id])

  async function salvarPerfil() {
    setSaving(true)
    try { const upd = await updateCRMEditora(contato.id, contato); setContato(upd); onSave(upd); showToast('Salvo!') }
    catch { showToast('Erro ao salvar', 'error') } finally { setSaving(false) }
  }

  async function avancarStatus() {
    if (!novoStatus) return
    setSavingStatus(true)
    try {
      await addStatusHistoryEditora(contato.id, novoStatus, motivo, usuario?.id)
      const hist = await getStatusHistoryEditora(contato.id)
      setHistory(hist)
      const atualizado = { ...contato, current_status: novoStatus }
      setContato(atualizado); onSave(atualizado)
      setNovoStatus(''); setMotivo('')
      showToast('Status atualizado!')
    } catch { showToast('Erro', 'error') } finally { setSavingStatus(false) }
  }

  const statusAtual = contato.current_status || 'novo_contato'
  const stInfo = pipelineInfo(statusAtual)
  const pipelineProspeccao = pipeline.filter(s => !['ativo','pausado','recusou'].includes(s.value))

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth:680, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10, borderBottom:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{contato.nome}</div>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:stInfo.bg, border:`1px solid ${stInfo.cor}40`, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, color:stInfo.cor, marginTop:4 }}>{stInfo.label}</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display:'flex', gap:4, padding:'12px 0 0', borderBottom:'1px solid var(--border)', marginBottom:16 }}>
          {[{ v:'perfil', l:'Perfil' }, { v:'pipeline', l:'Pipeline' }, { v:'historico', l:`Histórico (${history.length})` }].map(({ v, l }) => (
            <button key={v} onClick={() => setAba(v)} className={`btn btn-sm ${aba===v?'btn-primary':'btn-ghost'}`} style={{ borderRadius:'6px 6px 0 0' }}>{l}</button>
          ))}
        </div>
        {aba === 'perfil' && (
          <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={contato.nome} onChange={e => setContato(c => ({ ...c, nome:e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Modalidade</label><select className="form-select" value={contato.tipo} onChange={e => setContato(c => ({ ...c, tipo:e.target.value }))}>{TIPOS_CONTATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Contato</label><input className="form-input" value={contato.contato ?? ''} onChange={e => setContato(c => ({ ...c, contato:e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={contato.email ?? ''} onChange={e => setContato(c => ({ ...c, email:e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Instagram</label><input className="form-input" value={contato.instagram ?? ''} onChange={e => setContato(c => ({ ...c, instagram:e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Origem</label><select className="form-select" value={contato.origem ?? ''} onChange={e => setContato(c => ({ ...c, origem:e.target.value }))}><option value="">—</option>{ORIGENS_EDITORAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label className="form-label">Responsável</label><select className="form-select" value={contato.responsavel_id ?? ''} onChange={e => setContato(c => ({ ...c, responsavel_id:e.target.value }))}><option value="">Sem responsável</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label className="form-label">Observação</label><textarea className="form-textarea" rows={2} value={contato.observacao ?? ''} onChange={e => setContato(c => ({ ...c, observacao:e.target.value }))} /></div>
            <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-primary" onClick={salvarPerfil} disabled={saving}>{saving?'Salvando...':'Salvar perfil'}</button>
            </div>
          </div>
        )}
        {aba === 'pipeline' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, fontWeight:700, textTransform:'uppercase' }}>Status atual</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {pipelineProspeccao.map((s, i) => (
                  <div key={s.value} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, background:statusAtual===s.value?s.cor:s.bg, color:statusAtual===s.value?'#fff':s.cor, border:`2px solid ${s.cor}` }}>{s.label}</div>
                    {i < pipelineProspeccao.length-1 && <ChevronRight size={14} color="var(--border)" />}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, fontWeight:700, textTransform:'uppercase' }}>Mover para</div>
              <div className="form-group"><select className="form-select" value={novoStatus} onChange={e => setNovoStatus(e.target.value)}><option value="">Selecionar...</option>{pipeline.filter(s => s.value !== statusAtual).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              {novoStatus && <div className="form-group"><label className="form-label">Motivo (opcional)</label><textarea className="form-textarea" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} /></div>}
              <button className="btn btn-primary" onClick={avancarStatus} disabled={savingStatus || !novoStatus}>{savingStatus ? 'Salvando...' : 'Confirmar mudança'}</button>
            </div>
          </div>
        )}
        {aba === 'historico' && (
          <div>
            {history.length === 0 ? <p style={{ fontSize:13, color:'var(--text-muted)' }}>Nenhuma mudança registrada.</p>
            : history.map((h, i) => {
              const st = pipelineInfo(h.status)
              const anterior = history[i+1] ? pipelineInfo(history[i+1].status) : null
              return (
                <div key={h.id} style={{ display:'flex', gap:12, marginBottom:16 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:st.cor, flexShrink:0, marginTop:3 }} />
                    {i < history.length-1 && <div style={{ width:2, flex:1, background:'var(--border)', marginTop:4 }} />}
                  </div>
                  <div style={{ flex:1, paddingBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                      {anterior ? <span style={{ fontSize:13, fontWeight:700 }}><span style={{ color:anterior.cor }}>{anterior.label}</span><span style={{ color:'var(--text-muted)', margin:'0 4px' }}>→</span><span style={{ color:st.cor }}>{st.label}</span></span>
                      : <span style={{ fontSize:13, fontWeight:700, color:st.cor }}>{st.label}</span>}
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{format(new Date(h.changed_at), 'dd/MM/yyyy HH:mm', { locale:ptBR })}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>por {h.changed_by_nome || '—'}</div>
                    {h.reason && <div style={{ fontSize:12, color:'var(--text-muted)', background:'var(--surface-2)', borderRadius:6, padding:'6px 10px', marginTop:4 }}>{h.reason}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

// ── ABA PROSPECÇÃO ─────────────────────────────────────────
function AbaProspeccao({ pipeline, usuarios, showToast }) {
  const { usuario } = useAuth()
  const [contatos, setContatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  useEffect(() => { getCRMEditoras().then(setContatos).finally(() => setLoading(false)) }, [])

  async function handleNovo(form, statusInicial) {
    const novo = await createCRMEditora({ ...form, responsavel_id: form.responsavel_id || null }, statusInicial)
    setContatos(prev => [...prev, { ...novo, current_status: statusInicial, responsavel_nome: usuarios.find(u => u.id === form.responsavel_id)?.nome || null }])
    showToast('Contato criado!')
  }

  async function handleDelete(id, nome) {
    if (!window.confirm(`Excluir "${nome}"?`)) return
    await deleteCRMEditora(id); setContatos(prev => prev.filter(c => c.id !== id)); showToast(`${nome} excluído.`)
  }

  async function handleDrop(novoStatus) {
    if (!dragId || !novoStatus) { setDragId(null); setDragOverCol(null); return }
    const contato = contatos.find(c => c.id === dragId)
    if (!contato || contato.current_status === novoStatus) { setDragId(null); setDragOverCol(null); return }
    setContatos(prev => prev.map(c => c.id === dragId ? { ...c, current_status: novoStatus } : c))
    setDragId(null); setDragOverCol(null)
    try { await addStatusHistoryEditora(dragId, novoStatus, 'Status alterado via kanban', usuario?.id); showToast(`${contato.nome} → ${pipelineInfo(novoStatus).label}`) }
    catch { setContatos(prev => prev.map(c => c.id === dragId ? { ...c, current_status: contato.current_status } : c)); showToast('Erro ao atualizar status', 'error') }
  }

  const pipelineKanban = pipeline.filter(s => !['ativo','pausado','recusou'].includes(s.value))
  const filtrados = contatos.filter(c => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase())) return false
    if (filtroStatus && c.current_status !== filtroStatus) return false
    if (filtroTipo && c.tipo !== filtroTipo) return false
    if (filtroResp && c.responsavel_id !== filtroResp) return false
    if (filtroOrigem && c.origem !== filtroOrigem) return false
    return true
  })
  const porStatus = {}
  for (const s of pipeline) porStatus[s.value] = filtrados.filter(c => c.current_status === s.value)
  const responsaveis = [...new Map(contatos.filter(c => c.responsavel_id && c.responsavel_nome).map(c => [c.responsavel_id, c.responsavel_nome])).entries()]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', flex:1 }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft:32 }} placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>{pipeline.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todas as modalidades</option>{TIPOS_CONTATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
            <option value="">Todos os responsáveis</option>{responsaveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
          <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}>
            <option value="">Todas as origens</option>{ORIGENS_EDITORAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(filtroStatus||filtroTipo||filtroResp||filtroOrigem) && <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroStatus(''); setFiltroTipo(''); setFiltroResp(''); setFiltroOrigem('') }}><X size={12} /> Limpar</button>}
        </div>
        <button className="btn btn-primary" onClick={() => setModalNovo(true)} style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}><Plus size={15} /> Novo contato</button>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div style={{ overflowX:'auto', paddingBottom:16 }}>
          <div style={{ display:'flex', gap:14, minWidth:'max-content' }}>
            {pipelineKanban.map(st => {
              const items = porStatus[st.value] || []
              return (
                <div key={st.value} style={{ width:220, flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, padding:'6px 10px', background:st.bg, border:`1px solid ${st.cor}30`, borderRadius:8 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:st.cor }} />
                    <span style={{ fontSize:12, fontWeight:700, color:st.cor, flex:1 }}>{st.label}</span>
                    <span style={{ fontSize:11, color:st.cor, background:'var(--surface)', border:`1px solid ${st.cor}30`, borderRadius:20, padding:'1px 7px' }}>{items.length}</span>
                  </div>
                  <div onDragOver={e => { e.preventDefault(); setDragOverCol(st.value) }} onDragLeave={() => setDragOverCol(null)} onDrop={e => { e.preventDefault(); handleDrop(st.value) }}
                    style={{ minHeight:60, borderRadius:8, transition:'background 0.15s', background:dragOverCol===st.value?`${st.cor}18`:'transparent', border:dragOverCol===st.value?`2px dashed ${st.cor}`:'2px solid transparent', padding:2 }}>
                    {items.length === 0
                      ? <div style={{ padding:'16px 10px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>{dragOverCol===st.value?'Soltar aqui':'Vazio'}</div>
                      : items.map(c => <KanbanCard key={c.id} contato={c} onClick={() => setModalDetalhe(c)} onDragStart={() => setDragId(c.id)} onDragEnd={() => { setDragId(null); setDragOverCol(null) }} isDragging={dragId===c.id} onDelete={() => handleDelete(c.id, c.nome)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {modalNovo && <ModalContato onSave={handleNovo} onClose={() => setModalNovo(false)} pipeline={pipeline} usuarios={usuarios} />}
      {modalDetalhe && <ModalDetalheContato contato={modalDetalhe} onSave={upd => setContatos(prev => prev.map(c => c.id === upd.id ? { ...c, ...upd } : c))} onClose={() => setModalDetalhe(null)} pipeline={pipeline} usuarios={usuarios} />}
    </div>
  )
}

// ── ABA PARCEIROS ATIVOS ───────────────────────────────────
function AbaParceirosAtivos() {
  const [editoras, setEditoras] = useState([])
  const [livrarias, setLivrarias] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    Promise.all([getEditorasParceirasAtivas(), getLivrariasParceirasAtivas()])
      .then(([eds, livs]) => { setEditoras(eds); setLivrarias(livs) }).finally(() => setLoading(false))
  }, [])

  const dadosCombinados = [
    ...editoras.map(e => ({ ...e, _tipo:'editora', _nome:e.nome, _status:e.status_parceria })),
    ...livrarias.map(l => ({ ...l, _tipo:'livraria', _nome:l.nome, _status:l.status })),
  ].filter(item => {
    if (search && !item._nome.toLowerCase().includes(search.toLowerCase())) return false
    if (filtroTipo && item._tipo !== filtroTipo) return false
    if (filtroStatus && item._status !== filtroStatus) return false
    return true
  })

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[{ label:'Total editoras', value:editoras.length, cor:'var(--accent)' }, { label:'Total livrarias', value:livrarias.length, cor:'#22c55e' }, { label:'Parcerias ativas', value:editoras.filter(e => e.status_parceria==='ativa').length, cor:'#3b82f6' }, { label:'Em encerramento', value:editoras.filter(e => e.status_parceria==='encerramento').length, cor:'#ef4444' }].map(({ label, value, cor }) => (
          <div key={label} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px', minWidth:130 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:cor }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input className="search-input" style={{ paddingLeft:32, width:'100%' }} placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Editoras e livrarias</option><option value="editora">Apenas editoras</option><option value="livraria">Apenas livrarias</option>
        </select>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option><option value="ativa">Ativa</option><option value="encerramento">Encerramento</option><option value="pendente">Pendente</option><option value="finalizada">Finalizada</option>
        </select>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="table-card">
          <div className="table-toolbar"><span className="table-title">Parceiros ({dadosCombinados.length})</span></div>
          <table><thead><tr><th>Nome</th><th>Tipo</th><th>Classificação</th><th>Status</th></tr></thead>
            <tbody>{dadosCombinados.map(item => (
              <tr key={`${item._tipo}-${item.id}`} onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td><div className="td-strong">{item._nome}</div>{item._tipo==='livraria'&&item.editoras_parceiras?.nome&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.editoras_parceiras.nome}</div>}</td>
                <td><BadgeTipo tipo={item._tipo} /></td>
                <td>{item.classificacao?<span style={{ fontWeight:800, color:{A:'#22c55e',B:'#84cc16',C:'#f59e0b',D:'#fb923c',E:'#ef4444',F:'#6b7280'}[item.classificacao]||'var(--text)' }}>{item.classificacao}</span>:<span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}</td>
                <td><span style={{ fontSize:11, fontWeight:700, color:item._status==='ativa'?'#22c55e':item._status==='encerramento'?'#ef4444':'var(--text-muted)' }}>{item._status||'—'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── MODAIS SCORE MENSAL (preservados) ─────────────────────
function ModalScoreEditoraMensal({ editora, score, onSave, onClose }) {
  const mesesOpcoes = getMesesDisponiveis(24)
  const hoje = new Date()
  const [mes, setMes] = useState(score?.mes || hoje.getMonth()+1)
  const [ano, setAno] = useState(score?.ano || hoje.getFullYear())
  const [form, setForm] = useState({ promocao_geral:score?.promocao_geral||'nao_participou', promocao_particular:score?.promocao_particular||'nao_participou', campanha:score?.campanha||'nao_participou', teve_lancamento:score?.teve_lancamento||false, qtd_lancamentos:score?.qtd_lancamentos||0, fez_reuniao:score?.fez_reuniao||false, respondeu_whatsapp:score?.respondeu_whatsapp||false, publicou_feed:score?.publicou_feed||false, publicou_story:score?.publicou_story||false, publicou_reels:score?.publicou_reels||false, vendas_editora:score?.vendas_editora||0, responde_artes:score?.responde_artes||false, faz_cortesia:score?.faz_cortesia||false, cria_cupom:score?.cria_cupom||false, observacao:score?.observacao||'' })
  const [saving, setSaving] = useState(false)
  const preview = calcularScoreEditora(form)
  const c = corScore(preview)
  const opcoes = [{ value:'confirmou', label:'Confirmou' },{ value:'sem_retorno', label:'Sem retorno' },{ value:'recusou', label:'Recusou' },{ value:'nao_participou', label:'Não participou' }]
  function Check({ field, label }) { return <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'6px 0' }}><input type="checkbox" checked={!!form[field]} onChange={e => setForm(f => ({ ...f, [field]:e.target.checked }))} style={{ accentColor:'var(--accent)', width:15, height:15 }} /><span style={{ fontSize:13 }}>{label}</span></label> }
  function Sel({ field, label }) { return <div className="form-group"><label className="form-label">{label}</label><select className="form-select" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]:e.target.value }))}>{opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div> }
  async function salvar() { setSaving(true); try { await onSave(editora.id, ano, mes, form); onClose() } catch(e){ console.error(e) } finally { setSaving(false) } }
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header"><div><h2 className="modal-title">Score mensal — Editora</h2><div style={{ fontSize:12, color:'var(--text-muted)' }}>{editora.nome}</div></div><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button></div>
        <div className="form-group"><label className="form-label">Mês de referência</label><select className="form-select" value={`${ano}-${mes}`} onChange={e => { const [a,m]=e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)) }}>{mesesOpcoes.map(({ mes:m, ano:a }) => <option key={`${a}-${m}`} value={`${a}-${m}`}>{mesAnoLabel(m,a)}</option>)}</select></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}><Sel field="promocao_geral" label="Promoção geral" /><Sel field="promocao_particular" label="Promoção particular" /><Sel field="campanha" label="Campanha" /><div className="form-group"><label className="form-label">Vendas</label><input className="form-input" type="number" min={0} value={form.vendas_editora} onChange={e => setForm(f => ({ ...f, vendas_editora:Number(e.target.value) }))} /></div></div>
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:12 }}><div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8 }}>Lançamentos</div><div style={{ display:'flex', gap:16, alignItems:'center' }}><Check field="teve_lancamento" label="Teve lançamento?" />{form.teve_lancamento&&<div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:12, color:'var(--text-muted)' }}>Quantos?</span><input className="form-input" type="number" min={1} value={form.qtd_lancamentos} onChange={e => setForm(f => ({ ...f, qtd_lancamentos:Number(e.target.value) }))} style={{ width:80 }} /></div>}</div></div>
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:12 }}><div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8 }}>Comunicação & publicações</div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}><Check field="fez_reuniao" label="Fez reunião" /><Check field="respondeu_whatsapp" label="Respondeu WhatsApp" /><Check field="publicou_feed" label="Publicou feed" /><Check field="publicou_story" label="Publicou story" /><Check field="publicou_reels" label="Publicou reels" /><Check field="responde_artes" label="Responde sobre artes" /><Check field="faz_cortesia" label="Faz envio de cortesia" /><Check field="cria_cupom" label="Cria cupom de venda" /></div></div>
        <div className="form-group"><label className="form-label">Observação (opcional)</label><textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} /></div>
        <div style={{ padding:'14px 16px', background:c.bg, border:`1px solid ${c.cor}40`, borderRadius:10, display:'flex', alignItems:'center', gap:14, marginBottom:16 }}><span style={{ fontSize:36, fontWeight:900, color:c.cor }}>{preview.toFixed(1)}</span><div style={{ fontSize:13, fontWeight:700, color:c.cor }}>Score calculado</div></div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar score'}</button></div>
      </div>
    </div>
  )
}

function ModalScoreLivrariatMensal({ livraria, score, onSave, onClose }) {
  const mesesOpcoes = getMesesDisponiveis(24)
  const hoje = new Date()
  const [mes, setMes] = useState(score?.mes || hoje.getMonth()+1)
  const [ano, setAno] = useState(score?.ano || hoje.getFullYear())
  const [promocoes, setPromocoes] = useState([])
  const [form, setForm] = useState({
    promocao_geral: score?.promocao_geral || 'nao_aplica',
    qtd_promocoes: score?.qtd_promocoes || 0,
    promocoes_ids: score?.promocoes_ids || [],
    promocoes_nao_aplica: score?.promocoes_nao_aplica || false,
    semanas_previstas: score?.semanas_previstas || 0,
    semanas_postou_feed: score?.semanas_postou_feed || 0,
    semanas_postou_story: score?.semanas_postou_story || 0,
    publicacoes_nao_aplica: score?.publicacoes_nao_aplica || false,
    vendas_livraria: score?.vendas_livraria || 0,
    vendas_nao_aplica: score?.vendas_nao_aplica || false,
    comunicacao: score?.comunicacao || 'nao_aplica',
    observacao: score?.observacao || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { getCalendarioPromocoes().then(setPromocoes).catch(console.error) }, [])

  const preview = calcularScoreLivraria(form)
  const c = corScore(preview)

  const OPCOES_PARTICIPACAO = [
    { value:'confirmou', label:'Confirmou' },
    { value:'recusou', label:'Recusou' },
    { value:'sem_retorno', label:'Sem retorno' },
    { value:'nao_aplica', label:'Não se aplica' },
  ]
  const OPCOES_COMUNICACAO = [
    { value:'sempre', label:'Sempre responde' },
    { value:'as_vezes', label:'Às vezes responde' },
    { value:'nao_responde', label:'Não responde' },
    { value:'nao_aplica', label:'Não se aplica' },
  ]

  function togglePromocao(id) {
    setForm(f => ({ ...f, promocoes_ids: f.promocoes_ids.includes(id) ? f.promocoes_ids.filter(x => x !== id) : [...f.promocoes_ids, id] }))
  }

  async function salvar() { setSaving(true); try { await onSave(livraria.id, ano, mes, form); onClose() } catch(e){ console.error(e) } finally { setSaving(false) } }

  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:580, maxHeight:'92vh', overflowY:'auto' }}>
        <div className="modal-header">
          <div><h2 className="modal-title">Score mensal — Livraria</h2><div style={{ fontSize:12, color:'var(--text-muted)' }}>{livraria.nome}</div></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Mês */}
        <div className="form-group">
          <label className="form-label">Mês de referência</label>
          <select className="form-select" value={`${ano}-${mes}`} onChange={e => { const [a,m]=e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)) }}>
            {mesesOpcoes.map(({ mes:m, ano:a }) => <option key={`${a}-${m}`} value={`${a}-${m}`}>{mesAnoLabel(m,a)}</option>)}
          </select>
        </div>

        {/* Vendas */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Vendas</div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.vendas_nao_aplica} onChange={e => setForm(f => ({ ...f, vendas_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.vendas_nao_aplica && (
            <input className="form-input" type="number" min={0} value={form.vendas_livraria} onChange={e => setForm(f => ({ ...f, vendas_livraria:Number(e.target.value) }))} placeholder="Unidades vendidas no mês" />
          )}
        </div>

        {/* Promoções */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Promoções</div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.promocoes_nao_aplica} onChange={e => setForm(f => ({ ...f, promocoes_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.promocoes_nao_aplica && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Participação</label>
                <select className="form-select" value={form.promocao_geral} onChange={e => setForm(f => ({ ...f, promocao_geral:e.target.value }))}>
                  {OPCOES_PARTICIPACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quantas promoções participou?</label>
                <input className="form-input" type="number" min={0} value={form.qtd_promocoes} onChange={e => setForm(f => ({ ...f, qtd_promocoes:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quais promoções?</label>
                {promocoes.length === 0
                  ? <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', padding:'8px 0' }}>Nenhuma promoção cadastrada no calendário ainda.</div>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                      {promocoes.map(p => {
                        const ativo = form.promocoes_ids.includes(p.id)
                        return <button key={p.id} type="button" onClick={() => togglePromocao(p.id)} style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'2px solid var(--accent)', background:ativo?'var(--accent)':'transparent', color:ativo?'#fff':'var(--accent)', transition:'all 0.15s' }}>{p.titulo}</button>
                      })}
                    </div>
                }
              </div>
            </div>
          )}
        </div>

        {/* Publicações */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Publicações</div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.publicacoes_nao_aplica} onChange={e => setForm(f => ({ ...f, publicacoes_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.publicacoes_nao_aplica && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas previstas</label>
                <input className="form-input" type="number" min={0} value={form.semanas_previstas} onChange={e => setForm(f => ({ ...f, semanas_previstas:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas c/ feed</label>
                <input className="form-input" type="number" min={0} value={form.semanas_postou_feed} onChange={e => setForm(f => ({ ...f, semanas_postou_feed:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas c/ story</label>
                <input className="form-input" type="number" min={0} value={form.semanas_postou_story} onChange={e => setForm(f => ({ ...f, semanas_postou_story:Number(e.target.value) }))} />
              </div>
              <div style={{ gridColumn:'1/-1', fontSize:11, color:'var(--text-muted)' }}>
                Postagem dentro da semana prevista conta como cumprida. Feed e story são avaliados separadamente.
              </div>
            </div>
          )}
        </div>

        {/* Comunicação */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Comunicação</div>
          <select className="form-select" value={form.comunicacao} onChange={e => setForm(f => ({ ...f, comunicacao:e.target.value }))}>
            {OPCOES_COMUNICACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Observação */}
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} />
        </div>

        <div style={{ padding:'14px 16px', background:c.bg, border:`1px solid ${c.cor}40`, borderRadius:10, display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <span style={{ fontSize:36, fontWeight:900, color:c.cor }}>{preview.toFixed(1)}</span>
          <div style={{ fontSize:13, fontWeight:700, color:c.cor }}>Score calculado</div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar score'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL SCORE TRIMESTRAL — LIVRARIA ──────────────────────
function ModalScoreTrimestralLivraria({ livraria, score, onSave, onClose }) {
  const hoje = new Date()
  const trimestresOpcoes = getTrimestresDisponiveis(8)
  const [trimestre, setTrimestre] = useState(score?.trimestre || trimestreAtual())
  const [ano, setAno] = useState(score?.ano || hoje.getFullYear())
  const [promocoes, setPromocoes] = useState([])
  const [form, setForm] = useState({
    vendas: score?.vendas || 0,
    vendas_nao_aplica: score?.vendas_nao_aplica || false,
    participacao_promocao: score?.participacao_promocao || 'nao_aplica',
    qtd_promocoes: score?.qtd_promocoes || 0,
    promocoes_ids: score?.promocoes_ids || [],
    promocoes_nao_aplica: score?.promocoes_nao_aplica || false,
    semanas_previstas: score?.semanas_previstas || 0,
    semanas_postou_feed: score?.semanas_postou_feed || 0,
    semanas_postou_story: score?.semanas_postou_story || 0,
    publicacoes_nao_aplica: score?.publicacoes_nao_aplica || false,
    comunicacao: score?.comunicacao || 'nao_aplica',
    observacao: score?.observacao || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { getCalendarioPromocoes().then(setPromocoes).catch(console.error) }, [])

  const { score: preview, classificacao } = calcularScoreTrimestralLivraria(form)
  const corCls = corClassificacao(classificacao)

  const OPCOES_PARTICIPACAO = [
    { value:'confirmou', label:'Confirmou' },
    { value:'recusou', label:'Recusou' },
    { value:'sem_retorno', label:'Sem retorno' },
    { value:'nao_aplica', label:'Não se aplica' },
  ]
  const OPCOES_COMUNICACAO = [
    { value:'sempre', label:'Sempre responde' },
    { value:'as_vezes', label:'Às vezes responde' },
    { value:'nao_responde', label:'Não responde' },
    { value:'nao_aplica', label:'Não se aplica' },
  ]

  function togglePromocao(id) {
    setForm(f => ({ ...f, promocoes_ids: f.promocoes_ids.includes(id) ? f.promocoes_ids.filter(x => x !== id) : [...f.promocoes_ids, id] }))
  }

  async function salvar() {
    setSaving(true)
    try { await onSave(livraria.id, ano, trimestre, form); onClose() }
    catch(e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:600, maxHeight:'92vh', overflowY:'auto' }}>
        <div className="modal-header"><div><h2 className="modal-title">Score trimestral — Livraria</h2><div style={{ fontSize:12, color:'var(--text-muted)' }}>{livraria.nome}</div></div><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button></div>

        {/* Trimestre */}
        <div className="form-group">
          <label className="form-label">Trimestre de referência</label>
          <select className="form-select" value={`${ano}-${trimestre}`} onChange={e => { const [a,t]=e.target.value.split('-'); setAno(Number(a)); setTrimestre(Number(t)) }}>
            {trimestresOpcoes.map(({ trimestre:t, ano:a }) => <option key={`${a}-${t}`} value={`${a}-${t}`}>{TRIMESTRES_LABEL[t]} / {a}</option>)}
          </select>
        </div>

        {/* Vendas */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Vendas <span style={{ color:'var(--accent)', fontWeight:400 }}>(35 pts)</span></div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.vendas_nao_aplica} onChange={e => setForm(f => ({ ...f, vendas_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.vendas_nao_aplica && (
            <div>
              <input className="form-input" type="number" min={0} value={form.vendas} onChange={e => setForm(f => ({ ...f, vendas:Number(e.target.value) }))} placeholder="Total de unidades vendidas no trimestre" />
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                Faixas: ≥300 → 35pts · ≥200 → 28pts · ≥100 → 21pts · ≥50 → 14pts · ≥1 → 7pts · 0 → 0pts
              </div>
            </div>
          )}
        </div>

        {/* Promoções */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Promoções <span style={{ color:'var(--accent)', fontWeight:400 }}>(20 pts)</span></div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.promocoes_nao_aplica} onChange={e => setForm(f => ({ ...f, promocoes_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.promocoes_nao_aplica && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Participação</label>
                <select className="form-select" value={form.participacao_promocao} onChange={e => setForm(f => ({ ...f, participacao_promocao:e.target.value }))}>
                  {OPCOES_PARTICIPACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quantas promoções participou?</label>
                <input className="form-input" type="number" min={0} value={form.qtd_promocoes} onChange={e => setForm(f => ({ ...f, qtd_promocoes:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quais promoções?</label>
                {promocoes.length === 0
                  ? <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', padding:'8px 0' }}>Nenhuma promoção cadastrada no calendário — será disponível após criar o calendário de promoções.</div>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                      {promocoes.map(p => {
                        const ativo = form.promocoes_ids.includes(p.id)
                        return (
                          <button key={p.id} type="button" onClick={() => togglePromocao(p.id)}
                            style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'2px solid var(--accent)', background:ativo?'var(--accent)':'transparent', color:ativo?'#fff':'var(--accent)', transition:'all 0.15s' }}>
                            {p.titulo}
                          </button>
                        )
                      })}
                    </div>
                }
              </div>
            </div>
          )}
        </div>

        {/* Publicações */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Publicações <span style={{ color:'var(--accent)', fontWeight:400 }}>(30 pts)</span></div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.publicacoes_nao_aplica} onChange={e => setForm(f => ({ ...f, publicacoes_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.publicacoes_nao_aplica && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas previstas</label>
                <input className="form-input" type="number" min={0} value={form.semanas_previstas} onChange={e => setForm(f => ({ ...f, semanas_previstas:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas c/ feed</label>
                <input className="form-input" type="number" min={0} value={form.semanas_postou_feed} onChange={e => setForm(f => ({ ...f, semanas_postou_feed:Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Semanas c/ story</label>
                <input className="form-input" type="number" min={0} value={form.semanas_postou_story} onChange={e => setForm(f => ({ ...f, semanas_postou_story:Number(e.target.value) }))} />
              </div>
              <div style={{ gridColumn:'1/-1', fontSize:11, color:'var(--text-muted)' }}>
                Considera postagem dentro da semana prevista. Faixas: ≥90% → 30pts · ≥70% → 22pts · ≥50% → 15pts · ≥30% → 8pts · &lt;30% → 0pts
              </div>
            </div>
          )}
        </div>

        {/* Comunicação */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Comunicação <span style={{ color:'var(--accent)', fontWeight:400 }}>(15 pts)</span></div>
          <select className="form-select" value={form.comunicacao} onChange={e => setForm(f => ({ ...f, comunicacao:e.target.value }))}>
            {OPCOES_COMUNICACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Observação */}
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} />
        </div>

        {/* Preview */}
        <div style={{ padding:'14px 16px', background:`${corCls}15`, border:`1px solid ${corCls}40`, borderRadius:10, display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
          <BadgeClasse cls={classificacao} />
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:corCls }}>{preview.toFixed(1)}%</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Score trimestral calculado</div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar score'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL SCORE TRIMESTRAL — EDITORA ──────────────────────
function ModalScoreTrimestralEditora({ editora, score, onSave, onClose }) {
  const hoje = new Date()
  const trimestresOpcoes = getTrimestresDisponiveis(8)
  const [trimestre, setTrimestre] = useState(score?.trimestre || trimestreAtual())
  const [ano, setAno] = useState(score?.ano || hoje.getFullYear())
  const [promocoes, setPromocoes] = useState([])
  const [form, setForm] = useState({
    vendas: score?.vendas || 0,
    vendas_nao_aplica: score?.vendas_nao_aplica || false,
    participacao_promocao: score?.participacao_promocao || 'nao_aplica',
    qtd_promocoes: score?.qtd_promocoes || 0,
    promocoes_ids: score?.promocoes_ids || [],
    promocoes_nao_aplica: score?.promocoes_nao_aplica || false,
    comunicacao: score?.comunicacao || 'nao_aplica',
    observacao: score?.observacao || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { getCalendarioPromocoes().then(setPromocoes).catch(console.error) }, [])

  const { score: preview, classificacao } = calcularScoreTrimestralEditora(form)
  const corCls = corClassificacao(classificacao)

  const OPCOES_PARTICIPACAO = [{ value:'confirmou', label:'Confirmou' },{ value:'recusou', label:'Recusou' },{ value:'sem_retorno', label:'Sem retorno' },{ value:'nao_aplica', label:'Não se aplica' }]
  const OPCOES_COMUNICACAO = [{ value:'sempre', label:'Sempre responde' },{ value:'as_vezes', label:'Às vezes responde' },{ value:'nao_responde', label:'Não responde' },{ value:'nao_aplica', label:'Não se aplica' }]

  function togglePromocao(id) { setForm(f => ({ ...f, promocoes_ids: f.promocoes_ids.includes(id) ? f.promocoes_ids.filter(x => x !== id) : [...f.promocoes_ids, id] })) }
  async function salvar() { setSaving(true); try { await onSave(editora.id, ano, trimestre, form); onClose() } catch(e){ console.error(e) } finally { setSaving(false) } }

  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:600, maxHeight:'92vh', overflowY:'auto' }}>
        <div className="modal-header"><div><h2 className="modal-title">Score trimestral — Editora</h2><div style={{ fontSize:12, color:'var(--text-muted)' }}>{editora.nome}</div></div><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button></div>

        <div className="form-group">
          <label className="form-label">Trimestre de referência</label>
          <select className="form-select" value={`${ano}-${trimestre}`} onChange={e => { const [a,t]=e.target.value.split('-'); setAno(Number(a)); setTrimestre(Number(t)) }}>
            {trimestresOpcoes.map(({ trimestre:t, ano:a }) => <option key={`${a}-${t}`} value={`${a}-${t}`}>{TRIMESTRES_LABEL[t]} / {a}</option>)}
          </select>
        </div>

        {/* Vendas */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Vendas <span style={{ color:'var(--accent)', fontWeight:400 }}>(80 pts)</span></div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.vendas_nao_aplica} onChange={e => setForm(f => ({ ...f, vendas_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.vendas_nao_aplica && <input className="form-input" type="number" min={0} value={form.vendas} onChange={e => setForm(f => ({ ...f, vendas:Number(e.target.value) }))} placeholder="Total de unidades vendidas no trimestre" />}
        </div>

        {/* Promoções */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>Promoções <span style={{ color:'var(--accent)', fontWeight:400 }}>(10 pts)</span></div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.promocoes_nao_aplica} onChange={e => setForm(f => ({ ...f, promocoes_nao_aplica:e.target.checked }))} style={{ accentColor:'var(--accent)' }} />
              Não se aplica
            </label>
          </div>
          {!form.promocoes_nao_aplica && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group" style={{ marginBottom:0 }}><label className="form-label">Participação</label><select className="form-select" value={form.participacao_promocao} onChange={e => setForm(f => ({ ...f, participacao_promocao:e.target.value }))}>{OPCOES_PARTICIPACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div className="form-group" style={{ marginBottom:0 }}><label className="form-label">Quantas promoções?</label><input className="form-input" type="number" min={0} value={form.qtd_promocoes} onChange={e => setForm(f => ({ ...f, qtd_promocoes:Number(e.target.value) }))} /></div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quais promoções?</label>
                {promocoes.length === 0
                  ? <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', padding:'8px 0' }}>Nenhuma promoção cadastrada ainda.</div>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>{promocoes.map(p => { const ativo=form.promocoes_ids.includes(p.id); return <button key={p.id} type="button" onClick={() => togglePromocao(p.id)} style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'2px solid var(--accent)', background:ativo?'var(--accent)':'transparent', color:ativo?'#fff':'var(--accent)', transition:'all 0.15s' }}>{p.titulo}</button> })}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Comunicação */}
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Comunicação <span style={{ color:'var(--accent)', fontWeight:400 }}>(10 pts)</span></div>
          <select className="form-select" value={form.comunicacao} onChange={e => setForm(f => ({ ...f, comunicacao:e.target.value }))}>{OPCOES_COMUNICACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </div>

        <div className="form-group"><label className="form-label">Observação (opcional)</label><textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} /></div>

        <div style={{ padding:'14px 16px', background:`${corCls}15`, border:`1px solid ${corCls}40`, borderRadius:10, display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
          <BadgeClasse cls={classificacao} />
          <div><div style={{ fontSize:24, fontWeight:900, color:corCls }}>{preview.toFixed(1)}%</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>Score trimestral calculado</div></div>
        </div>

        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar score'}</button></div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR VENDAS ──────────────────────────────────
function ModalImportarVendas({ tipo, periodo, onClose, onImported, showToast }) {
  const hoje = new Date()
  const trimestresOpcoes = getTrimestresDisponiveis(8)
  const mesesOpcoes = getMesesDisponiveis(24)
  const [trimestre, setTrimestre] = useState(trimestreAtual())
  const [mes, setMes] = useState(hoje.getMonth()+1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [importando, setImportando] = useState(false)
  const fileRef = useRef()
  const eMensal = periodo === 'mensal'

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    const col = tipo === 'livraria' ? 'livraria_nome' : 'editora_nome'
    const ws = XLSX.utils.aoa_to_sheet([[col, 'vendas'], [tipo === 'livraria' ? 'Nome da Livraria' : 'Nome da Editora', 150]])
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas')
    XLSX.writeFile(wb, `template_vendas_${tipo}_${eMensal?'mensal':'trimestral'}.xlsx`)
  }

  async function processarArquivo(file) {
    if (!file) return
    setImportando(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type:'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' })
      const fn = tipo === 'livraria' ? importarVendasLivraria : importarVendasEditora
      const resultado = eMensal
        ? await fn(rows, ano, null, mes)
        : await fn(rows, ano, trimestre)
      let msg = `${resultado.importados} registro(s) importado(s).`
      if (resultado.naoEncontrados.length > 0) msg += ` Não encontrados: ${resultado.naoEncontrados.join(', ')}.`
      showToast(msg, resultado.erros.length > 0 ? 'error' : 'success')
      onImported()
      onClose()
    } catch(e) { showToast('Erro ao importar: ' + e.message, 'error') } finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar vendas {eMensal?'mensais':'trimestrais'} — {tipo === 'livraria' ? 'Livrarias' : 'Editoras'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {eMensal ? (
          <div className="form-group">
            <label className="form-label">Mês de referência</label>
            <select className="form-select" value={`${ano}-${mes}`} onChange={e => { const [a,m]=e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)) }}>
              {mesesOpcoes.map(({ mes:m, ano:a }) => <option key={`${a}-${m}`} value={`${a}-${m}`}>{mesAnoLabel(m,a)}</option>)}
            </select>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Trimestre de referência</label>
            <select className="form-select" value={`${ano}-${trimestre}`} onChange={e => { const [a,t]=e.target.value.split('-'); setAno(Number(a)); setTrimestre(Number(t)) }}>
              {trimestresOpcoes.map(({ trimestre:t, ano:a }) => <option key={`${a}-${t}`} value={`${a}-${t}`}>{TRIMESTRES_LABEL[t]} / {a}</option>)}
            </select>
          </div>
        )}
        <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width:'100%', marginBottom:12, justifyContent:'center', gap:8 }}><Download size={14} /> Baixar template .xlsx</button>
        <div onClick={() => fileRef.current?.click()} style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'32px 20px', textAlign:'center', cursor:'pointer', background:'var(--surface-2)' }}>
          <FileSpreadsheet size={28} style={{ color:'var(--text-muted)', marginBottom:8 }} />
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>{importando ? 'Importando...' : 'Clique ou arraste o arquivo .xlsx'}</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f) processarArquivo(f); e.target.value='' }} />
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button></div>
      </div>
    </div>
  )
}

// ── ABA CLASSIFICAÇÃO ──────────────────────────────────────
function AbaClassificacao() {
  const [subAba, setSubAba] = useState('editoras')
  const [periodoAba, setPeriodoAba] = useState('mensal') // 'mensal' | 'trimestral'
  const [larguraColunaNome, setLarguraColunaNome] = useState(220)
  const [editoras, setEditoras] = useState([])
  const [livrarias, setLivrarias] = useState([])
  const [scoresEdMensal, setScoresEdMensal] = useState([])
  const [scoresLivMensal, setScoresLivMensal] = useState([])
  const [scoresEdTri, setScoresEdTri] = useState([])
  const [scoresLivTri, setScoresLivTri] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalEdMensal, setModalEdMensal] = useState(null)
  const [modalLivMensal, setModalLivMensal] = useState(null)
  const [modalEdTri, setModalEdTri] = useState(null)
  const [modalLivTri, setModalLivTri] = useState(null)
  const [modalImportar, setModalImportar] = useState(null)
  const [toast, showToast] = useToast()
  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const ano = hoje.getFullYear()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getEditorasParceirasAtivas(), getLivrariasParceirasAtivas(),
      getAllScoreEditorasMes(ano, mes), getAllScoreLivrariasMes(ano, mes),
      getScoreTrimestralEditoras(ano), getScoreTrimestralLivrarias(ano),
    ]).then(([eds, livs, sEdM, sLivM, sEdT, sLivT]) => {
      setEditoras(eds); setLivrarias(livs)
      setScoresEdMensal(sEdM); setScoresLivMensal(sLivM)
      setScoresEdTri(sEdT); setScoresLivTri(sLivT)
    }).finally(() => setLoading(false))
  }, [ano, mes])

  const mapEdMensal = {}; for (const s of scoresEdMensal) mapEdMensal[s.editora_id] = s
  const mapLivMensal = {}; for (const s of scoresLivMensal) mapLivMensal[s.livraria_id] = s
  const triAtual = trimestreAtual()
  const mapEdTri = {}; for (const s of scoresEdTri) { if (s.trimestre === triAtual) mapEdTri[s.editora_id] = s }
  const mapLivTri = {}; for (const s of scoresLivTri) { if (s.trimestre === triAtual) mapLivTri[s.livraria_id] = s }

  const mesesColunas = useMemo(() => getMesesDisponiveis(6).reverse(), [])
  const triColunas = useMemo(() => getTrimestresDisponiveis(4).reverse(), [])

  function iniciarResize(e) {
    e.preventDefault()
    const startX = e.clientX
    const startW = larguraColunaNome
    function onMove(ev) { setLarguraColunaNome(Math.max(120, Math.min(400, startW + ev.clientX - startX))) }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const editorasFiltradas = editoras.filter(e => !search || e.nome.toLowerCase().includes(search.toLowerCase()))
  const livrariasFiltradas = livrarias.filter(l => !search || l.nome.toLowerCase().includes(search.toLowerCase()))

  function tabStyle(ativa) { return { padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', border:'none', borderBottom:ativa?'2px solid var(--accent)':'2px solid transparent', background:'transparent', color:ativa?'var(--accent)':'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6 } }

  async function recarregarTri() {
    const [sEdT, sLivT] = await Promise.all([getScoreTrimestralEditoras(ano), getScoreTrimestralLivrarias(ano)])
    setScoresEdTri(sEdT); setScoresLivTri(sLivT)
  }

  return (
    <div>
      {/* Sub-abas Editoras / Livrarias */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:16 }}>
        <button style={tabStyle(subAba==='editoras')} onClick={() => setSubAba('editoras')}><Building2 size={13} /> Editoras</button>
        <button style={tabStyle(subAba==='livrarias')} onClick={() => setSubAba('livrarias')}><Library size={13} /> Livrarias</button>
      </div>

      {/* Mensal / Trimestral + busca + importar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <button onClick={() => setPeriodoAba('mensal')} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, background:periodoAba==='mensal'?'var(--accent)':'transparent', color:periodoAba==='mensal'?'#fff':'var(--text-muted)', fontWeight:600 }}>Mensal</button>
          <button onClick={() => setPeriodoAba('trimestral')} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, background:periodoAba==='trimestral'?'var(--accent)':'transparent', color:periodoAba==='trimestral'?'#fff':'var(--text-muted)', fontWeight:600 }}>Trimestral</button>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flex:1, minWidth:200 }}>
          <div style={{ position:'relative', flex:1 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft:32, width:'100%' }} placeholder={`Buscar ${subAba==='editoras'?'editora':'livraria'}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setModalImportar(subAba==='livrarias'?'livraria':'editora')} style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
            <Upload size={13} /> Importar vendas
          </button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div style={{ overflowX:'auto' }}>
          {/* MENSAL */}
          {periodoAba === 'mensal' && (
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 + mesesColunas.length * 90 }}>
              <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', position:'sticky', left:0, background:'var(--surface)', zIndex:2, width:larguraColunaNome, minWidth:120, maxWidth:400 }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><span>{subAba==='editoras'?'Editora':'Livraria'}</span><div onMouseDown={iniciarResize} style={{ width:6, height:16, cursor:'col-resize', background:'var(--border)', borderRadius:3, flexShrink:0, marginLeft:8, opacity:0.6 }} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.6'} /></div></th>
                <th style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', minWidth:80 }}>Registrar</th>
                {mesesColunas.map(({ mes:m, ano:a }) => <th key={`${a}-${m}`} style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', minWidth:80 }}>{mesAnoLabel(m,a)}</th>)}
              </tr></thead>
              <tbody>
                {subAba === 'editoras' && editorasFiltradas.map(e => {
                  const s = mapEdMensal[e.id]
                  return <tr key={e.id} style={{ borderBottom:'1px solid var(--border)' }} onMouseEnter={el => el.currentTarget.style.background='var(--surface-2)'} onMouseLeave={el => el.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 14px', position:'sticky', left:0, background:'var(--surface)', zIndex:1, width:larguraColunaNome, maxWidth:400 }}><div style={{ fontWeight:700, fontSize:13 }}>{e.nome}</div>{e.classificacao&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>Classe {e.classificacao}</div>}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}><button className="btn btn-ghost btn-sm" onClick={() => setModalEdMensal({ editora:e, score:s })}><Plus size={12} /></button></td>
                    {mesesColunas.map(({ mes:m, ano:a }) => <td key={`${a}-${m}`} style={{ padding:'10px 14px', textAlign:'center' }}><CirculoScore nota={a===ano&&m===mes?s?.score:null} size={32} /></td>)}
                  </tr>
                })}
                {subAba === 'livrarias' && livrariasFiltradas.map(l => {
                  const s = mapLivMensal[l.id]
                  return <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }} onMouseEnter={el => el.currentTarget.style.background='var(--surface-2)'} onMouseLeave={el => el.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 14px', position:'sticky', left:0, background:'var(--surface)', zIndex:1, width:larguraColunaNome, maxWidth:400 }}><div style={{ fontWeight:700, fontSize:13 }}>{l.nome}</div>{l.editoras_parceiras?.nome&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>{l.editoras_parceiras.nome}</div>}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}><button className="btn btn-ghost btn-sm" onClick={() => setModalLivMensal({ livraria:l, score:s })}><Plus size={12} /></button></td>
                    {mesesColunas.map(({ mes:m, ano:a }) => <td key={`${a}-${m}`} style={{ padding:'10px 14px', textAlign:'center' }}><CirculoScore nota={a===ano&&m===mes?s?.score:null} size={32} /></td>)}
                  </tr>
                })}
              </tbody>
            </table>
          )}

          {/* TRIMESTRAL */}
          {periodoAba === 'trimestral' && (
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 + triColunas.length * 100 }}>
              <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', position:'sticky', left:0, background:'var(--surface)', zIndex:2, width:larguraColunaNome, minWidth:120, maxWidth:400 }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><span>{subAba==='editoras'?'Editora':'Livraria'}</span><div onMouseDown={iniciarResize} style={{ width:6, height:16, cursor:'col-resize', background:'var(--border)', borderRadius:3, flexShrink:0, marginLeft:8, opacity:0.6 }} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.6'} /></div></th>
                <th style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', minWidth:90 }}>Registrar</th>
                {triColunas.map(({ trimestre:t, ano:a }) => <th key={`${a}-${t}`} style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', minWidth:100 }}>{TRIMESTRES_LABEL[t].split(' ')[0]} {a}</th>)}
              </tr></thead>
              <tbody>
                {subAba === 'editoras' && editorasFiltradas.map(e => {
                  const sTri = mapEdTri[e.id]
                  return <tr key={e.id} style={{ borderBottom:'1px solid var(--border)' }} onMouseEnter={el => el.currentTarget.style.background='var(--surface-2)'} onMouseLeave={el => el.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 14px', position:'sticky', left:0, background:'var(--surface)', zIndex:1, width:larguraColunaNome, maxWidth:400 }}><div style={{ fontWeight:700, fontSize:13 }}>{e.nome}</div>{sTri?.classificacao&&<BadgeClasse cls={sTri.classificacao} />}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}><button className="btn btn-ghost btn-sm" onClick={() => setModalEdTri({ editora:e, score:sTri })}><Plus size={12} /></button></td>
                    {triColunas.map(({ trimestre:t, ano:a }) => {
                      const s = scoresEdTri.find(x => x.editora_id===e.id && x.trimestre===t && x.ano===a)
                      return <td key={`${a}-${t}`} style={{ padding:'10px 14px', textAlign:'center' }}>
                        {s ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}><BadgeClasse cls={s.classificacao} /><span style={{ fontSize:10, color:'var(--text-muted)' }}>{s.score?.toFixed(0)}%</span></div> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}
                      </td>
                    })}
                  </tr>
                })}
                {subAba === 'livrarias' && livrariasFiltradas.map(l => {
                  const sTri = mapLivTri[l.id]
                  return <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }} onMouseEnter={el => el.currentTarget.style.background='var(--surface-2)'} onMouseLeave={el => el.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 14px', position:'sticky', left:0, background:'var(--surface)', zIndex:1, width:larguraColunaNome, maxWidth:400 }}><div style={{ fontWeight:700, fontSize:13 }}>{l.nome}</div>{l.editoras_parceiras?.nome&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>{l.editoras_parceiras.nome}</div>}{sTri?.classificacao&&<BadgeClasse cls={sTri.classificacao} />}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}><button className="btn btn-ghost btn-sm" onClick={() => setModalLivTri({ livraria:l, score:sTri })}><Plus size={12} /></button></td>
                    {triColunas.map(({ trimestre:t, ano:a }) => {
                      const s = scoresLivTri.find(x => x.livraria_id===l.id && x.trimestre===t && x.ano===a)
                      return <td key={`${a}-${t}`} style={{ padding:'10px 14px', textAlign:'center' }}>
                        {s ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}><BadgeClasse cls={s.classificacao} /><span style={{ fontSize:10, color:'var(--text-muted)' }}>{s.score?.toFixed(0)}%</span></div> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}
                      </td>
                    })}
                  </tr>
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalEdMensal && <ModalScoreEditoraMensal editora={modalEdMensal.editora} score={modalEdMensal.score} onSave={async (id, a, m, d) => { const upd = await upsertScoreEditora(id, a, m, d); setScoresEdMensal(prev => { const ex=prev.find(s=>s.editora_id===id&&s.ano===a&&s.mes===m); return ex?prev.map(s=>s.editora_id===id?upd:s):[...prev,upd] }) }} onClose={() => setModalEdMensal(null)} />}
      {modalLivMensal && <ModalScoreLivrariatMensal livraria={modalLivMensal.livraria} score={modalLivMensal.score} onSave={async (id, a, m, d) => { const upd = await upsertScoreLivraria(id, a, m, d); setScoresLivMensal(prev => { const ex=prev.find(s=>s.livraria_id===id&&s.ano===a&&s.mes===m); return ex?prev.map(s=>s.livraria_id===id?upd:s):[...prev,upd] }) }} onClose={() => setModalLivMensal(null)} />}
      {modalEdTri && <ModalScoreTrimestralEditora editora={modalEdTri.editora} score={modalEdTri.score} onSave={async (id, a, t, d) => { await upsertScoreTrimestralEditora(id, a, t, d); await recarregarTri() }} onClose={() => setModalEdTri(null)} />}
      {modalLivTri && <ModalScoreTrimestralLivraria livraria={modalLivTri.livraria} score={modalLivTri.score} onSave={async (id, a, t, d) => { await upsertScoreTrimestralLivraria(id, a, t, d); await recarregarTri() }} onClose={() => setModalLivTri(null)} />}
      {modalImportar && <ModalImportarVendas tipo={modalImportar} periodo={periodoAba} onClose={() => setModalImportar(null)} onImported={periodoAba==='mensal'?async()=>{const [sEdM,sLivM]=await Promise.all([getAllScoreEditorasMes(ano,mes),getAllScoreLivrariasMes(ano,mes)]);setScoresEdMensal(sEdM);setScoresLivMensal(sLivM)}:recarregarTri} showToast={showToast} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function CRMEditorasParceiras() {
  const [aba, setAba] = useState('prospeccao')
  const [usuarios, setUsuarios] = useState([])
  const [toast, showToast] = useToast()

  useEffect(() => { getUsuarios().then(setUsuarios).catch(console.error) }, [])

  function tabStyle(ativa) { return { padding:'10px 20px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color:ativa?'var(--accent)':'var(--text-muted)', borderBottom:`2px solid ${ativa?'var(--accent)':'transparent'}`, marginBottom:-1, transition:'all 0.15s' } }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Building2 size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin:0 }}>CRM — Editoras Parceiras</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>Prospecção, parceiros ativos e classificação</p>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid var(--border)' }}>
        {[{ v:'prospeccao', l:'Prospecção' },{ v:'ativos', l:'Parceiros ativos' },{ v:'desempenho', l:'Desempenho' },{ v:'classificacao', l:'Classificação' }].map(({ v, l }) => (
          <button key={v} onClick={() => setAba(v)} style={tabStyle(aba===v)}>{l}</button>
        ))}
      </div>
      {aba === 'prospeccao' && <AbaProspeccao pipeline={PIPELINE_EDITORAS} usuarios={usuarios} showToast={showToast} />}
      {aba === 'ativos' && <AbaParceirosAtivos />}
      {aba === 'desempenho' && <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}><BarChart2 size={40} style={{ opacity:0.3, marginBottom:12 }} /><p style={{ fontSize:14 }}>Em desenvolvimento</p></div>}
      {aba === 'classificacao' && <AbaClassificacao />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
