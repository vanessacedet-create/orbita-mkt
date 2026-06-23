import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasCompletas, createEditora, updateEditora, desativarEditora, importarEditorasPlanilhaCompleta,
  getLivrarias, createLivraria, updateLivraria, desativarLivraria, importarLivrariasPlanilha,
  GRUPOS, STATUS_PARCERIA,
} from '../lib/editoras-livrarias'
import {
  BookOpen, Plus, X, Upload, Pencil, Trash2, FileSpreadsheet,
  ChevronDown, ChevronUp, Building2, Library, LayoutGrid,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── UTILITÁRIOS ────────────────────────────────────────────

function val(v) { return v ?? '-' }

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

const STATUS_COR = {
  ativa:        { cor: '#22c55e', bg: '#22c55e18', label: 'Ativa' },
  encerramento: { cor: '#f59e0b', bg: '#f59e0b18', label: 'Encerramento' },
  finalizada:   { cor: '#ef4444', bg: '#ef444418', label: 'Finalizada' },
  pendente:     { cor: '#6b7280', bg: '#6b728018', label: 'Pendente' },
}

const CLASS_COR = {
  A: '#22c55e', B: '#84cc16', C: '#f59e0b',
  D: '#fb923c', E: '#ef4444', F: '#6b7280',
}

// ── BADGE STATUS ───────────────────────────────────────────
function BadgeStatus({ status }) {
  const s = STATUS_COR[status] || STATUS_COR.ativa
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.cor, background: s.bg, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── MODAL EDITORA ──────────────────────────────────────────
function ModalEditora({ editora, onSave, onClose }) {
  const empty = {
    nome: '', contato: '', email: '', instagram: '', youtube: '', site: '',
    seguidores: '', canal_venda: '', tem_grupo: false, macro: '', nicho: '',
    sub_nicho: '', grupo_id: '', status_parceria: 'ativa', selos: [],
  }
  const [form, setForm] = useState(editora ? {
    ...editora,
    selos: editora.selos_editoriais?.map(s => s.nome) || [],
    seguidores: editora.seguidores ?? '',
    grupo_id: editora.grupo_id ?? '',
  } : empty)
  const [novoSelo, setNovoSelo] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function adicionarSelo() {
    const s = novoSelo.trim()
    if (!s || form.selos.includes(s)) return
    setForm(f => ({ ...f, selos: [...f.selos, s] }))
    setNovoSelo('')
  }

  function removerSelo(s) { setForm(f => ({ ...f, selos: f.selos.filter(x => x !== s) })) }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        seguidores: form.seguidores !== '' ? Number(form.seguidores) : null,
        grupo_id: form.grupo_id !== '' ? Number(form.grupo_id) : null,
      })
      onClose()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const input = (label, key, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[key] ?? ''} placeholder={placeholder || label}
        onChange={e => set(key, e.target.value)} />
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{editora ? 'Editar editora' : 'Nova editora'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {input('Nome *', 'nome')}
          {input('Contato (WhatsApp)', 'contato')}
          {input('E-mail', 'email', 'email')}
          {input('Instagram', 'instagram', 'text', '@usuario')}
          {input('YouTube', 'youtube')}
          {input('Site', 'site', 'text', 'https://')}
          {input('Nº de seguidores', 'seguidores', 'number')}
          {input('Principal canal de venda', 'canal_venda')}
          {input('Macro', 'macro')}
          {input('Nicho', 'nicho')}
          {input('Sub-nicho', 'sub_nicho')}

          <div className="form-group">
            <label className="form-label">Grupo</label>
            <select className="form-select" value={form.grupo_id ?? ''} onChange={e => set('grupo_id', e.target.value)}>
              <option value="">—</option>
              {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.id} · {g.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status_parceria} onChange={e => set('status_parceria', e.target.value)}>
              {STATUS_PARCERIA.map(s => <option key={s} value={s}>{STATUS_COR[s]?.label || s}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <label className="form-label" style={{ margin: 0 }}>Tem grupo?</label>
            <input type="checkbox" checked={!!form.tem_grupo} onChange={e => set('tem_grupo', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }} />
          </div>
        </div>

        {/* Selos */}
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">Selos editoriais</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {form.selos.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 20, fontSize: 12, color: 'var(--accent)' }}>
                {s}
                <button onClick={() => removerSelo(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent)', display: 'flex' }}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" value={novoSelo} onChange={e => setNovoSelo(e.target.value)}
              placeholder="Nome do selo" onKeyDown={e => e.key === 'Enter' && adicionarSelo()} style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={adicionarSelo}><Plus size={13} /> Adicionar</button>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL LIVRARIA ─────────────────────────────────────────
function ModalLivraria({ livraria, editoras, onSave, onClose }) {
  const empty = { nome: '', contato: '', email: '', whatsapp: '', site: '', editora_id: '' }
  const [form, setForm] = useState(livraria ? {
    ...livraria,
    editora_id: livraria.editora_id ?? '',
  } : empty)
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, editora_id: form.editora_id || null })
      onClose()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{livraria ? 'Editar livraria' : 'Nova livraria'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome da livraria" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Editora vinculada</label>
            <select className="form-select" value={form.editora_id} onChange={e => set('editora_id', e.target.value)}>
              <option value="">—</option>
              {editoras.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contato</label>
            <input className="form-input" value={form.contato ?? ''} onChange={e => set('contato', e.target.value)} placeholder="Nome" />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp</label>
            <input className="form-input" value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="email@livraria.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Site</label>
            <input className="form-input" value={form.site ?? ''} onChange={e => set('site', e.target.value)} placeholder="https://" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR ─────────────────────────────────────────
function ModalImportar({ tipo, editoras, onClose, onImported }) {
  const fileRef = useRef()
  const [linhas, setLinhas] = useState([])
  const [etapa, setEtapa] = useState('upload')
  const [importando, setImportando] = useState(false)

  const colunasEditora = ['nome','contato','email','instagram','youtube','site','seguidores','canal_venda','tem_grupo','macro','nicho','sub_nicho','grupo_id','status_parceria']
  const colunasLivraria = ['nome','contato','email','whatsapp','site','editora_nome']

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    if (tipo === 'editora') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nome','Contato','Email','Instagram','YouTube','Site','Seguidores','Canal de venda','Tem grupo (Sim/Não)','Macro','Nicho','Sub-nicho','Grupo ID (1-8)','Status (ativa/encerramento/finalizada/pendente)'],
        ['Editora Exemplo','Paulo Silva','paulo@ex.com','@editora','','https://editora.com','','Instagram','Sim','Catolicismo','Doutrina','','1','ativa'],
      ])
      XLSX.utils.book_append_sheet(wb, ws, 'Editoras')
      XLSX.writeFile(wb, 'template_editoras.xlsx')
    } else {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nome','Contato','Email','WhatsApp','Site','Nome da Editora'],
        ['Livraria Exemplo','Maria Lima','maria@ex.com','(11) 99999-0000','https://livraria.com','Editora Exemplo'],
      ])
      XLSX.utils.book_append_sheet(wb, ws, 'Livrarias')
      XLSX.writeFile(wb, 'template_livrarias.xlsx')
    }
  }

  function processar(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const dados = rows.slice(1).filter(r => r[0]?.toString().trim())
      if (tipo === 'editora') {
        setLinhas(dados.map(r => ({
          nome: r[0], contato: r[1], email: r[2], instagram: r[3], youtube: r[4],
          site: r[5], seguidores: r[6], canal_venda: r[7], tem_grupo: r[8],
          macro: r[9], nicho: r[10], sub_nicho: r[11], grupo_id: r[12], status_parceria: r[13],
        })))
      } else {
        setLinhas(dados.map(r => {
          const ed = editoras.find(e => e.nome?.toLowerCase() === r[5]?.toString().toLowerCase().trim())
          return { nome: r[0], contato: r[1], email: r[2], whatsapp: r[3], site: r[4], editora_id: ed?.id || null, editora_nome: r[5] }
        }))
      }
      setEtapa('revisao')
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmar() {
    setImportando(true)
    try {
      if (tipo === 'editora') await importarEditorasPlanilhaCompleta(linhas)
      else await importarLivrariasPlanilha(linhas)
      onImported()
      onClose()
    } catch (e) { console.error(e) }
    finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar {tipo === 'editora' ? 'editoras' : 'livrarias'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {etapa === 'upload' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Baixe o template, preencha e faça o upload.</p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }}>
              <FileSpreadsheet size={14} /> Baixar template .xlsx
            </button>
            <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processar(f) }}
              style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}>
              <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Clique ou arraste o arquivo .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} />
            </div>
          </div>
        )}
        {etapa === 'revisao' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{linhas.length} registro{linhas.length !== 1 ? 's' : ''} encontrado{linhas.length !== 1 ? 's' : ''}:</p>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
              {linhas.map((l, i) => (
                <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', flex: 1 }}>{l.nome}</span>
                  {tipo === 'livraria' && l.editora_nome && (
                    <span style={{ fontSize: 11, color: l.editora_id ? 'var(--accent)' : '#ef4444' }}>
                      {l.editora_id ? `✓ ${l.editora_nome}` : `✗ ${l.editora_nome} (não encontrada)`}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmar} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${linhas.length}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BARRA DE FILTROS ───────────────────────────────────────
function FiltroInput({ label, value, onChange, options }) {
  if (options) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: value ? 'var(--text)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={label}
      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, minWidth: 140 }} />
  )
}

// ── ABA EDITORAS ───────────────────────────────────────────
function AbaEditoras({ editoras, setEditoras, isAdmin, showToast }) {
  const [filtros, setFiltros] = useState({ nome: '', status: '', grupo: '', macro: '', classificacao: '' })
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)

  function setF(k, v) { setFiltros(f => ({ ...f, [k]: v })) }

  const lista = editoras.filter(e => {
    if (filtros.nome && !e.nome?.toLowerCase().includes(filtros.nome.toLowerCase())) return false
    if (filtros.status && e.status_parceria !== filtros.status) return false
    if (filtros.grupo && String(e.grupo_id) !== String(filtros.grupo)) return false
    if (filtros.macro && !e.macro?.toLowerCase().includes(filtros.macro.toLowerCase())) return false
    if (filtros.classificacao && e.classificacao !== filtros.classificacao) return false
    return true
  })

  async function handleSalvar(form) {
    if (modal === 'new') {
      const nova = await createEditora(form)
      setEditoras(prev => [...prev, nova])
      showToast('Editora cadastrada!')
    } else {
      const upd = await updateEditora(modal.id, form)
      setEditoras(prev => prev.map(e => e.id === upd.id ? upd : e))
      showToast('Editora atualizada!')
    }
  }

  async function handleExcluir(editora) {
    if (!window.confirm(`Remover ${editora.nome}?`)) return
    await desativarEditora(editora.id)
    setEditoras(prev => prev.filter(e => e.id !== editora.id))
    showToast('Editora removida!')
  }

  return (
    <div>
      {/* Cabeçalho da aba */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lista.length} editora{lista.length !== 1 ? 's' : ''}</span>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova editora</button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <FiltroInput label="Buscar nome..." value={filtros.nome} onChange={v => setF('nome', v)} />
        <FiltroInput label="Status" value={filtros.status} onChange={v => setF('status', v)}
          options={STATUS_PARCERIA.map(s => ({ value: s, label: STATUS_COR[s]?.label || s }))} />
        <FiltroInput label="Grupo" value={filtros.grupo} onChange={v => setF('grupo', v)}
          options={GRUPOS.map(g => ({ value: String(g.id), label: `${g.id} · ${g.label}` }))} />
        <FiltroInput label="Macro" value={filtros.macro} onChange={v => setF('macro', v)} />
        <FiltroInput label="Classificação" value={filtros.classificacao} onChange={v => setF('classificacao', v)}
          options={['A','B','C','D','E','F'].map(c => ({ value: c, label: c }))} />
        {Object.values(filtros).some(Boolean) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({ nome: '', status: '', grupo: '', macro: '', classificacao: '' })}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Class.','Nome','Contato','E-mail','Instagram','Site','Seguidores','Canal','Grupo','Tem grupo?','Macro','Nicho','Status','Selos',''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma editora encontrada.</td></tr>
            ) : lista.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={el => el.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={el => el.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                  {e.classificacao ? (
                    <span style={{ fontWeight: 800, color: CLASS_COR[e.classificacao] || 'var(--accent)', fontSize: 14 }}>{e.classificacao}</span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{e.nome}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{val(e.contato)}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{val(e.email)}</td>
                <td style={{ padding: '10px 10px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{val(e.instagram)}</td>
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                  {e.site ? <a href={e.site} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12 }}>🔗 site</a> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{e.seguidores ? e.seguidores.toLocaleString('pt-BR') : '-'}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{val(e.canal_venda)}</td>
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                  {e.grupo_id ? (
                    <span style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, color: 'var(--text)' }}>
                      {e.grupo_id} · {GRUPOS.find(g => g.id === e.grupo_id)?.label || ''}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>{e.tem_grupo ? '✓' : '-'}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{val(e.macro)}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{val(e.nicho)}</td>
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}><BadgeStatus status={e.status_parceria || 'ativa'} /></td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {e.selos_editoriais?.map(s => (
                      <span key={s.id || s.nome} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.nome}</span>
                    ))}
                  </div>
                </td>
                {isAdmin && (
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Pencil size={13} /></button>
                      <button onClick={() => handleExcluir(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.5 }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ModalEditora editora={modal === 'new' ? null : modal} onSave={handleSalvar} onClose={() => setModal(null)} />}
      {importar && (
        <ModalImportar tipo="editora" editoras={editoras} onClose={() => setImportar(false)}
          onImported={async () => { setEditoras(await getEditorasCompletas()); showToast('Editoras importadas!') }} />
      )}
    </div>
  )
}

// ── ABA LIVRARIAS ──────────────────────────────────────────
function AbaLivrarias({ livrarias, setLivrarias, editoras, isAdmin, showToast }) {
  const [filtros, setFiltros] = useState({ nome: '', editora: '' })
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)

  function setF(k, v) { setFiltros(f => ({ ...f, [k]: v })) }

  const lista = livrarias.filter(l => {
    if (filtros.nome && !l.nome?.toLowerCase().includes(filtros.nome.toLowerCase())) return false
    if (filtros.editora && l.editora_id !== filtros.editora) return false
    return true
  })

  async function handleSalvar(form) {
    if (modal === 'new') {
      const nova = await createLivraria(form)
      setLivrarias(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      showToast('Livraria cadastrada!')
    } else {
      const upd = await updateLivraria(modal.id, form)
      setLivrarias(prev => prev.map(l => l.id === upd.id ? upd : l))
      showToast('Livraria atualizada!')
    }
  }

  async function handleExcluir(livraria) {
    if (!window.confirm(`Remover ${livraria.nome}?`)) return
    await desativarLivraria(livraria.id)
    setLivrarias(prev => prev.filter(l => l.id !== livraria.id))
    showToast('Livraria removida!')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lista.length} livraria{lista.length !== 1 ? 's' : ''}</span>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportar(true)}><Upload size={13} /> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><Plus size={13} /> Nova livraria</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <FiltroInput label="Buscar nome..." value={filtros.nome} onChange={v => setF('nome', v)} />
        <FiltroInput label="Editora" value={filtros.editora} onChange={v => setF('editora', v)}
          options={editoras.map(e => ({ value: e.id, label: e.nome }))} />
        {Object.values(filtros).some(Boolean) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({ nome: '', editora: '' })}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Nome','Editora vinculada','Contato','WhatsApp','E-mail','Site',''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma livraria encontrada.</td></tr>
            ) : lista.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={el => el.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={el => el.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{l.nome}</td>
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                  {l.editoras_parceiras ? (
                    <span style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: 20 }}>{l.editoras_parceiras.nome}</span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{val(l.contato)}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{val(l.whatsapp)}</td>
                <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{val(l.email)}</td>
                <td style={{ padding: '10px 10px' }}>
                  {l.site ? <a href={l.site} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12 }}>🔗 site</a> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                {isAdmin && (
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Pencil size={13} /></button>
                      <button onClick={() => handleExcluir(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.5 }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ModalLivraria livraria={modal === 'new' ? null : modal} editoras={editoras} onSave={handleSalvar} onClose={() => setModal(null)} />}
      {importar && (
        <ModalImportar tipo="livraria" editoras={editoras} onClose={() => setImportar(false)}
          onImported={async () => { setLivrarias(await getLivrarias()); showToast('Livrarias importadas!') }} />
      )}
    </div>
  )
}

// ── ABA GRUPOS ─────────────────────────────────────────────
function AbaGrupos({ editoras }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {GRUPOS.map(grupo => {
        const membros = editoras.filter(e => e.grupo_id === grupo.id)
        return (
          <div key={grupo.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginRight: 6 }}>{grupo.id}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{grupo.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 20 }}>{membros.length}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {membros.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhuma editora neste grupo.</div>
              ) : membros.map(e => (
                <div key={e.id} style={{ padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
                  {e.classificacao && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: CLASS_COR[e.classificacao] || 'var(--accent)', minWidth: 16 }}>{e.classificacao}</span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{e.nome}</span>
                  <BadgeStatus status={e.status_parceria || 'ativa'} />
                </div>
              ))}
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
    return {
      padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      border: 'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent',
      background: 'transparent', color: ativa ? 'var(--accent)' : 'var(--text-muted)',
      transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <BookOpen size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Editoras & Livrarias</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {editoras.length} editoras · {livrarias.length} livrarias
          </p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <button style={tabStyle(aba === 'editoras')} onClick={() => setAba('editoras')}>
          <Building2 size={14} /> Editoras
        </button>
        <button style={tabStyle(aba === 'livrarias')} onClick={() => setAba('livrarias')}>
          <Library size={14} /> Livrarias
        </button>
        <button style={tabStyle(aba === 'grupos')} onClick={() => setAba('grupos')}>
          <LayoutGrid size={14} /> Grupos
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {aba === 'editoras' && <AbaEditoras editoras={editoras} setEditoras={setEditoras} isAdmin={isAdmin} showToast={showToast} />}
          {aba === 'livrarias' && <AbaLivrarias livrarias={livrarias} setLivrarias={setLivrarias} editoras={editoras} isAdmin={isAdmin} showToast={showToast} />}
          {aba === 'grupos' && <AbaGrupos editoras={editoras} />}
        </>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
