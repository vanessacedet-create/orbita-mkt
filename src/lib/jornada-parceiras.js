import { supabase } from './client'

// ── MEMBROS (equipe + jornada padrão) ─────────────────────
export async function getMembros() {
  const { data, error } = await supabase
    .from('jornada_parceiras_membros')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getMembroPorEmail(email) {
  if (!email) return null
  const { data, error } = await supabase
    .from('jornada_parceiras_membros')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function criarMembro(membro) {
  const { data, error } = await supabase
    .from('jornada_parceiras_membros')
    .insert([membro])
    .select().single()
  if (error) throw error
  return data
}

export async function atualizarMembro(id, updates) {
  const { data, error } = await supabase
    .from('jornada_parceiras_membros')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarMembro(id) {
  const { error } = await supabase.from('jornada_parceiras_membros').delete().eq('id', id)
  if (error) throw error
}

// ── FERIADOS ───────────────────────────────────────────────
export async function getFeriados() {
  const { data, error } = await supabase
    .from('jornada_parceiras_feriados')
    .select('*')
    .order('data', { ascending: true })
  if (error) throw error
  return data || []
}

// ── DIAS INATIVOS (declarados pela empresa) ───────────────
export async function getDiasInativos() {
  const { data, error } = await supabase
    .from('jornada_parceiras_dias_inativos')
    .select('*')
    .order('data', { ascending: true })
  if (error) throw error
  return data || []
}

export async function criarDiaInativo({ data: dataDia, membro_id = null, motivo = null }) {
  const { data, error } = await supabase
    .from('jornada_parceiras_dias_inativos')
    .insert([{ data: dataDia, membro_id, motivo }])
    .select().single()
  if (error) throw error
  return data
}

export async function deletarDiaInativo(id) {
  const { error } = await supabase.from('jornada_parceiras_dias_inativos').delete().eq('id', id)
  if (error) throw error
}

// ── REGISTROS DIÁRIOS ──────────────────────────────────────
export async function getRegistros(membroId, dataInicio, dataFim) {
  const { data, error } = await supabase
    .from('jornada_parceiras_registros')
    .select('*')
    .eq('membro_id', membroId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertRegistro(membroId, data, campos) {
  const payload = { membro_id: membroId, data, ...campos, updated_at: new Date().toISOString() }
  const { data: result, error } = await supabase
    .from('jornada_parceiras_registros')
    .upsert(payload, { onConflict: 'membro_id,data' })
    .select().single()
  if (error) throw error
  return result
}
