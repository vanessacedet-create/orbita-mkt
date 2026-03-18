import { useEffect, useState, useRef } from 'react'
import { getLivrosLancamento, importarLancamentos } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Upload, X, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── UTILITÁRIOS DE DATA (sem bibliotecas, sem fuso) ────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// Algoritmo de Zeller — retorna 0=Dom, 1=Seg ... 6=Sáb
function diaDaSemana(ano, mes, dia) {
  let a = ano, m = mes
  if (m < 3) { m += 12; a -= 1 }
  const k = a % 100
  const j = Math.floor(a / 100)
  const h = (dia + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7
  return ((h + 6) % 7)
}

function diasNoMes(ano, mes) {
  if (mes === 2) {
    const bis = (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0)
    return bis ? 29 : 28
  }
  return [0,31,28,31,30,31,30,31,31,30,31,30,31][mes]
}

function pad(n) { return String(n).padStart(2, '0') }
function toKey(a, m, d) { return `${a}-${pad(m)}-${pad(d)}` }
function hojeKey() {
  const d = new Date()
  return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function gerarGrid(ano, mes) {
  const primeiroDia = diaDaSemana(ano, mes, 1)
  const total = diasNoMes(ano, mes)
  const grid = []

  if (primeiroDia > 0) {
    const ma = mes === 1 ? 12 : mes - 1
    const aa = mes === 1 ? ano - 1 : ano
    const ta = diasNoMes(aa, ma)
    for (let i = primeiroDia - 1; i >= 0; i--)
      grid.push({ key: toKey(aa, ma, ta - i), dia: ta - i, doMes: false })
  }

  for (let d = 1; d <= total; d++)
    grid.push({ key: toKey(ano, mes, d), dia: d, doMes: true })

  const resto = grid.length % 7
  if (resto > 0) {
    const mp = mes === 12 ? 1 : mes + 1
    const ap = mes === 12 ? ano + 1 : ano
    for (let d = 1; d <= 7 - resto; d++)
      grid.push({ key: toKey(ap, mp, d), dia: d, doMes: false })
  }
  return grid
}

// ── CORES DAS EDITORAS ─────────────────────────────────────
const PALETTE = ['#f97316','#6366f1','#22c55e','#eab308','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#84cc16','#f43f5e']
const _cores = {}; let _idx = 0
function corEditora(e) {
  if (!e) return '#6b7280'
  if (!_cores[e]) _cores[e] = PALETTE[_idx++ % PALETTE.length]
  return _cores[e]
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

// ── MODAL DIA ──────────────────────────────────────────────
function ModalDia({ dataKey, livros, onClose }) {
  const [a, m, d] = dataKey.split('-').map(Number)
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{d} de {MESES[m-1]} de {a}</h2>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {livros.length} lançamento{livros.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:'60vh', overflowY:'auto' }}>
          {livros.map(l => (
            <div key={l.id} style={{
              background:'var(--surface-2)', border:'1px solid var(--border)',
              borderLeft:`4px solid ${corEditora(l.editora)}`, borderRadius:8, padding:'12px 14px'
            }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{l.titulo}</div>
              {l.editora && <div style={{ fontSize:12, color:corEditora(l.editora), fontWeight:600, marginBottom:4 }}>{l.editora}</div>}
              {l.autor   && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{l.autor}</div>}
              <div style={{ display:'flex', gap:12, marginTop:6, fontSize:11, color:'var(--text-muted)' }}>
                {l.isbn && <span>ISBN: {l.isbn}</span>}
                {l.sku  && <span>SKU: {l.sku}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR ─────────────────────────────────────────
function ModalImportar({ onImport, onClose }) {
  const [preview, setPreview]     = useState([])
  const [arquivo, setArquivo]     = useState(null)
  const [erros, setErros]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  function parseDate(val) {
    if (!val) return null
    // Objeto Date JS (cellDates:true retorna isso às vezes)
    if (val instanceof Date) return toKey(val.getFullYear(), val.getMonth()+1, val.getDate())
    // Número serial do Excel
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      return toKey(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate())
    }
    const s = String(val).trim()
    // ISO com horário: "2026-02-01T00:00:00.000Z" ou "2026-02-01T03:00:00"
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    // dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,a]=s.split('/'); return `${a}-${pad(+m)}-${pad(+d)}` }
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return null
  }

  function norm(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
  function get(row, ...keys) {
    for (const k of keys) {
      const f = Object.keys(row).find(rk => norm(rk) === norm(k))
      if (f !== undefined && row[f] !== '') return row[f]
    }
    return ''
  }

  function handleFile(file) {
    if (!file) return
    setArquivo(file); setErros([]); setResultado(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      // Usa array buffer para leitura mais confiável de datas
      const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array', cellDates:false })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'', raw:true })
      const errosArr = []
      const parsed = rows.map((row, i) => {
        const titulo = String(get(row,'titulo','título','title','nome')||'').trim()
        const dataRaw = get(row,'data de lancamento','data de lançamento','data lancamento','data lançamento','data_lancamento','data','lancamento','lançamento')
        const data_lancamento = parseDate(dataRaw)
        if (!titulo) errosArr.push(`Linha ${i+2}: título ausente`)
        if (titulo && !data_lancamento) errosArr.push(`Linha ${i+2}: data não reconhecida (${dataRaw})`)
        // ISBN como número puro do Excel (ex: 9786583924674)
        const isbnRaw = get(row,'isbn')
        const skuRaw  = get(row,'sku','codigo','código')
        return {
          titulo,
          autor:           String(get(row,'autor','author')||'').trim()||null,
          editora:         String(get(row,'editora','publisher')||'').trim()||null,
          isbn:            isbnRaw ? String(isbnRaw).replace(/\.0$/, '').trim() : null,
          sku:             skuRaw  ? String(skuRaw).replace(/\.0$/, '').trim()  : null,
          data_lancamento,
        }
      }).filter(r => r.titulo)
      setErros(errosArr); setPreview(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  async function salvar() {
    if (!preview.length) return
    setSaving(true)
    try {
      const res = await importarLancamentos(preview)
      setResultado(res)
      if (res.erros.length === 0) setTimeout(() => { onImport(); onClose() }, 2000)
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth:580 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar Lançamentos</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        {!resultado ? (<>
          <div onClick={() => inputRef.current?.click()} style={{
            border:`2px dashed ${arquivo?'var(--accent)':'var(--border)'}`, borderRadius:10,
            padding:'28px 20px', textAlign:'center', cursor:'pointer', marginBottom:16,
            background: arquivo ? 'var(--accent-glow)' : 'var(--surface-2)'
          }}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])}/>
            <Upload size={24} color="var(--accent)" style={{ marginBottom:8 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{arquivo ? arquivo.name : 'Clique para selecionar a planilha'}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Formatos aceitos: .xlsx, .xls, .csv</div>
          </div>
          <div style={{ background:'var(--surface-2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
            <strong style={{ color:'var(--text)' }}>Colunas esperadas:</strong>
            <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Título','Autor','Editora','ISBN','SKU','Data de Lançamento'].map(c=>(
                <span key={c} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 8px' }}>{c}</span>
              ))}
            </div>
            <div style={{ marginTop:6 }}>Data aceita: <strong>dd/mm/aaaa</strong>, <strong>aaaa-mm-dd</strong> ou formato de data do Excel</div>
          </div>
          {erros.length > 0 && (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--red)', marginBottom:12 }}>
              {erros.map((e,i)=><div key={i}>{e}</div>)}
            </div>
          )}
          {preview.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'var(--text)' }}>Prévia — {preview.length} livro{preview.length!==1?'s':''}</div>
              <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                <table><thead><tr><th>Título</th><th>Editora</th><th>Data lançamento</th></tr></thead>
                  <tbody>{preview.map((l,i)=>(
                    <tr key={i}>
                      <td style={{ fontSize:12 }}>{l.titulo}</td>
                      <td style={{ fontSize:12, color:'var(--accent)' }}>{l.editora||'—'}</td>
                      <td style={{ fontSize:12 }}>{l.data_lancamento||<span style={{ color:'var(--red)' }}>sem data</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={saving||!preview.filter(l=>l.data_lancamento).length}>
              {saving ? 'Importando...' : (() => {
                const comData = preview.filter(l=>l.data_lancamento).length
                const semData = preview.filter(l=>!l.data_lancamento).length
                return `Importar ${comData} livro${comData!==1?'s':''}${semData>0?' ('+semData+' sem data serão ignorados)':''}`
              })()}
            </button>
          </div>
        </>) : (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>{resultado.erros.length===0?'✅':'⚠️'}</div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
              {resultado.erros.length===0?'Importação concluída!':'Importado com avisos'}
            </div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {resultado.criados} criado{resultado.criados!==1?'s':''} · {resultado.atualizados} atualizado{resultado.atualizados!==1?'s':''}
            </div>
            {resultado.erros.length > 0 && (
              <div style={{ marginTop:12, textAlign:'left', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--red)', maxHeight:160, overflowY:'auto' }}>
                <strong style={{ display:'block', marginBottom:4 }}>Erros ({resultado.erros.length}):</strong>
                {resultado.erros.map((e,i)=><div key={i} style={{marginBottom:2}}>• {e}</div>)}
              </div>
            )}
            {resultado.erros.length>0&&<button className="btn btn-primary" style={{ marginTop:16 }} onClick={()=>{onImport();onClose()}}>Fechar</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Lancamentos() {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [livros, setLivros]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modalDia, setModalDia]       = useState(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [toast, showToast] = useToast()

  async function carregar(a, m) {
    setLoading(true)
    try { setLivros(await getLivrosLancamento({ ano:a, mes:m })) }
    catch(e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { carregar(ano, mes) }, [ano, mes])

  function navMes(delta) {
    let nm = mes + delta, na = ano
    if (nm > 12) { nm=1; na++ }
    if (nm < 1)  { nm=12; na-- }
    setMes(nm); setAno(na)
  }

  const grid = gerarGrid(ano, mes)
  const hj   = hojeKey()

  const porDia = {}
  for (const l of livros) {
    if (!l.data_lancamento) continue
    if (!porDia[l.data_lancamento]) porDia[l.data_lancamento] = []
    porDia[l.data_lancamento].push(l)
  }
  // Ordena cada dia: agrupa por editora (alfabético), dentro de cada editora alfabético por título
  for (const dia of Object.keys(porDia)) {
    porDia[dia].sort((a, b) => {
      const ea = (a.editora||'').toLowerCase()
      const eb = (b.editora||'').toLowerCase()
      if (ea !== eb) return ea.localeCompare(eb, 'pt-BR')
      return (a.titulo||'').toLowerCase().localeCompare((b.titulo||'').toLowerCase(), 'pt-BR')
    })
  }

  const editoras = [...new Set(livros.map(l=>l.editora).filter(Boolean))].sort()

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Calendar size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{ margin:0 }}>Lançamentos</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>
              {livros.length} lançamento{livros.length!==1?'s':''} em {MESES[mes-1].toLowerCase()} {ano}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModalImportar(true)}>
          <Upload size={14}/> Importar planilha
        </button>
      </div>

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:20,
        marginBottom:16, background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 20px'
      }}>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(-1)}><ChevronLeft size={18}/></button>
        <span style={{ fontSize:18, fontWeight:700, color:'var(--text)', minWidth:220, textAlign:'center' }}>
          {MESES[mes-1]} {ano}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(1)}><ChevronRight size={18}/></button>
      </div>

      {editoras.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
          {editoras.map(e=>(
            <div key={e} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)' }}>
              <div style={{ width:10, height:10, borderRadius:3, background:corEditora(e), flexShrink:0 }}/>
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', width:'100%', tableLayout:'fixed' }}>
            {/* Cabeçalho — 7 colunas exatamente iguais */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', borderBottom:'1px solid var(--border)' }}>
              {DIAS_SEMANA.map((d,i)=>(
                <div key={d} style={{
                  padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:700,
                  color: i===0||i===6 ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.05em',
                  overflow:'hidden'
                }}>{d}</div>
              ))}
            </div>

            {/* Grade — minmax(0,1fr) impede que célula com conteúdo longo expanda */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))' }}>
              {grid.map(({ key, dia, doMes }, i) => {
                const livrosDia = porDia[key] || []
                const ehHoje    = key === hj
                const col       = i % 7
                const fds       = col===0||col===6
                const ultima    = i >= grid.length - 7

                return (
                  <div key={`${key}-${i}`}
                    onClick={()=> livrosDia.length>0 && setModalDia({ dataKey:key, livros:livrosDia })}
                    style={{
                      minHeight:120,
                      width:'100%',
                      overflow:'hidden',
                      boxSizing:'border-box',
                      padding:'6px 5px',
                      borderRight: col<6 ? '1px solid var(--border)' : 'none',
                      borderBottom: !ultima ? '1px solid var(--border)' : 'none',
                      background: ehHoje ? 'var(--accent-glow)' : fds&&doMes ? 'rgba(255,255,255,0.012)' : 'transparent',
                      opacity: doMes ? 1 : 0.3,
                      cursor: livrosDia.length>0 ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e=>{ if(livrosDia.length>0&&doMes) e.currentTarget.style.background='var(--surface-2)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background = ehHoje?'var(--accent-glow)':fds&&doMes?'rgba(255,255,255,0.012)':'transparent' }}
                  >
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:24, height:24, borderRadius:'50%', fontSize:12,
                      fontWeight: ehHoje?800:500,
                      color: ehHoje?'#fff':fds?'var(--accent)':'var(--text-muted)',
                      background: ehHoje?'var(--accent)':'transparent',
                      marginBottom:3, flexShrink:0
                    }}>{dia}</div>

                    {livrosDia.map(l=>(
                      <div key={l.id} style={{
                        marginBottom:2, padding:'2px 5px', borderRadius:3,
                        background:`${corEditora(l.editora)}18`,
                        borderLeft:`3px solid ${corEditora(l.editora)}`,
                        overflow:'hidden', width:'100%', boxSizing:'border-box'
                      }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3, display:'block', width:'100%' }}>{l.titulo}</div>
                        {l.editora&&<div style={{ fontSize:9, color:corEditora(l.editora), fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', width:'100%' }}>{l.editora}</div>}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      {modalDia && <ModalDia dataKey={modalDia.dataKey} livros={modalDia.livros} onClose={()=>setModalDia(null)}/>}
      {modalImportar && <ModalImportar onImport={()=>{ carregar(ano,mes); showToast('Importação concluída!') }} onClose={()=>setModalImportar(false)}/>}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
