import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── AUTH ───────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── PERFIL DO USUÁRIO ──────────────────────────────────────
export async function getUsuarioPerfil(userId) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

// ── USUÁRIOS (admin) ───────────────────────────────────────
export async function getUsuarios() {
  const { data, error } = await supabase.from('usuarios').select('*').order('nome')
  if (error) throw error
  return data
}
export async function updateUsuario(id, updates) {
  const { data, error } = await supabase.from('usuarios').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function createUsuarioAdmin({ email, password, nome, perfil }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password, options: { data: { nome, perfil } }
  })
  if (authError) throw authError
  return authData
}

// ── PARCEIROS ──────────────────────────────────────────────
export async function getParceiros() {
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  return data
}
export async function createParceiro(p) {
  const { data, error } = await supabase.from('parceiros').insert([p]).select().single()
  if (error) throw error
  return data
}
export async function updateParceiro(id, updates) {
  const { data, error } = await supabase.from('parceiros').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteParceiro(id) {
  const { error } = await supabase.from('parceiros').delete().eq('id', id)
  if (error) throw error
}

// ── LIVROS ─────────────────────────────────────────────────
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

// ── ENVIOS (com múltiplos livros via envio_livros) ─────────
export async function getEnvios() {
  const { data, error } = await supabase
    .from('envios')
    .select(`
      *,
      parceiros(id, nome, tipo_parceria),
      envio_livros(
        id,
        divulgado,
        data_divulgacao,
        livros(id, titulo, autor, isbn, sku)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  // For each envio, fetch ALL envio_livros separately if truncated
  return data
}

export async function getEnvioCompleto(id) {
  // Busca envio principal + parceiro
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .eq('id', id)
    .single()
  if (envioError) throw envioError

  // Busca envio_livros separadamente para contornar o limite de 5 do Supabase
  const { data: envioLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .eq('envio_id', id)
    .limit(200)
  if (livrosError) throw livrosError

  return { ...envio, envio_livros: envioLivros || [] }
}

export async function createEnvio({ parceiro_id, status, data_envio, observacoes, livro_ids }) {
  // 1. Cria o envio principal
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .insert([{ parceiro_id, status, data_envio, observacoes }])
    .select(`*, parceiros(id, nome, tipo_parceria)`)
    .single()
  if (envioError) throw envioError

  // 2. Vincula os livros
  if (livro_ids && livro_ids.length > 0) {
    const linhas = livro_ids.map(livro_id => ({ envio_id: envio.id, livro_id }))
    const { error: livrosError } = await supabase.from('envio_livros').insert(linhas)
    if (livrosError) throw livrosError
  }

  // 3. Retorna o envio com livros
  const { data: completo, error: fetchError } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', envio.id)
    .single()
  if (fetchError) throw fetchError
  return completo
}

export async function updateEnvio(id, { parceiro_id, status, data_envio, observacoes, livro_ids }) {
  // 1. Atualiza dados do envio
  const { error: envioError } = await supabase
    .from('envios')
    .update({ parceiro_id, status, data_envio, observacoes })
    .eq('id', id)
  if (envioError) throw envioError

  // 2. Substitui os livros se foram passados
  if (livro_ids) {
    await supabase.from('envio_livros').delete().eq('envio_id', id)
    if (livro_ids.length > 0) {
      const linhas = livro_ids.map(livro_id => ({ envio_id: id, livro_id }))
      const { error } = await supabase.from('envio_livros').insert(linhas)
      if (error) throw error
    }
  }

  // 3. Retorna o envio atualizado
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

// ── STATS ──────────────────────────────────────────────────
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

// ── DIVULGAÇÃO POR LIVRO ───────────────────────────────────
export async function updateEnvioLivroDivulgacao(envioLivroId, { divulgado, data_divulgacao }) {
  const { error } = await supabase
    .from('envio_livros')
    .update({ divulgado, data_divulgacao: data_divulgacao || null })
    .eq('id', envioLivroId)
  if (error) throw error
}

// ── CAMPANHAS ──────────────────────────────────────────────
export async function getCampanhas() {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      *,
      campanha_livros(id, livros(id, titulo, autor, editora)),
      campanha_parceiros(id, status, parceiros(id, nome, tipo_parceria))
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getCampanha(id) {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      *,
      campanha_livros(id, livros(id, titulo, autor, isbn, sku, editora)),
      campanha_parceiros(id, status, data_publicacao_combinada, link_publicacao, curtidas, visualizacoes, livros_vendidos, observacoes, parceiros(id, nome, tipo_parceria))
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCampanha({ nome, tipo, status, data_inicio, data_fim, descricao, livro_ids = [] }) {
  const { data: campanha, error } = await supabase
    .from('campanhas')
    .insert([{ nome, tipo, status, data_inicio, data_fim, descricao }])
    .select().single()
  if (error) throw error
  if (livro_ids.length > 0) {
    const { error: le } = await supabase.from('campanha_livros').insert(livro_ids.map(livro_id => ({ campanha_id: campanha.id, livro_id })))
    if (le) throw le
  }
  return getCampanha(campanha.id)
}

export async function updateCampanha(id, { nome, tipo, status, data_inicio, data_fim, descricao, livro_ids }) {
  const { error } = await supabase.from('campanhas').update({ nome, tipo, status, data_inicio, data_fim, descricao }).eq('id', id)
  if (error) throw error
  if (livro_ids !== undefined) {
    await supabase.from('campanha_livros').delete().eq('campanha_id', id)
    if (livro_ids.length > 0) {
      const { error: le } = await supabase.from('campanha_livros').insert(livro_ids.map(livro_id => ({ campanha_id: id, livro_id })))
      if (le) throw le
    }
  }
  return getCampanha(id)
}

export async function deleteCampanha(id) {
  const { error } = await supabase.from('campanhas').delete().eq('id', id)
  if (error) throw error
}

export async function addParceiroCampanha(campanha_id, parceiro_id) {
  const { data, error } = await supabase.from('campanha_parceiros')
    .insert([{ campanha_id, parceiro_id, status: 'convidado' }])
    .select(`*, parceiros(id, nome, tipo_parceria)`).single()
  if (error) throw error
  return data
}

export async function updateParceiroCampanha(id, updates) {
  const { data, error } = await supabase.from('campanha_parceiros')
    .update(updates).eq('id', id)
    .select(`*, parceiros(id, nome, tipo_parceria)`).single()
  if (error) throw error
  return data
}

export async function removeParceiroCampanha(id) {
  const { error } = await supabase.from('campanha_parceiros').delete().eq('id', id)
  if (error) throw error
}

// ── FOLLOW-UP / CONTATO ────────────────────────────────────
export async function getFollowUps() {
  // Busca campanhas em planejamento ou em_andamento com data_inicio definida
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      id, nome, tipo, status, data_inicio,
      campanha_parceiros(id, status, contato_realizado, data_contato, nota_contato, parceiros(id, nome, tipo_parceria))
    `)
    .in('status', ['planejamento', 'em_andamento'])
    .not('data_inicio', 'is', null)
    .order('data_inicio', { ascending: true })
  if (error) throw error
  return data
}

export async function registrarContato(campanhaParceirolId, { data_contato, nota_contato }) {
  const { data, error } = await supabase
    .from('campanha_parceiros')
    .update({ contato_realizado: true, data_contato, nota_contato })
    .eq('id', campanhaParceirolId)
    .select(`*, parceiros(id, nome, tipo_parceria)`)
    .single()
  if (error) throw error
  return data
}
