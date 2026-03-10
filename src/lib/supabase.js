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

  if (search) {
    query = query.or(`titulo.ilike.%${search}%,autor.ilike.%${search}%,isbn.ilike.%${search}%,sku.ilike.%${search}%`)
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
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
        livros(id, titulo, autor, isbn, sku)
      )
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
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
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, livros(id, titulo, autor, isbn, sku))`)
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
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, livros(id, titulo, autor, isbn, sku))`)
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
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, livros(id, titulo, autor, isbn, sku))`)
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
