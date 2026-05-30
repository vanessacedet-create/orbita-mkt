import { supabase } from './client'

// ══════════════════════════════════════════════════════════════
// HASH — SHA-256 do e-mail (feito no front, nunca envia e-mail puro)
// ══════════════════════════════════════════════════════════════
export async function hashEmail(email) {
  const normalized = (email || '').trim().toLowerCase()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ══════════════════════════════════════════════════════════════
// PEDIDOS
// ══════════════════════════════════════════════════════════════
export async function importarPedidos(pedidos, loteId, nomeArquivo, loja) {
  // Inserir pedidos em lotes de 500
  const BATCH = 500
  let inseridos = 0
  for (let i = 0; i < pedidos.length; i += BATCH) {
    const batch = pedidos.slice(i, i + BATCH)
    const { error } = await supabase
      .from('cac_ltv_pedidos')
      .upsert(batch, { onConflict: 'numero_pedido', ignoreDuplicates: true })
    if (error) throw error
    inseridos += batch.length
  }

  // Calcular leitores novos neste lote
  const hashesDoLote = [...new Set(pedidos.map(p => p.hash_email))]
  const { data: pedidosExistentes } = await supabase
    .from('cac_ltv_pedidos')
    .select('hash_email, data_pedido')
    .in('hash_email', hashesDoLote)
    .order('data_pedido', { ascending: true })

  // Um leitor é novo se sua primeira compra veio neste lote
  const primeiraCompra = {}
  for (const p of (pedidosExistentes || [])) {
    if (!primeiraCompra[p.hash_email]) primeiraCompra[p.hash_email] = p.data_pedido
  }
  const loteDataSet = new Set(pedidos.map(p => p.hash_email))
  let totalNovos = 0
  for (const h of hashesDoLote) {
    const primeira = primeiraCompra[h]
    const pedidoDoLote = pedidos.find(p => p.hash_email === h)
    if (pedidoDoLote && primeira === pedidoDoLote.data_pedido) totalNovos++
  }

  // Registrar a importação
  const { error: errLog } = await supabase
    .from('cac_ltv_importacoes')
    .insert([{
      id: loteId,
      nome_arquivo: nomeArquivo,
      loja: loja || null,
      total_pedidos: pedidos.length,
      total_novos: totalNovos,
    }])
  if (errLog) throw errLog

  return { inseridos: pedidos.length, totalNovos }
}

export async function listarPedidos(filtros = {}) {
  let q = supabase
    .from('cac_ltv_pedidos')
    .select('*')
    .order('data_pedido', { ascending: false })

  if (filtros.loja) q = q.eq('loja', filtros.loja)
  if (filtros.dataInicio) q = q.gte('data_pedido', filtros.dataInicio)
  if (filtros.dataFim) q = q.lte('data_pedido', filtros.dataFim)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function listarTodosPedidos() {
  const { data, error } = await supabase
    .from('cac_ltv_pedidos')
    .select('*')
    .order('data_pedido', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getNumeroPedidosExistentes(numeros) {
  if (!numeros.length) return new Set()
  const BATCH = 500
  const existentes = new Set()
  for (let i = 0; i < numeros.length; i += BATCH) {
    const batch = numeros.slice(i, i + BATCH)
    const { data } = await supabase
      .from('cac_ltv_pedidos')
      .select('numero_pedido')
      .in('numero_pedido', batch)
    if (data) data.forEach(d => existentes.add(d.numero_pedido))
  }
  return existentes
}

export async function excluirLoteImportacao(loteId) {
  const { error: e1 } = await supabase
    .from('cac_ltv_pedidos')
    .delete()
    .eq('lote_importacao', loteId)
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('cac_ltv_importacoes')
    .delete()
    .eq('id', loteId)
  if (e2) throw e2
}

export async function listarImportacoes() {
  const { data, error } = await supabase
    .from('cac_ltv_importacoes')
    .select('*')
    .order('importado_em', { ascending: false })
  if (error) throw error
  return data || []
}

// ══════════════════════════════════════════════════════════════
// GASTOS
// ══════════════════════════════════════════════════════════════
export async function listarGastos(filtros = {}) {
  let q = supabase
    .from('cac_ltv_gastos')
    .select('*')
    .order('mes_referencia', { ascending: false })

  if (filtros.loja) q = q.eq('loja', filtros.loja)
  if (filtros.dataInicio) q = q.gte('mes_referencia', filtros.dataInicio)
  if (filtros.dataFim) q = q.lte('mes_referencia', filtros.dataFim)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function inserirGasto(gasto) {
  const { data, error } = await supabase
    .from('cac_ltv_gastos')
    .insert([gasto])
    .select().single()
  if (error) throw error
  return data
}

export async function editarGasto(id, updates) {
  const { data, error } = await supabase
    .from('cac_ltv_gastos')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function excluirGasto(id) {
  const { error } = await supabase
    .from('cac_ltv_gastos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ══════════════════════════════════════════════════════════════
// LOJAS — extrai as lojas únicas dos pedidos importados
// ══════════════════════════════════════════════════════════════
export async function listarLojas() {
  const { data, error } = await supabase
    .from('cac_ltv_pedidos')
    .select('loja')
  if (error) throw error
  const unique = [...new Set((data || []).map(d => d.loja).filter(Boolean))]
  return unique.sort()
}

// ══════════════════════════════════════════════════════════════
// CÁLCULOS (front-end)
// ══════════════════════════════════════════════════════════════

/**
 * Situações que contam como "entregue"
 */
const SITUACAO_ENTREGUE_PADRAO = ['entregue']

function situacaoConclui(situacao, filtrosSituacao = SITUACAO_ENTREGUE_PADRAO) {
  if (!situacao) return false
  const lower = situacao.toLowerCase()
  return filtrosSituacao.some(f => lower.includes(f))
}

/**
 * Identifica leitores novos: primeira compra de cada hash_email por loja
 * Retorna Map<hash_email, { loja, dataPrimeira, pedidos[] }>
 */
export function identificarLeitores(todosPedidos, filtrosSituacao = SITUACAO_ENTREGUE_PADRAO) {
  // Agrupa por loja + hash_email, encontra a primeira compra entregue
  const mapa = {} // key: `${loja}::${hash_email}`

  // Ordenar por data para facilitar
  const ordenados = [...todosPedidos].sort((a, b) =>
    new Date(a.data_pedido) - new Date(b.data_pedido)
  )

  for (const p of ordenados) {
    const key = `${p.loja}::${p.hash_email}`
    if (!mapa[key]) {
      mapa[key] = {
        loja: p.loja,
        hash_email: p.hash_email,
        dataPrimeira: null,
        pedidos: [],
      }
    }
    mapa[key].pedidos.push(p)

    // Marca data da primeira compra entregue
    if (!mapa[key].dataPrimeira && situacaoConclui(p.situacao, filtrosSituacao)) {
      mapa[key].dataPrimeira = p.data_pedido
    }
  }

  return mapa
}

/**
 * Leitores novos no período (primeira compra entregue caiu no período)
 */
export function leitoresNovosPeriodo(leitoresMap, loja, dataInicio, dataFim) {
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)

  return Object.values(leitoresMap).filter(l => {
    if (loja && l.loja !== loja) return false
    if (!l.dataPrimeira) return false
    const d = new Date(l.dataPrimeira)
    return d >= inicio && d <= fim
  })
}

/**
 * CAC blended = gastos no período / leitores novos no período
 */
export function calcularCACBlended(gastos, leitoresNovos) {
  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0)
  if (leitoresNovos.length === 0) return { cac: null, totalGastos, totalLeitores: 0 }
  return {
    cac: totalGastos / leitoresNovos.length,
    totalGastos,
    totalLeitores: leitoresNovos.length,
  }
}

/**
 * LTV médio por loja = média da receita acumulada por leitor nos 12 meses após 1ª compra
 */
export function calcularLTV(leitoresNovos, todosPedidos, hoje = new Date()) {
  if (leitoresNovos.length === 0) return { ltv: null, imaturos: 0, total: 0, pctMaturos: 0 }

  const JANELA_MS = 365 * 24 * 60 * 60 * 1000 // 12 meses
  let somaLTV = 0
  let imaturos = 0

  for (const leitor of leitoresNovos) {
    const dataPrimeira = new Date(leitor.dataPrimeira)
    const fimJanela = new Date(dataPrimeira.getTime() + JANELA_MS)
    const maturo = hoje >= fimJanela

    if (!maturo) imaturos++

    // Soma receita de todos os pedidos deste leitor nesta loja nos 12 meses
    const receita = leitor.pedidos
      .filter(p => {
        const dp = new Date(p.data_pedido)
        return dp >= dataPrimeira && dp <= fimJanela
      })
      .reduce((s, p) => s + Number(p.valor), 0)

    somaLTV += receita
  }

  const total = leitoresNovos.length
  const pctMaturos = total > 0 ? Math.round(((total - imaturos) / total) * 100) : 0

  return {
    ltv: somaLTV / total,
    imaturos,
    total,
    pctMaturos,
  }
}

/**
 * CAC por campanha/cupom
 */
export function calcularCACPorCupom(leitoresNovos, gastos) {
  // Agrupa leitores novos por cupom
  const porCupom = {}
  for (const leitor of leitoresNovos) {
    const pedidosComCupom = leitor.pedidos.filter(p =>
      p.cupom && p.data_pedido === leitor.dataPrimeira
    )
    for (const p of pedidosComCupom) {
      const c = p.cupom.trim().toUpperCase()
      if (!c) continue
      if (!porCupom[c]) porCupom[c] = { cupom: c, leitores: 0 }
      porCupom[c].leitores++
    }
  }

  // Para cada cupom, ver se existe gasto associado (busca no campo descricao)
  return Object.values(porCupom).map(item => {
    // Tenta encontrar gasto relacionado
    const gastoRelacionado = gastos.filter(g =>
      g.descricao && g.descricao.toUpperCase().includes(item.cupom)
    )
    const totalGasto = gastoRelacionado.reduce((s, g) => s + Number(g.valor), 0)
    return {
      ...item,
      gasto: totalGasto,
      cac: item.leitores > 0 && totalGasto > 0 ? totalGasto / item.leitores : null,
    }
  }).filter(x => x.leitores > 0)
}

/**
 * Evolução mensal — retorna array de { mes, cac, ltv, leitoresNovos, gastoTotal }
 */
export function calcularEvolucaoMensal(todosPedidos, gastos, loja, filtrosSituacao = SITUACAO_ENTREGUE_PADRAO) {
  const leitoresMap = identificarLeitores(todosPedidos, filtrosSituacao)

  // Descobrir meses com dados
  const meses = new Set()
  for (const p of todosPedidos) {
    if (loja && p.loja !== loja) continue
    const d = new Date(p.data_pedido)
    meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  for (const g of gastos) {
    if (loja && g.loja !== loja) continue
    const d = new Date(g.mes_referencia + 'T12:00:00')
    meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const sorted = [...meses].sort()
  const hoje = new Date()

  return sorted.map(mes => {
    const [ano, m] = mes.split('-').map(Number)
    const inicio = `${ano}-${String(m).padStart(2, '0')}-01`
    const ultimoDia = new Date(ano, m, 0).getDate()
    const fim = `${ano}-${String(m).padStart(2, '0')}-${ultimoDia}`

    const leitNovos = leitoresNovosPeriodo(leitoresMap, loja, inicio, fim)
    const gastosMes = gastos.filter(g => {
      if (loja && g.loja !== loja) return false
      const gd = new Date(g.mes_referencia + 'T12:00:00')
      return gd.getFullYear() === ano && gd.getMonth() + 1 === m
    })

    const { cac, totalGastos } = calcularCACBlended(gastosMes, leitNovos)
    const { ltv } = calcularLTV(leitNovos, todosPedidos, hoje)

    return {
      mes,
      mesLabel: `${String(m).padStart(2, '0')}/${ano}`,
      cac,
      ltv,
      leitoresNovos: leitNovos.length,
      gastoTotal: totalGastos,
    }
  })
}

// ══════════════════════════════════════════════════════════════
// IMPORTAÇÃO — Parsing da planilha
// ══════════════════════════════════════════════════════════════

/**
 * Normaliza string para comparação de colunas
 */
function norm(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

const COLUMN_MAP = {
  numero_pedido: ['npedido', 'numeropedido', 'pedido', 'numpedido', 'numerodopedido', 'nropedido'],
  email: ['email', 'emailcliente', 'emaildocliente'],
  data_pedido: ['datacriacao', 'datapedido', 'datadopedido'],
  valor: ['valor', 'total', 'valortotal', 'valorpedido'],
  loja: ['livraria', 'loja', 'nomeloja', 'nomelihvraria'],
  situacao: ['situacao', 'status', 'statusdopedido', 'situacaopedido'],
  cupom: ['cupom', 'codigocupom', 'voucher', 'codigodesconto'],
  cidade_estado: ['cidadeestado', 'cidadeuf'],
  metodo_pagamento: ['metodopag', 'metodopagamento', 'formapagamento'],
}

export function mapearColunas(headers) {
  const map = {}
  const usados = new Set() // evita mapear a mesma coluna para dois campos

  for (const [campo, aliases] of Object.entries(COLUMN_MAP)) {
    // Primeiro tenta match exato (normalizado)
    let idx = headers.findIndex((h, i) => {
      if (usados.has(i)) return false
      const n = norm(h)
      return aliases.some(a => n === a)
    })

    // Depois tenta: o header contém o alias (ex: "codigocupom" contém "cupom")
    if (idx === -1) {
      idx = headers.findIndex((h, i) => {
        if (usados.has(i)) return false
        const n = norm(h)
        return aliases.some(a => n.includes(a))
      })
    }

    if (idx !== -1) {
      map[campo] = idx
      usados.add(idx)
    }
  }
  return map
}

/**
 * Converte valor brasileiro para número
 */
export function parseValorBR(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  const str = String(val).replace(/[R$\s]/g, '').trim()
  // Formato brasileiro: 1.234,56 → 1234.56
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(str)
}

/**
 * Converte data brasileira para ISO
 */
export function parseDataBR(val) {
  if (!val) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    return val.toISOString().split('T')[0]
  }
  const str = String(val).trim()
  // dd/mm/yyyy
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    const [, d, m, y] = brMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // yyyy-mm-dd
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]
  // Tenta parse genérico
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

/**
 * Processa as linhas da planilha e retorna { pedidos, erros, duplicados }
 */
export async function processarLinhas(rows, colMap, existentes, lojaOverride = '') {
  const pedidos = []
  const erros = []
  const duplicados = []
  const loteId = crypto.randomUUID()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const numeroPedido = String(row[colMap.numero_pedido] || '').trim()
      if (!numeroPedido) { erros.push({ linha: i + 2, motivo: 'Sem número de pedido' }); continue }

      if (existentes.has(numeroPedido)) { duplicados.push(numeroPedido); continue }

      const emailRaw = row[colMap.email]
      if (!emailRaw || !String(emailRaw).trim()) { erros.push({ linha: i + 2, motivo: 'Sem e-mail' }); continue }

      const valor = parseValorBR(row[colMap.valor])
      if (valor == null || isNaN(valor)) { erros.push({ linha: i + 2, motivo: 'Valor inválido' }); continue }

      const dataPedido = parseDataBR(row[colMap.data_pedido])
      if (!dataPedido) { erros.push({ linha: i + 2, motivo: 'Data inválida' }); continue }

      const loja = lojaOverride || (colMap.loja != null ? String(row[colMap.loja] || '').trim() : '')
      if (!loja) { erros.push({ linha: i + 2, motivo: 'Sem loja' }); continue }

      const hash = await hashEmail(String(emailRaw))

      const pedido = {
        numero_pedido: numeroPedido,
        hash_email: hash,
        data_pedido: dataPedido,
        valor,
        loja,
        situacao: colMap.situacao != null ? String(row[colMap.situacao] || '').trim() : null,
        cupom: colMap.cupom != null ? (String(row[colMap.cupom] || '').trim() || null) : null,
        cidade_estado: colMap.cidade_estado != null ? (String(row[colMap.cidade_estado] || '').trim() || null) : null,
        metodo_pagamento: colMap.metodo_pagamento != null ? (String(row[colMap.metodo_pagamento] || '').trim() || null) : null,
        lote_importacao: loteId,
      }

      pedidos.push(pedido)
    } catch (err) {
      erros.push({ linha: i + 2, motivo: err.message })
    }
  }

  // Identificar leitores novos no lote
  const hashesNovos = new Set()
  const hashesExistentes = new Set()

  // Buscar hashes que já existem na base
  const allHashes = [...new Set(pedidos.map(p => p.hash_email))]
  if (allHashes.length > 0) {
    const BATCH = 500
    for (let i = 0; i < allHashes.length; i += BATCH) {
      const batch = allHashes.slice(i, i + BATCH)
      const { data } = await supabase
        .from('cac_ltv_pedidos')
        .select('hash_email')
        .in('hash_email', batch)
      if (data) data.forEach(d => hashesExistentes.add(d.hash_email))
    }
  }

  for (const h of allHashes) {
    if (!hashesExistentes.has(h)) hashesNovos.add(h)
  }

  return { pedidos, erros, duplicados, loteId, leitoresNovos: hashesNovos.size }
}
