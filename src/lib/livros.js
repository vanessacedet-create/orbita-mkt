import { supabase } from './client'

export async function getLivros({ page = 0, pageSize = 50, search = '' } = {}) {
  let query = supabase.from('livros').select('*', { count: 'exact' }).order('titulo')

  if (search && search.trim()) {
    const s = search.trim()
    query = query.or(`titulo.ilike.%${s}%,autor.ilike.%${s}%,isbn.ilike.%${s}%,sku.ilike.%${s}%`)
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

export async function getEditoras() {
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
  return [...new Set(todas)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// ── ENVIOS (Cortesias) ─────────────────────────────────────
export async function getEnvios() {
  const { data: envios, error } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  if (!envios || envios.length === 0) return []

  const envioIds = envios.map(e => e.id)
  const { data: todosLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, envio_id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .in('envio_id', envioIds)
    .limit(5000)
  if (livrosError) throw livrosError

  const livrosPorEnvio = {}
  for (const el of (todosLivros || [])) {
    if (!livrosPorEnvio[el.envio_id]) livrosPorEnvio[el.envio_id] = []
    livrosPorEnvio[el.envio_id].push(el)
  }

  return envios.map(e => ({ ...e, envio_livros: livrosPorEnvio[e.id] || [] }))
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
  const rows = livros.map(l => ({
    titulo:          l.titulo,
    autor:           l.autor || null,
    editora:         l.editora || null,
    isbn:            l.isbn ? String(l.isbn).replace(/\.0$/, '').trim() : null,
    sku:             l.sku  ? String(l.sku).replace(/\.0$/, '').trim()  : null,
    data_lancamento: l.data_lancamento || null,
  }))

  const results = { atualizados: 0, criados: 0, erros: [] }

  for (const row of rows) {
    try {
      const isbnStr = row.isbn ? String(row.isbn).replace(/\.0$/, '').trim() : null
      const skuStr  = row.sku  ? String(row.sku).replace(/\.0$/, '').trim()  : null
      row.isbn = isbnStr
      row.sku  = skuStr

      let existing = null
      if (isbnStr) {
        const { data } = await supabase.from('livros').select('id').eq('isbn', isbnStr).maybeSingle()
        existing = data
      }
      if (!existing && skuStr) {
        const { data } = await supabase.from('livros').select('id').eq('sku', skuStr).maybeSingle()
        existing = data
      }
      if (!existing && row.titulo && row.data_lancamento) {
        const { data } = await supabase.from('livros').select('id')
          .ilike('titulo', row.titulo.trim())
          .eq('data_lancamento', row.data_lancamento)
          .maybeSingle()
        existing = data
      }
      if (!existing && row.titulo) {
        const { data } = await supabase.from('livros').select('id')
          .ilike('titulo', row.titulo.trim())
          .maybeSingle()
        existing = data
      }
      if (existing) {
        const { error: updErr } = await supabase.from('livros').update(row).eq('id', existing.id)
        if (updErr) throw updErr
        results.atualizados++
      } else {
        const { error: insErr } = await supabase.from('livros').insert([row])
        if (insErr) throw insErr
        results.criados++
      }
    } catch(e) {
      results.erros.push(`${row.titulo || 'desconhecido'}: ${e?.message || e}`)
    }
  }
  return results
}
