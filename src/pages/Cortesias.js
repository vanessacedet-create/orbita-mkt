import { useEffect, useState, useRef } from 'react'
import {
  getParceiros, createParceiro, updateParceiro, deleteParceiro, getEditoras,
  getLivros, createLivro, updateLivro, deleteLivro,
  getEnvios, getEnvioCompleto, createEnvio, updateEnvio, updateEnvioStatus, deleteEnvio, updateEnvioLivroDivulgacao
} from '../lib/supabase'
import {
  Plus, Pencil, Trash2, X, BookOpen, Users, Send,
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, Search, BarChart2, Megaphone
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

const TIPOS_PARCERIA = [
  'Livraria de influencer',
  'Booktime',
  'Divulgação editoras próprias',
]

const STATUS_OPTIONS = [
  { value: 'enviado',   label: 'Enviado',   cls: 'badge-amber' },
  { value: 'divulgado', label: 'Divulgado', cls: 'badge-green' },
  { value: 'cancelado', label: 'Cancelado', cls: 'badge-red'   },
]

const TABS = [
  { id: 'envios',       label: 'Envios',       icon: Send },
  { id: 'parceiros',    label: 'Parceiros',    icon: Users },
  { id: 'livros',       label: 'Livros',       icon: BookOpen },
  { id: 'divulgacoes',  label: 'Divulgações',  icon: Megaphone },
  { id: 'relatorios',   label: 'Relatórios',   icon: BarChart2 },
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }
  return [toast, show]
}

// Remove acentos e normaliza string para comparação
function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

// ── MODAL DE BUSCA DE DUPLICATAS ───────────────────────────
function BuscaDuplicatas({ parceiros, livros, envios, onClose }) {
  const [parceiroId, setParceiroId] = useState('')
  const [livroId, setLivroId]       = useState('')
  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen]     = useState(false)
  const [livroSearch, setLivroSearch] = useState('')
  const [resultado, setResultado]   = useState(null)

  const livrosFiltrados = livros.filter(l =>
    normalizar(l.titulo).includes(normalizar(livroSearch)) ||
    (l.isbn || '').replace(/-/g, '').includes(livroSearch.replace(/-/g, '')) ||
    (l.sku || '').toLowerCase().includes(livroSearch.toLowerCase())
  )

  function buscar() {
    if (!parceiroId || !livroId) return
    const jaEnviado = envios.find(e =>
      e.parceiro_id === parceiroId &&
      (e.envio_livros || []).some(el => el.livros?.id === livroId)
    )
    if (jaEnviado) {
      const s = STATUS_OPTIONS.find(x => x.value === jaEnviado.status)
      setResultado({
        encontrado: true,
        status: s,
        data: jaEnviado.data_envio,
        obs: jaEnviado.observacoes,
      })
    } else {
      setResultado({ encontrado: false })
    }
  }

  const parceiro = parceiros.find(p => p.id === parceiroId)
  const livro    = livros.find(l => l.id === livroId)

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Verificar Envio Anterior</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Parceiro</label>
            <select className="form-select" value={parceiroId} onChange={e => { setParceiroId(e.target.value); setResultado(null) }}>
              <option value="">Selecionar parceiro...</option>
              {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Livro</label>
            <input
              className="form-input"
              placeholder="Buscar por título, ISBN ou SKU..."
              value={livroSearch}
              onChange={e => { setLivroSearch(e.target.value); setLivroId(''); setResultado(null) }}
              style={{ marginBottom: 6 }}
            />
            <div style={{ border:'1px solid var(--border)', borderRadius:8, maxHeight:160, overflowY:'auto', background:'var(--surface-2)' }}>
              {livroSearch === '' ? (
                <div style={{ padding:'10px 14px', fontSize:13, color:'var(--text-muted)' }}>Digite para buscar um livro...</div>
              ) : livrosFiltrados.length === 0 ? (
                <div style={{ padding:'10px 14px', fontSize:13, color:'var(--text-muted)' }}>Nenhum livro encontrado.</div>
              ) : livrosFiltrados.map(l => (
                <div
                  key={l.id}
                  onClick={() => { setLivroId(l.id); setLivroSearch(l.titulo); setResultado(null) }}
                  style={{
                    padding:'10px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: livroId === l.id ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize:13, color: livroId===l.id ? 'var(--accent)':'var(--text)', fontWeight: livroId===l.id?600:400 }}>{l.titulo}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>
                    {l.isbn && <span>ISBN: {l.isbn}</span>}
                    {l.isbn && l.sku && <span> · </span>}
                    {l.sku && <span>SKU: {l.sku}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, marginBottom: resultado ? 16 : 0 }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={buscar}
            disabled={!parceiroId || !livroId}
          >
            <Search size={15}/> Verificar
          </button>
        </div>

        {resultado && (
          <div style={{
            borderRadius: 10,
            padding: '16px 18px',
            background: resultado.encontrado ? 'var(--amber-light)' : 'var(--green-light)',
            border: `1px solid ${resultado.encontrado ? 'rgba(245,166,35,0.25)' : 'rgba(62,207,142,0.25)'}`,
          }}>
            {resultado.encontrado ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <AlertCircle size={18} color="var(--amber)"/>
                  <span style={{ fontWeight:700, color:'var(--amber)', fontSize:14 }}>
                    Este livro já foi enviado para este parceiro!
                  </span>
                </div>
                <div style={{ fontSize:13, color:'var(--text-soft)', lineHeight:1.7 }}>
                  <div><strong>Parceiro:</strong> {parceiro?.nome}</div>
                  <div><strong>Livro:</strong> {livro?.titulo}</div>
                  <div><strong>Status:</strong> <span className={`badge ${resultado.status?.cls}`}>{resultado.status?.label}</span></div>
                  {resultado.data && <div><strong>Data:</strong> {format(new Date(resultado.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>}
                  {resultado.obs && <div><strong>Obs:</strong> {resultado.obs}</div>}
                </div>
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <CheckCircle size={18} color="var(--green)"/>
                <span style={{ fontWeight:700, color:'var(--green)', fontSize:14 }}>
                  Este livro ainda não foi enviado para este parceiro.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── UPLOAD PLANILHA ────────────────────────────────────────
function UploadPlanilha({ onImport, tipo }) {
  const [open, setOpen]           = useState(false)
  const [preview, setPreview]     = useState([])
  const [erros, setErros]         = useState([])
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef                  = useRef()

  const colunasParceiros = ['nome', 'tipo_parceria', 'cpf', 'livraria', 'taxa_engajamento', 'editoras_divulga', 'temas']
  const colunasLivros    = ['titulo', 'isbn', 'sku', 'autor', 'editora']
  const colunas          = tipo === 'parceiros' ? colunasParceiros : colunasLivros

  const nomeColuna = {
    nome: 'Nome', tipo_parceria: 'Tipo de Parceria', cpf: 'CPF', livraria: 'Livraria', taxa_engajamento: 'Engajamento', editoras_divulga: 'Editoras', temas: 'Temas',
    titulo: 'Título', isbn: 'ISBN', sku: 'SKU', autor: 'Autor', editora: 'Editora'
  }

  // Mapeia variações de nomes de colunas (com/sem acento, maiúsculas)
  const aliases = {
    titulo: ['titulo', 'título', 'title', 'nome do livro'],
    isbn:   ['isbn', 'ean', 'isbn/ean'],
    sku:    ['sku', 'cod', 'codigo', 'código'],
    autor:  ['autor', 'author', 'autora'],
    editora:['editora', 'publisher', 'editoras'],
    nome:             ['nome', 'name', 'parceiro'],
    tipo_parceria:    ['tipo_parceria', 'tipo de parceria', 'tipo', 'parceria'],
    cpf:              ['cpf', 'documento', 'doc'],
    livraria:         ['livraria', 'loja', 'bookstore'],
    taxa_engajamento: ['taxa_engajamento', 'taxa de engajamento', 'engajamento', 'taxa'],
    editoras_divulga: ['editoras_divulga', 'editoras que divulga', 'editoras', 'editora'],
    temas:            ['temas', 'tema', 'assuntos', 'assunto'],
  }

  function resolverColuna(headers, campo) {
    const alts = aliases[campo] || [campo]
    return headers.find(h => alts.includes(normalizar(h).replace(/_/g, ' ').trim()) ||
                              alts.includes(normalizar(h)))
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

        // Normaliza mapeando aliases
        const normalized = rows.map(row => {
          const obj = {}
          colunas.forEach(campo => {
            const headerReal = resolverColuna(headers, campo)
            obj[campo] = headerReal ? String(row[headerReal]).trim() : ''
          })
          return obj
        })

        const campoObrigatorio = tipo === 'parceiros' ? 'nome' : 'titulo'
        const errosEncontrados = []
        normalized.forEach((row, i) => {
          if (!row[campoObrigatorio]) errosEncontrados.push(`Linha ${i + 2}: campo "${campoObrigatorio}" está vazio.`)
        })

        setErros(errosEncontrados)
        setPreview(normalized.slice(0, 5))
        inputRef.current._allRows = normalized
      } catch {
        setErros(['Erro ao ler o arquivo. Verifique se é um Excel válido (.xlsx).'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    const rows = inputRef.current._allRows
    if (!rows || rows.length === 0) return
    setImporting(true)
    let sucesso = 0, falhas = 0, atualizados = 0

    // Para parceiros: busca todos existentes para comparar por nome
    let parceirosExistentes = []
    if (tipo === 'parceiros') {
      try { parceirosExistentes = await getParceiros() } catch {}
    }

    for (const row of rows) {
      try {
        if (tipo === 'parceiros') {
          const payload = {
            nome:             row.nome || '',
            tipo_parceria:    row.tipo_parceria || '',
            cpf:              row.cpf || '',
            livraria:         row.livraria || '',
            taxa_engajamento: row.taxa_engajamento || '',
            editoras_divulga: row.editoras_divulga || '',
            temas:            row.temas || '',
          }
          // Verifica se já existe pelo nome (normalizado)
          const normalizado = (s) => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'')
          const existente = parceirosExistentes.find(p => normalizado(p.nome) === normalizado(row.nome || ''))
          if (existente) {
            await updateParceiro(existente.id, payload)
            atualizados++
          } else {
            await createParceiro(payload)
            sucesso++
          }
        } else {
          await createLivro({ titulo: row.titulo || '', isbn: row.isbn || '', sku: row.sku || '', autor: row.autor || '', editora: row.editora || '' })
          sucesso++
        }
      } catch { falhas++ }
    }

    setImporting(false)
    setResultado({ sucesso, falhas, atualizados })
    onImport()
  }

  function reset() {
    setOpen(false); setPreview([]); setErros([]); setResultado(null)
    if (inputRef.current) { inputRef.current.value = ''; inputRef.current._allRows = null }
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Upload size={15}/> Importar planilha
      </button>

      {open && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && reset()}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">Importar {tipo === 'parceiros' ? 'Parceiros' : 'Livros'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={reset}><X size={16}/></button>
            </div>

            <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <FileSpreadsheet size={15} color="var(--text-muted)"/>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Colunas esperadas
                </span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {colunas.map(c => <span key={c} className="badge badge-indigo" style={{fontSize:11}}>{nomeColuna[c]}</span>)}
              </div>
              <p style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:8 }}>
                Acentos e maiúsculas são aceitos. {tipo === 'livros' ? '"EAN" também é aceito no lugar de "ISBN".' : ''}
              </p>
            </div>

            {!resultado && (
              <>
                <div
                  style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'28px 20px', textAlign:'center', marginBottom:16, cursor:'pointer' }}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFile({ target: { files: e.dataTransfer.files } }) }}
                >
                  <Upload size={24} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <p style={{ fontSize:13.5, color:'var(--text-soft)' }}>Clique para selecionar ou arraste o arquivo</p>
                  <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Apenas .xlsx</p>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={handleFile}/>

                {erros.length > 0 && (
                  <div style={{ background:'var(--red-light)', border:'1px solid rgba(245,101,101,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                    {erros.slice(0, 5).map((e,i) => (
                      <div key={i} style={{ display:'flex', gap:7, alignItems:'flex-start', fontSize:12.5, color:'var(--red)' }}>
                        <AlertCircle size={14} style={{ marginTop:2, flexShrink:0 }}/> {e}
                      </div>
                    ))}
                    {erros.length > 5 && <p style={{ fontSize:12, color:'var(--red)', marginTop:4 }}>...e mais {erros.length - 5} erros.</p>}
                  </div>
                )}

                {preview.length > 0 && erros.length === 0 && (
                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
                      Prévia — {preview.length} de {inputRef.current?._allRows?.length || 0} linhas:
                    </p>
                    <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                      <table style={{ fontSize:12 }}>
                        <thead><tr>{colunas.map(c => <th key={c}>{nomeColuna[c]}</th>)}</tr></thead>
                        <tbody>{preview.map((row,i) => <tr key={i}>{colunas.map(c => <td key={c}>{row[c]||'—'}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {resultado && (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <CheckCircle size={40} color="var(--green)" style={{ marginBottom:12 }}/>
                <p style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Importação concluída!</p>
                <p style={{ fontSize:13.5, color:'var(--green)' }}>{resultado.sucesso} {tipo==='parceiros'?'parceiro(s)':'livro(s)'} importado(s)</p>
                {resultado.falhas > 0 && <p style={{ fontSize:13, color:'var(--red)', marginTop:4 }}>{resultado.falhas} linha(s) com erro</p>}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={reset}>{resultado ? 'Fechar' : 'Cancelar'}</button>
              {!resultado && preview.length > 0 && erros.length === 0 && (
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando...' : `Importar ${inputRef.current?._allRows?.length || 0} registros`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── ENVIOS TAB ─────────────────────────────────────────────
function EnviosTab({ parceiros, livros, envios, setEnvios }) {
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [buscaModal, setBuscaModal] = useState(false)
  const [editing, setEditing]       = useState(null)
  const [filter, setFilter]         = useState('todos')
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, showToast]          = useToast()

  // Multi-livro: form com array de livro_ids
  const EMPTY = {
    parceiro_id: '',
    livro_ids: [],
    status: 'enviado',
    data_envio: new Date().toISOString().slice(0,10),
    observacoes: ''
  }
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (envios.length >= 0) setLoading(false)
  }, [envios])

  function openNew()   { setEditing(null); setForm(EMPTY); setParceiroSearch(''); setParceiroOpen(false); setLivroSearch(''); setModal(true) }
  async function openEdit(e) {
    // Busca PRIMEIRO, abre modal só depois — garante todos os livros
    setSaving(true)
    try {
      const completo = await getEnvioCompleto(e.id)
      const livro_ids = (completo.envio_livros || []).map(el => el.livros?.id).filter(Boolean)
      const p = parceiros.find(x => x.id === completo.parceiro_id)
      setEditing(completo)
      setForm({ parceiro_id: completo.parceiro_id, livro_ids, status: completo.status, data_envio: completo.data_envio || '', observacoes: completo.observacoes || '' })
      setParceiroSearch(p?.nome || '')
      setParceiroOpen(false)
      setLivroSearch('')
      setModal(true)
    } catch (err) {
      console.error(err)
      // Fallback com dados da memória
      const livro_ids = (e.envio_livros || []).map(el => el.livros?.id).filter(Boolean)
      const p = parceiros.find(x => x.id === e.parceiro_id)
      setEditing(e)
      setForm({ parceiro_id: e.parceiro_id, livro_ids, status: e.status, data_envio: e.data_envio || '', observacoes: e.observacoes || '' })
      setParceiroSearch(p?.nome || '')
      setParceiroOpen(false)
      setLivroSearch('')
      setModal(true)
    } finally {
      setSaving(false)
    }
  }
  function close() { setModal(false); setEditing(null); setParceiroOpen(false) }

  function toggleLivro(livroId) {
    setForm(f => ({
      ...f,
      livro_ids: f.livro_ids.includes(livroId)
        ? f.livro_ids.filter(id => id !== livroId)
        : [...f.livro_ids, livroId]
    }))
  }

  async function save() {
    if (!form.parceiro_id || form.livro_ids.length === 0) return
    setSaving(true)
    try {
      if (editing) {
        const u = await updateEnvio(editing.id, form)
        setEnvios(prev => prev.map(e => e.id === u.id ? u : e))
        showToast('Envio atualizado!')
      } else {
        const novo = await createEnvio(form)
        setEnvios(prev => [novo, ...prev])
        const qtd = form.livro_ids.length
        showToast(`Envio registrado com ${qtd} livro${qtd > 1 ? 's' : ''}!`)
      }
      close()
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir este envio?')) return
    try { await deleteEnvio(id); setEnvios(prev => prev.filter(e => e.id !== id)); showToast('Excluído!') }
    catch { showToast('Erro', 'error') }
  }

  async function quickConfirm(envio) {
    try {
      const u = await updateEnvioStatus(envio.id, 'divulgado')
      setEnvios(prev => prev.map(e => e.id === u.id ? u : e))
      showToast('Divulgação confirmada!')
    } catch { showToast('Erro', 'error') }
  }

  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen]     = useState(false)
  const [livroSearch, setLivroSearch]       = useState('')
  const [livrosFiltrados, setLivrosFiltrados] = useState([])
  const [livrosLoading, setLivrosLoading]   = useState(false)
  const [livrosErro, setLivrosErro]         = useState('')

  useEffect(() => {
    if (!livroSearch.trim()) { setLivrosFiltrados([]); setLivrosErro(''); return }
    const timer = setTimeout(async () => {
      setLivrosLoading(true)
      setLivrosErro('')
      try {
        const r = await getLivros({ page: 0, pageSize: 20, search: livroSearch.trim() })
        setLivrosFiltrados(r.data || [])
        if ((r.data||[]).length === 0) setLivrosErro('Nenhum livro encontrado com este ISBN/título.')
      } catch (e) {
        console.error('Erro busca livros:', e)
        setLivrosErro('Erro ao buscar livros: ' + (e.message || e))
        setLivrosFiltrados([])
      }
      finally { setLivrosLoading(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [livroSearch])

  const filtered = envios
    .filter(e => filter === 'todos' || e.status === filter)
    .filter(e => {
      const q = search.toLowerCase()
      return (e.parceiros?.nome||'').toLowerCase().includes(q) || (e.livros?.titulo||'').toLowerCase().includes(q)
    })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cortesias</h1>
          <p className="page-subtitle">{envios.length} envio{envios.length!==1?'s':''} registrado{envios.length!==1?'s':''}</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-ghost" onClick={() => setBuscaModal(true)}>
            <Search size={15}/> Verificar duplicata
          </button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Registrar Envio</button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['todos','enviado','divulgado','cancelado'].map(f => (
              <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`} onClick={()=>setFilter(f)}>
                {f==='todos'?'Todos':STATUS_OPTIONS.find(s=>s.value===f)?.label}
              </button>
            ))}
          </div>
          <input className="search-input" placeholder="Buscar parceiro ou livro..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {loading ? <div className="loading" style={{minHeight:'auto',padding:40}}><div className="spinner"/></div>
        : filtered.length === 0 ? <div className="empty-state"><p>Nenhum envio encontrado.</p></div>
        : (
          <table>
            <thead><tr><th>Parceiro</th><th>Livro</th><th>Data</th><th>Status</th><th>Ação</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e => {
                const s = STATUS_OPTIONS.find(x=>x.value===e.status)||STATUS_OPTIONS[0]
                return (
                  <tr key={e.id}>
                    <td className="td-strong">{e.parceiros?.nome||'—'}</td>
                    <td>
                      {(e.envio_livros||[]).length === 0 ? <span className="td-muted">—</span> :
                      (e.envio_livros||[]).length === 1 ?
                        <span>{e.envio_livros[0].livros?.titulo}</span> :
                        <div>
                          <span>{e.envio_livros[0].livros?.titulo}</span>
                          <span style={{marginLeft:6, fontSize:11, background:'var(--surface-3)', color:'var(--text-muted)', borderRadius:10, padding:'1px 7px'}}>
                            +{(e.envio_livros||[]).length - 1} livro{(e.envio_livros||[]).length > 2 ? 's' : ''}
                          </span>
                        </div>
                      }
                    </td>
                    <td className="td-muted">{e.data_envio?format(new Date(e.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR}):'—'}</td>
                    <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    <td>{e.status==='enviado'&&<button className="btn btn-sm btn-ghost" style={{color:'var(--green)',fontSize:12}} onClick={()=>quickConfirm(e)}>✓ Confirmar</button>}</td>
                    <td><div className="actions-cell">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(e)}><Pencil size={14}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(e.id)}><Trash2 size={14}/></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Registrar Envio */}
      {modal && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing?'Editar Envio':'Registrar Envio'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{position:'relative'}}>
                <label className="form-label">Parceiro *</label>
                <input
                  className="form-input"
                  placeholder="Digite para buscar o parceiro..."
                  value={parceiroSearch}
                  onChange={e=>{ setParceiroSearch(e.target.value); setForm(f=>({...f,parceiro_id:''})); setParceiroOpen(true) }}
                  onFocus={()=>setParceiroOpen(true)}
                  autoComplete="off"
                />
                {parceiroOpen && parceiroSearch && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                    {parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).length === 0
                      ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado.</div>
                      : parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).map(p=>(
                        <div key={p.id} onClick={()=>{ setForm(f=>({...f,parceiro_id:p.id})); setParceiroSearch(p.nome); setParceiroOpen(false) }}
                          style={{padding:'10px 14px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)',color:'var(--text)'}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                        >
                          {p.nome}
                          {p.tipo_parceria && <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>{p.tipo_parceria}</span>}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Livros selecionados — lista de pedido */}
              {form.livro_ids.length > 0 && (
                <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', maxHeight:280, overflowY:'auto' }}>
                  <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>
                      Livros selecionados
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--accent)' }}>
                      {form.livro_ids.length} item{form.livro_ids.length>1?'s':''}
                    </span>
                  </div>
                  {form.livro_ids.map((id, idx) => {
                    // Primeiro tenta no envio carregado, depois no prop livros
                    const elFromEnvio = (editing?.envio_livros || []).find(el => el.livros?.id === id)
                    const l = elFromEnvio?.livros || livros.find(x => x.id === id)
                    if (!l) return null
                    return (
                      <div key={id} style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px',
                        borderBottom: idx < form.livro_ids.length-1 ? '1px solid var(--border)' : 'none',
                        background:'transparent',
                      }}>
                        <div style={{
                          width:28, height:28, borderRadius:6, flexShrink:0,
                          background:'var(--accent-glow)', border:'1px solid rgba(224,96,48,0.2)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700, color:'var(--accent)',
                        }}>{idx+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.titulo}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>
                            {l.autor && <span>{l.autor}</span>}
                            {l.autor && l.isbn && <span> · </span>}
                            {l.isbn && <span>ISBN: {l.isbn}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleLivro(id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:4, display:'flex', alignItems:'center' }}
                          title="Remover"
                        >
                          <X size={14}/>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Busca de livros */}
              <div className="form-group">
                <label className="form-label">Adicionar livro *</label>
                <input
                  className="form-input"
                  placeholder="Buscar por título, ISBN ou SKU..."
                  value={livroSearch}
                  onChange={e => setLivroSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {livroSearch && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:8, maxHeight:200, overflowY:'auto', background:'var(--surface-2)' }}>
                    {livrosLoading ? (
                      <div style={{ padding:'12px 14px', fontSize:13, color:'var(--text-muted)' }}>Buscando...</div>
                    ) : livrosErro ? (
                      <div style={{ padding:'12px 14px', fontSize:13, color:'var(--red)' }}>{livrosErro}</div>
                    ) : livrosFiltrados.length === 0 ? (
                      <div style={{ padding:'12px 14px', fontSize:13, color:'var(--text-muted)' }}>Nenhum livro encontrado.</div>
                    ) : livrosFiltrados.map(l => {
                      const selecionado = form.livro_ids.includes(l.id)
                      return (
                        <div
                          key={l.id}
                          onClick={() => { if (!selecionado) { toggleLivro(l.id); setLivroSearch('') } }}
                          style={{
                            padding:'10px 14px', cursor: selecionado ? 'default' : 'pointer',
                            borderBottom:'1px solid var(--border)',
                            display:'flex', alignItems:'center', gap:10,
                            background: selecionado ? 'var(--surface-3)' : 'transparent',
                            opacity: selecionado ? 0.5 : 1,
                          }}
                        >
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{l.titulo}</div>
                            <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>
                              {l.autor && <span>{l.autor}</span>}
                              {l.autor && l.isbn && <span> · </span>}
                              {l.isbn && <span>ISBN: {l.isbn}</span>}
                            </div>
                          </div>
                          {selecionado
                            ? <span style={{ fontSize:11, color:'var(--text-muted)' }}>já adicionado</span>
                            : <Plus size={14} color="var(--accent)"/>
                          }
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data do Envio</label>
                  <input className="form-input" type="date" value={form.data_envio} onChange={e=>setForm(f=>({...f,data_envio:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas sobre este envio..."/>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving||!form.parceiro_id||form.livro_ids.length===0}>
                {saving ? 'Salvando...' : editing ? 'Salvar' : `Registrar ${form.livro_ids.length > 1 ? `${form.livro_ids.length} envios` : 'envio'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Busca Duplicatas */}
      {buscaModal && (
        <BuscaDuplicatas
          parceiros={parceiros}
          livros={livros}
          envios={envios}
          onClose={() => setBuscaModal(false)}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── PARCEIROS TAB ──────────────────────────────────────────
function ParceirosTab({ parceiros, setParceiros }) {
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, showToast]    = useToast()
  const EMPTY = { nome:'', tipo_parceria:'', cpf:'', livraria:'', taxa_engajamento:'', editoras_divulga:[], temas:'' }
  const [editoras, setEditoras] = useState([])
  const [editoraSearch, setEditoraSearch] = useState('')
  const [form, setForm] = useState(EMPTY)

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(p) { setEditing(p); setForm({
    nome:              p.nome,
    tipo_parceria:     p.tipo_parceria||'',
    cpf:               p.cpf||'',
    livraria:          p.livraria||'',
    taxa_engajamento:  p.taxa_engajamento||'',
    editoras_divulga:  p.editoras_divulga ? p.editoras_divulga.split('|').filter(Boolean) : [],
    temas:             p.temas||'',
  }); setModal(true) }
  function close()     { setModal(false); setEditing(null) }
  async function reload() { setParceiros(await getParceiros()) }

  useEffect(() => {
    getEditoras().then(setEditoras).catch(console.error)
  }, [])

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, editoras_divulga: form.editoras_divulga.join('|') }
      if (editing) { await updateParceiro(editing.id, payload); showToast('Atualizado!') }
      else { await createParceiro(payload); showToast('Cadastrado!') }
      await reload()
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir?')) return
    try { await deleteParceiro(id); setParceiros(prev=>prev.filter(p=>p.id!==id)); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  const filtered = parceiros.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.tipo_parceria||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.livraria||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.temas||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginBottom:20}}>
        <UploadPlanilha tipo="parceiros" onImport={reload}/>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Parceiro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Parceiros ({parceiros.length})</span>
          <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {filtered.length===0?<div className="empty-state"><p>Nenhum parceiro encontrado.</p></div>:(
          <table>
            <thead><tr><th>Nome</th><th>Tipo de Parceria</th><th>Livraria</th><th>Engajamento</th><th>Temas</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id}>
                  <td>
                    <div className="td-strong">{p.nome}</div>
                    {p.cpf&&<div style={{fontSize:11,color:'var(--text-muted)'}}>CPF: {p.cpf}</div>}
                  </td>
                  <td>{p.tipo_parceria?<span className="badge badge-indigo">{p.tipo_parceria}</span>:<span className="td-muted">—</span>}</td>
                  <td style={{fontSize:12}}>{p.livraria||<span className="td-muted">—</span>}</td>
                  <td style={{fontSize:12}}>{p.taxa_engajamento?<span style={{color:'var(--green)',fontWeight:700}}>{p.taxa_engajamento}</span>:<span className="td-muted">—</span>}</td>
                  <td style={{fontSize:12,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.temas||<span className="td-muted">—</span>}</td>
                  <td><div className="actions-cell">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(p)}><Pencil size={14}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(p.id)}><Trash2 size={14}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal&&(
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing?'Editar Parceiro':'Novo Parceiro'}</h2><button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Nome do Parceiro *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/></div>
                <div className="form-group"><label className="form-label">CPF</label><input className="form-input" value={form.cpf} onChange={e=>setForm(f=>({...f,cpf:e.target.value}))} placeholder="000.000.000-00"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Tipo de Parceria</label>
                  <select className="form-select" value={form.tipo_parceria} onChange={e=>setForm(f=>({...f,tipo_parceria:e.target.value}))}>
                    <option value="">Selecionar...</option>
                    {TIPOS_PARCERIA.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Livraria</label><input className="form-input" value={form.livraria} onChange={e=>setForm(f=>({...f,livraria:e.target.value}))} placeholder="Nome da livraria (se aplicável)"/></div>
              </div>
              <div className="form-group"><label className="form-label">Taxa de Engajamento Interno</label><input className="form-input" value={form.taxa_engajamento} onChange={e=>setForm(f=>({...f,taxa_engajamento:e.target.value}))} placeholder="Ex: 5%, alto, médio..."/></div>
              <div className="form-group">
                <label className="form-label">Editoras que o Parceiro Divulga</label>
                {/* Tags selecionadas */}
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
                {/* Busca */}
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
              <div className="form-group"><label className="form-label">Temas que o Parceiro Aborda</label><textarea className="form-textarea" rows={2} value={form.temas} onChange={e=>setForm(f=>({...f,temas:e.target.value}))} placeholder="Ex: filosofia, teologia, literatura clássica..."/></div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button></div>
          </div>
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── LIVROS TAB ─────────────────────────────────────────────
function LivrosTab() {
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [toast, showToast]      = useToast()
  const [livros, setLivros]     = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const EMPTY = { titulo:'', isbn:'', sku:'', autor:'', editora:'' }
  const [form, setForm] = useState(EMPTY)

  async function fetchLivros(p, ps, s) {
    const pg = p !== undefined ? p : page
    const sz = ps !== undefined ? ps : pageSize
    const sq = s !== undefined ? s : search
    setLoading(true)
    try {
      const { data, count } = await getLivros({ page: pg, pageSize: sz, search: sq })
      setLivros(data || [])
      setTotal(count || 0)
    } catch (e) { console.error(e); showToast('Erro ao carregar livros', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLivros(page, pageSize, search) }, [page, pageSize, search])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const totalPages = Math.ceil(total / pageSize)

  function openNew()   { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(l) { setEditing(l); setForm({ titulo:l.titulo, isbn:l.isbn||'', sku:l.sku||'', autor:l.autor||'', editora:l.editora||'' }); setModal(true) }
  function close()     { setModal(false); setEditing(null) }

  async function save() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      if (editing) { await updateLivro(editing.id, form); showToast('Atualizado!') }
      else { await createLivro(form); showToast('Cadastrado!') }
      await fetchLivros()
      close()
    } catch { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Excluir?')) return
    try { await deleteLivro(id); await fetchLivros(); showToast('Excluído!') }
    catch { showToast('Erro','error') }
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginBottom:20}}>
        <UploadPlanilha tipo="livros" onImport={() => { setPage(0); fetchLivros(0, pageSize, search) }}/>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Novo Livro</button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span className="table-title">
              {search ? `${total} resultado${total!==1?'s':''} para "${search}"` : `Livros (${total})`}
            </span>
            {totalPages > 1 && <span style={{fontSize:12,color:'var(--text-muted)'}}>Pág. {page+1}/{totalPages}</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'4px 8px'}} value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(0) }}>
              {[50,100,200,500].map(n=><option key={n} value={n}>{n} por página</option>)}
            </select>
            <input className="search-input" placeholder="Buscar título, autor, ISBN ou SKU..." value={searchInput} onChange={e=>setSearchInput(e.target.value)}/>
          </div>
        </div>

        {loading
          ? <div className="loading" style={{minHeight:'auto',padding:40}}><div className="spinner"/></div>
          : livros.length === 0
            ? <div className="empty-state"><p>Nenhum livro encontrado.</p></div>
            : <table>
                <thead><tr><th>Título</th><th>Autor</th><th>Editora</th><th>ISBN</th><th>SKU</th><th></th></tr></thead>
                <tbody>
                  {livros.map(l=>(
                    <tr key={l.id}>
                      <td className="td-strong">{l.titulo}</td>
                      <td className="td-muted">{l.autor||'—'}</td>
                      <td className="td-muted">{l.editora||'—'}</td>
                      <td className="td-muted">{l.isbn||'—'}</td>
                      <td className="td-muted">{l.sku||'—'}</td>
                      <td><div className="actions-cell">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(l)}><Pencil size={14}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>remove(l.id)}><Trash2 size={14}/></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }

        {totalPages > 1 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'14px 20px',borderTop:'1px solid var(--border)'}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setPage(0)} disabled={page===0}>«</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setPage(p=>p-1)} disabled={page===0}>‹ Anterior</button>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p = page < 3 ? i : page > totalPages-4 ? totalPages-5+i : page-2+i
              if (p < 0 || p >= totalPages) return null
              return <button key={p} className={`btn btn-sm ${p===page?'btn-primary':'btn-ghost'}`} onClick={()=>setPage(p)}>{p+1}</button>
            })}
            <button className="btn btn-ghost btn-sm" onClick={()=>setPage(p=>p+1)} disabled={page>=totalPages-1}>Próxima ›</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setPage(totalPages-1)} disabled={page>=totalPages-1}>»</button>
          </div>
        )}
      </div>

      {modal&&(
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing?'Editar Livro':'Novo Livro'}</h2><button className="btn btn-ghost btn-icon" onClick={close}><X size={16}/></button></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Título do livro"/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Autor</label><input className="form-input" value={form.autor} onChange={e=>setForm(f=>({...f,autor:e.target.value}))} placeholder="Nome do autor"/></div>
                <div className="form-group"><label className="form-label">Editora</label><input className="form-input" value={form.editora} onChange={e=>setForm(f=>({...f,editora:e.target.value}))} placeholder="Editora"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ISBN</label><input className="form-input" value={form.isbn} onChange={e=>setForm(f=>({...f,isbn:e.target.value}))} placeholder="978-..."/></div>
                <div className="form-group"><label className="form-label">SKU</label><input className="form-input" value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="SKU do produto"/></div>
              </div>
            </div>
            <div className="form-actions"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.titulo.trim()}>{saving?'Salvando...':editing?'Salvar':'Cadastrar'}</button></div>
          </div>
        </div>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── DIVULGAÇÕES TAB ───────────────────────────────────────
function DivulgacoesTab({ envios, setEnvios }) {
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null) // { envio }
  const [datas, setDatas]     = useState({})   // { envioLivroId: 'yyyy-mm-dd' }
  const [checked, setChecked] = useState({})   // { envioLivroId: bool }
  const [saving, setSaving]   = useState(false)
  const [toast, showToast]    = useToast()

  // Envios que têm pelo menos 1 livro ainda não divulgado
  const pendentes = envios.filter(e =>
    (e.envio_livros||[]).some(el => !el.divulgado)
  )

  const filtrados = pendentes.filter(e => {
    const q = search.toLowerCase()
    return (e.parceiros?.nome||'').toLowerCase().includes(q) ||
      (e.envio_livros||[]).some(el => (el.livros?.titulo||'').toLowerCase().includes(q))
  })

  function abrirModal(envio) {
    const hoje = new Date().toISOString().slice(0,10)
    const initDatas = {}
    const initCheck = {}
    ;(envio.envio_livros||[]).forEach(el => {
      if (!el.divulgado) {
        initDatas[el.id] = hoje
        initCheck[el.id] = false // desmarcado por padrão
      }
    })
    setDatas(initDatas)
    setChecked(initCheck)
    setModal({ envio })
  }

  async function salvarDivulgacoes() {
    if (!modal) return
    setSaving(true)
    try {
      const livrosNaoDiv = (modal.envio.envio_livros||[]).filter(el => !el.divulgado)
      for (const el of livrosNaoDiv) {
        if (checked[el.id] && datas[el.id]) {
          await updateEnvioLivroDivulgacao(el.id, { divulgado: true, data_divulgacao: datas[el.id] })
        }
      }
      // Se todos foram divulgados (os que já estavam + os que acabamos de marcar), muda status
      const todosDiv = (modal.envio.envio_livros||[]).every(el => el.divulgado || checked[el.id])
      if (todosDiv) {
        await updateEnvioStatus(modal.envio.id, 'divulgado')
      }
      const novosEnvios = await getEnvios()
      setEnvios(novosEnvios)
      const qtd = Object.values(checked).filter(Boolean).length
      showToast(qtd > 0 ? `${qtd} divulgação${qtd>1?'s':''} registrada${qtd>1?'s':''}!` : 'Nenhuma alteração.')
      setModal(null)
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Registro de Divulgação</h1>
          <p className="page-subtitle">{pendentes.length} envio{pendentes.length!==1?'s':''} com livros aguardando divulgação</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Envios pendentes</span>
          <input className="search-input" placeholder="Buscar parceiro ou livro..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {filtrados.length === 0
          ? <div className="empty-state"><p>{search ? 'Nenhum resultado.' : 'Todos os livros já foram divulgados!'}</p></div>
          : <table>
              <thead><tr><th>Parceiro</th><th>Livros do envio</th><th>Data envio</th><th>Ação</th></tr></thead>
              <tbody>
                {filtrados.map(e => {
                  const livros = (e.envio_livros||[]).filter(el=>el.livros)
                  const pendentesCount = livros.filter(el=>!el.divulgado).length
                  return (
                    <tr key={e.id}>
                      <td className="td-strong">{e.parceiros?.nome||'—'}</td>
                      <td>
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          {livros.map((el,i) => (
                            <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5}}>
                              <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:el.divulgado?'var(--green)':'var(--amber)'}}/>
                              <span style={{color:el.divulgado?'var(--text-muted)':'var(--text)',textDecoration:el.divulgado?'line-through':'none'}}>
                                {el.livros.titulo}
                              </span>
                              {el.divulgado && el.data_divulgacao && (
                                <span style={{fontSize:11,color:'var(--text-muted)'}}>
                                  ({format(new Date(el.data_divulgacao+'T12:00:00'),'dd/MM/yy',{locale:ptBR})})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="td-muted" style={{whiteSpace:'nowrap'}}>
                        {e.data_envio ? format(new Date(e.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR}) : '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{color:'var(--green)',fontWeight:600,whiteSpace:'nowrap'}}
                          onClick={()=>abrirModal(e)}
                        >
                          ✓ Registrar ({pendentesCount} livro{pendentesCount!==1?'s':''})
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        }
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={()=>{}}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Divulgação</h2>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(null)}><X size={16}/></button>
            </div>

            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>
              Parceiro: <strong style={{color:'var(--text)'}}>{modal.envio.parceiros?.nome}</strong>
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
              {(modal.envio.envio_livros||[]).filter(el=>el.livros).map(el => {
                const jaDivulgado = el.divulgado
                const marcado = checked[el.id] || false
                return (
                  <div key={el.id} style={{
                    background: jaDivulgado ? 'var(--surface-2)' : marcado ? 'var(--accent-glow)' : 'var(--surface-2)',
                    border: `1px solid ${marcado && !jaDivulgado ? 'rgba(224,96,48,0.3)' : 'var(--border)'}`,
                    borderRadius:8, padding:'12px 14px',
                    opacity: jaDivulgado ? 0.55 : 1,
                    transition:'all 0.15s',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom: (!jaDivulgado && marcado) ? 10 : 0}}>
                      {/* Checkbox */}
                      {!jaDivulgado && (
                        <div
                          onClick={()=>setChecked(c=>({...c,[el.id]:!c[el.id]}))}
                          style={{
                            width:18,height:18,borderRadius:5,flexShrink:0,cursor:'pointer',
                            border:`2px solid ${marcado?'var(--accent)':'var(--border)'}`,
                            background:marcado?'var(--accent)':'transparent',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            transition:'all 0.15s',
                          }}
                        >
                          {marcado && <span style={{color:'#fff',fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
                        </div>
                      )}
                      <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:jaDivulgado?'var(--green)':'var(--amber)'}}/>
                      <span style={{
                        fontSize:13,fontWeight:600,flex:1,
                        color: jaDivulgado?'var(--text-muted)':marcado?'var(--accent)':'var(--text)',
                        textDecoration:jaDivulgado?'line-through':'none',
                      }}>{el.livros.titulo}</span>
                      {jaDivulgado
                        ? <span className="badge badge-green" style={{fontSize:11}}>Já divulgado</span>
                        : !marcado && <span style={{fontSize:11,color:'var(--text-muted)'}}>clique para marcar</span>
                      }
                    </div>
                    {!jaDivulgado && marcado && (
                      <div style={{display:'flex',alignItems:'center',gap:10,paddingLeft:28}}>
                        <label style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>Data de divulgação:</label>
                        <input
                          className="form-input"
                          type="date"
                          value={datas[el.id]||''}
                          onChange={e=>setDatas(d=>({...d,[el.id]:e.target.value}))}
                          style={{flex:1,padding:'6px 10px',fontSize:13}}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={salvarDivulgacoes}
                disabled={saving || Object.values(checked).every(v=>!v)}
              >
                {saving ? 'Salvando...' : '✓ Salvar divulgações'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

// ── RELATÓRIOS TAB ────────────────────────────────────────
function RelatoriosTab({ parceiros, envios }) {
  const [parceiroId, setParceiroId]   = useState('')
  const [parceiroSearch, setParceiroSearch] = useState('')
  const [parceiroOpen, setParceiroOpen]     = useState(false)
  const [dataInicio, setDataInicio]   = useState('')
  const [dataFim, setDataFim]         = useState('')
  const [resultado, setResultado]     = useState(null)

  function gerarRelatorio() {
    if (!parceiroId) return
    const parceiro = parceiros.find(p => p.id === parceiroId)

    let enviosFiltrados = envios.filter(e => e.parceiro_id === parceiroId)

    if (dataInicio) {
      enviosFiltrados = enviosFiltrados.filter(e => e.data_envio && e.data_envio >= dataInicio)
    }
    if (dataFim) {
      enviosFiltrados = enviosFiltrados.filter(e => e.data_envio && e.data_envio <= dataFim)
    }

    const totalLivros = enviosFiltrados.reduce((acc, e) => acc + (e.envio_livros||[]).length, 0)
    const porStatus = {}
    STATUS_OPTIONS.forEach(s => {
      porStatus[s.value] = enviosFiltrados.filter(e => e.status === s.value).reduce((acc, e) => acc + (e.envio_livros||[]).length, 0)
    })

    setResultado({ parceiro, envios: enviosFiltrados, totalLivros, porStatus })
  }

  const STATUS_OPTIONS_LOCAL = [
    { value: 'enviado',   label: 'Enviado',   cls: 'badge-amber' },
    { value: 'divulgado', label: 'Divulgado', cls: 'badge-green' },
    { value: 'cancelado', label: 'Cancelado', cls: 'badge-red'   },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Consulte cortesias por parceiro e período</p>
        </div>
      </div>

      <div className="table-card" style={{padding:'20px 24px', marginBottom:24, overflow:'visible'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, alignItems:'end'}}>
          <div className="form-group" style={{position:'relative', margin:0}}>
            <label className="form-label">Parceiro</label>
            <input
              className="form-input"
              placeholder="Digite para buscar..."
              value={parceiroSearch}
              onChange={e=>{ setParceiroSearch(e.target.value); setParceiroId(''); setParceiroOpen(true); setResultado(null) }}
              onFocus={()=>setParceiroOpen(true)}
              autoComplete="off"
            />
            {parceiroOpen && parceiroSearch && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                {parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).length === 0
                  ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>Nenhum parceiro encontrado.</div>
                  : parceiros.filter(p=>p.nome.toLowerCase().includes(parceiroSearch.toLowerCase())).map(p=>(
                    <div key={p.id}
                      onClick={()=>{ setParceiroId(p.id); setParceiroSearch(p.nome); setParceiroOpen(false); setResultado(null) }}
                      style={{padding:'10px 14px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)',color:'var(--text)'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      {p.nome}
                      {p.tipo_parceria && <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>{p.tipo_parceria}</span>}
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div style={{display:'flex', gap:10}}>
            <div className="form-group" style={{margin:0, flex:1}}>
              <label className="form-label">Data início</label>
              <input className="form-input" type="date" value={dataInicio} onChange={e=>{ setDataInicio(e.target.value); setResultado(null) }}/>
            </div>
            <div className="form-group" style={{margin:0, flex:1}}>
              <label className="form-label">Data fim</label>
              <input className="form-input" type="date" value={dataFim} onChange={e=>{ setDataFim(e.target.value); setResultado(null) }}/>
            </div>
          </div>

          <button className="btn btn-primary" onClick={gerarRelatorio} disabled={!parceiroId} style={{justifyContent:'center'}}>
            <Search size={15}/> Gerar relatório
          </button>
        </div>
      </div>

      {resultado && (
        <>
          {/* Cards de resumo */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20}}>
            <div className="table-card" style={{padding:'16px 20px', textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:6}}>Total de envios</p>
              <p style={{fontSize:32,fontWeight:800,color:'var(--accent)'}}>{resultado.envios.length}</p>
            </div>
            <div className="table-card" style={{padding:'16px 20px', textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',marginBottom:6}}>Total de livros</p>
              <p style={{fontSize:32,fontWeight:800,color:'var(--text)'}}>{resultado.totalLivros}</p>
            </div>
            <div className="table-card" style={{padding:'16px 20px', textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--green)',marginBottom:6}}>Divulgados</p>
              <p style={{fontSize:32,fontWeight:800,color:'var(--green)'}}>{resultado.porStatus.divulgado}</p>
            </div>
            <div className="table-card" style={{padding:'16px 20px', textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--amber)',marginBottom:6}}>Aguardando</p>
              <p style={{fontSize:32,fontWeight:800,color:'var(--amber)'}}>{resultado.porStatus.enviado}</p>
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="table-card">
            <div className="table-toolbar">
              <span className="table-title">
                Cortesias de <strong>{resultado.parceiro.nome}</strong>
                {dataInicio && dataFim && <span style={{fontWeight:400,color:'var(--text-muted)'}}> · {format(new Date(dataInicio+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})} até {format(new Date(dataFim+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})}</span>}
                {dataInicio && !dataFim && <span style={{fontWeight:400,color:'var(--text-muted)'}}> · a partir de {format(new Date(dataInicio+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})}</span>}
                {!dataInicio && dataFim && <span style={{fontWeight:400,color:'var(--text-muted)'}}> · até {format(new Date(dataFim+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})}</span>}
              </span>
            </div>
            {resultado.envios.length === 0
              ? <div className="empty-state"><p>Nenhum envio encontrado para este período.</p></div>
              : <table>
                  <thead><tr><th>Data</th><th>Livros</th><th>Qtd</th><th>Status</th></tr></thead>
                  <tbody>
                    {resultado.envios.map(e => {
                      const s = STATUS_OPTIONS_LOCAL.find(x=>x.value===e.status)||STATUS_OPTIONS_LOCAL[0]
                      const livros = (e.envio_livros||[]).map(el=>el.livros?.titulo).filter(Boolean)
                      return (
                        <tr key={e.id}>
                          <td className="td-muted" style={{whiteSpace:'nowrap'}}>
                            {e.data_envio ? format(new Date(e.data_envio+'T12:00:00'),'dd MMM yyyy',{locale:ptBR}) : '—'}
                          </td>
                          <td>
                            <div style={{display:'flex',flexDirection:'column',gap:3}}>
                              {livros.map((t,i)=><span key={i} style={{fontSize:12.5}}>{t}</span>)}
                            </div>
                          </td>
                          <td style={{textAlign:'center',fontWeight:700,color:'var(--accent)'}}>{livros.length}</td>
                          <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>
        </>
      )}
    </>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Cortesias() {
  const [tab, setTab]             = useState('envios')
  const [parceiros, setParceiros] = useState([])
  const [livros, setLivros]       = useState([])
  const [envios, setEnvios]       = useState([])

  useEffect(() => {
    getParceiros().then(setParceiros).catch(console.error)
    getLivros({ page:0, pageSize:5000 }).then(r => setLivros(r.data || [])).catch(console.error)
    getEnvios().then(setEnvios).catch(console.error)
  }, [])

  return (
    <div>
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'1px solid var(--border)'}}>
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setTab(id)} className={`btn btn-sm ${tab===id?'btn-primary':'btn-ghost'}`} style={{borderRadius:'8px 8px 0 0',marginBottom:tab===id?'-1px':0}}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>
      {tab==='envios'      && <EnviosTab       parceiros={parceiros} livros={livros} envios={envios} setEnvios={setEnvios}/>}
      {tab==='parceiros'   && <ParceirosTab    parceiros={parceiros} setParceiros={setParceiros}/>}
      {tab==='livros'      && <LivrosTab/>}
      {tab==='divulgacoes' && <DivulgacoesTab  envios={envios} setEnvios={setEnvios}/>}
      {tab==='relatorios'  && <RelatoriosTab   parceiros={parceiros} envios={envios}/>}
    </div>
  )
}
