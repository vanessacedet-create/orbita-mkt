import { useEffect, useState, useRef } from 'react'
import {
  getParceiros, createParceiro, updateParceiro, deleteParceiro, getEditoras,
} from '../lib/supabase'
import {
  Plus, Pencil, Trash2, X, Upload, Download, Users,
  FileSpreadsheet, AlertCircle, CheckCircle
} from 'lucide-react'
import * as XLSX from 'xlsx'

const TIPOS_PARCERIA = [
  'Livraria de influencer',
  'Booktime',
  'Divulgação editoras próprias',
]

const CANAIS_COMUNICACAO = [
  'WhatsApp',
  'E-mail',
  'Instagram (DM)',
  'Telefone',
  'Outro',
]

const NIVEIS = {
  ouro:    { label:'Ouro',    emoji:'🏆', cor:'#f59e0b', bg:'rgba(245,158,11,0.12)'  },
  prata:   { label:'Prata',   emoji:'🥈', cor:'#9ca3af', bg:'rgba(156,163,175,0.12)' },
  bronze:  { label:'Bronze',  emoji:'🥉', cor:'#b45309', bg:'rgba(180,83,9,0.12)'    },
  atencao: { label:'Atenção', emoji:'⚠️', cor:'#ef4444', bg:'rgba(239,68,68,0.12)'   },
}

function BadgeNivel({ nivel }) {
  if (!nivel) return <span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>
  const n = NIVEIS[nivel] || NIVEIS.atencao
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:n.bg,border:`1px solid ${n.cor}40`,borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700,color:n.cor}}>
      {n.emoji} {n.label}
    </span>
  )
}

function NotaCirculo({ nota }) {
  if (nota === null || nota === undefined) return <span style={{fontSize:12,color:'var(--text-muted)'}}>—</span>
  const cor = nota >= 8 ? '#f59e0b' : nota >= 6 ? '#9ca3af' : nota >= 4 ? '#b45309' : '#ef4444'
  return (
    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,borderRadius:'50%',fontSize:13,fontWeight:800,color:'#fff',background:cor,boxShadow:`0 0 0 3px ${cor}30`}}>
      {nota.toFixed(1)}
    </span>
  )
}

function ModalPontuacao({ parceiro, onClose }) {
  const p = parceiro.pontuacao
  if (!p) return null
  const n = NIVEIS[p.nivel] || NIVEIS.atencao
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:420}}>
        <div className="modal-header">
          <h2 className="modal-title">Pontuação — {parceiro.nome}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{textAlign:'center',padding:'16px 0 20px'}}>
          <NotaCirculo nota={p.nota}/>
          <div style={{marginTop:10}}><BadgeNivel nivel={p.nivel}/></div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>
            Baseado em {p.totalCampanhas} campanha{p.totalCampanhas!==1?'s':''}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,paddingBottom:16}}>
          {[
            {label:'Campanhas totais', value:p.totalCampanhas},
            {label:'Publicações', value:p.publicadas},
            {label:'Taxa de publicação', value:p.totalCampanhas>0?`${Math.round(p.publicadas/p.totalCampanhas*100)}%`:'—'},
            {label:'Nível', value:`${n.emoji} ${n.label}`},
          ].map(({label,value})=>(
            <div key={label} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{label}</div>
              <div style={{fontSize:16,fontWeight:800,color:'var(--text)'}}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
          <strong style={{color:'var(--text)',display:'block',marginBottom:6}}>Como a nota é calculada:</strong>
          Publicou (10pts) · Confirmado (5pts) · Sem retorno (3pts) · Recusou (2pts) · Não publicou (0pts)
          <span style={{marginTop:4,display:'block'}}>+1pt por rapidez (confirmou em até 3 dias) · +0.5pt por constância (3+ publicações) · Campanhas recentes pesam mais.</span>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}


function normalizar(s) {
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type='success') { setToast({msg,type}); setTimeout(()=>setToast(null),4000) }
  return [toast, show]
}

// ── UPLOAD PLANILHA ────────────────────────────────────────
function UploadPlanilha({ onImport }) {
  const [open, setOpen]           = useState(false)
  const [preview, setPreview]     = useState([])
  const [erros, setErros]         = useState([])
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef                  = useRef()

  const colunas    = ['nome', 'tipo_parceria', 'cpf', 'livraria', 'canal_comunicacao', 'taxa_engajamento', 'editoras_divulga', 'temas']
  const nomeColuna = {
    nome: 'Nome', tipo_parceria: 'Tipo de Parceria', cpf: 'CPF', livraria: 'Livraria',
    canal_comunicacao: 'Canal', taxa_engajamento: 'Engajamento',
    editoras_divulga: 'Editoras', temas: 'Temas'
  }
  const aliases = {
    nome:             ['nome', 'name', 'parceiro'],
    tipo_parceria:    ['tipo_parceria', 'tipo de parceria', 'tipo', 'parceria'],
    cpf:              ['cpf', 'documento', 'doc'],
    livraria:         ['livraria', 'loja', 'bookstore'],
    canal_comunicacao:['canal_comunicacao', 'canal de comunicacao', 'canal', 'melhor canal'],
    taxa_engajamento: ['taxa_engajamento', 'taxa de engajamento', 'engajamento', 'taxa'],
    editoras_divulga: ['editoras_divulga', 'editoras que divulga', 'editoras', 'editora'],
    temas:            ['temas', 'tema', 'assuntos'],
  }

  function resolverColuna(headers, campo) {
    const alts = aliases[campo] || [campo]
    return headers.find(h => alts.includes(normalizar(h).replace(/_/g,' ').trim()) || alts.includes(normalizar(h)))
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
        const headers = Object.keys(rows[0])
        const normalized = rows.map(row => {
          const obj = {}
          colunas.forEach(campo => {
            const h = resolverColuna(headers, campo)
            obj[campo] = h ? String(row[h]).trim() : ''
          })
          return obj
        })
        const errosEncontrados = []
        normalized.forEach((row, i) => {
          if (!row.nome) errosEncontrados.push(`Linha ${i+2}: campo "Nome" está vazio.`)
        })
        setErros(errosEncontrados)
        setPreview(normalized.slice(0, 5))
        inputRef.current._allRows = normalized
      } catch { setErros(['Erro ao ler o arquivo. Verifique se é um Excel válido (.xlsx).']) }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    const rows = inputRef.current._allRows
    if (!rows || !rows.length) return
    setImporting(true)
    let sucesso = 0, falhas = 0, atualizados = 0
    let existentes = []
    try { existentes = await getParceiros() } catch {}
    for (const row of rows) {
      try {
        const payload = {
          nome: row.nome, tipo_parceria: row.tipo_parceria||'', cpf: row.cpf||'',
          livraria: row.livraria||'', canal_comunicacao: row.canal_comunicacao||'',
          taxa_engajamento: row.taxa_engajamento||'',
          editoras_divulga: row.editoras_divulga||'', temas: row.temas||'',
        }
        const existente = existentes.find(p => normalizar(p.nome) === normalizar(row.nome||''))
        if (existente) { await updateParceiro(existente.id, payload); atualizados++ }
        else { await createParceiro(payload); sucesso++ }
      } catch { falhas++ }
    }
    setImporting(false)
    setResultado({ sucesso, falhas, atualizados })
    onImport()
  }

  function reset() {
    setOpen(false); setPreview([]); setErros([]); setResultado(null)
    if (inputRef.current) { inputRef.current.value=''; inputRef.current._allRows=null }
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={()=>setOpen(true)}>
        <Upload size={15}/> Importar planilha
      </button>
      {open && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&reset()}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-header">
              <h2 className="modal-title">Importar Parceiros</h2>
              <button className="btn btn-ghost btn-icon" onClick={reset}><X size={16}/></button>
            </div>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 16px',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <FileSpreadsheet size={15} color="var(--text-muted)"/>
                <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Colunas esperadas</span>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {colunas.map(c=><span key={c} className="badge badge-indigo" style={{fontSize:11}}>{nomeColuna[c]}</span>)}
              </div>
            </div>
            {!resultado && (<>
              <div style={{border:'2px dashed var(--border)',borderRadius:10,padding:'28px 20px',textAlign:'center',marginBottom:16,cursor:'pointer'}}
                onClick={()=>inputRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();handleFile({target:{files:e.dataTransfer.files}})}}>
                <Upload size={24} color="var(--text-muted)" style={{marginBottom:8}}/>
                <p style={{fontSize:13.5,color:'var(--text-soft)'}}>Clique para selecionar ou arraste o arquivo</p>
                <p style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Apenas .xlsx</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleFile}/>
              {erros.length > 0 && (
                <div style={{background:'var(--red-light)',border:'1px solid rgba(245,101,101,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
                  {erros.slice(0,5).map((e,i)=>(
                    <div key={i} style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12.5,color:'var(--red)'}}>
                      <AlertCircle size={14} style={{marginTop:2,flexShrink:0}}/> {e}
                    </div>
                  ))}
                  {erros.length>5&&<p style={{fontSize:12,color:'var(--red)',marginTop:4}}>...e mais {erros.length-5} erros.</p>}
                </div>
              )}
              {preview.length > 0 && erros.length === 0 && (
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>
                    Prévia — {preview.length} de {inputRef.current?._allRows?.length||0} linhas:
                  </p>
                  <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                    <table style={{fontSize:12}}>
                      <thead><tr>{colunas.map(c=><th key={c}>{nomeColuna[c]}</th>)}</tr></thead>
                      <tbody>{preview.map((row,i)=><tr key={i}>{colunas.map(c=><td key={c}>{row[c]||'—'}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>)}
            {resultado && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <CheckCircle size={40} color="var(--green)" style={{marginBottom:12}}/>
                <p style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:6}}>Importação concluída!</p>
                <p style={{fontSize:13.5,color:'var(--green)'}}>{resultado.sucesso} parceiro(s) criado(s)</p>
                {resultado.atualizados>0&&<p style={{fontSize:13,color:'var(--amber)',marginTop:4}}>{resultado.atualizados} atualizado(s)</p>}
                {resultado.falhas>0&&<p style={{fontSize:13,color:'var(--red)',marginTop:4}}>{resultado.falhas} com erro</p>}
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={reset}>{resultado?'Fechar':'Cancelar'}</button>
              {!resultado && preview.length>0 && erros.length===0 && (
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing?'Importando...':`Importar ${inputRef.current?._allRows?.length||0} registros`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Parceiros() {
  const [parceiros, setParceiros] = useState([])
  const [modal, setModal]         = useState(false)
  const [modalPontuacao, setModalPontuacao] = useState(null)
  const [editing, setEditing]     = useState(null)
  const [search, setSearch]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [toast, showToast]        = useToast()
  const [editoras, setEditoras]   = useState([])
  const [editoraSearch, setEditoraSearch] = useState('')

  const EMPTY = { nome:'', tipo_parceria:'', cpf:'', livraria:'', canal_comunicacao:'', taxa_engajamento:'', editoras_divulga:[], temas:'' }
  const [form, setForm] = useState(EMPTY)

  async function reload() { setParceiros(await getParceirosComPontuacao()) }

  useEffect(() => {
    reload()
    getEditoras().then(setEditoras).catch(console.error)
  }, [])

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(p) {
    setEditing(p)
    setForm({
      nome:              p.nome,
      tipo_parceria:     p.tipo_parceria||'',
      cpf:               p.cpf||'',
      livraria:          p.livraria||'',
      canal_comunicacao: p.canal_comunicacao||'',
      taxa_engajamento:  p.taxa_engajamento||'',
      editoras_divulga:  p.editoras_divulga ? p.editoras_divulga.split(',').map(e=>e.trim()).filter(Boolean) : [],
      temas:             p.temas||'',
    })
    setModal(true)
  }
  function close() { setModal(false); setEditing(null) }

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, editoras_divulga: form.editoras_divulga.join(',') }
      if (editing) { await updateParceiro(editing.id, payload); showToast('Atualizado!') }
      else { await createParceiro(payload); showToast('Cadastrado!') }
      await reload()
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir este parceiro?')) return
    try { await deleteParceiro(id); setParceiros(prev=>prev.filter(p=>p.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  function exportar() {
    const rows = parceiros.map(p=>({
      'Nome':                     p.nome,
      'Tipo de Parceria':         p.tipo_parceria||'',
      'CPF':                      p.cpf||'',
      'Livraria':                 p.livraria||'',
      'Melhor Canal de Comunicação': p.canal_comunicacao||'',
      'Taxa de Engajamento':      p.taxa_engajamento||'',
      'Editoras que Divulga':     p.editoras_divulga||'',
      'Temas':                    p.temas||'',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Parceiros')
    XLSX.writeFile(wb, 'parceiros.xlsx')
  }

  const filtered = parceiros
    .filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.tipo_parceria||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.livraria||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.canal_comunicacao||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.temas||'').toLowerCase().includes(search.toLowerCase())
  )
  .sort((a,b) => {
    const na = a.pontuacao?.nota ?? -1
    const nb = b.pontuacao?.nota ?? -1
    if (na !== nb) return nb - na
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Parceiros</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {parceiros.length} parceiro{parceiros.length!==1?'s':''} cadastrado{parceiros.length!==1?'s':''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <UploadPlanilha onImport={reload}/>
          <button className="btn btn-ghost" onClick={exportar}><Download size={15}/> Exportar</button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Parceiro</button>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Parceiros ({filtered.length})</span>
          <input className="search-input" placeholder="Buscar por nome, tipo, livraria, canal..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0
          ? <div className="empty-state"><p>Nenhum parceiro encontrado.</p></div>
          : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Nota</th>
                  <th>Tipo de Parceria</th>
                  <th>Livraria</th>
                  <th>Canal</th>
                  <th>Engajamento</th>
                  <th>Temas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div className="td-strong">{p.nome}</div>
                      {p.cpf&&<div style={{fontSize:11,color:'var(--text-muted)'}}>CPF: {p.cpf}</div>}
                    </td>
                    <td style={{cursor:'pointer'}} onClick={()=>p.pontuacao&&setModalPontuacao(p)}>
                      {p.pontuacao
                        ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                            <NotaCirculo nota={p.pontuacao.nota}/>
                            <BadgeNivel nivel={p.pontuacao.nivel}/>
                          </div>
                        : <span style={{fontSize:11,color:'var(--text-muted)'}}>Sem histórico</span>
                      }
                    </td>
                    <td>{p.tipo_parceria?<span className="badge badge-indigo">{p.tipo_parceria}</span>:<span className="td-muted">—</span>}</td>
                    <td style={{fontSize:12}}>{p.livraria||<span className="td-muted">—</span>}</td>
                    <td style={{fontSize:12}}>
                      {p.canal_comunicacao
                        ? <span className="badge badge-amber" style={{fontSize:10}}>{p.canal_comunicacao}</span>
                        : <span className="td-muted">—</span>}
                    </td>
                    <td style={{fontSize:12}}>
                      {p.taxa_engajamento
                        ? <span style={{color:'var(--green)',fontWeight:700}}>{p.taxa_engajamento}</span>
                        : <span className="td-muted">—</span>}
                    </td>
                    <td style={{fontSize:12,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {p.temas||<span className="td-muted">—</span>}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(p)}><Pencil size={14}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(p.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Modal novo/editar */}
      {modal && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing?'Editar Parceiro':'Novo Parceiro'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome do Parceiro *</label>
                  <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/>
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input className="form-input" value={form.cpf} onChange={e=>setForm(f=>({...f,cpf:e.target.value}))} placeholder="000.000.000-00"/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo de Parceria</label>
                  <select className="form-select" value={form.tipo_parceria} onChange={e=>setForm(f=>({...f,tipo_parceria:e.target.value}))}>
                    <option value="">Selecionar...</option>
                    {TIPOS_PARCERIA.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Livraria</label>
                  <input className="form-input" value={form.livraria} onChange={e=>setForm(f=>({...f,livraria:e.target.value}))} placeholder="Nome da livraria (se aplicável)"/>
                </div>
              </div>

              {/* Melhor canal de comunicação — acima da taxa de engajamento */}
              <div className="form-group">
                <label className="form-label">Melhor Canal de Comunicação</label>
                <select className="form-select" value={form.canal_comunicacao} onChange={e=>setForm(f=>({...f,canal_comunicacao:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {CANAIS_COMUNICACAO.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Taxa de Engajamento Interno</label>
                <input className="form-input" value={form.taxa_engajamento} onChange={e=>setForm(f=>({...f,taxa_engajamento:e.target.value}))} placeholder="Ex: 5%, alto, médio..."/>
              </div>

              <div className="form-group">
                <label className="form-label">Editoras que o Parceiro Divulga</label>
                {form.editoras_divulga.length > 0 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                    {form.editoras_divulga.map(e=>(
                      <span key={e} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:20,padding:'3px 10px',fontSize:12,color:'var(--accent)',fontWeight:600}}>
                        {e}
                        <button onClick={()=>setForm(f=>({...f,editoras_divulga:f.editoras_divulga.filter(x=>x!==e)}))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:0,display:'flex',lineHeight:1}}><X size={11}/></button>
                      </span>
                    ))}
                  </div>
                )}
                <input className="form-input" value={editoraSearch} onChange={e=>setEditoraSearch(e.target.value)} placeholder="Buscar editora..."/>
                {editoraSearch.trim() && (
                  <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:160,overflowY:'auto',background:'var(--surface-2)'}}>
                    {editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_divulga.includes(e)).length===0
                      ? <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-muted)'}}>Nenhuma editora encontrada</div>
                      : editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_divulga.includes(e)).map(e=>(
                          <div key={e} onClick={()=>{setForm(f=>({...f,editoras_divulga:[...f.editoras_divulga,e]}));setEditoraSearch('')}}
                            style={{padding:'8px 14px',fontSize:13,cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                            onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-3)'}
                            onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                            {e}
                          </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Temas que o Parceiro Aborda</label>
                <textarea className="form-textarea" rows={2} value={form.temas} onChange={e=>setForm(f=>({...f,temas:e.target.value}))} placeholder="Ex: filosofia, teologia, literatura clássica..."/>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>
                {saving?'Salvando...':editing?'Salvar':'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPontuacao&&<ModalPontuacao parceiro={modalPontuacao} onClose={()=>setModalPontuacao(null)}/>}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
