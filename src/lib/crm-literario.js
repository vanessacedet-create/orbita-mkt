import { supabase } from './client'

export async function getLivrosCRM(mes, ano) {
  let q = supabase.from('livros_crm').select('*').eq('ativo', true).order('titulo')
  if (mes) q = q.eq('mes', mes)
  if (ano) q = q.eq('ano', ano)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createLivroCRM(payload) {
  const { data, error } = await supabase
    .from('livros_crm').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateLivroCRM(id, updates) {
  const { data, error } = await supabase
    .from('livros_crm').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function getContatosCRM({ search, nicho } = {}) {
  let q = supabase.from('contatos_crm').select('*').order('nome')
  if (nicho) q = q.eq('nicho', nicho)
  if (search) q = q.or(`nome.ilike.%${search}%,handle.ilike.%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createContatoCRM(payload) {
  const { data, error } = await supabase
    .from('contatos_crm').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateContatoCRM(id, updates) {
  const { data, error } = await supabase
    .from('contatos_crm').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function getCampanhaLiteraria(livro_id) {
  const { data, error } = await supabase
    .from('campanha_literaria')
    .select('*, contato:contatos_crm(*)')
    .eq('livro_id', livro_id)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function addContatosCampanha(livro_id, contato_ids) {
  const rows = contato_ids.map(contato_id => ({ livro_id, contato_id, status: 'encontrado' }))
  const { data, error } = await supabase
    .from('campanha_literaria').insert(rows).select('*, contato:contatos_crm(*)')
  if (error) throw error
  return data || []
}

export async function updateStatusCampanha(id, status, nota) {
  const updates = { status }
  if (nota !== undefined) updates.nota = nota
  const { data, error } = await supabase
    .from('campanha_literaria').update(updates).eq('id', id)
    .select('*, contato:contatos_crm(*)').single()
  if (error) throw error
  return data
}

export async function bulkUpdateStatusCampanha(ids, status) {
  const { data, error } = await supabase
    .from('campanha_literaria').update({ status }).in('id', ids).select('id, status')
  if (error) throw error
  return data || []
}

export async function removeContatoCampanha(id) {
  const { error } = await supabase.from('campanha_literaria').delete().eq('id', id)
  if (error) throw error
}

export async function getDivulgadores({ search, tipo } = {}) {
  let q = supabase.from('divulgadores').select('*').order('nome')
  if (tipo) q = q.eq('tipo_parceria', tipo)
  if (search) q = q.or(`nome.ilike.%${search}%,username.ilike.%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createDivulgador(payload) {
  const { data, error } = await supabase
    .from('divulgadores').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateDivulgador(id, updates) {
  const { data, error } = await supabase
    .from('divulgadores').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function getDivulgacaoLivro(livro_id) {
  const { data, error } = await supabase
    .from('divulgacao_livro')
    .select('*, divulgador:divulgadores(*)')
    .eq('livro_id', livro_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addDivulgadoresLivro(livro_id, divulgador_ids) {
  const rows = divulgador_ids.map(divulgador_id => ({
    livro_id, divulgador_id, status: 'encontrado'
  }))
  const { data, error } = await supabase
    .from('divulgacao_livro').insert(rows)
    .select('*, divulgador:divulgadores(*)')
  if (error) throw error
  return data || []
}

export async function updateDivulgacaoStatus(id, status, nota) {
  const updates = { status }
  if (nota !== undefined) updates.nota = nota
  const { data, error } = await supabase
    .from('divulgacao_livro').update(updates).eq('id', id)
    .select('*, divulgador:divulgadores(*)').single()
  if (error) throw error
  return data
}

export async function bulkUpdateDivulgacao(ids, status) {
  const { data, error } = await supabase
    .from('divulgacao_livro').update({ status }).in('id', ids).select('id, status')
  if (error) throw error
  return data || []
}

export async function removeDivulgacaoLivro(id) {
  const { error } = await supabase.from('divulgacao_livro').delete().eq('id', id)
  if (error) throw error
}
