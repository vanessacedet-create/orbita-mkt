import { supabase } from './client'

// Usuários desligados permanecem no banco para preservar tarefas,
// comentários e demais registros históricos, mas não aparecem em
// seletores de responsáveis nem nas listagens operacionais.
const EMAILS_INATIVOS = new Set([
  'anny.passos@cedet.com.br',
])

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  })
  if (error) throw error
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

  return (data || []).filter((usuario) => {
    const email = (usuario.email || '').trim().toLowerCase()
    return !EMAILS_INATIVOS.has(email)
  })
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
