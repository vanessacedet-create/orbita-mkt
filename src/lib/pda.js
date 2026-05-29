import { supabase } from './client'

// ── SEMESTRES ──────────────────────────────────────────────
export async function getSemestres() {
  const { data, error } = await supabase
    .from('pda_semestres')
    .select('*')
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data || []
}

export async function criarSemestre({ nome, data_inicio, data_fim }) {
  const { data, error } = await supabase
    .from('pda_semestres')
    .insert([{ nome, data_inicio, data_fim }])
    .select().single()
  if (error) throw error
  return data
}

export async function deletarSemestre(id) {
  const { error } = await supabase.from('pda_semestres').delete().eq('id', id)
  if (error) throw error
}

// ── INICIATIVAS ────────────────────────────────────────────
export async function getIniciativas(semestreId, area = null) {
  let q = supabase
    .from('pda_iniciativas')
    .select('*, pda_celulas(*)')
    .eq('semestre_id', semestreId)
    .order('ordem', { ascending: true })
  if (area) q = q.eq('area', area)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function criarIniciativa({
  semestre_id, area, titulo,
  responsavel = null, ordem = 0, grupo_id = null, eh_grupo = false,
  justificativa = null, como_fazer = null, prazo_final = null,
}) {
  const { data, error } = await supabase
    .from('pda_iniciativas')
    .insert([{
      semestre_id, area, titulo,
      responsavel, ordem, grupo_id, eh_grupo,
      justificativa, como_fazer, prazo_final,
    }])
    .select().single()
  if (error) throw error
  return { ...data, pda_celulas: [] }
}

export async function atualizarIniciativa(id, updates) {
  const { data, error } = await supabase
    .from('pda_iniciativas')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarIniciativa(id) {
  const { error } = await supabase.from('pda_iniciativas').delete().eq('id', id)
  if (error) throw error
}

// ── CÉLULAS (texto + status por semana) ────────────────────
export async function upsertCelula({ iniciativa_id, semana, texto = null, status = 'a_fazer' }) {
  const { data: existente } = await supabase
    .from('pda_celulas').select('id')
    .eq('iniciativa_id', iniciativa_id).eq('semana', semana).maybeSingle()
  if (existente) {
    if (!texto && status === 'a_fazer') {
      const { error } = await supabase.from('pda_celulas').delete().eq('id', existente.id)
      if (error) throw error
      return null
    }
    const { data, error } = await supabase
      .from('pda_celulas')
      .update({ texto, status }).eq('id', existente.id).select().single()
    if (error) throw error
    return data
  } else {
    if (!texto && status === 'a_fazer') return null
    const { data, error } = await supabase
      .from('pda_celulas')
      .insert([{ iniciativa_id, semana, texto, status }])
      .select().single()
    if (error) throw error
    return data
  }
}

export async function deletarCelula(id) {
  const { error } = await supabase.from('pda_celulas').delete().eq('id', id)
  if (error) throw error
}
