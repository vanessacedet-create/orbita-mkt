import { useEffect, useState, useRef } from 'react'
import { getLivrosLancamento, importarLancamentos } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Upload, X, BookOpen, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 5000) }
  return [toast, show]
}

// ── MODAL DETALHES DO DIA ──────────────────────────────────
function ModalDia({ data, livros, onClose }) {
  // data is "yyyy-MM-dd" string — parse safely without timezone shift
  const [y, m, d] = data.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const label = format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ textTransform: 'capitalize' }}>{label}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {livros.length} lançamento{livros.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {livros.map(l => (
            <div key={l.id} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 14px'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{l.titulo}</div>
              {l.editora && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{l.editora}</div>}
              {l.autor   && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.autor}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
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

// ── MODAL IMPORTAR PLANILHA ────────────────────────────────
function ModalImportar({ onImport, onClose }) {
  const [preview, setPreview]   = useState([])
  const [arquivo, setArquivo]   = useState(null)
  const [erros, setErros]       = useState([])
  const [saving, setSaving]     = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  function parseDate(val) {
    if (!val) return null
    // JS Date object (SheetJS with cellDates:true)
    if (val instanceof Date) {
      const y = val.getFullYear()
      const m = String(val.getMonth()+1).padStart(2,'0')
      const d = String(val.getDate()).padStart(2,'0')
      return `${y}-${m}-${d}`
    }
    // Excel serial number
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      return d.toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    // dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `${y}-${m}-${d}`
    }
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const dt = new Date(s)
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10)
    return null
  }

  function handleFile(file) {
    if (!file) return
    setArquivo(file)
    setErros([])
    setResultado(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      // cellDates:true faz SheetJS retornar Date objects em vez de serial numbers
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const errosArr = []
      const parsed = rows.map((row, i) => {
        // Busca coluna ignorando acento, maiúsculas e espaços
        const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim()
        const get = (...keys) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => norm(rk) === norm(k))
            if (found !== undefined && row[found] !== '') return row[found]
          }
          return ''
        }
        const tituloRaw = get('titulo', 'título', 'title', 'nome')
        const titulo = tituloRaw ? String(tituloRaw).trim() : ''
        const dataRaw = get('data de lancamento', 'data de lançamento', 'data lancamento', 'data lançamento', 'data_lancamento', 'data', 'lancamento', 'lançamento')
        const data_lancamento = parseDate(dataRaw)
        const isbnRaw = get('isbn')
        const skuRaw  = get('sku', 'codigo', 'código')
        if (!titulo) errosArr.push(`Linha ${i + 2}: título ausente`)
        return {
          titulo,
          autor:           String(get('autor', 'author', 'autores')||'').trim() || null,
          editora:         String(get('editora', 'publisher')||'').trim() || null,
          isbn:            isbnRaw ? String(isbnRaw).trim() : null,
          sku:             skuRaw  ? String(skuRaw).trim()  : null,
          data_lancamento,
        }
      }).filter(r => r.titulo)
      setErros(errosArr)
      setPreview(parsed)
    }
    reader.readAsBinaryString(file)
  }

  async function salvar() {
    if (preview.length === 0) return
    setSaving(true)
    try {
      const res = await importarLancamentos(preview)
      setResultado(res)
      if (res.erros.length === 0) {
        setTimeout(() => { onImport(); onClose() }, 2000)
      }
    } catch(e) {
      console.error(e)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar Lançamentos</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {!resultado ? (
          <>
            {/* Upload area */}
            <div
              onClick={() => inputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                background: arquivo ? 'var(--accent-glow)' : 'var(--surface-2)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
              <Upload size={24} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {arquivo ? arquivo.name : 'Clique para selecionar a planilha'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Formatos aceitos: .xlsx, .xls, .csv
              </div>
            </div>

            {/* Instruções de colunas */}
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--text)' }}>Colunas esperadas na planilha:</strong>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Título', 'Autor', 'Editora', 'ISBN', 'SKU', 'Data de Lançamento'].map(c => (
                  <span key={c} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>{c}</span>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>Data aceita nos formatos: <strong>dd/mm/aaaa</strong> ou <strong>aaaa-mm-dd</strong></div>
            </div>

            {erros.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
                {erros.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                  Prévia — {preview.length} livro{preview.length !== 1 ? 's' : ''} encontrado{preview.length !== 1 ? 's' : ''}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Editora</th>
                        <th>Data lançamento</th>
                        <th>ISBN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((l, i) => (
                        <tr key={i}>
                          <td className="td-strong" style={{ fontSize: 12 }}>{l.titulo}</td>
                          <td style={{ fontSize: 12, color: 'var(--accent)' }}>{l.editora || '—'}</td>
                          <td style={{ fontSize: 12 }}>{l.data_lancamento || <span style={{ color: 'var(--red)' }}>sem data</span>}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.isbn || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}
                disabled={saving || preview.length === 0}>
                {saving ? 'Importando...' : `Importar ${preview.length} livro${preview.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {resultado.erros.length === 0 ? '✅' : '⚠️'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {resultado.erros.length === 0 ? 'Importação concluída!' : 'Importado com avisos'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              {resultado.criados} novo{resultado.criados !== 1 ? 's' : ''} · {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''}
            </div>
            {resultado.erros.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>
                {resultado.erros.length} erro{resultado.erros.length !== 1 ? 's' : ''}: {resultado.erros.join(', ')}
              </div>
            )}
            {resultado.erros.length > 0 && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { onImport(); onClose() }}>Fechar</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CALENDÁRIO ─────────────────────────────────────────────
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const EDITORA_COLORS = {}
const PALETTE = [
  'var(--accent)', 'var(--indigo)', 'var(--green)', 'var(--amber)',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
]
let colorIdx = 0
function getEditoraColor(editora) {
  if (!editora) return 'var(--text-muted)'
  if (!EDITORA_COLORS[editora]) {
    EDITORA_COLORS[editora] = PALETTE[colorIdx % PALETTE.length]
    colorIdx++
  }
  return EDITORA_COLORS[editora]
}

export default function Lancamentos() {
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [livros, setLivros]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [modalDia, setModalDia]     = useState(null) // { data, livros }
  const [modalImportar, setModalImportar] = useState(false)
  const [toast, showToast]          = useToast()

  async function carregar(mes) {
    setLoading(true)
    try {
      const data = await getLivrosLancamento({ ano: mes.getFullYear(), mes: mes.getMonth() + 1 })
      setLivros(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar(mesAtual) }, [mesAtual])

  function navMes(delta) {
    setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  // Gera calendário 100% à prova de fuso horário
  // Trabalha apenas com strings "yyyy-MM-dd" e aritmética de datas local
  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth() // 0-indexed

  // Calcula dia da semana de qualquer data SEM criar Date objects (algoritmo de Tomohiko Sakamoto)
  function diaSemana(a, m, d) {
    // Retorna 0=Dom, 1=Seg ... 6=Sáb
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    if (m < 3) a -= 1
    return (a + Math.floor(a/4) - Math.floor(a/100) + Math.floor(a/400) + t[m-1] + d) % 7
  }

  function diasNoMes(a, m) { // m: 1-indexed
    return new Date(a, m, 0).getDate()
  }

  function strData(a, m, d) {
    return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  // Monta array de objetos { key: "yyyy-MM-dd", dia, mes, ano, doMes }
  const totalDias    = diasNoMes(ano, mes + 1)
  const inicioCol    = diaSemana(ano, mes + 1, 1) // 0=Dom
  const diasGrid = []

  // Dias do mês anterior
  const anoAnterior  = mes === 0 ? ano - 1 : ano
  const mesAnterior  = mes === 0 ? 12 : mes
  const totalAnterior = diasNoMes(anoAnterior, mesAnterior)
  for (let i = inicioCol - 1; i >= 0; i--) {
    const d = totalAnterior - i
    diasGrid.push({ key: strData(anoAnterior, mesAnterior, d), dia: d, doMes: false })
  }

  // Dias do mês atual
  for (let d = 1; d <= totalDias; d++) {
    diasGrid.push({ key: strData(ano, mes + 1, d), dia: d, doMes: true })
  }

  // Completa até múltiplo de 7
  const resto = diasGrid.length % 7
  if (resto !== 0) {
    const proxAno = mes === 11 ? ano + 1 : ano
    const proxMes = mes === 11 ? 1 : mes + 2
    for (let d = 1; d <= 7 - resto; d++) {
      diasGrid.push({ key: strData(proxAno, proxMes, d), dia: d, doMes: false })
    }
  }

  // Agrupa livros por data — usa a data string diretamente sem conversão de fuso
  const livrosPorDia = {}
  for (const l of livros) {
    if (!l.data_lancamento) continue
    const key = l.data_lancamento // ex: "2026-03-13"
    if (!livrosPorDia[key]) livrosPorDia[key] = []
    livrosPorDia[key].push(l)
  }

  // Editoras únicas do mês para legenda
  const editoras = [...new Set(livros.map(l => l.editora).filter(Boolean))]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Calendar size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Lançamentos</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {livros.length} lançamento{livros.length !== 1 ? 's' : ''} em {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModalImportar(true)}>
          <Upload size={14} /> Importar planilha
        </button>
      </div>

      {/* Navegação de mês */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 20px'
      }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(-1)}><ChevronLeft size={18}/></button>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', minWidth: 200, textAlign: 'center' }}>
          {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(1)}><ChevronRight size={18}/></button>
      </div>

      {/* Legenda editoras */}
      {editoras.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {editoras.map(e => (
            <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: getEditoraColor(e), flexShrink: 0 }}/>
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendário */}
      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Cabeçalho dias da semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{
                  padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: d === 'Dom' || d === 'Sáb' ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>{d}</div>
              ))}
            </div>

            {/* Grade de dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {diasGrid.map(({ key, dia, doMes }, i) => {
                const livrosDia = livrosPorDia[key] || []
                const hoje = new Date()
                const hojeKey = strData(hoje.getFullYear(), hoje.getMonth()+1, hoje.getDate())
                const ehHoje = key === hojeKey
                const coluna = i % 7 // 0=Dom, 6=Sab
                const fimDeSemana = coluna === 0 || coluna === 6
                return (
                  <div
                    key={i}
                    onClick={() => livrosDia.length > 0 && setModalDia({ data: key, livros: livrosDia })}
                    style={{
                      minHeight: 110,
                      padding: '8px 6px',
                      borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                      borderBottom: i < dias.length - 7 ? '1px solid var(--border)' : 'none',
                      background: ehHoje ? 'var(--accent-glow)' : fimDeSemana && doMes ? 'rgba(255,255,255,0.015)' : 'transparent',
                      opacity: doMes ? 1 : 0.35,
                      cursor: livrosDia.length > 0 ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (livrosDia.length > 0) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = ehHoje ? 'var(--accent-glow)' : fimDeSemana && doMes ? 'rgba(255,255,255,0.015)' : 'transparent' }}
                  >
                    {/* Número do dia */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: ehHoje ? 800 : 500,
                      color: ehHoje ? '#fff' : fimDeSemana ? 'var(--accent)' : 'var(--text-muted)',
                      background: ehHoje ? 'var(--accent)' : 'transparent',
                      marginBottom: 4
                    }}>{dia}</div>

                    {/* Livros do dia */}
                    {livrosDia.map(l => (
                      <div key={l.id} style={{
                        marginBottom: 3, padding: '2px 6px', borderRadius: 4,
                        background: `${getEditoraColor(l.editora)}18`,
                        borderLeft: `3px solid ${getEditoraColor(l.editora)}`,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          lineHeight: '1.3'
                        }}>{l.titulo}</div>
                        {l.editora && (
                          <div style={{
                            fontSize: 9, color: getEditoraColor(l.editora), fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>{l.editora}</div>
                        )}
                      </div>
                    ))}

                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      {/* Modais */}
      {modalDia && (
        <ModalDia data={modalDia.data} livros={modalDia.livros} onClose={() => setModalDia(null)} />
      )}
      {modalImportar && (
        <ModalImportar
          onImport={() => { carregar(mesAtual); showToast('Importação concluída!') }}
          onClose={() => setModalImportar(false)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
