import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasCompletas, createEditora, updateEditora, desativarEditora, desativarEditorasLote, importarEditorasPlanilha,
  getLivrarias, createLivraria, updateLivraria, desativarLivraria, desativarLivrariaLote, importarLivrariasPlanilha,
  GRUPOS, STATUS_PARCERIA,
} from '../lib/editoras-livrarias'
import { BookOpen, Plus, X, Upload, Pencil, Trash2, FileSpreadsheet, Building2, Library, LayoutGrid, Settings2, ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

const STATUS_COR = {
  ativa:        { cor: '#22c55e', bg: '#22c55e18', label: 'Ativa' },
  encerramento: { cor: '#ef4444', bg: '#ef444418', label: 'Encerramento' },
  finalizada:   { cor: '#6b7280', bg: '#6b728018', label: 'Finalizada' },
  pendente:     { cor: '#f59e0b', bg: '#f59e0b18', label: 'Pendente' },
}

const CLASS_COR = { A:'#22c55e', B:'#84cc16', C:'#f59e0b', D:'#fb923c', E:'#ef4444', F:'#6b7280' }

function getStatusSafe(status) {
  return STATUS_COR[status?.toLowerCase()] || STATUS_COR['ativa']
}

// Todas as colunas possíveis para editoras
const TODAS_COLUNAS_EDITORAS = [
  { key: 'classificacao',  label: 'Class.',      fixo: true },
  { key: 'nome',           label: 'Nome',         fixo: true },
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

const COLUNAS_LIVRARIAS = [
  { key: 'nome',        label: 'Livraria',          fixo: true },
  { key: 'editora',     label: 'Editora vinculada',  fixo: true },
  { key: 'contato',     label: 'Contato' },
  { key: 'instagram',   label: 'Instagram' },
  { key: 'site',        label: 'Site' },
  { key: 'inauguracao', label: 'Inauguração' },
]

// Ordem e visibilidade padrão
const ORDEM_DEFAULT_EDITORAS = TODAS_COLUNAS_EDITORAS.map(c => c.key)
const VISIVEIS_DEFAULT_EDITORAS = ['classificacao','nome','livraria','macro','nicho','sub_nicho','posicionamento','grupo_id','status_parceria']
const ORDEM_DEFAULT_LIVRARIAS = COLUNAS_LIVRARIAS.map(c => c.key)
const VISIVEIS_DEFAULT_LIVRARIAS = ['nome','editora','contato','site','inauguracao']

function formatarTituloGrupo(romano, label) {
  const partes = label.split(/[;,\/]/).map(p => p.trim()).filter(Boolean)
  return `${romano} - ${partes.map(p => p.split(' ').join(' | ')).join(' · ')}`
}

// ── SELETOR DE COLUNAS COM DRAG ────────────────────────────
function SeletorColunas({ colunas, ordem, onOrdemChange, visiveis, onVisiveisChange, onClose }) {
  const ref = useRef(null)
  const dragIdx = useRef(null)
  const dragOverIdx = useRef(null)
  const [dragState, setDragState] = useState(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Todas as colunas não fixas na ordem atual
  const naoFixas = ordem
    .map(k => colunas.find(c => c.key === k))
    .filter(c => c && !c.fixo)

  function onDragStart(e, idx) {
    dragIdx.current = idx
    setDragState(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    dragOverIdx.current = idx
    const nova = [...naoFixas]
    const [item] = nova.splice(dragIdx.current, 1)
    nova.splice(idx, 0, item)
    dragIdx.current = idx
    const fixas = ordem.filter(k => colunas.find(c => c.key === k)?.fixo)
    onOrdemChange([...fixas, ...nova.map(c => c.key)])
  }

  function onDragEnd() { dragIdx.current = null; dragOverIdx.current = null; setDragState(null) }

  return (
    <div ref={ref} style={{ position:'absolute', top:36, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:12, zIndex:100, minWidth:240, boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8, letterSpacing:'0.05em' }}>
        Colunas visíveis · arraste para reordenar
      </div>
      {naoFixas.map((col, idx) => (
        <div key={col.key}
          draggable
          onDragStart={e => onDragStart(e, idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDragEnd={onDragEnd}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderRadius:6, background: dragState === idx ? 'var(--surface-2)' : 'transparent', cursor:'grab', userSelect:'none' }}>
          <span style={{ color:'var(--text-muted)', fontSize:13 }}>⠿</span>
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', flex:1, fontSize:13 }}>
            <input type="checkbox"
              checked={visiveis.includes(col.key)}
              onChange={e => e.target.checked
                ? onVisiveisChange([...visiveis, col.key])
                : onVisiveisChange(visiveis.filter(k => k !== col.key))}
              style={{ accentColor:'var(--accent)', cursor:'pointer', width:14, height:14 }} />
            <span style={{ color:'var(--text)' }}>{col.label}</span>
          </label>
        </div>
      ))}
    </div>
  )
}

// ── FILTRO ESTILO EXCEL ────────────────────────────────────
function FiltroExcel({ valores, selecionados, onConfirm, onClose }) {
  const ref = useRef(null)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(new Set(selecionados.length ? selecionados : valores))

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const filtrados = valores.filter(v => v.toLowerCase().includes(busca.toLowerCase()))
  const todosSel = filtrados.every(v => sel.has(v))

  function toggleAll() {
    if (todosSel) setSel(prev => { const n = new Set(prev); filtrados.forEach(v => n.delete(v)); return n })
    else setSel(prev => { const n = new Set(prev); filtrados.forEach(v => n.add(v)); return n })
  }

  function toggle(v) { setSel(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n }) }

  return (
    <div ref={ref} style={{ position:'absolute', top:'100%', left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, zIndex:200, minWidth:200, boxShadow:'0 8px 24px rgba(0,0,0,0.2)', padding:8 }}>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar..."
        style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:12, marginBottom:6, boxSizing:'border-box' }} />
      <div style={{ maxHeight:200, overflowY:'auto', marginBottom:6 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 4px', fontSize:12, cursor:'pointer', fontWeight:600 }}>
          <input type="checkbox" checked={todosSel} onChange={toggleAll} style={{ accentColor:'var(--accent)' }} />
          (Selecionar Tudo)
        </label>
        {filtrados.map(v => (
          <label key={v} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 4px', fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} style={{ accentColor:'var(--accent)' }} />
            {v || '(vazio)'}
          </label>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize:11 }}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={() => onConfirm([...sel])} style={{ fontSize:11 }}>OK</button>
      </div>
    </div>
  )
}

// ── CABEÇALHO COM FILTRO EXCEL ─────────────────────────────
function ThFiltro({ label, colKey, dados, filtroAtivo, onFiltro }) {
  const [open, setOpen] = useState(false)
  const valores = [...new Set(dados.map(r => {
    const v = r[colKey]
    if (colKey === 'grupo_id') return GRUPOS.find(g => g.id === v)?.romano || ''
    if (colKey === 'status_parceria') return getStatusSafe(v).label
    return v ? String(v) : ''
  }).filter(v => v !== undefined))].sort()

  const ativo = filtroAtivo && filtroAtivo.length < valores.length

  return (
    <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color: ativo ? 'var(--accent)' : 'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap', position:'relative', cursor:'pointer', userSelect:'none' }}
      onClick={() => setOpen(v => !v)}>
      <span style={{ display:'flex', alignItems:'center', gap:4 }}>
        {label}
        <ChevronDown size={10} style={{ opacity: ativo ? 1 : 0.5, color: ativo ? 'var(--accent)' : 'inherit' }} />
        {ativo && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block' }} />}
      </span>
      {open && (
        <FiltroExcel
          valores={valores}
          selecionados={filtroAtivo || valores}
          onConfirm={sel => { onFiltro(colKey, sel); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </th>
  )
}

function ModalEditora({ editora, onSave, onClose }) {
  const empty = { nome:'', instagram:'', youtube:'', contato:'', email:'', tem_grupo:false, macro:'', nicho:'', sub_nicho:'', posicionamento:'', grupo_id:'', status_parceria:'ativa', selos:[] }
  const [form, setForm] = useState(editora ? { ...editora, selos: editora.selos_editoriais?.map(s => s.nome) || [], grupo_id: editora.grupo_id ?? '' } : empty)
  const [novoSelo, setNovoSelo] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function adicionarSelo() { const s = novoSelo.trim(); if (!s || form.selos.includes(s)) return; setForm(f => ({ ...f, selos: [...f.selos, s] })); setNovoSelo('') }
  function removerSelo(s) { setForm(f => ({ ...f, selos: f.selos.filter(x => x !== s) })) }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave({ ...form, grupo_id: form.grupo_id !== '' ? Number(form.grupo_id) : null }); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const inp = (label, key, type = 'text', ph = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[key] ?? ''} placeholder={ph || label} onChange={e => set(key, e.target.value)} />
    </div>
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
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status_parceria} onChange={e => set('status_parceria', e.target.value)}>
              {STATUS_PARCERIA.map(s => <option key={s} value={s}>{STATUS_COR[s]?.label || s}</option>)}
            </select>
          </div>
          {inp('Instagram', 'instagram', 'text', '@usuario')}
          {inp('YouTube', 'youtube')}
          {inp('Contato', 'contato')}
          {inp('E-mail', 'email', 'email')}
          {inp('Macro', 'macro')}
          {inp('Nicho', 'nicho')}
          {inp('Sub-nicho', 'sub_nicho')}
          {inp('Posicionamento', 'posicionamento')}
          <div className="form-group">
            <label className="form-label">Grupo</label>
            <select className="form-select" value={form.grupo_id ?? ''} onChange={e => set('grupo_id', e.target.value)}>
              <option value="">—</option>
              {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.romano} · {g.label}</option>)}
            </select>
          </div>
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
                {s}<button onClick={() => removerSelo(s)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'var(--accent)', display:'flex' }}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input className="form-input" value={novoSelo} onChange={e => setNovoSelo(e.target.value)}
              placeholder="Nome do selo" onKeyDown={e => e.key === 'Enter' && adicionarSelo()} style={{ flex:1 }} />
            <button className="btn btn-ghost btn-sm" onClick={adicionarSelo}><Plus size={13} /> Adicionar</button>
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
  const empty = { nome:'', editora_id:'', contato:'', email:'', instagram:'', site:'', inauguracao:'' }
  const [form, setForm] = useState(livraria ? { ...livraria, editora_id: livraria.editora_id ?? '', inauguracao: livraria.inauguracao ?? '' } : empty)
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave({ ...form, editora_id: form.editora_id || null, inauguracao: form.inauguracao || null }); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:460 }}>
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
          <div className="form-group"><label className="form-label">Instagram</label><input className="form-input" value={form.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@livraria" /></div>
          <div className="form-group"><label className="form-label">Site</label><input className="form-input" value={form.site ?? ''} onChange={e => set('site', e.target.value)} placeholder="https://" /></div>
          <div className="form-group"><label className="form-label">Inauguração</label><input className="form-input" type="date" value={form.inauguracao ?? ''} onChange={e => set('inauguracao', e.target.value)} /></div>
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
        ['Editora Exemplo','-','Catolicismo','Formação católica','Espiritualidade; devoção','Conservadora','III','ativa'],
      ])
      ws['!cols'] = [28,24,16,28,32,18,14,16].map(w => ({ wch:w }))
      XLSX.utils.book_append_sheet(wb, ws, 'Editoras')
      XLSX.writeFile(wb, 'template_editoras.xlsx')
    } else {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Editora (nome exato)','Contato Editora','Email Editora','Nome Livraria','Site Livraria','Contato Livraria','Email Livraria','Telefone','Data Contrato','Data Inauguração','Observação'],
        ['Editora Exemplo','João Silva','joao@ex.com','Livraria Exemplo','https://livraria.com','Maria Lima','maria@ex.com','(11) 99999-0000','01/01/2024','15/03/2024',''],
      ])
      ws['!cols'] = [28,20,24,24,24,20,24,16,14,14,20].map(w => ({ wch:w }))
      XLSX.utils.book_append_sheet(wb, ws, 'Livrarias')
      XLSX.writeFile(wb, 'template_livrarias.xlsx')
    }
  }

  function processar(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:true })
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
                  <span style={{ fontSize:11, color: l[7] && l[7].toString().toLowerCase() !== 'ativa' ? '#ef4444' : 'var(--text-muted)' }}>{l[7]}</span>
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

function Celula({ children, width = 140 }) {
  const texto = typeof children === 'string' ? children : undefined
  return (
    <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text)', maxWidth:width, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={texto}>
      {children != null && children !== '' ? children : <span style={{ color:'var(--border)' }}>—</span>}
    </td>
  )
}

function BarraSeleção({ selecionados, total, onSelecionarTodos, onDeselecionarTodos, onExcluir, excluindo }) {
  if (selecionados === 0) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', background:'var(--accent-glow)', border:'1px solid var(--accent)', borderRadius:8, marginBottom:12 }}>
      <span style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>{selecionados} selecionado{selecionados !== 1 ? 's' : ''}</span>
      <button className="btn btn-ghost btn-sm" onClick={onSelecionarTodos} style={{ fontSize:12 }}>Selecionar todos ({total})</button>
      <button className="btn btn-ghost btn-sm" onClick={onDeselecionarTodos} style={{ fontSize:12 }}>Limpar seleção</button>
      <button onClick={onExcluir} disabled={excluindo}
        style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', border:'none', borderRadius:6, padding:'5px 14px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
        <Trash2 size={12} /> {excluindo ? 'Removendo...' : `Remover ${selecionados}`}
      </button>
    </div>
  )
}

// ── ABA EDITORAS ───────────────────────────────────────────
function AbaEditoras({ editoras, livrarias, setEditoras, isAdmin, showToast }) {
  const [ordem, setOrdem] = useState(ORDEM_DEFAULT_EDITORAS)
  const [visiveis, setVisiveis] = useState(VISIVEIS_DEFAULT_EDITORAS)
  const [showColSel, setShowColSel] = useState(false)
  const [filtros, setFiltros] = useState({}) // { colKey: ['val1','val2'] }
  const [buscaNome, setBuscaNome] = useState('')
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)
  const [selecionados, setSelecionados] = useState(new Set())
  const [excluindo, setExcluindo] = useState(false)

  // Mapa editora_id → livraria
  const livrariaPorEditora = {}
  for (const l of livrarias) { if (l.editora_id) livrariaPorEditora[l.editora_id] = l }

  // Adicionar livraria como campo virtual em cada editora para filtros
  const editorasComLivraria = editoras.map(e => ({
    ...e,
    livraria: livrariaPorEditora[e.id]?.nome || '',
  }))

  const colsAtivas = ordem
    .filter(k => {
      const c = TODAS_COLUNAS_EDITORAS.find(x => x.key === k)
      return c && (c.fixo || visiveis.includes(k))
    })
    .map(k => TODAS_COLUNAS_EDITORAS.find(c => c.key === k))
    .filter(Boolean)

  const lista = editorasComLivraria.filter(e => {
    if (buscaNome && !e.nome?.toLowerCase().includes(buscaNome.toLowerCase())) return false
    for (const [col, vals] of Object.entries(filtros)) {
      if (!vals || !vals.length) continue
      let v = ''
      if (col === 'grupo_id') v = GRUPOS.find(g => g.id === e.grupo_id)?.romano || ''
      else if (col === 'status_parceria') v = getStatusSafe(e.status_parceria).label
      else v = e[col] ? String(e[col]) : ''
      if (!vals.includes(v) && !(vals.includes('(vazio)') && !v)) return false
    }
    return true
  })

  function toggleSel(id) { setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function handleExcluirLote() {
    if (!window.confirm(`Remover ${selecionados.size} editora${selecionados.size !== 1 ? 's' : ''}?`)) return
    setExcluindo(true)
    try {
      await desativarEditorasLote([...selecionados])
      setEditoras(prev => prev.filter(e => !selecionados.has(e.id)))
      setSelecionados(new Set())
      showToast(`${selecionados.size} removida${selecionados.size !== 1 ? 's' : ''}!`)
    } catch (e) { console.error(e) } finally { setExcluindo(false) }
  }

  async function handleSalvar(form) {
    if (modal === 'new') { const nova = await createEditora(form); setEditoras(prev => [...prev, nova]); showToast('Editora cadastrada!') }
    else { const upd = await updateEditora(modal.id, form); setEditoras(prev => prev.map(e => e.id === upd.id ? upd : e)); showToast('Editora atualizada!') }
  }

  async function handleExcluir(e) {
    if (!window.confirm(`Remover ${e.nome}?`)) return
    await desativarEditora(e.id); setEditoras(prev => prev.filter(x => x.id !== e.id)); showToast('Editora removida!')
  }

  function renderCelula(e, key) {
    if (key === 'classificacao') return e.classificacao ? <span style={{ fontWeight:800, color:CLASS_COR[e.classificacao]||'var(--accent)' }}>{e.classificacao}</span> : null
    if (key === 'nome') return e.nome
    if (key === 'livraria') return e.livraria || null
    if (key === 'status_parceria') {
      const s = getStatusSafe(e.status_parceria)
      return <span style={{ fontSize:11, fontWeight:700, color:s.cor, background:s.bg, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{s.label}</span>
    }
    if (key === 'grupo_id') { const g = GRUPOS.find(x => x.id === e.grupo_id); return g ? g.romano : null }
    if (key === 'tem_grupo') return e.tem_grupo ? '✓' : null
    if (key === 'selos') return e.selos_editoriais?.map(s => s.nome).join(', ') || null
    if (key === 'instagram' && e.instagram)
      return <a href={`https://instagram.com/${e.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{e.instagram}</a>
    return e[key] || null
  }

  const filtrosAtivos = Object.values(filtros).some(v => v && v.length)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>{lista.length} editora{lista.length !== 1 ? 's' : ''}</span>
          {filtrosAtivos && <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({})} style={{ fontSize:11 }}><X size={11} /> Limpar filtros</button>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input value={buscaNome} onChange={e => setBuscaNome(e.target.value)} placeholder="Buscar nome..."
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, minWidth:160 }} />
          <div style={{ position:'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowColSel(v => !v)}><Settings2 size={13} /> Colunas</button>
            {showColSel && (
              <SeletorColunas
                colunas={TODAS_COLUNAS_EDITORAS}
                ordem={ordem} onOrdemChange={setOrdem}
                visiveis={visiveis} onVisiveisChange={setVisiveis}
                onClose={() => setShowColSel(false)}
              />
            )}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova editora</button>
          </>}
        </div>
      </div>

      <BarraSeleção selecionados={selecionados.size} total={lista.length}
        onSelecionarTodos={() => setSelecionados(new Set(lista.map(e => e.id)))}
        onDeselecionarTodos={() => setSelecionados(new Set())}
        onExcluir={handleExcluirLote} excluindo={excluindo} />

      <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--surface-2)' }}>
              <th style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', width:36 }}>
                <input type="checkbox"
                  checked={lista.length > 0 && lista.every(e => selecionados.has(e.id))}
                  onChange={e => e.target.checked ? setSelecionados(new Set(lista.map(x => x.id))) : setSelecionados(new Set())}
                  style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
              </th>
              {colsAtivas.map(c => (
                c.fixo
                  ? <th key={c.key} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>
                  : <ThFiltro key={c.key} label={c.label} colKey={c.key} dados={editorasComLivraria}
                      filtroAtivo={filtros[c.key]}
                      onFiltro={(col, vals) => setFiltros(f => ({ ...f, [col]: vals }))} />
              ))}
              {isAdmin && <th style={{ padding:'8px 10px', borderBottom:'2px solid var(--border)', width:60 }}></th>}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={colsAtivas.length + 2} style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Nenhuma editora encontrada.</td></tr>
            ) : lista.map((e, i) => {
              const sel = selecionados.has(e.id)
              return (
                <tr key={e.id}
                  style={{ background: sel ? 'var(--accent-glow)' : i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)', transition:'background 0.1s' }}
                  onMouseEnter={el => { if (!sel) el.currentTarget.style.background = 'var(--accent-glow)' }}
                  onMouseLeave={el => { if (!sel) el.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleSel(e.id)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
                  </td>
                  {colsAtivas.map(c => (
                    <Celula key={c.key} width={c.key === 'nome' || c.key === 'livraria' ? 200 : c.key === 'grupo_id' || c.key === 'classificacao' ? 60 : 160}>
                      {renderCelula(e, c.key)}
                    </Celula>
                  ))}
                  {isAdmin && (
                    <td style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModal(e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Pencil size={12} /></button>
                        <button onClick={() => handleExcluir(e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', opacity:0.5 }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && <ModalEditora editora={modal === 'new' ? null : modal} onSave={handleSalvar} onClose={() => setModal(null)} />}
      {importar && <ModalImportar tipo="editora" editoras={editoras} onClose={() => setImportar(false)}
        onImported={async () => { setEditoras(await getEditorasCompletas()); showToast('Editoras importadas!') }} />}
    </div>
  )
}

// ── ABA LIVRARIAS ──────────────────────────────────────────
function AbaLivrarias({ livrarias, setLivrarias, editoras, isAdmin, showToast }) {
  const [ordem, setOrdem] = useState(ORDEM_DEFAULT_LIVRARIAS)
  const [visiveis, setVisiveis] = useState(VISIVEIS_DEFAULT_LIVRARIAS)
  const [showColSel, setShowColSel] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [buscaNome, setBuscaNome] = useState('')
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)
  const [selecionados, setSelecionados] = useState(new Set())
  const [excluindo, setExcluindo] = useState(false)

  const livrariaComEditora = livrarias.map(l => ({
    ...l,
    editora: l.editoras_parceiras?.nome || '',
  }))

  const colsAtivas = ordem
    .filter(k => {
      const c = COLUNAS_LIVRARIAS.find(x => x.key === k)
      return c && (c.fixo || visiveis.includes(k))
    })
    .map(k => COLUNAS_LIVRARIAS.find(c => c.key === k))
    .filter(Boolean)

  const lista = livrariaComEditora.filter(l => {
    if (buscaNome && !l.nome?.toLowerCase().includes(buscaNome.toLowerCase())) return false
    for (const [col, vals] of Object.entries(filtros)) {
      if (!vals || !vals.length) continue
      const v = l[col] ? String(l[col]) : ''
      if (!vals.includes(v) && !(vals.includes('(vazio)') && !v)) return false
    }
    return true
  })

  function toggleSel(id) { setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function handleExcluirLote() {
    if (!window.confirm(`Remover ${selecionados.size} livraria${selecionados.size !== 1 ? 's' : ''}?`)) return
    setExcluindo(true)
    try {
      await desativarLivrariaLote([...selecionados])
      setLivrarias(prev => prev.filter(l => !selecionados.has(l.id)))
      setSelecionados(new Set())
      showToast(`${selecionados.size} removida${selecionados.size !== 1 ? 's' : ''}!`)
    } catch (e) { console.error(e) } finally { setExcluindo(false) }
  }

  async function handleSalvar(form) {
    if (modal === 'new') { const nova = await createLivraria(form); setLivrarias(prev => [...prev, nova].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))); showToast('Livraria cadastrada!') }
    else { const upd = await updateLivraria(modal.id, form); setLivrarias(prev => prev.map(l => l.id === upd.id ? upd : l)); showToast('Livraria atualizada!') }
  }

  async function handleExcluir(l) {
    if (!window.confirm(`Remover ${l.nome}?`)) return
    await desativarLivraria(l.id); setLivrarias(prev => prev.filter(x => x.id !== l.id)); showToast('Livraria removida!')
  }

  function renderCelula(l, key) {
    if (key === 'editora') return l.editora || null
    if (key === 'site' && l.site) return <a href={l.site} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>🔗 site</a>
    if (key === 'instagram' && l.instagram) return <a href={`https://instagram.com/${l.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>{l.instagram}</a>
    if (key === 'inauguracao' && l.inauguracao) return new Date(l.inauguracao).toLocaleDateString('pt-BR')
    return l[key] || null
  }

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
            {showColSel && <SeletorColunas colunas={COLUNAS_LIVRARIAS} ordem={ordem} onOrdemChange={setOrdem} visiveis={visiveis} onVisiveisChange={setVisiveis} onClose={() => setShowColSel(false)} />}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova livraria</button>
          </>}
        </div>
      </div>

      <BarraSeleção selecionados={selecionados.size} total={lista.length}
        onSelecionarTodos={() => setSelecionados(new Set(lista.map(l => l.id)))}
        onDeselecionarTodos={() => setSelecionados(new Set())}
        onExcluir={handleExcluirLote} excluindo={excluindo} />

      <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--surface-2)' }}>
              <th style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', width:36 }}>
                <input type="checkbox" checked={lista.length > 0 && lista.every(l => selecionados.has(l.id))}
                  onChange={e => e.target.checked ? setSelecionados(new Set(lista.map(x => x.id))) : setSelecionados(new Set())}
                  style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
              </th>
              {colsAtivas.map(c => (
                c.fixo
                  ? <th key={c.key} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>
                  : <ThFiltro key={c.key} label={c.label} colKey={c.key} dados={livrariaComEditora}
                      filtroAtivo={filtros[c.key]}
                      onFiltro={(col, vals) => setFiltros(f => ({ ...f, [col]: vals }))} />
              ))}
              {isAdmin && <th style={{ padding:'8px 10px', borderBottom:'2px solid var(--border)', width:60 }}></th>}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={colsAtivas.length + 2} style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Nenhuma livraria encontrada.</td></tr>
            ) : lista.map((l, i) => {
              const sel = selecionados.has(l.id)
              return (
                <tr key={l.id}
                  style={{ background: sel ? 'var(--accent-glow)' : i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}
                  onMouseEnter={el => { if (!sel) el.currentTarget.style.background = 'var(--accent-glow)' }}
                  onMouseLeave={el => { if (!sel) el.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleSel(l.id)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
                  </td>
                  {colsAtivas.map(c => (
                    <Celula key={c.key} width={c.key === 'nome' || c.key === 'editora' ? 200 : 160}>
                      {renderCelula(l, c.key)}
                    </Celula>
                  ))}
                  {isAdmin && (
                    <td style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModal(l)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><Pencil size={12} /></button>
                        <button onClick={() => handleExcluir(l)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', opacity:0.5 }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && <ModalLivraria livraria={modal === 'new' ? null : modal} editoras={editoras} onSave={handleSalvar} onClose={() => setModal(null)} />}
      {importar && <ModalImportar tipo="livraria" editoras={editoras} onClose={() => setImportar(false)}
        onImported={async () => { setLivrarias(await getLivrarias()); showToast('Livrarias importadas!') }} />}
    </div>
  )
}

// ── ABA GRUPOS ─────────────────────────────────────────────
function AbaGrupos({ editoras, livrarias }) {
  const livrariaPorEditora = {}
  for (const l of livrarias) { if (l.editora_id) livrariaPorEditora[l.editora_id] = l }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
      {GRUPOS.map(grupo => {
        const eds = editoras.filter(e => e.grupo_id === grupo.id)
        const comLiv = eds.filter(e => livrariaPorEditora[e.id]).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))
        const semLiv = eds.filter(e => !livrariaPorEditora[e.id]).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))
        const titulo = formatarTituloGrupo(grupo.romano, grupo.label)

        return (
          <div key={grupo.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{titulo}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--surface-3)', padding:'2px 8px', borderRadius:20, flexShrink:0, marginLeft:8 }}>{eds.length}</span>
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
                      <span style={{ fontSize:11, fontWeight:700, color:getStatusSafe(e.status_parceria).cor, background:getStatusSafe(e.status_parceria).bg, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>
                        {getStatusSafe(e.status_parceria).label}
                      </span>
                    </div>
                  ))}
                  {semLiv.map(e => (
                    <div key={e.id} style={{ padding:'7px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}>
                      {e.classificacao && <span style={{ fontSize:11, fontWeight:800, color:CLASS_COR[e.classificacao]||'var(--accent)', minWidth:16 }}>{e.classificacao}</span>}
                      <span style={{ fontSize:12, color:'var(--text)', flex:1 }}>{e.nome}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:getStatusSafe(e.status_parceria).cor, background:getStatusSafe(e.status_parceria).bg, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>
                        {getStatusSafe(e.status_parceria).label}
                      </span>
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
      .catch(console.error)
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
