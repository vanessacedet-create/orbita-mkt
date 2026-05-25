import { useEffect, useState, useRef } from 'react'
import { useViewAs } from '../context/ViewAsContext'
import { useAuth } from '../context/AuthContext'
import { PERFIL_GRUPO } from '../context/AuthContext'
import { getLivrosLancamento, importarLancamentos, updateLivro, deleteLivro } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Upload, X, Calendar, Pencil, Trash2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── UTILITÁRIOS DE DATA ────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function diaDaSemana(ano, mes, dia) {
  let a = ano, m = mes
  if (m < 3) { m += 12; a -= 1 }
  const k = a % 100; const j = Math.floor(a / 100)
  const h = (dia + Math.floor(13*(m+1)/5) + k + Math.floor(k/4) + Math.floor(j/4) - 2*j) % 7
  return ((h + 6) % 7)
}
function diasNoMes(ano, mes) {
  if (mes === 2) { const b = (ano%4===0&&ano%100!==0)||(ano%400===0); return b?29:28 }
  return [0,31,28,31,30,31,30,31,31,30,31,30,31][mes]
}
function pad(n) { return String(n).padStart(2,'0') }
function toKey(a,m,d) { return `${a}-${pad(m)}-${pad(d)}` }
function hojeKey() { const d=new Date(); return toKey(d.getFullYear(),d.getMonth()+1,d.getDate()) }

function gerarGrid(ano, mes) {
  const primeiroDia = diaDaSemana(ano, mes, 1)
  const total = diasNoMes(ano, mes)
  const grid = []
  if (primeiroDia > 0) {
    const ma = mes===1?12:mes-1; const aa = mes===1?ano-1:ano; const ta = diasNoMes(aa,ma)
    for (let i=primeiroDia-1;i>=0;i--) grid.push({key:toKey(aa,ma,ta-i),dia:ta-i,doMes:false})
  }
  for (let d=1;d<=total;d++) grid.push({key:toKey(ano,mes,d),dia:d,doMes:true})
  const resto = grid.length%7
  if (resto>0) {
    const mp=mes===12?1:mes+1; const ap=mes===12?ano+1:ano
    for (let d=1;d<=7-resto;d++) grid.push({key:toKey(ap,mp,d),dia:d,doMes:false})
  }
  return grid
}

// ── CORES DAS EDITORAS — únicas, não repetem ───────────────
const PALETTE = [
  '#f97316','#6366f1','#22c55e','#eab308','#06b6d4',
  '#8b5cf6','#ec4899','#14b8a6','#f43f5e','#84cc16',
  '#0ea5e9','#a855f7','#10b981','#fb923c','#6d28d9',
]
function buildCores(editoras) {
  const mapa = {}
  const sorted = [...editoras].sort()
  sorted.forEach((e, i) => { mapa[e] = PALETTE[i % PALETTE.length] })
  return mapa
}

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}

// ── MODAL EDITAR LIVRO ─────────────────────────────────────
function ModalEditarLivro({ livro, coresEditoras, onSave, onDelete, onClose }) {
  const [data, setData] = useState(livro.data_lancamento||'')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!data) return
    setSaving(true)
    try { await onSave(livro.id, data); onClose() }
    catch(e) { console.error(e) } finally { setSaving(false) }
  }
  async function excluir() {
    if (!window.confirm(`Excluir "${livro.titulo}" dos lançamentos?`)) return
    setSaving(true)
    try { await onDelete(livro.id); onClose() }
    catch(e) { console.error(e) } finally { setSaving(false) }
  }
  const cor = coresEditoras[livro.editora] || '#6b7280'

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:420}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title" style={{fontSize:15}}>Editar lançamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{padding:'4px 0 12px'}}>
          <div style={{background:'var(--surface-2)',borderLeft:`4px solid ${cor}`,borderRadius:8,padding:'12px 14px',marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4}}>{livro.titulo}</div>
            {livro.editora && <div style={{fontSize:12,color:cor,fontWeight:600,marginBottom:2}}>{livro.editora}</div>}
            {livro.autor  && <div style={{fontSize:12,color:'var(--text-muted)'}}>{livro.autor}</div>}
            <div style={{display:'flex',gap:10,marginTop:6,fontSize:11,color:'var(--text-muted)'}}>
              {livro.isbn && <span>ISBN: {livro.isbn}</span>}
              {livro.sku  && <span>SKU: {livro.sku}</span>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Data de lançamento</label>
            <input className="form-input" type="date" value={data} onChange={e=>setData(e.target.value)}/>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button className="btn btn-danger" onClick={excluir} disabled={saving}
            style={{display:'flex',alignItems:'center',gap:6}}>
            <Trash2 size={14}/> Excluir
          </button>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={saving||!data}>
              {saving?'Salvando...':'Salvar data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MODAL DIA (clique na célula) ───────────────────────────
function ModalDia({ dataKey, livros, coresEditoras, onEditLivro, onClose }) {
  const [a, m, d] = dataKey.split('-').map(Number)
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:500}}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{d} de {MESES[m-1]} de {a}</h2>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
              {livros.length} lançamento{livros.length!==1?'s':''}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'60vh',overflowY:'auto'}}>
          {livros.map(l => {
            const cor = coresEditoras[l.editora] || '#6b7280'
            return (
              <div key={l.id} style={{
                background:'var(--surface-2)',border:'1px solid var(--border)',
                borderLeft:`4px solid ${cor}`,borderRadius:8,padding:'10px 14px',
                display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10
              }}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:3}}>{l.titulo}</div>
                  {l.editora && <div style={{fontSize:11,color:cor,fontWeight:600,marginBottom:2}}>{l.editora}</div>}
                  {l.autor   && <div style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}</div>}
                  <div style={{display:'flex',gap:10,marginTop:4,fontSize:10,color:'var(--text-muted)'}}>
                    {l.isbn && <span>ISBN: {l.isbn}</span>}
                    {l.sku  && <span>SKU: {l.sku}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" title="Editar / excluir"
                  onClick={()=>{ onEditLivro(l); onClose() }}>
                  <Pencil size={13}/>
                </button>
              </div>
            )
          })}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR ─────────────────────────────────────────
function ModalImportar({ onImport, onClose , grupo }) {
  const [preview, setPreview]     = useState([])
  const [arquivo, setArquivo]     = useState(null)
  const [erros, setErros]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  function parseDate(val) {
    if (!val) return null
    if (val instanceof Date) return toKey(val.getFullYear(),val.getMonth()+1,val.getDate())
    if (typeof val==='number') { const d=new Date(Math.round((val-25569)*86400*1000)); return toKey(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()) }
    const s = String(val).trim()
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,a]=s.split('/'); return `${a}-${pad(+m)}-${pad(+d)}` }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return null
  }
  function norm(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
  function get(row,...keys) {
    for (const k of keys) { const f=Object.keys(row).find(rk=>norm(rk)===norm(k)); if(f!==undefined&&row[f]!=='')return row[f] }
    return ''
  }

  function downloadModelo() {
    const dados = [
      { 'titulo': 'A Metamorfose', 'autor': 'Franz Kafka', 'editora': 'Sétimo Selo', 'data de lançamento': '15/05/2025', 'isbn': '9788500000001', 'sku': 'SET-001' },
      { 'titulo': 'O Padrão Bitcoin', 'autor': 'Saifedean Ammous', 'editora': 'Axia', 'data de lançamento': '22/05/2025', 'isbn': '9788500000002', 'sku': 'AXI-002' },
      { 'titulo': 'Frankenstein', 'autor': 'Mary Shelley', 'editora': 'Papillon', 'data de lançamento': '10/06/2025', 'isbn': '', 'sku': '' },
    ]
    const ws = XLSX.utils.json_to_sheet(dados)
    const colWidths = [{ wch: 40 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 12 }]
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
    XLSX.writeFile(wb, 'modelo-lancamentos.xlsx')
  }

  function handleFile(file) {
    if (!file) return
    setArquivo(file); setErros([]); setResultado(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false})
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:true})
      const errosArr = []
      const parsed = rows.map((row,i) => {
        const titulo = String(get(row,'titulo','título','title','nome')||'').trim()
        const dataRaw = get(row,'data de lancamento','data de lançamento','data lancamento','data lançamento','data_lancamento','data','lancamento','lançamento')
        const data_lancamento = parseDate(dataRaw)
        if (!titulo) errosArr.push(`Linha ${i+2}: título ausente`)
        if (titulo && !data_lancamento) errosArr.push(`Linha ${i+2}: data não reconhecida (${dataRaw})`)
        const isbnRaw = get(row,'isbn'); const skuRaw = get(row,'sku','codigo','código')
        return {
          titulo, data_lancamento,
          autor:   String(get(row,'autor','author')||'').trim()||null,
          editora: String(get(row,'editora','publisher')||'').trim()||null,
          isbn:    isbnRaw?String(isbnRaw).replace(/\.0$/,'').trim():null,
          sku:     skuRaw ?String(skuRaw ).replace(/\.0$/,'').trim():null,
        }
      }).filter(r=>r.titulo)
      setErros(errosArr); setPreview(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  async function salvar() {
    if (!preview.length) return
    setSaving(true)
    try {
      const res = await importarLancamentos(preview, { grupo: grupo || 'influencers' })
      setResultado(res)
      if (res.erros.length===0) setTimeout(()=>{onImport();onClose()},2000)
    } catch(e){console.error(e)} finally{setSaving(false)}
  }

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:580}}>
        <div className="modal-header">
          <h2 className="modal-title">Importar Lançamentos</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        {!resultado ? (<>
          <div onClick={()=>inputRef.current?.click()} style={{
            border:`2px dashed ${arquivo?'var(--accent)':'var(--border)'}`,borderRadius:10,
            padding:'28px 20px',textAlign:'center',cursor:'pointer',marginBottom:16,
            background:arquivo?'var(--accent-glow)':'var(--surface-2)'
          }}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
            <Upload size={24} color="var(--accent)" style={{marginBottom:8}}/>
            <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{arquivo?arquivo.name:'Clique para selecionar a planilha'}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Formatos aceitos: .xlsx, .xls, .csv</div>
          </div>
          <div style={{textAlign:'center',marginBottom:16}}>
            <button onClick={downloadModelo}
              style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,color:'var(--text-muted)',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
              <Download size={13}/> Baixar planilha modelo
            </button>
          </div>
          {erros.length>0&&(<div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--red)',marginBottom:12}}>{erros.map((e,i)=><div key={i}>{e}</div>)}</div>)}
          {preview.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text)'}}>Prévia — {preview.length} livro{preview.length!==1?'s':''}</div>
              <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                <table><thead><tr><th>Título</th><th>Editora</th><th>Data lançamento</th></tr></thead>
                  <tbody>{preview.map((l,i)=>(<tr key={i}><td style={{fontSize:12}}>{l.titulo}</td><td style={{fontSize:12,color:'var(--accent)'}}>{l.editora||'—'}</td><td style={{fontSize:12}}>{l.data_lancamento||<span style={{color:'var(--red)'}}>sem data</span>}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={saving||!preview.filter(l=>l.data_lancamento).length}>
              {saving?'Importando...':(()=>{ const c=preview.filter(l=>l.data_lancamento).length; const s=preview.filter(l=>!l.data_lancamento).length; return `Importar ${c} livro${c!==1?'s':''}${s>0?' ('+s+' sem data serão ignorados)':''}` })()}
            </button>
          </div>
        </>) : (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:36,marginBottom:12}}>{resultado.erros.length===0?'✅':'⚠️'}</div>
            <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>{resultado.erros.length===0?'Importação concluída!':'Importado com avisos'}</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>{resultado.criados} criado{resultado.criados!==1?'s':''} · {resultado.atualizados} atualizado{resultado.atualizados!==1?'s':''}</div>
            {resultado.erros.length>0&&(<div style={{marginTop:12,textAlign:'left',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--red)',maxHeight:160,overflowY:'auto'}}><strong style={{display:'block',marginBottom:4}}>Erros ({resultado.erros.length}):</strong>{resultado.erros.map((e,i)=><div key={i} style={{marginBottom:2}}>• {e}</div>)}</div>)}
            {resultado.erros.length>0&&<button className="btn btn-primary" style={{marginTop:16}} onClick={()=>{onImport();onClose()}}>Fechar</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Lancamentos() {
  const { usuario } = useAuth()
  const { perfilAtivo } = useViewAs()

  // Quando estiver em modo "Ver como", usa o perfil visualizado.
  // Isso impede que um administrador vendo como Parceiras enxergue lançamentos de outros grupos.
  const perfilEfetivo = perfilAtivo || usuario?.perfil
  const ehAdminVisual = ['administrador', 'gerente'].includes(perfilEfetivo)
  const grupoDoPerfil = PERFIL_GRUPO[perfilEfetivo] || null

  const [filtroGrupoAdmin, setFiltroGrupoAdmin] = useState('todos')

  const grupoLanc = ehAdminVisual
    ? (filtroGrupoAdmin === 'todos' ? null : filtroGrupoAdmin)
    : grupoDoPerfil

  const agora = new Date()
  const [ano, setAno]           = useState(agora.getFullYear())
  const [mes, setMes]           = useState(agora.getMonth()+1)
  const [livros, setLivros]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalDia, setModalDia] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [dragId, setDragId]     = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [toast, showToast]      = useToast()

  async function carregar(a,m) {
    setLoading(true)
    try { setLivros(await getLivrosLancamento({ano:a,mes:m,grupo:grupoLanc})) }
    catch(e){console.error(e)} finally{setLoading(false)}
  }

  useEffect(()=>{ carregar(ano,mes) },[ano,mes,grupoLanc,perfilEfetivo]) // eslint-disable-line

  function navMes(delta) {
    let nm=mes+delta, na=ano
    if(nm>12){nm=1;na++} if(nm<1){nm=12;na--}
    setMes(nm); setAno(na)
  }

  async function handleSalvarData(id, novaData) {
    await updateLivro(id, {data_lancamento: novaData})
    setLivros(prev => prev.map(l => l.id===id ? {...l, data_lancamento:novaData} : l))
    showToast('Data atualizada!')
  }

  async function handleExcluir(id) {
    await deleteLivro(id)
    setLivros(prev => prev.filter(l => l.id!==id))
    showToast('Livro removido dos lançamentos!')
  }

  // Drag and drop entre datas
  async function handleDrop(novaData) {
    if (!dragId || !novaData) return
    const livro = livros.find(l=>l.id===dragId)
    if (!livro || livro.data_lancamento===novaData) { setDragId(null); setDragOver(null); return }
    try {
      await updateLivro(dragId, {data_lancamento: novaData})
      setLivros(prev => prev.map(l => l.id===dragId ? {...l, data_lancamento:novaData} : l))
      showToast('Data atualizada!')
    } catch(e) { showToast('Erro ao mover','error') }
    setDragId(null); setDragOver(null)
  }

  const grid = gerarGrid(ano,mes)
  const hj   = hojeKey()

  const porDia = {}
  for (const l of livros) {
    if (!l.data_lancamento) continue
    if (!porDia[l.data_lancamento]) porDia[l.data_lancamento]=[]
    porDia[l.data_lancamento].push(l)
  }
  for (const dia of Object.keys(porDia)) {
    porDia[dia].sort((a,b)=>{
      const ea=(a.editora||'').toLowerCase(), eb=(b.editora||'').toLowerCase()
      if(ea!==eb) return ea.localeCompare(eb,'pt-BR')
      return (a.titulo||'').toLowerCase().localeCompare((b.titulo||'').toLowerCase(),'pt-BR')
    })
  }

  // Cores únicas por editora — construídas uma vez por mês para não variar
  const todasEditoras = [...new Set(livros.map(l=>l.editora).filter(Boolean))].sort()
  const coresEditoras = buildCores(todasEditoras)

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Calendar size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Lançamentos</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {livros.length} lançamento{livros.length!==1?'s':''} em {MESES[mes-1].toLowerCase()} {ano}
            </p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {ehAdminVisual && (
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
              value={filtroGrupoAdmin} onChange={e=>setFiltroGrupoAdmin(e.target.value)}>
              <option value="todos">Todos os grupos</option>
              <option value="influencers">Influencers</option>
              <option value="parceiras">Parceiras</option>
              <option value="proprias">Próprias</option>
              <option value="marketplaces">Marketplaces</option>
            </select>
          )}
          <button className="btn btn-primary" onClick={()=>setModalImportar(true)}>
            <Upload size={14}/> Importar planilha
          </button>
        </div>
      </div>

      {/* Navegação */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 20px'}}>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(-1)}><ChevronLeft size={18}/></button>
        <span style={{fontSize:18,fontWeight:700,color:'var(--text)',minWidth:220,textAlign:'center'}}>
          {MESES[mes-1]} {ano}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(1)}><ChevronRight size={18}/></button>
      </div>

      {/* Legenda de editoras */}
      {todasEditoras.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
          {todasEditoras.map(e=>(
            <div key={e} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text-muted)'}}>
              <div style={{width:10,height:10,borderRadius:3,background:coresEditoras[e],flexShrink:0}}/>
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendário */}
      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',width:'100%'}}>
            {/* Header dias */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(0, 1fr))',borderBottom:'1px solid var(--border)'}}>
              {DIAS_SEMANA.map((d,i)=>(
                <div key={d} style={{padding:'10px 0',textAlign:'center',fontSize:11,fontWeight:700,
                  color:i===0||i===6?'var(--accent)':'var(--text-muted)',
                  textTransform:'uppercase',letterSpacing:'0.05em'}}>{d}</div>
              ))}
            </div>

            {/* Grade */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(0, 1fr))'}}>
              {grid.map(({key,dia,doMes},i)=>{
                const livrosDia = porDia[key] || []
                const ehHoje    = key===hj
                const col       = i%7
                const fds       = col===0||col===6
                const ultima    = i>=grid.length-7
                const isDragOver = dragOver===key && doMes

                return (
                  <div key={`${key}-${i}`}
                    onClick={()=>{ if(!dragId && livrosDia.length>0 && doMes) setModalDia({dataKey:key,livros:livrosDia}) }}
                    onDragOver={e=>{ e.preventDefault(); if(doMes) setDragOver(key) }}
                    onDragLeave={()=>setDragOver(null)}
                    onDrop={e=>{ e.preventDefault(); if(doMes) handleDrop(key) }}
                    style={{
                      minHeight:120, width:'100%', overflow:'hidden', boxSizing:'border-box',
                      padding:'6px 5px',
                      borderRight:col<6?'1px solid var(--border)':'none',
                      borderBottom:!ultima?'1px solid var(--border)':'none',
                      background: isDragOver ? 'var(--accent-glow)'
                        : ehHoje ? 'var(--accent-glow)'
                        : fds&&doMes ? 'rgba(255,255,255,0.012)' : 'transparent',
                      opacity:doMes?1:0.3,
                      cursor:livrosDia.length>0&&!dragId?'pointer':'default',
                      outline: isDragOver ? '2px dashed var(--accent)' : 'none',
                      transition:'background 0.1s',
                    }}
                  >
                    <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                      width:24,height:24,borderRadius:'50%',fontSize:12,marginBottom:3,flexShrink:0,
                      fontWeight:ehHoje?800:500,
                      color:ehHoje?'#fff':fds?'var(--accent)':'var(--text-muted)',
                      background:ehHoje?'var(--accent)':'transparent'}}>{dia}</div>

                    {livrosDia.map(l=>{
                      const cor = coresEditoras[l.editora]||'#6b7280'
                      return (
                        <div key={l.id}
                          draggable={doMes}
                          onDragStart={e=>{ e.stopPropagation(); setDragId(l.id) }}
                          onDragEnd={()=>{ setDragId(null); setDragOver(null) }}
                          onClick={e=>{ e.stopPropagation(); if(!dragId) setModalEditar(l) }}
                          title={`${l.titulo} — clique para editar/excluir`}
                          style={{
                            marginBottom:2, padding:'2px 5px', borderRadius:3,
                            background:`${cor}18`, borderLeft:`3px solid ${cor}`,
                            overflow:'hidden', width:'100%', boxSizing:'border-box',
                            cursor:'grab', opacity:dragId===l.id?0.4:1,
                            transition:'opacity 0.15s',
                          }}>
                          <div style={{fontSize:10,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>{l.titulo}</div>
                          {l.editora&&<div style={{fontSize:9,color:cor,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.editora}</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      {/* Modais */}
      {modalDia && (
        <ModalDia
          dataKey={modalDia.dataKey}
          livros={modalDia.livros}
          coresEditoras={coresEditoras}
          onEditLivro={l=>{ setModalEditar(l); setModalDia(null) }}
          onClose={()=>setModalDia(null)}
        />
      )}
      {modalEditar && (
        <ModalEditarLivro
          livro={modalEditar}
          coresEditoras={coresEditoras}
          onSave={handleSalvarData}
          onDelete={handleExcluir}
          onClose={()=>setModalEditar(null)}
        />
      )}
      {modalImportar && (
        <ModalImportar
          grupo={grupoLanc}
          onImport={()=>{ carregar(ano,mes); showToast('Importação concluída!') }}
          onClose={()=>setModalImportar(false)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
