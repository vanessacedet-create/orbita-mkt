import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Search,
  Plus,
  Pencil,
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
} from 'lucide-react'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 50
const BATCH_SIZE = 500
const MAX_ROWS = 40000

const CAMPOS = [
  'numero_pedido',
  'nome',
  'email',
  'telefone',
  'metodo_pagamento',
  'cidade_estado',
  'frete',
  'valor',
  'livraria',
  'data_criacao',
  'situacao',
]

const LABELS = {
  numero_pedido: 'Nº Pedido',
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  metodo_pagamento: 'Método Pag.',
  cidade_estado: 'Cidade/Estado',
  frete: 'Frete',
  valor: 'Valor',
  livraria: 'Livraria',
  data_criacao: 'Data criação',
  situacao: 'Situação',
}

const ALIASES = {
  numero_pedido: [
    'numero_pedido',
    'nº pedido',
    'n pedido',
    'número pedido',
    'numero pedido',
    'pedido',
    'número do pedido',
    'numero do pedido',
    'order',
    'order id',
  ],
  nome: ['nome', 'cliente', 'nome cliente', 'nome do cliente', 'customer', 'name'],
  email: ['email', 'e-mail', 'mail', 'e mail'],
  telefone: ['telefone', 'tel', 'celular', 'whatsapp', 'fone'],
  metodo_pagamento: [
    'metodo_pagamento',
    'método pag.',
    'metodo pag.',
    'método pagamento',
    'metodo pagamento',
    'forma pagamento',
    'forma de pagamento',
    'pagamento',
  ],
  cidade_estado: [
    'cidade_estado',
    'cidade/estado',
    'cidade estado',
    'cidade',
    'estado',
    'uf',
    'cidade uf',
  ],
  frete: ['frete', 'envio', 'entrega', 'modalidade frete', 'modalidade de frete'],
  valor: ['valor', 'total', 'valor total', 'preço', 'preco', 'total pedido'],
  livraria: ['livraria', 'loja', 'marketplace', 'canal', 'origem', 'site'],
  data_criacao: [
    'data_criacao',
    'data criação',
    'data criacao',
    'data de criação',
    'data de criacao',
    'criado em',
    'data pedido',
    'data do pedido',
  ],
  situacao: ['situacao', 'situação', 'status', 'estado pedido', 'situação pedido'],
}

const EMPTY_FORM = {
  numero_pedido: '',
  nome: '',
  email: '',
  telefone: '',
  metodo_pagamento: '',
  cidade_estado: '',
  frete: '',
  valor: '',
  livraria: '',
  data_criacao: '',
  situacao: '',
}

function normalizarTexto(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª]/g, '')
    .replace(/[._\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizarNumeroPedido(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.0$/, '')
}

function limparBuscaSupabase(value) {
  return String(value || '')
    .replace(/[%(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolverColuna(headers, campo) {
  const alternativas = ALIASES[campo].map(normalizarTexto)

  return headers.find((header) => {
    const h = normalizarTexto(header)
    return alternativas.includes(h)
  })
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'

  const numero = Number(valor)

  if (Number.isNaN(numero)) return String(valor)

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(value) {
  if (!value) return '—'

  try {
    const data = new Date(value)
    if (Number.isNaN(data.getTime())) return value

    return data.toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

function excelSerialDateToISO(serial) {
  const utcDays = Math.floor(Number(serial) - 25569)
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)

  if (Number.isNaN(dateInfo.getTime())) return null

  return dateInfo.toISOString()
}

function parseData(value) {
  if (!value) return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    return excelSerialDateToISO(value)
  }

  const str = String(value).trim()
  if (!str) return null

  if (/^\d+(\.\d+)?$/.test(str)) {
    return excelSerialDateToISO(Number(str))
  }

  const br = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (br) {
    const dia = br[1].padStart(2, '0')
    const mes = br[2].padStart(2, '0')
    let ano = br[3]
    if (ano.length === 2) ano = `20${ano}`

    const data = new Date(`${ano}-${mes}-${dia}T12:00:00`)
    if (!Number.isNaN(data.getTime())) return data.toISOString()
  }

  const data = new Date(str)
  if (!Number.isNaN(data.getTime())) return data.toISOString()

  return null
}

function parseValor(value) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') return value

  let str = String(value)
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .trim()

  if (!str) return null

  const temVirgula = str.includes(',')
  const temPonto = str.includes('.')

  if (temVirgula && temPonto) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula) {
    str = str.replace(',', '.')
  }

  const numero = Number(str)

  return Number.isNaN(numero) ? null : numero
}

function deduplicarPorNumeroPedido(linhas, linhaInicial = 2) {
  const mapa = new Map()
  const duplicados = []

  linhas.forEach((linha, index) => {
    const numero = normalizarNumeroPedido(linha.numero_pedido)

    if (!numero) return

    const linhaNormalizada = {
      ...linha,
      numero_pedido: numero,
    }

    if (mapa.has(numero)) {
      duplicados.push({
        linha: linhaInicial + index,
        numero_pedido: numero,
        erro: 'Pedido repetido dentro da planilha. Foi mantida a última ocorrência.',
      })
    }

    mapa.set(numero, linhaNormalizada)
  })

  return {
    linhasDeduplicadas: Array.from(mapa.values()),
    duplicados,
  }
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function baixarCSV(nomeArquivo, linhas) {
  const header = ['linha', 'numero_pedido', 'erro']
  const body = linhas.map((l) => [
    csvEscape(l.linha || ''),
    csvEscape(l.numero_pedido || ''),
    csvEscape(l.erro || ''),
  ])

  const csv = [
    header.join(';'),
    ...body.map((row) => row.join(';')),
  ].join('\n')

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

function Toast({ toast }) {
  if (!toast) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 9999,
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background:
          toast.type === 'error'
            ? 'rgba(127, 29, 29, 0.95)'
            : 'rgba(22, 101, 52, 0.95)',
        color: '#fff',
        boxShadow: '0 12px 30px rgba(0,0,0,.25)',
        fontSize: 14,
      }}
    >
      {toast.message}
    </div>
  )
}

function PedidoModal({ pedido, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!pedido) return EMPTY_FORM

    return {
      numero_pedido: pedido.numero_pedido || '',
      nome: pedido.nome || '',
      email: pedido.email || '',
      telefone: pedido.telefone || '',
      metodo_pagamento: pedido.metodo_pagamento || '',
      cidade_estado: pedido.cidade_estado || '',
      frete: pedido.frete || '',
      valor: pedido.valor ?? '',
      livraria: pedido.livraria || '',
      data_criacao: pedido.data_criacao ? String(pedido.data_criacao).slice(0, 10) : '',
      situacao: pedido.situacao || '',
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(campo, value) {
    setForm((prev) => ({ ...prev, [campo]: value }))
  }

  async function salvar() {
    setError('')

    if (!form.numero_pedido.trim()) {
      setError('Informe o número do pedido.')
      return
    }

    if (!form.nome.trim()) {
      setError('Informe o nome do cliente.')
      return
    }

    setSaving(true)

    const payload = {
      numero_pedido: normalizarNumeroPedido(form.numero_pedido),
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      metodo_pagamento: form.metodo_pagamento.trim(),
      cidade_estado: form.cidade_estado.trim(),
      frete: form.frete.trim(),
      valor: parseValor(form.valor),
      livraria: form.livraria.trim(),
      data_criacao: parseData(form.data_criacao),
      situacao: form.situacao.trim(),
      updated_at: new Date().toISOString(),
    }

    try {
      let query

      if (pedido?.id) {
        query = supabase
          .from('pedidos_crm')
          .update(payload)
          .eq('id', pedido.id)
          .select()
          .single()
      } else {
        query = supabase
          .from('pedidos_crm')
          .insert(payload)
          .select()
          .single()
      }

      const { data, error: supabaseError } = await query

      if (supabaseError) throw supabaseError

      onSaved(data)
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--surface, #111827)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 24px 70px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>{pedido ? 'Editar pedido' : 'Novo pedido'}</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Dados básicos do pedido e do cliente.
            </p>
          </div>

          <button className="btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(239, 68, 68, .12)',
              border: '1px solid rgba(239, 68, 68, .28)',
              color: '#fecaca',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {CAMPOS.map((campo) => (
            <label key={campo} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {LABELS[campo]}{['numero_pedido', 'nome'].includes(campo) ? ' *' : ''}
              </span>

              <input
                value={form[campo]}
                type={campo === 'data_criacao' ? 'date' : 'text'}
                onChange={(e) => updateField(campo, e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2, rgba(255,255,255,.04))',
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn-secondary" onClick={onClose} type="button">
            Cancelar
          </button>

          <button className="btn-primary" onClick={salvar} disabled={saving} type="button">
            {saving ? 'Salvando...' : 'Salvar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportarPlanilha({ onImportFinished, showToast }) {
  const inputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headersMap, setHeadersMap] = useState({})
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState([])
  const [validationErrors, setValidationErrors] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState({
    total: 0,
    processadas: 0,
    importadas: 0,
    atualizadas: 0,
    erros: 0,
  })

  function reset() {
    setOpen(false)
    setFileName('')
    setHeadersMap({})
    setRows([])
    setPreview([])
    setValidationErrors([])
    setImportErrors([])
    setImporting(false)
    setResult(null)
    setProgress({
      total: 0,
      processadas: 0,
      importadas: 0,
      atualizadas: 0,
      erros: 0,
    })

    if (inputRef.current) inputRef.current.value = ''
  }

  function normalizarLinha(row, headers) {
    const obj = {}

    CAMPOS.forEach((campo) => {
      const headerReal = resolverColuna(headers, campo)
      obj[campo] = headerReal ? row[headerReal] : ''
    })

    return {
      numero_pedido: normalizarNumeroPedido(obj.numero_pedido),
      nome: String(obj.nome || '').trim(),
      email: String(obj.email || '').trim(),
      telefone: String(obj.telefone || '').trim(),
      metodo_pagamento: String(obj.metodo_pagamento || '').trim(),
      cidade_estado: String(obj.cidade_estado || '').trim(),
      frete: String(obj.frete || '').trim(),
      valor: parseValor(obj.valor),
      livraria: String(obj.livraria || '').trim(),
      data_criacao: parseData(obj.data_criacao),
      situacao: String(obj.situacao || '').trim(),
    }
  }

  function validarLinhas(normalizadas) {
    const erros = []

    if (normalizadas.length > MAX_ROWS) {
      erros.push(`A planilha tem ${normalizadas.length} linhas. O limite é ${MAX_ROWS}.`)
    }

    normalizadas.forEach((row, index) => {
      const linhaExcel = index + 2

      if (!row.numero_pedido) {
        erros.push(`Linha ${linhaExcel}: número do pedido está vazio.`)
      }

      if (!row.nome) {
        erros.push(`Linha ${linhaExcel}: nome está vazio.`)
      }
    })

    return erros
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setValidationErrors([])
    setImportErrors([])
    setResult(null)

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, {
          type: 'array',
          cellDates: true,
        })

        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const rawRows = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: true,
        })

        if (!rawRows.length) {
          setValidationErrors(['A planilha está vazia.'])
          return
        }

        const headers = Object.keys(rawRows[0] || {})
        const mapa = {}

        CAMPOS.forEach((campo) => {
          mapa[campo] = resolverColuna(headers, campo) || ''
        })

        const colunasFaltantes = CAMPOS.filter((campo) => !mapa[campo])

        if (colunasFaltantes.length) {
          setValidationErrors([
            `Colunas não encontradas: ${colunasFaltantes.map((c) => LABELS[c]).join(', ')}.`,
            'A tela aceita nomes com acentos, espaços e variações comuns, mas todos os campos precisam existir.',
          ])
          setHeadersMap(mapa)
          return
        }

        const normalizadas = rawRows.map((row) => normalizarLinha(row, headers))

        const { linhasDeduplicadas, duplicados } = deduplicarPorNumeroPedido(normalizadas)

        const erros = validarLinhas(linhasDeduplicadas)

        setHeadersMap(mapa)
        setRows(linhasDeduplicadas)
        setPreview(linhasDeduplicadas.slice(0, 10))
        setValidationErrors(erros)
        setImportErrors(duplicados)
        setProgress((prev) => ({
          ...prev,
          total: linhasDeduplicadas.length,
        }))
      } catch (err) {
        setValidationErrors([
          err.message || 'Erro ao ler a planilha. Verifique se o arquivo é CSV ou XLSX válido.',
        ])
      }
    }

    reader.readAsArrayBuffer(file)
  }

  async function importar() {
    if (!rows.length || validationErrors.length) return

    setImporting(true)

    const avisosAntesDaImportacao = [...importErrors]
    setResult(null)

    let importadas = 0
    let atualizadas = 0
    let erros = 0
    let processadas = 0
    const errosDetalhados = [...avisosAntesDaImportacao]

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id || null

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batchOriginal = rows.slice(i, i + BATCH_SIZE)

        const { linhasDeduplicadas: batch, duplicados: duplicadosDoBatch } =
          deduplicarPorNumeroPedido(batchOriginal, i + 2)

        if (duplicadosDoBatch.length) {
          errosDetalhados.push(...duplicadosDoBatch)
        }

        const numeros = batch
          .map((row) => normalizarNumeroPedido(row.numero_pedido))
          .filter(Boolean)

        let existentes = new Set()

        if (numeros.length) {
          const { data: existentesData, error: existingError } = await supabase
            .from('pedidos_crm')
            .select('numero_pedido')
            .in('numero_pedido', numeros)

          if (existingError) throw existingError

          existentes = new Set((existentesData || []).map((item) => normalizarNumeroPedido(item.numero_pedido)))
        }

        const payload = batch.map((row) => ({
          ...row,
          numero_pedido: normalizarNumeroPedido(row.numero_pedido),
          arquivo_origem: fileName || null,
          importado_por: userId,
          importado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))

        const { error } = await supabase
          .from('pedidos_crm')
          .upsert(payload, { onConflict: 'numero_pedido' })

        if (error) {
          erros += batch.length

          batch.forEach((row, batchIndex) => {
            errosDetalhados.push({
              linha: i + batchIndex + 2,
              numero_pedido: row.numero_pedido,
              erro: error.message,
            })
          })
        } else {
          batch.forEach((row) => {
            if (existentes.has(normalizarNumeroPedido(row.numero_pedido))) atualizadas += 1
            else importadas += 1
          })
        }

        processadas += batch.length

        setProgress({
          total: rows.length,
          processadas,
          importadas,
          atualizadas,
          erros,
        })
      }

      setImportErrors(errosDetalhados)

      setResult({
        total: rows.length,
        importadas,
        atualizadas,
        erros,
        avisos: errosDetalhados.length,
      })

      showToast('Importação concluída.')
      onImportFinished()
    } catch (err) {
      setImportErrors([
        {
          linha: '',
          numero_pedido: '',
          erro: err.message || 'Erro geral na importação.',
        },
      ])
      showToast('Erro ao importar planilha.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const percentual = progress.total
    ? Math.round((progress.processadas / progress.total) * 100)
    : 0

  return (
    <>
      <button className="btn-secondary" type="button" onClick={() => setOpen(true)}>
        <Upload size={16} />
        Importar planilha
      </button>

      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && !importing && reset()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 980,
              maxHeight: '90vh',
              overflow: 'auto',
              background: 'var(--surface, #111827)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 24px 70px rgba(0,0,0,.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>Importar pedidos</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
                  Arquivos CSV ou XLSX com até {MAX_ROWS.toLocaleString('pt-BR')} linhas.
                </p>
              </div>

              <button className="btn-icon" type="button" onClick={reset} disabled={importing}>
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface-2, rgba(255,255,255,.04))',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 8 }}>Colunas esperadas</strong>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CAMPOS.map((campo) => (
                  <span
                    key={campo}
                    style={{
                      padding: '6px 9px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  >
                    {LABELS[campo]}
                  </span>
                ))}
              </div>

              <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Acentos, espaços e variações como “Nº Pedido”, “Método Pag.” e “Situação” são aceitos.
              </p>
            </div>

            {!result && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />

                <div
                  onClick={() => !importing && inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!importing) {
                      handleFile({ target: { files: e.dataTransfer.files } })
                    }
                  }}
                  style={{
                    marginTop: 16,
                    padding: 28,
                    borderRadius: 14,
                    border: '1px dashed var(--border)',
                    background: 'rgba(255,255,255,.03)',
                    textAlign: 'center',
                    cursor: importing ? 'not-allowed' : 'pointer',
                    opacity: importing ? 0.65 : 1,
                  }}
                >
                  <FileSpreadsheet size={32} />
                  <p style={{ margin: '10px 0 4px', fontWeight: 700 }}>
                    {fileName || 'Clique para selecionar ou arraste a planilha'}
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                    CSV, XLS ou XLSX
                  </p>
                </div>
              </>
            )}

            {Object.keys(headersMap).length > 0 && (
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                <strong>Colunas reconhecidas:</strong>{' '}
                {CAMPOS.map((campo) => `${LABELS[campo]}: ${headersMap[campo] || 'não encontrada'}`).join(' | ')}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, .12)',
                  border: '1px solid rgba(239, 68, 68, .28)',
                  color: '#fecaca',
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <AlertCircle size={16} />
                  <strong>Corrija antes de importar</strong>
                </div>

                {validationErrors.slice(0, 10).map((erro, index) => (
                  <div key={index}>{erro}</div>
                ))}

                {validationErrors.length > 10 && (
                  <div>...e mais {validationErrors.length - 10} erro(s).</div>
                )}
              </div>
            )}

            {preview.length > 0 && validationErrors.length === 0 && !result && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: '0 0 10px' }}>
                  Prévia das primeiras 10 linhas
                </h3>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {CAMPOS.map((campo) => (
                          <th
                            key={campo}
                            style={{
                              textAlign: 'left',
                              padding: 10,
                              borderBottom: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {LABELS[campo]}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index}>
                          {CAMPOS.map((campo) => (
                            <td
                              key={campo}
                              style={{
                                padding: 10,
                                borderBottom: '1px solid var(--border)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {campo === 'valor'
                                ? formatarValor(row[campo])
                                : campo === 'data_criacao'
                                  ? formatarData(row[campo])
                                  : row[campo] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importErrors.length > 0 && !result && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, .12)',
                  border: '1px solid rgba(245, 158, 11, .28)',
                  color: '#fde68a',
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <strong>Avisos antes da importação</strong>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => baixarCSV('avisos-importacao-pedidos-crm.csv', importErrors)}
                  >
                    <Download size={15} />
                    Baixar avisos
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  {importErrors.slice(0, 10).map((erro, index) => (
                    <div key={index}>
                      Linha {erro.linha || '—'} | Pedido {erro.numero_pedido || '—'} | {erro.erro}
                    </div>
                  ))}

                  {importErrors.length > 10 && (
                    <div>...e mais {importErrors.length - 10} aviso(s).</div>
                  )}
                </div>
              </div>
            )}

            {importing && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span>Importando em lotes de {BATCH_SIZE} linhas...</span>
                  <span>{percentual}%</span>
                </div>

                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${percentual}%`,
                      height: '100%',
                      background: 'var(--accent, #8b5cf6)',
                      transition: 'width .2s',
                    }}
                  />
                </div>

                <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  {progress.processadas} de {progress.total} linhas processadas.
                </div>
              </div>
            )}

            {result && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 12,
                  background: 'rgba(34,197,94,.12)',
                  border: '1px solid rgba(34,197,94,.28)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <CheckCircle size={18} />
                  <strong>Importação concluída</strong>
                </div>

                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Total processado: {result.total} | Importados: {result.importadas} | Atualizados: {result.atualizadas} | Erros: {result.erros} | Avisos: {result.avisos}
                </p>
              </div>
            )}

            {importErrors.length > 0 && result && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, .12)',
                  border: '1px solid rgba(239, 68, 68, .28)',
                  color: '#fecaca',
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <strong>Erros e avisos da importação</strong>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => baixarCSV('erros-importacao-pedidos-crm.csv', importErrors)}
                  >
                    <Download size={15} />
                    Baixar relatório
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  {importErrors.slice(0, 10).map((erro, index) => (
                    <div key={index}>
                      Linha {erro.linha || '—'} | Pedido {erro.numero_pedido || '—'} | {erro.erro}
                    </div>
                  ))}

                  {importErrors.length > 10 && (
                    <div>...e mais {importErrors.length - 10} registro(s).</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" onClick={reset} type="button" disabled={importing}>
                {result ? 'Fechar' : 'Cancelar'}
              </button>

              {!result && preview.length > 0 && validationErrors.length === 0 && (
                <button className="btn-primary" onClick={importar} type="button" disabled={importing}>
                  {importing ? 'Importando...' : `Importar ${rows.length.toLocaleString('pt-BR')} registros`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function PedidosCRM() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [situacao, setSituacao] = useState('')
  const [livraria, setLivraria] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [modalPedido, setModalPedido] = useState(null)
  const [toast, setToast] = useState(null)

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [total])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function fetchPedidos(nextPage = page) {
    setLoading(true)

    try {
      const from = nextPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('pedidos_crm')
        .select('*', { count: 'exact' })
        .order('data_criacao', { ascending: false, nullsFirst: false })
        .range(from, to)

      const termo = limparBuscaSupabase(search)

      if (termo) {
        query = query.or(
          [
            `numero_pedido.ilike.%${termo}%`,
            `nome.ilike.%${termo}%`,
            `email.ilike.%${termo}%`,
            `telefone.ilike.%${termo}%`,
            `livraria.ilike.%${termo}%`,
            `situacao.ilike.%${termo}%`,
          ].join(',')
        )
      }

      if (situacao.trim()) {
        query = query.ilike('situacao', `%${limparBuscaSupabase(situacao)}%`)
      }

      if (livraria.trim()) {
        query = query.ilike('livraria', `%${limparBuscaSupabase(livraria)}%`)
      }

      if (dataInicio) {
        query = query.gte('data_criacao', `${dataInicio}T00:00:00`)
      }

      if (dataFim) {
        query = query.lte('data_criacao', `${dataFim}T23:59:59`)
      }

      const { data, error, count } = await query

      if (error) throw error

      setPedidos(data || [])
      setTotal(count || 0)
    } catch (err) {
      showToast(err.message || 'Erro ao carregar pedidos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPedidos(0)
    setPage(0)
  }, [search, situacao, livraria, dataInicio, dataFim])

  function mudarPagina(novaPagina) {
    const segura = Math.min(Math.max(novaPagina, 0), totalPages - 1)
    setPage(segura)
    fetchPedidos(segura)
  }

  function limparFiltros() {
    setSearch('')
    setSituacao('')
    setLivraria('')
    setDataInicio('')
    setDataFim('')
  }

  function handleSaved() {
    showToast('Pedido salvo.')
    fetchPedidos(page)
  }

  return (
    <div className="page">
      <Toast toast={toast} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Pedidos CRM</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Central de pedidos, clientes, valores, livrarias e situação comercial.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ImportarPlanilha onImportFinished={() => fetchPedidos(0)} showToast={showToast} />

          <button className="btn-primary" type="button" onClick={() => setModalPedido({ mode: 'new', pedido: null })}>
            <Plus size={16} />
            Novo pedido
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
          gap: 10,
          alignItems: 'end',
          marginBottom: 16,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Busca geral</span>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, e-mail, telefone, pedido, livraria ou situação"
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-2, rgba(255,255,255,.04))',
                color: 'var(--text)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Situação</span>
          <input
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            placeholder="Ex.: concluído"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Livraria</span>
          <input
            value={livraria}
            onChange={(e) => setLivraria(e.target.value)}
            placeholder="Ex.: Amazon"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Data inicial</span>
          <input
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            type="date"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Data final</span>
          <input
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            type="date"
            style={inputStyle}
          />
        </label>

        <button className="btn-secondary" type="button" onClick={limparFiltros}>
          Limpar
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
          color: 'var(--text-muted)',
          fontSize: 14,
        }}
      >
        <span>
          {total.toLocaleString('pt-BR')} pedido{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'}
        </span>

        <button className="btn-secondary" type="button" onClick={() => fetchPedidos(page)}>
          <RefreshCw size={15} />
          Atualizar
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2, rgba(255,255,255,.04))' }}>
              <th style={thStyle}>Nº Pedido</th>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>E-mail</th>
              <th style={thStyle}>Telefone</th>
              <th style={thStyle}>Método Pag.</th>
              <th style={thStyle}>Cidade/Estado</th>
              <th style={thStyle}>Frete</th>
              <th style={thStyle}>Valor</th>
              <th style={thStyle}>Livraria</th>
              <th style={thStyle}>Data criação</th>
              <th style={thStyle}>Situação</th>
              <th style={thStyle}>Ação</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Carregando pedidos...
                </td>
              </tr>
            ) : pedidos.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <td style={tdStyle}>{pedido.numero_pedido || '—'}</td>
                  <td style={tdStyle}>{pedido.nome || '—'}</td>
                  <td style={tdStyle}>{pedido.email || '—'}</td>
                  <td style={tdStyle}>{pedido.telefone || '—'}</td>
                  <td style={tdStyle}>{pedido.metodo_pagamento || '—'}</td>
                  <td style={tdStyle}>{pedido.cidade_estado || '—'}</td>
                  <td style={tdStyle}>{pedido.frete || '—'}</td>
                  <td style={tdStyle}>{formatarValor(pedido.valor)}</td>
                  <td style={tdStyle}>{pedido.livraria || '—'}</td>
                  <td style={tdStyle}>{formatarData(pedido.data_criacao)}</td>
                  <td style={tdStyle}>{pedido.situacao || '—'}</td>
                  <td style={tdStyle}>
                    <button
                      className="btn-icon"
                      type="button"
                      onClick={() => setModalPedido({ mode: 'edit', pedido })}
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginTop: 14,
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Página {page + 1} de {totalPages}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" type="button" disabled={page <= 0} onClick={() => mudarPagina(page - 1)}>
            Anterior
          </button>

          <button
            className="btn-secondary"
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => mudarPagina(page + 1)}
          >
            Próxima
          </button>
        </div>
      </div>

      {modalPedido && (
        <PedidoModal
          pedido={modalPedido.pedido}
          onClose={() => setModalPedido(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2, rgba(255,255,255,.04))',
  color: 'var(--text)',
}

const thStyle = {
  textAlign: 'left',
  padding: '11px 10px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  fontWeight: 700,
}

const tdStyle = {
  padding: '10px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}
