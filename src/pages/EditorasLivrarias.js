import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasCompletas, createEditora, updateEditora, desativarEditora, desativarEditorasLote, importarEditorasPlanilha,
  getLivrarias, createLivraria, updateLivraria, desativarLivraria, desativarLivrariaLote, importarLivrariasPlanilha,
  GRUPOS, STATUS_PARCERIA, STATUS_LIVRARIA,
} from '../lib/editoras-livrarias'
import { BookOpen, Plus, X, Upload, Pencil, Trash2, FileSpreadsheet, Building2, Library, LayoutGrid, Settings2, ChevronDown, Check } from 'lucide-react'
import * as XLSX from 'xlsx'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

const STATUS_COR = {
  ativa:        { cor: '#22c55e', bg: '#22c55e18', label: 'Ativa' },
  em_analise:   { cor: '#6366f1', bg: '#6366f118', label: 'Em análise' },
  encerramento: { cor: '#ef4444', bg: '#ef444418', label: 'Encerramento' },
  finalizada:   { cor: '#6b7280', bg: '#6b728018', label: 'Finalizada' },
  pendente:     { cor: '#f59e0b', bg: '#f59e0b18', label: 'Pendente' },
}
const CLASS_COR = { A:'#22c55e', B:'#84cc16', C:'#f59e0b', D:'#fb923c', E:'#ef4444', F:'#6b7280' }
function getStatusSafe(s) {
  if (!s) return STATUS_COR['ativa']
  const norm = s.toLowerCase().replace(/\s+/g, '_').replace(/[áà]/g, 'a').replace(/[éê]/g, 'e').replace(/[íî]/g, 'i').replace(/[óô]/g, 'o').replace(/[úû]/g, 'u')
  return STATUS_COR[norm] || STATUS_COR[s.toLowerCase()] || STATUS_COR['ativa']
}

const TODAS_COLUNAS_EDITORAS = [
  { key: 'classificacao',  label: 'Class.',        fixo: true },
  { key: 'nome',           label: 'Nome',           fixo: true },
  { key: 'livraria',       label: 'Livraria' },
  { key: 'macro',          label: 'Macro' },
  { key: 'nicho',          label: 'Nicho' },
  { key: 'sub_nicho',      label: 'Sub-nicho' },
  { key: 'posicionamento', label: 'Posicionamento' },
  { key: 'grupo_id',       label: 'Grupo' },
  { key: 'status_parceria',label: 'Status' },
  { key: 'instagram',      label: 'Instagram' },
  { key: 'youtube',        label: 'YouTube' },
  { key: 'contato',        label: 'Contato' },
  { key: 'email',          label: 'E-mail' },
  { key: 'tem_grupo',      label: 'Tem grupo WA?' },
  { key: 'selos',          label: 'Selos' },
]

const TODAS_COLUNAS_LIVRARIAS = [
  { key: 'nome',        label: 'Livraria',         fixo: true },
  { key: 'editora',     label: 'Editora vinculada', fixo: true },
  { key: 'contato',     label: 'Contato' },
  { key: 'site',        label: 'Site' },
  { key: 'instagram',   label: 'Instagram' },
  { key: 'youtube',     label: 'YouTube' },
  { key: 'inauguracao', label: 'Inauguração' },
  { key: 'observacao',  label: 'Observação' },
  { key: 'status',      label: 'Status' },
]

const VISIVEIS_DEFAULT_EDITORAS = ['classificacao','nome','livraria','macro','nicho','sub_nicho','posicionamento','grupo_id','status_parceria']
const VISIVEIS_DEFAULT_LIVRARIAS = ['nome','editora','contato','site','instagram','youtube','inauguracao','observacao','status']

// ── SELETOR DE COLUNAS ─────────────────────────────────────
function SeletorColunas({ colunas, ordem, onOrdemChange, visiveis, onVisiveisChange, onClose }) {
  const ref = useRef(null)
  const dragIdx = useRef(null)
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const naoFixas = ordem.map(k => colunas.find(c => c.key === k)).filter(c => c && !c.fixo)

  function onDragStart(e, idx) { dragIdx.current = idx; setDrag(idx); e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    const nova = [...naoFixas]; const [item] = nova.splice(dragIdx.current, 1); nova.splice(idx, 0, item)
    dragIdx.current = idx
    const fixas = ordem.filter(k => colunas.find(c => c.key === k)?.fixo)
    onOrdemChange([...fixas, ...nova.map(c => c.key)])
  }
  function onDragEnd() { dragIdx.current = null; setDrag(null) }

  return (
    <div ref={ref} style={{ position:'absolute', top:36, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:12, zIndex:100, minWidth:240, boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8 }}>Colunas visíveis · arraste para reordenar</div>
      {naoFixas.map((col, idx) => (
        <div key={col.key} draggable onDragStart={e => onDragStart(e, idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderRadius:6, background: drag === idx ? 'var(--surface-2)' : 'transparent', cursor:'grab', userSelect:'none' }}>
          <span style={{ color:'var(--text-muted)', fontSize:13 }}>⠿</span>
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', flex:1, fontSize:13 }}>
            <input type="checkbox" checked={visiveis.includes(col.key)}
              onChange={e => e.target.checked ? onVisiveisChange([...visiveis, col.key]) : onVisiveisChange(visiveis.filter(k => k !== col.key))}
              style={{ accentColor:'var(--accent)', cursor:'pointer', width:14, height:14 }} />
            <span style={{ color:'var(--text)' }}>{col.label}</span>
          </label>
        </div>
      ))}
    </div>
  )
}

// ── FILTRO EXCEL ───────────────────────────────────────────
function FiltroExcel({ valores, selecionados, onConfirm, onClose }) {
  const ref = useRef(null)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(() => new Set(selecionados?.length ? selecionados : valores))

  useEffect(() => {
    const t = setTimeout(() => {
      function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
      document.addEventListener('mousedown', h)
      return () => document.removeEventListener('mousedown', h)
    }, 150)
    return () => clearTimeout(t)
  }, [onClose])

  const filtrados = valores.filter(v => String(v).toLowerCase().includes(busca.toLowerCase()))
  const todosSel = filtrados.length > 0 && filtrados.every(v => sel.has(v))

  return (
    <div ref={ref} onClick={e => e.stopPropagation()}
      style={{ position:'absolute', top:'100%', left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, zIndex:300, minWidth:200, maxWidth:280, boxShadow:'0 8px 24px rgba(0,0,0,0.25)', padding:8 }}>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar..." autoFocus
        style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:12, marginBottom:6, boxSizing:'border-box' }} />
      <div style={{ maxHeight:200, overflowY:'auto', marginBottom:6 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 4px', fontSize:12, cursor:'pointer', fontWeight:600 }}>
          <input type="checkbox" checked={todosSel}
            onChange={() => setSel(prev => { const n = new Set(prev); todosSel ? filtrados.forEach(v => n.delete(v)) : filtrados.forEach(v => n.add(v)); return n })}
            style={{ accentColor:'var(--accent)' }} />
          (Selecionar Tudo)
        </label>
        {filtrados.map(v => (
          <label key={v} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 4px', fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={sel.has(v)}
              onChange={() => setSel(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })}
              style={{ accentColor:'var(--accent)' }} />
            {v || '(vazio)'}
          </label>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onClose() }} style={{ fontSize:11 }}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); onConfirm([...sel]) }} style={{ fontSize:11 }}>OK</button>
      </div>
    </div>
  )
}

function ThFiltro({ label, colKey, dados, filtroAtivo, onFiltro }) {
  const [open, setOpen] = useState(false)
  const valores = [...new Set(dados.map(r => {
    if (colKey === 'grupo_id') return GRUPOS.find(g => g.id === r.grupo_id)?.romano || ''
    if (colKey === 'status_parceria' || colKey === 'status') return getStatusSafe(r[colKey]).label
    if (colKey === 'editora') return r.editora || ''
    const v = r[colKey]; return v != null ? String(v) : ''
  }).filter(v => v !== undefined))].sort()
  const ativo = filtroAtivo && filtroAtivo.length < valores.length

  return (
    <th onClick={() => setOpen(v => !v)}
      style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color: ativo ? 'var(--accent)' : 'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap', position:'relative', cursor:'pointer', userSelect:'none' }}>
      <span style={{ display:'flex', alignItems:'center', gap:4 }}>
        {label}
        <ChevronDown size={10} style={{ opacity:0.6 }} />
        {ativo && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />}
      </span>
      {open && (
        <FiltroExcel valores={valores} selecionados={filtroAtivo || valores}
          onConfirm={sel => { onFiltro(colKey, sel); setOpen(false) }}
          onClose={() => setOpen(false)} />
      )}
    </th>
  )
}

function Celula({ children, width = 140 }) {
  const texto = typeof children === 'string' ? children : undefined
  return (
    <td title={texto} style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text)', maxWidth:width, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
      {children != null && children !== '' ? children : <span style={{ color:'var(--border)' }}>—</span>}
    </td>
  )
}

function BarraSel({ selecionados, total, onTodos, onLimpar, onExcluir, excluindo }) {
  if (!selecionados) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', background:'var(--accent-glow)', border:'1px solid var(--accent)', borderRadius:8, marginBottom:12 }}>
      <span style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>{selecionados} selecionado{selecionados !== 1 ? 's' : ''}</span>
      <button className="btn btn-ghost btn-sm" onClick={onTodos} style={{ fontSize:12 }}>Selecionar todos ({total})</button>
      <button className="btn btn-ghost btn-sm" onClick={onLimpar} style={{ fontSize:12 }}>Limpar</button>
      <button onClick={onExcluir} disabled={excluindo}
        style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', border:'none', borderRadius:6, padding:'5px 14px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
        <Trash2 size={12} /> {excluindo ? 'Removendo...' : `Remover ${selecionados}`}
      </button>
    </div>
  )
}

// ── MODAIS ─────────────────────────────────────────────────
function ModalEditora({ editora, onSave, onClose }) {
  const empty = { nome:'', instagram:'', youtube:'', contato:'', email:'', tem_grupo:false, macro:'', nicho:'', sub_nicho:'', posicionamento:'', grupo_id:'', status_parceria:'ativa', selos:[] }
  const [form, setForm] = useState(editora ? { ...editora, selos: editora.selos_editoriais?.map(s => s.nome) || [], grupo_id: editora.grupo_id ?? '' } : empty)
  const [novoSelo, setNovoSelo] = useState('')
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function addSelo() { const s = novoSelo.trim(); if (!s || form.selos.includes(s)) return; setForm(f => ({ ...f, selos: [...f.selos, s] })); setNovoSelo('') }
  function rmSelo(s) { setForm(f => ({ ...f, selos: f.selos.filter(x => x !== s) })) }
  async function salvar() {
    if (!form.nome.trim()) return; setSaving(true)
    try { await onSave({ ...form, grupo_id: form.grupo_id !== '' ? Number(form.grupo_id) : null }); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const inp = (label, key, type = 'text') => (
    <div className="form-group"><label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[key] ?? ''} placeholder={label} onChange={e => set(key, e.target.value)} /></div>
  )
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{editora ? 'Editar editora' : 'Nova editora'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
          {inp('Nome *', 'nome')}
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={form.status_parceria} onChange={e => set('status_parceria', e.target.value)}>
              {STATUS_PARCERIA.map(s => <option key={s} value={s}>{STATUS_COR[s]?.label || s}</option>)}
            </select></div>
          {inp('Instagram', 'instagram')} {inp('YouTube', 'youtube')}
          {inp('Contato', 'contato')} {inp('E-mail', 'email', 'email')}
          {inp('Macro', 'macro')} {inp('Nicho', 'nicho')}
          {inp('Sub-nicho', 'sub_nicho')} {inp('Posicionamento', 'posicionamento')}
          <div className="form-group"><label className="form-label">Grupo</label>
            <select className="form-select" value={form.grupo_id ?? ''} onChange={e => set('grupo_id', e.target.value)}>
              <option value="">—</option>
              {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.romano} · {g.label}</option>)}
            </select></div>
          <div className="form-group" style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
            <label className="form-label" style={{ margin:0 }}>Tem grupo de WhatsApp?</label>
            <input type="checkbox" checked={!!form.tem_grupo} onChange={e => set('tem_grupo', e.target.checked)}
              style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--accent)' }} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop:8 }}>
          <label className="form-label">Selos editoriais</label>
          <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            {form.selos.map(s => (
              <span key={s} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:'var(--accent-glow)', border:'1px solid var(--accent)', borderRadius:20, fontSize:12, color:'var(--accent)' }}>
                {s}<button onClick={() => rmSelo(s)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'var(--accent)', display:'flex' }}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input className="form-input" value={novoSelo} onChange={e => setNovoSelo(e.target.value)}
              placeholder="Nome do selo" onKeyDown={e => e.key === 'Enter' && addSelo()} style={{ flex:1 }} />
            <button className="btn btn-ghost btn-sm" onClick={addSelo}><Plus size={13} /> Adicionar</button>
          </div>
        </div>
        <div className="form-actions" style={{ marginTop:16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function ModalLivraria({ livraria, editoras, onSave, onClose }) {
  const empty = { nome:'', editora_id:'', contato:'', site:'', instagram:'', youtube:'', inauguracao:'', observacao:'', status:'ativa' }
  const [form, setForm] = useState(livraria ? { ...livraria, editora_id: livraria.editora_id ?? '', inauguracao: livraria.inauguracao ?? '' } : empty)
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  async function salvar() {
    if (!form.nome.trim()) return; setSaving(true)
    try { await onSave({ ...form, editora_id: form.editora_id || null, inauguracao: form.inauguracao || null }); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{livraria ? 'Editar livraria' : 'Nova livraria'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome da livraria" />
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Editora vinculada</label>
            <select className="form-select" value={form.editora_id} onChange={e => set('editora_id', e.target.value)}>
              <option value="">—</option>
              {editoras.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Contato</label><input className="form-input" value={form.contato ?? ''} onChange={e => set('contato', e.target.value)} placeholder="Nome" /></div>
          <div className="form-group"><label className="form-label">Site</label><input className="form-input" value={form.site ?? ''} onChange={e => set('site', e.target.value)} placeholder="https://" /></div>
          <div className="form-group"><label className="form-label">Instagram</label><input className="form-input" value={form.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@livraria" /></div>
          <div className="form-group"><label className="form-label">YouTube</label><input className="form-input" value={form.youtube ?? ''} onChange={e => set('youtube', e.target.value)} placeholder="@canal" /></div>
          <div className="form-group"><label className="form-label">Inauguração</label><input className="form-input" type="date" value={form.inauguracao ?? ''} onChange={e => set('inauguracao', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={form.status || 'ativa'} onChange={e => set('status', e.target.value)}>
              {STATUS_LIVRARIA.map(s => <option key={s} value={s}>{STATUS_COR[s]?.label || s}</option>)}
            </select></div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Observação</label>
            <textarea className="form-textarea" rows={2} value={form.observacao ?? ''} onChange={e => set('observacao', e.target.value)} placeholder="Observações" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function ModalImportar({ tipo, editoras, onClose, onImported }) {
  const fileRef = useRef()
  const [linhas, setLinhas] = useState([])
  const [etapa, setEtapa] = useState('upload')
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState(null)

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    if (tipo === 'editora') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nome','Livraria (nome ou - se não tiver)','Macro','Nicho','Sub-nicho','Posicionamento','Grupo (I a VIII)','Status (ativa/Encerramento/pendente)'],
        ['Editora Exemplo','-','Catolicismo','Formação católica','Espiritualidade','Conservadora','III','ativa'],
      ])
      ws['!cols'] = [28,24,16,28,24,18,14,16].map(w => ({ wch:w }))
      XLSX.utils.book_append_sheet(wb, ws, 'Editoras')
      XLSX.writeFile(wb, 'template_editoras.xlsx')
    } else {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nome Livraria','Editora (nome exato)','Contato','Site','Instagram','YouTube','Data Inauguração (dd/mm/aaaa)','Observação','Status'],
        ['Livraria Exemplo','Editora Exemplo','Maria Lima','https://livraria.com','@livraria','@canal','15/03/2024','','ativa'],
      ])
      ws['!cols'] = [24,24,16,24,14,14,22,24,12].map(w => ({ wch:w }))
      XLSX.utils.book_append_sheet(wb, ws, 'Livrarias')
      XLSX.writeFile(wb, 'template_livrarias.xlsx')
    }
  }

  function processar(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
      setLinhas(rows.slice(1).filter(r => r[0]?.toString().trim()))
      setEtapa('revisao')
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmar() {
    setImportando(true); setErro(null)
    try {
      if (tipo === 'editora') await importarEditorasPlanilha(linhas)
      else await importarLivrariasPlanilha(linhas, editoras)
      onImported(); onClose()
    } catch (e) {
      console.error(e)
      setErro('Erro ao importar: ' + (e?.message || 'Verifique os dados e tente novamente.'))
    } finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar {tipo === 'editora' ? 'editoras' : 'livrarias'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {etapa === 'upload' && (
          <div>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>Baixe o template, preencha e faça o upload.</p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width:'100%', marginBottom:12, justifyContent:'center' }}>
              <FileSpreadsheet size={14} /> Baixar template .xlsx
            </button>
            <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processar(f) }}
              style={{ border:'2px dashed var(--border)', borderRadius:12, padding:'36px 20px', textAlign:'center', cursor:'pointer', background:'var(--surface-2)' }}>
              <Upload size={28} style={{ color:'var(--text-muted)', marginBottom:8 }} />
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Clique ou arraste o arquivo .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} />
            </div>
          </div>
        )}
        {etapa === 'revisao' && (
          <div>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>{linhas.length} registro{linhas.length !== 1 ? 's' : ''} encontrado{linhas.length !== 1 ? 's' : ''}:</p>
            <div style={{ maxHeight:280, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8, marginBottom:16 }}>
              {linhas.map((l, i) => (
                <div key={i} style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', fontSize:13, display:'flex', gap:12 }}>
                  <span style={{ fontWeight:600, color:'var(--text)', flex:1 }}>{l[0]}</span>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmar} disabled={importando}>{importando ? 'Importando...' : `Importar ${linhas.length}`}</button>
            </div>
            {erro && <div style={{ marginTop:10, padding:'8px 12px', background:'#ef444418', border:'1px solid #ef4444', borderRadius:8, fontSize:12, color:'#ef4444' }}>{erro}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TABELA GENÉRICA ────────────────────────────────────────
function TabelaLinhas({ colsAtivas, lista, dados, selecionados, toggleSel, renderCelula, isAdmin, onEditar, onExcluir, larguras }) {
  return (
    <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'var(--surface-2)' }}>
            <th style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', width:36 }}>
              <input type="checkbox"
                checked={lista.length > 0 && lista.every(e => selecionados.has(e.id))}
                onChange={e => e.target.checked ? lista.forEach(x => selecionados.add(x.id)) : selecionados.clear()}
                style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
            </th>
            {colsAtivas}
            {isAdmin && <th style={{ padding:'8px 10px', borderBottom:'2px solid var(--border)', width:60 }}></th>}
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 ? (
            <tr><td colSpan={99} style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Nenhum registro encontrado.</td></tr>
          ) : lista.map((item, i) => {
            const sel = selecionados.has(item.id)
            return (
              <tr key={item.id}
                style={{ background: sel ? 'var(--accent-glow)' : i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)', transition:'background 0.1s' }}
                onMouseEnter={el => { if (!sel) el.currentTarget.style.background = 'var(--accent-glow)' }}
                onMouseLeave={el => { if (!sel) el.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleSel(item.id)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
                </td>
                {renderCelula(item, i)}
                {isAdmin && (
                  <td style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => onEditar(item)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Pencil size={12} /></button>
                      <button onClick={() => onExcluir(item)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', opacity:0.5 }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── ABA EDITORAS ───────────────────────────────────────────
function AbaEditoras({ editoras, livrarias, setEditoras, isAdmin, showToast }) {
  const [ordem, setOrdem] = useState(TODAS_COLUNAS_EDITORAS.map(c => c.key))
  const [visiveis, setVisiveis] = useState(VISIVEIS_DEFAULT_EDITORAS)
  const [showColSel, setShowColSel] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [buscaNome, setBuscaNome] = useState('')
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [excluindo, setExcluindo] = useState(false)

  const livrariaPorEditora = {}
  for (const l of livrarias) { if (l.editora_id) livrariaPorEditora[l.editora_id] = l }

  const dados = editoras.map(e => ({ ...e, livraria: livrariaPorEditora[e.id]?.nome || '' }))

  const colDefs = ordem
    .map(k => TODAS_COLUNAS_EDITORAS.find(c => c.key === k))
    .filter(c => c && (c.fixo || visiveis.includes(c.key)))

  const lista = dados.filter(e => {
    if (buscaNome && !e.nome?.toLowerCase().includes(buscaNome.toLowerCase())) return false
    for (const [col, vals] of Object.entries(filtros)) {
      if (!vals?.length) continue
      let v = col === 'grupo_id' ? (GRUPOS.find(g => g.id === e.grupo_id)?.romano || '')
             : col === 'status_parceria' ? getStatusSafe(e.status_parceria).label
             : (e[col] != null ? String(e[col]) : '')
      if (!vals.includes(v) && !(vals.includes('(vazio)') && !v)) return false
    }
    return true
  })

  function toggleSel(id) { setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function excluirLote() {
    if (!window.confirm(`Remover ${sel.size} editora${sel.size !== 1 ? 's' : ''}?`)) return
    setExcluindo(true)
    try { await desativarEditorasLote([...sel]); setEditoras(prev => prev.filter(e => !sel.has(e.id))); setSel(new Set()); showToast('Editoras removidas!') }
    catch { showToast('Erro ao remover editoras.', 'error') } finally { setExcluindo(false) }
  }

  async function salvar(form) {
    try {
      if (modal === 'new') { const n = await createEditora(form); setEditoras(prev => [...prev, n]); showToast('Editora cadastrada!') }
      else { const u = await updateEditora(modal.id, form); setEditoras(prev => prev.map(e => e.id === u.id ? u : e)); showToast('Editora atualizada!') }
    } catch { showToast('Erro ao salvar editora.', 'error') }
  }

  async function excluir(e) {
    if (!window.confirm(`Remover ${e.nome}?`)) return
    try { await desativarEditora(e.id); setEditoras(prev => prev.filter(x => x.id !== e.id)); showToast('Editora removida!') }
    catch { showToast('Erro ao remover.', 'error') }
  }

  function renderCell(e) {
    return colDefs.map(c => {
      let content = null
      if (c.key === 'classificacao') content = e.classificacao ? <span style={{ fontWeight:800, color:CLASS_COR[e.classificacao]||'var(--accent)' }}>{e.classificacao}</span> : null
      else if (c.key === 'nome') content = e.nome
      else if (c.key === 'livraria') content = e.livraria || null
      else if (c.key === 'status_parceria') { const s = getStatusSafe(e.status_parceria); content = <span style={{ fontSize:11, fontWeight:700, color:s.cor, background:s.bg, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{s.label}</span> }
      else if (c.key === 'grupo_id') { const g = GRUPOS.find(x => x.id === e.grupo_id); content = g ? g.romano : null }
      else if (c.key === 'tem_grupo') content = e.tem_grupo ? '✓' : null
      else if (c.key === 'selos') content = e.selos_editoriais?.map(s => s.nome).join(', ') || null
      else if (c.key === 'instagram' && e.instagram) content = <a href={`https://instagram.com/${e.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{e.instagram}</a>
      else if (c.key === 'youtube' && e.youtube) content = <a href={e.youtube.startsWith('http') ? e.youtube : `https://youtube.com/${e.youtube}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{e.youtube}</a>
      else content = e[c.key] || null
      return <Celula key={c.key} width={c.key === 'nome' || c.key === 'livraria' ? 200 : c.key === 'grupo_id' || c.key === 'classificacao' ? 60 : 160}>{content}</Celula>
    })
  }

  const cabecalhos = colDefs.map(c => c.fixo
    ? <th key={c.key} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>
    : <ThFiltro key={c.key} label={c.label} colKey={c.key} dados={dados} filtroAtivo={filtros[c.key]} onFiltro={(col, vals) => setFiltros(f => ({ ...f, [col]: vals }))} />
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>{lista.length} editora{lista.length !== 1 ? 's' : ''}</span>
          {Object.values(filtros).some(v => v?.length) && <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({})} style={{ fontSize:11 }}><X size={11} /> Limpar filtros</button>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input value={buscaNome} onChange={e => setBuscaNome(e.target.value)} placeholder="Buscar nome..."
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, minWidth:160 }} />
          <div style={{ position:'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowColSel(v => !v)}><Settings2 size={13} /> Colunas</button>
            {showColSel && <SeletorColunas colunas={TODAS_COLUNAS_EDITORAS} ordem={ordem} onOrdemChange={setOrdem} visiveis={visiveis} onVisiveisChange={setVisiveis} onClose={() => setShowColSel(false)} />}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova editora</button>
          </>}
        </div>
      </div>
      <BarraSel selecionados={sel.size} total={lista.length}
        onTodos={() => setSel(new Set(lista.map(e => e.id)))} onLimpar={() => setSel(new Set())}
        onExcluir={excluirLote} excluindo={excluindo} />
      <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:'var(--surface-2)' }}>
            <th style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', width:36 }}>
              <input type="checkbox" checked={lista.length > 0 && lista.every(e => sel.has(e.id))}
                onChange={e => setSel(e.target.checked ? new Set(lista.map(x => x.id)) : new Set())}
                style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
            </th>
            {cabecalhos}
            {isAdmin && <th style={{ padding:'8px 10px', borderBottom:'2px solid var(--border)', width:60 }}></th>}
          </tr></thead>
          <tbody>
            {lista.length === 0 ? <tr><td colSpan={99} style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Nenhuma editora encontrada.</td></tr>
            : lista.map((e, i) => {
              const s = sel.has(e.id)
              return (
                <tr key={e.id} style={{ background: s ? 'var(--accent-glow)' : i%2===0 ? 'var(--surface)' : 'var(--surface-2)', transition:'background 0.1s' }}
                  onMouseEnter={el => { if (!s) el.currentTarget.style.background='var(--accent-glow)' }}
                  onMouseLeave={el => { if (!s) el.currentTarget.style.background = i%2===0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                    <input type="checkbox" checked={s} onChange={() => toggleSel(e.id)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
                  </td>
                  {renderCell(e)}
                  {isAdmin && <td style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setModal(e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Pencil size={12} /></button>
                      <button onClick={() => excluir(e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', opacity:0.5 }}><Trash2 size={12} /></button>
                    </div>
                  </td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {modal && <ModalEditora editora={modal === 'new' ? null : modal} onSave={salvar} onClose={() => setModal(null)} />}
      {importar && <ModalImportar tipo="editora" editoras={editoras} onClose={() => setImportar(false)} onImported={async () => { setEditoras(await getEditorasCompletas()); showToast('Editoras importadas com sucesso!') }} />}
    </div>
  )
}

// ── ABA LIVRARIAS ──────────────────────────────────────────
function AbaLivrarias({ livrarias, setLivrarias, editoras, isAdmin, showToast }) {
  const [ordem, setOrdem] = useState(TODAS_COLUNAS_LIVRARIAS.map(c => c.key))
  const [visiveis, setVisiveis] = useState(VISIVEIS_DEFAULT_LIVRARIAS)
  const [showColSel, setShowColSel] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [buscaNome, setBuscaNome] = useState('')
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [excluindo, setExcluindo] = useState(false)

  const dados = livrarias.map(l => ({ ...l, editora: l.editoras_parceiras?.nome || '' }))

  const colDefs = ordem
    .map(k => TODAS_COLUNAS_LIVRARIAS.find(c => c.key === k))
    .filter(c => c && (c.fixo || visiveis.includes(c.key)))

  const lista = dados.filter(l => {
    if (buscaNome && !l.nome?.toLowerCase().includes(buscaNome.toLowerCase())) return false
    for (const [col, vals] of Object.entries(filtros)) {
      if (!vals?.length) continue
      const v = col === 'status' ? getStatusSafe(l.status).label : (l[col] != null ? String(l[col]) : '')
      if (!vals.includes(v) && !(vals.includes('(vazio)') && !v)) return false
    }
    return true
  })

  function toggleSel(id) { setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function excluirLote() {
    if (!window.confirm(`Remover ${sel.size} livraria${sel.size !== 1 ? 's' : ''}?`)) return
    setExcluindo(true)
    try { await desativarLivrariaLote([...sel]); setLivrarias(prev => prev.filter(l => !sel.has(l.id))); setSel(new Set()); showToast('Livrarias removidas!') }
    catch { showToast('Erro ao remover livrarias.', 'error') } finally { setExcluindo(false) }
  }

  async function salvar(form) {
    try {
      if (modal === 'new') { const n = await createLivraria(form); setLivrarias(prev => [...prev, n].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))); showToast('Livraria cadastrada!') }
      else { const u = await updateLivraria(modal.id, form); setLivrarias(prev => prev.map(l => l.id === u.id ? u : l)); showToast('Livraria atualizada!') }
    } catch { showToast('Erro ao salvar livraria.', 'error') }
  }

  async function excluir(l) {
    if (!window.confirm(`Remover ${l.nome}?`)) return
    try { await desativarLivraria(l.id); setLivrarias(prev => prev.filter(x => x.id !== l.id)); showToast('Livraria removida!') }
    catch { showToast('Erro ao remover.', 'error') }
  }

  function renderCell(l) {
    return colDefs.map(c => {
      let content = null
      if (c.key === 'nome') content = l.nome
      else if (c.key === 'editora') content = l.editora || null
      else if (c.key === 'site' && l.site) content = <a href={l.site.startsWith('http') ? l.site : `https://${l.site}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'underline' }}>🔗 {l.site}</a>
      else if (c.key === 'instagram' && l.instagram) content = <a href={`https://instagram.com/${l.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{l.instagram}</a>
      else if (c.key === 'youtube' && l.youtube) content = <a href={l.youtube.startsWith('http') ? l.youtube : `https://youtube.com/${l.youtube}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{l.youtube}</a>
      else if (c.key === 'inauguracao' && l.inauguracao) content = new Date(l.inauguracao + 'T12:00:00').toLocaleDateString('pt-BR')
      else if (c.key === 'status') { const s = getStatusSafe(l.status); content = <span style={{ fontSize:11, fontWeight:700, color:s.cor, background:s.bg, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{s.label}</span> }
      else content = l[c.key] || null
      return <Celula key={c.key} width={c.key === 'nome' || c.key === 'editora' ? 180 : c.key === 'observacao' ? 160 : c.key === 'site' ? 120 : c.key === 'status' ? 100 : c.key === 'inauguracao' ? 90 : 120}>{content}</Celula>
    })
  }

  const cabecalhos = colDefs.map(c => c.fixo
    ? <th key={c.key} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>
    : <ThFiltro key={c.key} label={c.label} colKey={c.key} dados={dados} filtroAtivo={filtros[c.key]} onFiltro={(col, vals) => setFiltros(f => ({ ...f, [col]: vals }))} />
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>{lista.length} livraria{lista.length !== 1 ? 's' : ''}</span>
          {Object.values(filtros).some(v => v?.length) && <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({})} style={{ fontSize:11 }}><X size={11} /> Limpar filtros</button>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input value={buscaNome} onChange={e => setBuscaNome(e.target.value)} placeholder="Buscar livraria..."
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, minWidth:160 }} />
          <div style={{ position:'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowColSel(v => !v)}><Settings2 size={13} /> Colunas</button>
            {showColSel && <SeletorColunas colunas={TODAS_COLUNAS_LIVRARIAS} ordem={ordem} onOrdemChange={setOrdem} visiveis={visiveis} onVisiveisChange={setVisiveis} onClose={() => setShowColSel(false)} />}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova livraria</button>
          </>}
        </div>
      </div>
      <BarraSel selecionados={sel.size} total={lista.length}
        onTodos={() => setSel(new Set(lista.map(l => l.id)))} onLimpar={() => setSel(new Set())}
        onExcluir={excluirLote} excluindo={excluindo} />
      <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:'var(--surface-2)' }}>
            <th style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', width:36 }}>
              <input type="checkbox" checked={lista.length > 0 && lista.every(l => sel.has(l.id))}
                onChange={e => setSel(e.target.checked ? new Set(lista.map(x => x.id)) : new Set())}
                style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
            </th>
            {cabecalhos}
            {isAdmin && <th style={{ padding:'8px 10px', borderBottom:'2px solid var(--border)', width:60 }}></th>}
          </tr></thead>
          <tbody>
            {lista.length === 0 ? <tr><td colSpan={99} style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Nenhuma livraria encontrada.</td></tr>
            : lista.map((l, i) => {
              const s = sel.has(l.id)
              return (
                <tr key={l.id} style={{ background: s ? 'var(--accent-glow)' : i%2===0 ? 'var(--surface)' : 'var(--surface-2)' }}
                  onMouseEnter={el => { if (!s) el.currentTarget.style.background='var(--accent-glow)' }}
                  onMouseLeave={el => { if (!s) el.currentTarget.style.background = i%2===0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                    <input type="checkbox" checked={s} onChange={() => toggleSel(l.id)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
                  </td>
                  {renderCell(l)}
                  {isAdmin && <td style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setModal(l)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Pencil size={12} /></button>
                      <button onClick={() => excluir(l)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', opacity:0.5 }}><Trash2 size={12} /></button>
                    </div>
                  </td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {modal && <ModalLivraria livraria={modal === 'new' ? null : modal} editoras={editoras} onSave={salvar} onClose={() => setModal(null)} />}
      {importar && <ModalImportar tipo="livraria" editoras={editoras} onClose={() => setImportar(false)} onImported={async () => { setLivrarias(await getLivrarias()); showToast('Livrarias importadas com sucesso!') }} />}
    </div>
  )
}

// ── ABA GRUPOS ─────────────────────────────────────────────
function AbaGrupos({ editoras, livrarias }) {
  const [gruposLocais, setGruposLocais] = useState(GRUPOS.map(g => ({ ...g })))
  const [editandoId, setEditandoId] = useState(null)
  const [labelEdit, setLabelEdit] = useState('')

  const livrariaPorEditora = {}
  for (const l of livrarias) { if (l.editora_id) livrariaPorEditora[l.editora_id] = l }

  function iniciarEdicao(g) { setEditandoId(g.id); setLabelEdit(g.label) }
  function salvarEdicao(id) {
    setGruposLocais(prev => prev.map(g => g.id === id ? { ...g, label: labelEdit } : g))
    setEditandoId(null)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
      {gruposLocais.map(grupo => {
        const eds = editoras.filter(e => e.grupo_id === grupo.id)
        const comLiv = eds.filter(e => livrariaPorEditora[e.id]).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))
        const semLiv = eds.filter(e => !livrariaPorEditora[e.id]).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))

        return (
          <div key={grupo.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              {editandoId === grupo.id ? (
                <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>{grupo.romano} -</span>
                  <input value={labelEdit} onChange={e => setLabelEdit(e.target.value)}
                    autoFocus onKeyDown={e => e.key === 'Enter' && salvarEdicao(grupo.id)}
                    style={{ flex:1, padding:'2px 6px', borderRadius:4, border:'1px solid var(--accent)', background:'var(--surface)', color:'var(--text)', fontSize:12 }} />
                  <button onClick={() => salvarEdicao(grupo.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', display:'flex' }}><Check size={14} /></button>
                  <button onClick={() => setEditandoId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={14} /></button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{grupo.romano} - {grupo.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                    <button onClick={() => iniciarEdicao(grupo)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:0 }}><Pencil size={12} /></button>
                    <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--surface-3)', padding:'2px 8px', borderRadius:20 }}>{eds.length}</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding:'8px 0' }}>
              {eds.length === 0 ? (
                <div style={{ padding:'12px 16px', fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>Nenhuma editora neste grupo.</div>
              ) : (
                <>
                  {comLiv.map(e => (
                    <div key={e.id} style={{ padding:'7px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)', background:'var(--accent-glow)' }}>
                      {e.classificacao && <span style={{ fontSize:11, fontWeight:800, color:CLASS_COR[e.classificacao]||'var(--accent)', minWidth:16 }}>{e.classificacao}</span>}
                      <span style={{ fontSize:12, color:'var(--text)', flex:1 }}>{e.nome}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:getStatusSafe(e.status_parceria).cor, background:getStatusSafe(e.status_parceria).bg, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>{getStatusSafe(e.status_parceria).label}</span>
                    </div>
                  ))}
                  {semLiv.map(e => (
                    <div key={e.id} style={{ padding:'7px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}>
                      {e.classificacao && <span style={{ fontSize:11, fontWeight:800, color:CLASS_COR[e.classificacao]||'var(--accent)', minWidth:16 }}>{e.classificacao}</span>}
                      <span style={{ fontSize:12, color:'var(--text)', flex:1 }}>{e.nome}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:getStatusSafe(e.status_parceria).cor, background:getStatusSafe(e.status_parceria).bg, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>{getStatusSafe(e.status_parceria).label}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function EditorasLivrarias() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente' || usuario?.perfil === 'supervisor_parceiras'
  const [aba, setAba] = useState('editoras')
  const [editoras, setEditoras] = useState([])
  const [livrarias, setLivrarias] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, showToast] = useToast()

  useEffect(() => {
    setLoading(true)
    Promise.all([getEditorasCompletas(), getLivrarias()])
      .then(([eds, livs]) => { setEditoras(eds); setLivrarias(livs) })
      .catch(() => showToast('Erro ao carregar dados.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  function tabStyle(ativa) {
    return { padding:'10px 24px', fontSize:13, fontWeight:700, cursor:'pointer', border:'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent', background:'transparent', color: ativa ? 'var(--accent)' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6 }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <BookOpen size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin:0 }}>Editoras & Livrarias</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{editoras.length} editoras · {livrarias.length} livrarias</p>
        </div>
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:24 }}>
        <button style={tabStyle(aba === 'editoras')} onClick={() => setAba('editoras')}><Building2 size={14} /> Editoras</button>
        <button style={tabStyle(aba === 'livrarias')} onClick={() => setAba('livrarias')}><Library size={14} /> Livrarias</button>
        <button style={tabStyle(aba === 'grupos')} onClick={() => setAba('grupos')}><LayoutGrid size={14} /> Grupos</button>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {aba === 'editoras' && <AbaEditoras editoras={editoras} livrarias={livrarias} setEditoras={setEditoras} isAdmin={isAdmin} showToast={showToast} />}
          {aba === 'livrarias' && <AbaLivrarias livrarias={livrarias} setLivrarias={setLivrarias} editoras={editoras} isAdmin={isAdmin} showToast={showToast} />}
          {aba === 'grupos' && <AbaGrupos editoras={editoras} livrarias={livrarias} />}
        </>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
