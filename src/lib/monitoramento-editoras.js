import { supabase } from './client'

// ── EDITORAS ───────────────────────────────────────────────

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
  // editoras: [{ nome, instagram }]
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .insert(editoras.map(e => ({ nome: e.nome, contato: e.contato || null, instagram: e.instagram || null })))
    .select('*')
  if (error) throw error
  return data || []
}

// ── CHECAGEM DE POSTAGENS ──────────────────────────────────

export async function getCheckagemMes({ ano, mes }) {
  const ini = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .select('*, editoras_parceiras(id, nome, instagram)')
    .gte('data_esperada', ini)
    .lte('data_esperada', fim)
    .order('data_esperada', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertCheckagemDia({ editora_id, formato, data_esperada, status, observacao }) {
  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .upsert(
      { editora_id, formato, data_esperada, status, observacao },
      { onConflict: 'editora_id,formato,data_esperada' }
    )
    .select('*, editoras_parceiras(id, nome, instagram)')
    .single()
  if (error) throw error
  return data
}

export async function gerarChecklistDia({ editoras, formato, data_esperada }) {
  // Cria registros 'pendente' para todas as editoras em um dia/formato
  // se ainda não existirem (upsert não sobrescreve os que já têm status)
  const rows = editoras.map(e => ({
    editora_id: e.id,
    formato,
    data_esperada,
    status: 'pendente',
  }))
  const { data, error } = await supabase
    .from('monitoramento_parceiras')
    .upsert(rows, { onConflict: 'editora_id,formato,data_esperada', ignoreDuplicates: true })
    .select('*, editoras_parceiras(id, nome, instagram)')
  if (error) throw error
  return data || []
}

// ── OBSERVAÇÕES ────────────────────────────────────────────

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
