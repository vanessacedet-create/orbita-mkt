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
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── USUÁRIOS (admin) ───────────────────────────────────────
export async function getUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

export async function updateUsuario(id, updates) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createUsuarioAdmin({ email, password, nome, perfil }) {
  // Cria o auth user via signUp
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome, perfil } }
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
export async function getLivros() {
  const { data, error } = await supabase.from('livros').select('*').order('titulo')
  if (error) throw error
  return data
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

// ── ENVIOS ─────────────────────────────────────────────────
export async function getEnvios() {
  const { data, error } = await supabase
    .from('envios')
    .select(`*, parceiros(id,nome,canal), livros(id,titulo,autor)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function createEnvio(e) {
  const { data, error } = await supabase.from('envios').insert([e]).select(`*, parceiros(nome), livros(titulo)`).single()
  if (error) throw error
  return data
}
export async function updateEnvio(id, updates) {
  const { data, error } = await supabase.from('envios').update(updates).eq('id', id).select(`*, parceiros(nome), livros(titulo)`).single()
  if (error) throw error
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
