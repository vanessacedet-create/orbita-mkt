import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasCompletas, createEditora, updateEditora, desativarEditora, importarEditorasPlanilha,
  getLivrarias, createLivraria, updateLivraria, desativarLivraria, importarLivrariasPlanilha,
  GRUPOS, STATUS_PARCERIA,
} from '../lib/editoras-livrarias'
import { BookOpen, Plus, X, Upload, Pencil, Trash2, FileSpreadsheet, Building2, Library, LayoutGrid, Settings2 } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── UTILITÁRIOS ────────────────────────────────────────────
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

// Colunas disponíveis para editoras
const COLUNAS_EDITORAS = [
  { key: 'classificacao', label: 'Class.', fixo: true },
  { key: 'nome',          label: 'Nome',   fixo: true },
  { key: 'status_parceria', label: 'Status', fixo: true },
  { key: 'macro',         label: 'Macro' },
  { key: 'nicho',         label: 'Nicho' },
  { key: 'sub_nicho',     label: 'Sub-nicho' },
  { key: 'posicionamento',label: 'Posicionamento' },
  { key: 'grupo_id',      label: 'Grupo' },
  { key: 'instagram',     label: 'Instagram' },
  { key: 'youtube',       label: 'YouTube' },
  { key: 'contato',       label: 'Contato' },
  { key: 'email',         label: 'E-mail' },
  { key: 'tem_grupo',     label: 'Tem grupo?' },
  { key: 'selos',         label: 'Selos' },
]

const COLUNAS_LIVRARIAS = [
  { key: 'nome',       label: 'Livraria', fixo: true },
  { key: 'editora',    label: 'Editora vinculada', fixo: true },
  { key: 'contato',    label: 'Contato' },
  { key: 'instagram',  label: 'Instagram' },
  { key: 'site',       label: 'Site' },
  { key: 'inauguracao',label: 'Inauguração' },
]

const COLS_EDITORAS_DEFAULT = ['classificacao','nome','status_parceria','macro','nicho','posicionamento','grupo_id']
const COLS_LIVRARIAS_DEFAULT = ['nome','editora','contato','site','inauguracao']

// ── SELETOR DE COLUNAS ─────────────────────────────────────
function SeletorColunas({ colunas, visiveis, onChange, onClose }) {
  return (
    <div style={{ position:'absolute', top:36, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:12, zIndex:50, minWidth:220, boxShadow:'0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8 }}>Colunas visíveis</div>
      {colunas.filter(c => !c.fixo).map(c => (
        <label key={c.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer', fontSize:13 }}>
          <input type="checkbox" checked={visiveis.includes(c.key)} onChange={e => {
            if (e.target.checked) onChange([...visiveis, c.key])
            else onChange(visiveis.filter(k => k !== c.key))
          }} style={{ accentColor:'var(--accent)', cursor:'pointer' }} />
          <span style={{ color:'var(--text)' }}>{c.label}</span>
        </label>
      ))}
    </div>
  )
}

// ── MODAL EDITORA ──────────────────────────────────────────
function ModalEditora({ editora, onSave, onClose }) {
  const empty = { nome:'', instagram:'', youtube:'', contato:'', email:'', tem_grupo:false, macro:'', nicho:'', sub_nicho:'', posicionamento:'', grupo_id:'', status_parceria:'ativa', selos:[] }
  const [form, setForm] = useState(editora ? { ...editora, selos: editora.selos_editoriais?.map(s=>s.nome)||[], grupo_id: editora.grupo_id??'' } : empty)
  const [novoSelo, setNovoSelo] = useState('')
  const [saving, setSaving] = useState(false)
  function set(k,v) { setForm(f=>({...f,[k]:v})) }
  function adicionarSelo() { const s=novoSelo.trim(); if(!s||form.selos.includes(s))return; setForm(f=>({...f,selos:[...f.selos,s]})); setNovoSelo('') }
  function removerSelo(s) { setForm(f=>({...f,selos:f.selos.filter(x=>x!==s)})) }
  async function salvar() {
    if(!form.nome.trim())return
    setSaving(true)
    try { await onSave({...form, grupo_id: form.grupo_id!==''?Number(form.grupo_id):null}); onClose() }
    catch(e){console.error(e)} finally{setSaving(false)}
  }
  const inp = (label,key,type='text',ph='') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={form[key]??''} placeholder={ph||label} onChange={e=>set(key,e.target.value)} />
    </div>
  )
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:560,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header">
          <h2 className="modal-title">{editora?'Editar editora':'Nova editora'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          {inp('Nome *','nome')}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status_parceria} onChange={e=>set('status_parceria',e.target.value)}>
              {STATUS_PARCERIA.map(s=><option key={s} value={s}>{STATUS_COR[s]?.label||s}</option>)}
            </select>
          </div>
          {inp('Instagram','instagram','text','@usuario')}
          {inp('YouTube','youtube')}
          {inp('Contato','contato')}
          {inp('E-mail','email','email')}
          {inp('Macro','macro')}
          {inp('Nicho','nicho')}
          {inp('Sub-nicho','sub_nicho')}
          {inp('Posicionamento','posicionamento')}
          <div className="form-group">
            <label className="form-label">Grupo</label>
            <select className="form-select" value={form.grupo_id??''} onChange={e=>set('grupo_id',e.target.value)}>
              <option value="">—</option>
              {GRUPOS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
            <label className="form-label" style={{margin:0}}>Tem grupo?</label>
            <input type="checkbox" checked={!!form.tem_grupo} onChange={e=>set('tem_grupo',e.target.checked)} style={{width:16,height:16,cursor:'pointer',accentColor:'var(--accent)'}}/>
          </div>
        </div>
        <div className="form-group" style={{marginTop:8}}>
          <label className="form-label">Selos editoriais</label>
          <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            {form.selos.map(s=>(
              <span key={s} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:20,fontSize:12,color:'var(--accent)'}}>
                {s}<button onClick={()=>removerSelo(s)} style={{background:'none',border:'none',cursor:'pointer',padding:0,color:'var(--accent)',display:'flex'}}><X size={11}/></button>
              </span>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input className="form-input" value={novoSelo} onChange={e=>setNovoSelo(e.target.value)} placeholder="Nome do selo" onKeyDown={e=>e.key==='Enter'&&adicionarSelo()} style={{flex:1}}/>
            <button className="btn btn-ghost btn-sm" onClick={adicionarSelo}><Plus size={13}/> Adicionar</button>
          </div>
        </div>
        <div className="form-actions" style={{marginTop:16}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL LIVRARIA ─────────────────────────────────────────
function ModalLivraria({ livraria, editoras, onSave, onClose }) {
  const empty = { nome:'', editora_id:'', contato:'', email:'', instagram:'', site:'', inauguracao:'' }
  const [form, setForm] = useState(livraria?{...livraria,editora_id:livraria.editora_id??'',inauguracao:livraria.inauguracao??''}:empty)
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function salvar() {
    if(!form.nome.trim())return
    setSaving(true)
    try { await onSave({...form,editora_id:form.editora_id||null,inauguracao:form.inauguracao||null}); onClose() }
    catch(e){console.error(e)} finally{setSaving(false)}
  }
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header">
          <h2 className="modal-title">{livraria?'Editar livraria':'Nova livraria'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="form-group" style={{gridColumn:'1/-1'}}>
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome da livraria"/>
          </div>
          <div className="form-group" style={{gridColumn:'1/-1'}}>
            <label className="form-label">Editora vinculada</label>
            <select className="form-select" value={form.editora_id} onChange={e=>set('editora_id',e.target.value)}>
              <option value="">—</option>
              {editoras.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contato</label>
            <input className="form-input" value={form.contato??''} onChange={e=>set('contato',e.target.value)} placeholder="Nome"/>
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input className="form-input" value={form.instagram??''} onChange={e=>set('instagram',e.target.value)} placeholder="@livraria"/>
          </div>
          <div className="form-group">
            <label className="form-label">Site</label>
            <input className="form-input" value={form.site??''} onChange={e=>set('site',e.target.value)} placeholder="https://"/>
          </div>
          <div className="form-group">
            <label className="form-label">Inauguração</label>
            <input className="form-input" type="date" value={form.inauguracao??''} onChange={e=>set('inauguracao',e.target.value)}/>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'Salvar'}</button>
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
  const [erro, setErro] = useState(null)

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    if (tipo === 'editora') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nome','Livraria (nome ou - se não tiver)','Macro','Nicho','Sub-nicho','Posicionamento','Grupo (I a VIII)','Status (ativa/encerramento/pendente)'],
        ['Editora Exemplo','-','Catolicismo','Formação católica','Espiritualidade; devoção','Conservadora','III','ativa'],
      ])
      ws['!cols'] = [28,24,16,28,32,18,14,16].map(w=>({wch:w}))
      XLSX.utils.book_append_sheet(wb, ws, 'Editoras')
      XLSX.writeFile(wb, 'template_editoras.xlsx')
    } else {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Editora (nome exato)','Contato Editora','Email Editora','Nome Livraria','Site Livraria','Contato Livraria','Email Livraria','Telefone','Data Contrato','Data Inauguração','Observação'],
        ['Editora Exemplo','João Silva','joao@ex.com','Livraria Exemplo','https://livraria.com','Maria Lima','maria@ex.com','(11) 99999-0000','01/01/2024','15/03/2024',''],
      ])
      ws['!cols'] = [28,20,24,24,24,20,24,16,14,14,20].map(w=>({wch:w}))
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
    setImportando(true)
    setErro(null)
    try {
      if (tipo === 'editora') await importarEditorasPlanilha(linhas)
      else await importarLivrariasPlanilha(linhas, editoras)
      onImported()
      onClose()
    } catch(e) {
      console.error(e)
      setErro(e?.message || 'Erro ao importar. Verifique o console.')
    } finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-header">
          <h2 className="modal-title">Importar {tipo==='editora'?'editoras':'livrarias'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        {etapa==='upload' && (
          <div>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Baixe o template, preencha e faça o upload.</p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{width:'100%',marginBottom:12,justifyContent:'center'}}>
              <FileSpreadsheet size={14}/> Baixar template .xlsx
            </button>
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)processar(f)}}
              style={{border:'2px dashed var(--border)',borderRadius:12,padding:'36px 20px',textAlign:'center',cursor:'pointer',background:'var(--surface-2)'}}>
              <Upload size={28} style={{color:'var(--text-muted)',marginBottom:8}}/>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>Clique ou arraste o arquivo .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{display:'none'}}
                onChange={e=>{const f=e.target.files?.[0];if(f)processar(f);e.target.value=''}}/>
            </div>
          </div>
        )}
        {etapa==='revisao' && (
          <div>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>{linhas.length} registro{linhas.length!==1?'s':''} encontrado{linhas.length!==1?'s':''}:</p>
            <div style={{maxHeight:280,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8,marginBottom:16}}>
              {linhas.map((l,i)=>(
                <div key={i} style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:13,display:'flex',gap:12}}>
                  <span style={{fontWeight:600,color:'var(--text)',flex:1}}>{l[0]}</span>
                  {tipo==='livraria' && <span style={{fontSize:11,color:'var(--text-muted)'}}>{l[3]}</span>}
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={()=>setEtapa('upload')}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmar} disabled={importando}>{importando?'Importando...':`Importar ${linhas.length}`}</button>
            </div>
            {erro && <div style={{marginTop:10,padding:'8px 12px',background:'#ef444418',border:'1px solid #ef4444',borderRadius:8,fontSize:12,color:'#ef4444'}}>{erro}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CÉLULA DA TABELA ───────────────────────────────────────
function Celula({ children, width = 120 }) {
  return (
    <td style={{padding:'7px 10px', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text)', maxWidth:width, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={typeof children === 'string' ? children : undefined}>
      {children || <span style={{color:'var(--border)'}}>—</span>}
    </td>
  )
}

// ── ABA EDITORAS ───────────────────────────────────────────
function AbaEditoras({ editoras, setEditoras, isAdmin, showToast }) {
  const [filtros, setFiltros] = useState({ nome:'', grupo:'', macro:'', posicionamento:'' })
  const [colsVisiveis, setColsVisiveis] = useState(COLS_EDITORAS_DEFAULT)
  const [showColSel, setShowColSel] = useState(false)
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)

  function setF(k,v){setFiltros(f=>({...f,[k]:v}))}

  const lista = editoras.filter(e => {
    if (filtros.nome && !e.nome?.toLowerCase().includes(filtros.nome.toLowerCase())) return false
    if (filtros.grupo && String(e.grupo_id) !== String(filtros.grupo)) return false
    if (filtros.macro && !e.macro?.toLowerCase().includes(filtros.macro.toLowerCase())) return false
    if (filtros.posicionamento && !e.posicionamento?.toLowerCase().includes(filtros.posicionamento.toLowerCase())) return false
    return true
  })

  const colsAtivas = COLUNAS_EDITORAS.filter(c => c.fixo || colsVisiveis.includes(c.key))

  async function handleSalvar(form) {
    if (modal==='new') { const nova=await createEditora(form); setEditoras(prev=>[...prev,nova]); showToast('Editora cadastrada!') }
    else { const upd=await updateEditora(modal.id,form); setEditoras(prev=>prev.map(e=>e.id===upd.id?upd:e)); showToast('Editora atualizada!') }
  }

  async function handleExcluir(e) {
    if (!window.confirm(`Remover ${e.nome}?`)) return
    await desativarEditora(e.id)
    setEditoras(prev=>prev.filter(x=>x.id!==e.id))
    showToast('Editora removida!')
  }

  function renderCelula(e, key) {
    if (key==='classificacao') return e.classificacao ? <span style={{fontWeight:800,color:CLASS_COR[e.classificacao]||'var(--accent)'}}>{e.classificacao}</span> : null
    if (key==='status_parceria') {
      const s = STATUS_COR[e.status_parceria||'ativa']
      return <span style={{fontSize:11,fontWeight:700,color:s.cor,background:s.bg,padding:'2px 8px',borderRadius:20,whiteSpace:'nowrap'}}>{s.label}</span>
    }
    if (key==='grupo_id') return e.grupo_id ? `${e.grupo_id} · ${GRUPOS.find(g=>g.id===e.grupo_id)?.label||''}` : null
    if (key==='tem_grupo') return e.tem_grupo ? '✓' : null
    if (key==='selos') return e.selos_editoriais?.map(s=>s.nome).join(', ') || null
    if (key==='instagram' && e.instagram) return <a href={`https://instagram.com/${e.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{e.instagram}</a>
    return e[key] || null
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:10}}>
        <span style={{fontSize:13,color:'var(--text-muted)'}}>{lista.length} editora{lista.length!==1?'s':''}</span>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowColSel(v=>!v)}><Settings2 size={13}/> Colunas</button>
            {showColSel && <SeletorColunas colunas={COLUNAS_EDITORAS} visiveis={colsVisiveis} onChange={setColsVisiveis} onClose={()=>setShowColSel(false)}/>}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={()=>setImportar(true)}><Upload size={13}/> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal('new')}><Plus size={13}/> Nova editora</button>
          </>}
        </div>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <input value={filtros.nome} onChange={e=>setF('nome',e.target.value)} placeholder="Buscar nome..." style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12,minWidth:160}}/>
        <select value={filtros.grupo} onChange={e=>setF('grupo',e.target.value)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12}}>
          <option value="">Todos os grupos</option>
          {GRUPOS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.label}</option>)}
        </select>
        <input value={filtros.macro} onChange={e=>setF('macro',e.target.value)} placeholder="Macro..." style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12,minWidth:120}}/>
        <input value={filtros.posicionamento} onChange={e=>setF('posicionamento',e.target.value)} placeholder="Posicionamento..." style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12,minWidth:140}}/>
        {Object.values(filtros).some(Boolean) && <button className="btn btn-ghost btn-sm" onClick={()=>setFiltros({nome:'',grupo:'',macro:'',posicionamento:''})}><X size={12}/> Limpar</button>}
      </div>

      {/* Tabela estilo planilha */}
      <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:8}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:'var(--surface-2)'}}>
              {colsAtivas.map(c=>(
                <th key={c.key} style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'var(--text-muted)',fontSize:11,textTransform:'uppercase',borderRight:'1px solid var(--border)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap'}}>{c.label}</th>
              ))}
              {isAdmin && <th style={{padding:'8px 10px',borderBottom:'2px solid var(--border)',width:60}}></th>}
            </tr>
          </thead>
          <tbody>
            {lista.length===0 ? (
              <tr><td colSpan={colsAtivas.length+1} style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)'}}>Nenhuma editora encontrada.</td></tr>
            ) : lista.map((e,i)=>(
              <tr key={e.id} style={{background: i%2===0 ? 'var(--surface)' : 'var(--surface-2)', transition:'background 0.1s'}}
                onMouseEnter={el=>el.currentTarget.style.background='var(--accent-glow)'}
                onMouseLeave={el=>el.currentTarget.style.background=i%2===0?'var(--surface)':'var(--surface-2)'}>
                {colsAtivas.map(c=>(
                  <Celula key={c.key} width={c.key==='nome'?180:c.key==='grupo_id'?200:120}>
                    {renderCelula(e,c.key)}
                  </Celula>
                ))}
                {isAdmin && (
                  <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>setModal(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}><Pencil size={12}/></button>
                      <button onClick={()=>handleExcluir(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',opacity:0.5}}><Trash2 size={12}/></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ModalEditora editora={modal==='new'?null:modal} onSave={handleSalvar} onClose={()=>setModal(null)}/>}
      {importar && <ModalImportar tipo="editora" editoras={editoras} onClose={()=>setImportar(false)} onImported={async()=>{setEditoras(await getEditorasCompletas());showToast('Editoras importadas!')}}/>}
    </div>
  )
}

// ── ABA LIVRARIAS ──────────────────────────────────────────
function AbaLivrarias({ livrarias, setLivrarias, editoras, isAdmin, showToast }) {
  const [filtros, setFiltros] = useState({ nome:'', editora:'' })
  const [colsVisiveis, setColsVisiveis] = useState(COLS_LIVRARIAS_DEFAULT)
  const [showColSel, setShowColSel] = useState(false)
  const [modal, setModal] = useState(null)
  const [importar, setImportar] = useState(false)

  function setF(k,v){setFiltros(f=>({...f,[k]:v}))}

  const lista = livrarias.filter(l=>{
    if(filtros.nome&&!l.nome?.toLowerCase().includes(filtros.nome.toLowerCase()))return false
    if(filtros.editora&&l.editora_id!==filtros.editora)return false
    return true
  })

  const colsAtivas = COLUNAS_LIVRARIAS.filter(c=>c.fixo||colsVisiveis.includes(c.key))

  async function handleSalvar(form) {
    if(modal==='new'){const nova=await createLivraria(form);setLivrarias(prev=>[...prev,nova].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')));showToast('Livraria cadastrada!')}
    else{const upd=await updateLivraria(modal.id,form);setLivrarias(prev=>prev.map(l=>l.id===upd.id?upd:l));showToast('Livraria atualizada!')}
  }

  async function handleExcluir(l){
    if(!window.confirm(`Remover ${l.nome}?`))return
    await desativarLivraria(l.id)
    setLivrarias(prev=>prev.filter(x=>x.id!==l.id))
    showToast('Livraria removida!')
  }

  function renderCelula(l, key) {
    if(key==='editora') return l.editoras_parceiras?.nome || null
    if(key==='site'&&l.site) return <a href={l.site} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>🔗 site</a>
    if(key==='instagram'&&l.instagram) return <a href={`https://instagram.com/${l.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{l.instagram}</a>
    if(key==='inauguracao'&&l.inauguracao) return new Date(l.inauguracao).toLocaleDateString('pt-BR')
    return l[key] || null
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:10}}>
        <span style={{fontSize:13,color:'var(--text-muted)'}}>{lista.length} livraria{lista.length!==1?'s':''}</span>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowColSel(v=>!v)}><Settings2 size={13}/> Colunas</button>
            {showColSel && <SeletorColunas colunas={COLUNAS_LIVRARIAS} visiveis={colsVisiveis} onChange={setColsVisiveis} onClose={()=>setShowColSel(false)}/>}
          </div>
          {isAdmin && <>
            <button className="btn btn-ghost btn-sm" onClick={()=>setImportar(true)}><Upload size={13}/> Importar</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal('new')}><Plus size={13}/> Nova livraria</button>
          </>}
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <input value={filtros.nome} onChange={e=>setF('nome',e.target.value)} placeholder="Buscar livraria..." style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12,minWidth:160}}/>
        <select value={filtros.editora} onChange={e=>setF('editora',e.target.value)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12}}>
          <option value="">Todas as editoras</option>
          {editoras.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {Object.values(filtros).some(Boolean)&&<button className="btn btn-ghost btn-sm" onClick={()=>setFiltros({nome:'',editora:''})}><X size={12}/> Limpar</button>}
      </div>

      <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:8}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:'var(--surface-2)'}}>
              {colsAtivas.map(c=>(
                <th key={c.key} style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'var(--text-muted)',fontSize:11,textTransform:'uppercase',borderRight:'1px solid var(--border)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap'}}>{c.label}</th>
              ))}
              {isAdmin&&<th style={{padding:'8px 10px',borderBottom:'2px solid var(--border)',width:60}}></th>}
            </tr>
          </thead>
          <tbody>
            {lista.length===0?(
              <tr><td colSpan={colsAtivas.length+1} style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)'}}>Nenhuma livraria encontrada.</td></tr>
            ):lista.map((l,i)=>(
              <tr key={l.id} style={{background:i%2===0?'var(--surface)':'var(--surface-2)'}}
                onMouseEnter={el=>el.currentTarget.style.background='var(--accent-glow)'}
                onMouseLeave={el=>el.currentTarget.style.background=i%2===0?'var(--surface)':'var(--surface-2)'}>
                {colsAtivas.map(c=>(
                  <Celula key={c.key} width={c.key==='nome'||c.key==='editora'?180:140}>
                    {renderCelula(l,c.key)}
                  </Celula>
                ))}
                {isAdmin&&(
                  <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>setModal(l)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}><Pencil size={12}/></button>
                      <button onClick={()=>handleExcluir(l)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',opacity:0.5}}><Trash2 size={12}/></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal&&<ModalLivraria livraria={modal==='new'?null:modal} editoras={editoras} onSave={handleSalvar} onClose={()=>setModal(null)}/>}
      {importar&&<ModalImportar tipo="livraria" editoras={editoras} onClose={()=>setImportar(false)} onImported={async()=>{setLivrarias(await getLivrarias());showToast('Livrarias importadas!')}}/>}
    </div>
  )
}

// ── ABA GRUPOS ─────────────────────────────────────────────
function AbaGrupos({ editoras, livrarias }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:16}}>
      {GRUPOS.map(grupo=>{
        const eds = editoras.filter(e=>e.grupo_id===grupo.id)
        const livs = livrarias.filter(l=>l.editora_id&&eds.some(e=>e.id===l.editora_id))
        const total = eds.length + livs.length
        return (
          <div key={grupo.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',background:'var(--surface-2)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span style={{fontSize:11,fontWeight:800,color:'var(--accent)',marginRight:6}}>{grupo.id}</span>
                <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{grupo.label}</span>
              </div>
              <span style={{fontSize:11,color:'var(--text-muted)',background:'var(--surface-3)',padding:'2px 8px',borderRadius:20}}>{total}</span>
            </div>
            <div style={{padding:'8px 0'}}>
              {total===0?(
                <div style={{padding:'12px 16px',fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>Nenhum membro neste grupo.</div>
              ):(
                <>
                  {eds.map(e=>(
                    <div key={e.id} style={{padding:'7px 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid var(--border)'}}>
                      {e.classificacao&&<span style={{fontSize:11,fontWeight:800,color:CLASS_COR[e.classificacao]||'var(--accent)',minWidth:16}}>{e.classificacao}</span>}
                      <span style={{fontSize:13,color:'var(--text)',flex:1}}>{e.nome}</span>
                      <span style={{fontSize:11,fontWeight:700,color:STATUS_COR[e.status_parceria||'ativa']?.cor,background:STATUS_COR[e.status_parceria||'ativa']?.bg,padding:'2px 8px',borderRadius:20}}>
                        {STATUS_COR[e.status_parceria||'ativa']?.label}
                      </span>
                    </div>
                  ))}
                  {livs.map(l=>(
                    <div key={l.id} style={{padding:'7px 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid var(--border)',background:'var(--surface-2)'}}>
                      <span style={{fontSize:13,color:'var(--text)',flex:1,fontWeight:700}}>{l.nome}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>livraria</span>
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
  const isAdmin = usuario?.perfil==='administrador'||usuario?.perfil==='gerente'||usuario?.perfil==='supervisor_parceiras'
  const [aba, setAba] = useState('editoras')
  const [editoras, setEditoras] = useState([])
  const [livrarias, setLivrarias] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, showToast] = useToast()

  useEffect(()=>{
    setLoading(true)
    Promise.all([getEditorasCompletas(),getLivrarias()])
      .then(([eds,livs])=>{setEditoras(eds);setLivrarias(livs)})
      .catch(console.error)
      .finally(()=>setLoading(false))
  },[])

  function tabStyle(ativa) {
    return { padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer',border:'none',borderBottom:ativa?'2px solid var(--accent)':'2px solid transparent',background:'transparent',color:ativa?'var(--accent)':'var(--text-muted)',transition:'all 0.15s',display:'flex',alignItems:'center',gap:6 }
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
        <BookOpen size={22} color="var(--accent)"/>
        <div>
          <h1 className="page-title" style={{margin:0}}>Editoras & Livrarias</h1>
          <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{editoras.length} editoras · {livrarias.length} livrarias</p>
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:24}}>
        <button style={tabStyle(aba==='editoras')} onClick={()=>setAba('editoras')}><Building2 size={14}/> Editoras</button>
        <button style={tabStyle(aba==='livrarias')} onClick={()=>setAba('livrarias')}><Library size={14}/> Livrarias</button>
        <button style={tabStyle(aba==='grupos')} onClick={()=>setAba('grupos')}><LayoutGrid size={14}/> Grupos</button>
      </div>

      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <>
          {aba==='editoras'&&<AbaEditoras editoras={editoras} setEditoras={setEditoras} isAdmin={isAdmin} showToast={showToast}/>}
          {aba==='livrarias'&&<AbaLivrarias livrarias={livrarias} setLivrarias={setLivrarias} editoras={editoras} isAdmin={isAdmin} showToast={showToast}/>}
          {aba==='grupos'&&<AbaGrupos editoras={editoras} livrarias={livrarias}/>}
        </>
      )}

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
