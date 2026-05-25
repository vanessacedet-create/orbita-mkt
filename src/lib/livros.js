import { supabase } from './client'

export async function getLivros({ page = 0, pageSize = 50, search = '', grupos = null } = {}) {
  let query = supabase.from('livros').select('*', { count: 'exact' }).order('titulo')

  if (search && search.trim()) {
    const s = search.trim()
    query = query.or(`titulo.ilike.%${s}%,autor.ilike.%${s}%,isbn.ilike.%${s}%,sku.ilike.%${s}%`)
  }

  // Filtro por grupo (usado em Cortesias para separar acesso por perfil)
  if (grupos && grupos.length > 0) {
    query = query.in('grupo', grupos)
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await query
  if (error) { console.error('getLivros error:', error); throw error }
  return { data: data || [], count: count || 0 }
}

export async function createLivro(l) {
  const { data, error } = await supabase.from('livros').insert([l]).select().single()
  if (error) throw error
  return data
}

export async function updateLivro(id, updates) {
  const { data, error } = await supabase.from('livros').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLivro(id) {
  const { error } = await supabase.from('livros').delete().eq('id', id)
  if (error) throw error
}

export async function buscarLivroPorISBN(isbn) {
  const isbnLimpo = String(isbn || '').replace(/[^0-9]/g, '').trim()
  if (!isbnLimpo) return null
  const { data } = await supabase
    .from('livros')
    .select('id, titulo, autor, isbn')
    .eq('isbn', isbnLimpo)
    .maybeSingle()
  return data
}

// Cache em memória para editoras — dado estático que não muda durante a sessão.
// Evita múltiplas queries paginadas toda vez que a página de livros abre.
let _editorasCache = null
let _editorasCacheAt = 0
const EDITORAS_TTL = 5 * 60 * 1000 // 5 minutos

export async function getEditoras({ forceRefresh = false } = {}) {
  const agora = Date.now()
  if (!forceRefresh && _editorasCache && (agora - _editorasCacheAt) < EDITORAS_TTL) {
    return _editorasCache
  }
  let todas = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('livros')
      .select('editora')
      .not('editora', 'is', null)
      .neq('editora', '')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    todas = todas.concat(data.map(l => l.editora).filter(Boolean))
    if (data.length < pageSize) break
    page++
  }
  _editorasCache = [...new Set(todas)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  _editorasCacheAt = agora
  return _editorasCache
}

// ── ENVIOS (Cortesias) ─────────────────────────────────────
// Paginação real — sem limites arbitrários que silenciosamente cortam dados.
export async function getEnvios({ page = 0, pageSize = 50 } = {}) {
  const from = page * pageSize
  const to   = from + pageSize - 1

  const { data: envios, error, count } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  if (!envios || envios.length === 0) return { data: [], count: 0 }

  const envioIds = envios.map(e => e.id)
  const { data: todosLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, envio_id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .in('envio_id', envioIds)
  if (livrosError) throw livrosError

  const livrosPorEnvio = {}
  for (const el of (todosLivros || [])) {
    if (!livrosPorEnvio[el.envio_id]) livrosPorEnvio[el.envio_id] = []
    livrosPorEnvio[el.envio_id].push(el)
  }

  const data = envios.map(e => ({ ...e, envio_livros: livrosPorEnvio[e.id] || [] }))
  return { data, count: count || 0 }
}

export async function getEnvioCompleto(id) {
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .eq('id', id)
    .single()
  if (envioError) throw envioError

  const { data: envioLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .eq('envio_id', id)
    .limit(200)
  if (livrosError) throw livrosError

  return { ...envio, envio_livros: envioLivros || [] }
}

export async function createEnvio({ parceiro_id, status, data_envio, observacoes, livro_ids }) {
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .insert([{ parceiro_id, status, data_envio, observacoes }])
    .select(`*, parceiros(id, nome, tipo_parceria)`)
    .single()
  if (envioError) throw envioError

  if (livro_ids && livro_ids.length > 0) {
    const linhas = livro_ids.map(livro_id => ({ envio_id: envio.id, livro_id }))
    const { error: livrosError } = await supabase.from('envio_livros').insert(linhas)
    if (livrosError) throw livrosError
  }

  const { data: completo, error: fetchError } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', envio.id)
    .single()
  if (fetchError) throw fetchError
  return completo
}

export async function updateEnvio(id, { parceiro_id, status, data_envio, observacoes, livro_ids }) {
  const { error: envioError } = await supabase
    .from('envios')
    .update({ parceiro_id, status, data_envio, observacoes })
    .eq('id', id)
  if (envioError) throw envioError

  if (livro_ids) {
    await supabase.from('envio_livros').delete().eq('envio_id', id)
    if (livro_ids.length > 0) {
      const linhas = livro_ids.map(livro_id => ({ envio_id: id, livro_id }))
      const { error } = await supabase.from('envio_livros').insert(linhas)
      if (error) throw error
    }
  }

  const { data, error } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateEnvioStatus(id, status) {
  const { error } = await supabase.from('envios').update({ status }).eq('id', id)
  if (error) throw error
  const { data, error: fetchError } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  return data
}

export async function deleteEnvio(id) {
  const { error } = await supabase.from('envios').delete().eq('id', id)
  if (error) throw error
}

export async function updateEnvioLivroDivulgacao(envioLivroId, { divulgado, data_divulgacao }) {
  const { error } = await supabase
    .from('envio_livros')
    .update({ divulgado, data_divulgacao: data_divulgacao || null })
    .eq('id', envioLivroId)
  if (error) throw error
}

export async function getStats() {
  const [parceiros, livros, envios] = await Promise.all([
    supabase.from('parceiros').select('id', { count: 'exact', head: true }),
    supabase.from('livros').select('id', { count: 'exact', head: true }),
    supabase.from('envios').select('status'),
  ])
  const enviosData = envios.data || []
  return {
    totalParceiros: parceiros.count || 0,
    totalLivros: livros.count || 0,
    totalEnvios: enviosData.length,
    confirmados: enviosData.filter(e => e.status === 'divulgado').length,
    pendentes: enviosData.filter(e => e.status === 'enviado').length,
  }
}

// ── LANÇAMENTOS (calendário) ───────────────────────────────
export async function getLivrosLancamento({ ano, mes } = {}) {
  let q = supabase
    .from('livros')
    .select('id, titulo, autor, editora, isbn, sku, data_lancamento')
    .not('data_lancamento', 'is', null)
    .order('data_lancamento', { ascending: true })
  if (ano && mes) {
    const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    q = q.gte('data_lancamento', ini).lte('data_lancamento', fim)
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function importarLancamentos(livros) {
  // Normaliza todos os dados antes de qualquer query
  const rows = livros.map(l => ({
    titulo:          l.titulo,
    autor:           l.autor || null,
    editora:         l.editora || null,
    isbn:            l.isbn ? String(l.isbn).replace(/\.0$/, '').trim() : null,
    sku:             l.sku  ? String(l.sku).replace(/\.0$/, '').trim()  : null,
    data_lancamento: l.data_lancamento || null,
  }))

  const results = { atualizados: 0, criados: 0, erros: [] }

  // ── Busca em batch — 1 query por campo em vez de N queries por livro ──
  const isbns  = [...new Set(rows.map(r => r.isbn).filter(Boolean))]
  const skus   = [...new Set(rows.map(r => r.sku).filter(Boolean))]
  const titulos = [...new Set(rows.map(r => r.titulo).filter(Boolean))]

  const [byIsbn, bySku, byTitulo] = await Promise.all([
    isbns.length
      ? supabase.from('livros').select('id, isbn, sku, titulo, data_lancamento').in('isbn', isbns)
      : Promise.resolve({ data: [] }),
    skus.length
      ? supabase.from('livros').select('id, isbn, sku, titulo, data_lancamento').in('sku', skus)
      : Promise.resolve({ data: [] }),
    titulos.length
      ? supabase.from('livros').select('id, isbn, sku, titulo, data_lancamento').in('titulo', titulos)
      : Promise.resolve({ data: [] }),
  ])

  // Mapas para lookup O(1)
  const mapIsbn   = Object.fromEntries((byIsbn.data  || []).map(l => [l.isbn,   l]))
  const mapSku    = Object.fromEntries((bySku.data   || []).map(l => [l.sku,    l]))
  const mapTitulo = Object.fromEntries((byTitulo.data || []).map(l => [l.titulo, l]))

  // Separa os que vão ser atualizados dos que vão ser inseridos
  const paraAtualizar = [] // [{ id, row }]
  const paraInserir   = [] // [row]

  for (const row of rows) {
    try {
      const existing =
        (row.isbn && mapIsbn[row.isbn])   ||
        (row.sku  && mapSku[row.sku])     ||
        (row.titulo && mapTitulo[row.titulo])

      if (existing) paraAtualizar.push({ id: existing.id, row })
      else          paraInserir.push(row)
    } catch(e) {
      results.erros.push(`${row.titulo || 'desconhecido'}: ${e?.message || e}`)
    }
  }

  // Atualiza em paralelo (cada update é leve, sem risco de conflito)
  const updateResults = await Promise.allSettled(
    paraAtualizar.map(({ id, row }) =>
      supabase.from('livros').update(row).eq('id', id)
    )
  )
  for (const r of updateResults) {
    if (r.status === 'fulfilled') results.atualizados++
    else results.erros.push(r.reason?.message || 'Erro ao atualizar')
  }

  // Insere em batch — 1 query para todos os novos
  if (paraInserir.length > 0) {
    const { error: insErr } = await supabase.from('livros').insert(paraInserir)
    if (insErr) results.erros.push(`Erro ao inserir: ${insErr.message}`)
    else results.criados += paraInserir.length
  }

  return results
}
