import { supabase } from './client'

// ── SEMESTRES ──────────────────────────────────────────────
export async function getSemestres() {
  const { data, error } = await supabase
    .from('pda_parceiras_semestres')
    .select('*')
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data || []
}

export async function criarSemestre({ nome, data_inicio, data_fim }) {
  const { data, error } = await supabase
    .from('pda_parceiras_semestres')
    .insert([{ nome, data_inicio, data_fim }])
    .select().single()
  if (error) throw error
  return data
}

export async function deletarSemestre(id) {
  const { error } = await supabase.from('pda_parceiras_semestres').delete().eq('id', id)
  if (error) throw error
}

// ── INICIATIVAS ────────────────────────────────────────────
export async function getIniciativas(semestreId, area = null) {
  let q = supabase
    .from('pda_parceiras_iniciativas')
    .select('*, pda_parceiras_celulas(*), pda_parceiras_secoes(*, pda_parceiras_itens(*))')
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
  justificativa = null, como_fazer = null, prazo_final = null, data_inicio = null,
  meta_quantidade = null, meta_periodo = null, meta_nao_aplica = false,
}) {
  const { data, error } = await supabase
    .from('pda_parceiras_iniciativas')
    .insert([{
      semestre_id, area, titulo,
      responsavel, ordem, grupo_id, eh_grupo,
      justificativa, como_fazer, prazo_final, data_inicio,
      meta_quantidade, meta_periodo, meta_nao_aplica,
    }])
    .select().single()
  if (error) throw error
  return { ...data, pda_parceiras_celulas: [], pda_parceiras_secoes: [] }
}

export async function atualizarIniciativa(id, updates) {
  const { data, error } = await supabase
    .from('pda_parceiras_iniciativas')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarIniciativa(id) {
  const { error } = await supabase.from('pda_parceiras_iniciativas').delete().eq('id', id)
  if (error) throw error
}

// ── CÉLULAS (texto + status por semana) ────────────────────
export async function upsertCelula({ iniciativa_id, semana, texto = null, status = 'a_fazer' }) {
  const { data: existente } = await supabase
    .from('pda_parceiras_celulas').select('id')
    .eq('iniciativa_id', iniciativa_id).eq('semana', semana).maybeSingle()
  if (existente) {
    if (!texto && status === 'a_fazer') {
      const { error } = await supabase.from('pda_parceiras_celulas').delete().eq('id', existente.id)
      if (error) throw error
      return null
    }
    const { data, error } = await supabase
      .from('pda_parceiras_celulas')
      .update({ texto, status }).eq('id', existente.id).select().single()
    if (error) throw error
    return data
  } else {
    if (!texto && status === 'a_fazer') return null
    const { data, error } = await supabase
      .from('pda_parceiras_celulas')
      .insert([{ iniciativa_id, semana, texto, status }])
      .select().single()
    if (error) throw error
    return data
  }
}

export async function deletarCelula(id) {
  const { error } = await supabase.from('pda_parceiras_celulas').delete().eq('id', id)
  if (error) throw error
}

// ── SUBTAREFAS: SEÇÕES + ITENS (dentro de uma iniciativa) ──
export async function criarSecao(iniciativa_id, titulo, ordem = 0) {
  const { data, error } = await supabase
    .from('pda_parceiras_secoes')
    .insert([{ iniciativa_id, titulo, ordem }])
    .select().single()
  if (error) throw error
  return { ...data, pda_parceiras_itens: [] }
}

export async function atualizarSecao(id, updates) {
  const { data, error } = await supabase
    .from('pda_parceiras_secoes')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarSecao(id) {
  const { error } = await supabase.from('pda_parceiras_secoes').delete().eq('id', id)
  if (error) throw error
}

export async function criarItem(secao_id, texto, ordem = 0) {
  const { data, error } = await supabase
    .from('pda_parceiras_itens')
    .insert([{ secao_id, texto, ordem }])
    .select().single()
  if (error) throw error
  return data
}

export async function atualizarItem(id, updates) {
  const { data, error } = await supabase
    .from('pda_parceiras_itens')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarItem(id) {
  const { error } = await supabase.from('pda_parceiras_itens').delete().eq('id', id)
  if (error) throw error
}
