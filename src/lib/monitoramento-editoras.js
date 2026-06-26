import { supabase } from './client'

export async function getEditorasParceiras() {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createEditoraParceira(payload) {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .insert([payload])
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateEditoraParceira(id, updates) {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function desativarEditoraParceira(id) {
  const { error } = await supabase
    .from('editoras_parceiras')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function importarEditorasPlanilha(editoras) {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .insert(editoras.map(e => ({ nome: e.nome, contato: e.contato || null, instagram: e.instagram || null })))
    .select('*')
  if (error) throw error
  return data || []
}

export async function getCheckagemMes({ ano, mes }) {
  const ini = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .select('*')
    .gte('data_esperada', ini)
    .lte('data_esperada', fim)
    .order('data_esperada', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertCheckagemDia({ editora_id, formato, data_esperada, status, observacao }) {
  const { data: existing } = await supabase
    .from('monitoramento_parceiras')
    .select('id')
    .eq('editora_id', editora_id)
    .eq('formato', formato)
    .eq('data_esperada', data_esperada)
    .maybeSingle()

  let id
  if (existing) {
    const { error } = await supabase
      .from('monitoramento_parceiras')
      .update({ status, observacao })
      .eq('id', existing.id)
    if (error) throw error
    id = existing.id
  } else {
    const { data: inserted, error } = await supabase
      .from('monitoramento_parceiras')
      .insert({ editora_id, formato, data_esperada, status, observacao })
      .select('id')
      .single()
    if (error) throw error
    id = inserted.id
  }

  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function deleteCheckagemDia({ editora_id, formato, data_esperada }) {
  const { error } = await supabase
    .from('monitoramento_parceiras')
    .delete()
    .eq('editora_id', editora_id)
    .eq('formato', formato)
    .eq('data_esperada', data_esperada)
  if (error) throw error
}

export async function gerarChecklistDia({ editoras, formato, data_esperada }) {
  const rows = editoras.map(e => ({ editora_id: e.id, formato, data_esperada, status: 'pendente' }))
  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .upsert(rows, { onConflict: 'editora_id,formato,data_esperada', ignoreDuplicates: true })
    .select('*')
  if (error) throw error
  return data || []
}

export async function getObservacoesEditora(editora_id) {
  const { data, error } = await supabase
    .from('monitoramento_parceiras_obs')
    .select('*')
    .eq('editora_id', editora_id)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createObservacao({ editora_id, categoria, texto, criado_por }) {
  const { data, error } = await supabase
    .from('monitoramento_parceiras_obs')
    .insert([{ editora_id, categoria, texto, criado_por }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteObservacao(id) {
  const { error } = await supabase
    .from('monitoramento_parceiras_obs')
    .delete()
    .eq('id', id)
  if (error) throw error
}
