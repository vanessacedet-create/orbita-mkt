import { supabase } from './client'

// ── PILARES ────────────────────────────────────────────────
export async function getPilares() {
  const { data, error } = await supabase
    .from('pda2_parceiras_pilares')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  if (error) throw error
  return data || []
}

// ── INICIATIVAS ────────────────────────────────────────────
export async function getIniciativas(semestre) {
  const { data, error } = await supabase
    .from('pda2_parceiras_iniciativas')
    .select('*, pda2_parceiras_semanas(*), pda2_parceiras_secoes(*, pda2_parceiras_itens(*))')
    .eq('semestre', semestre)
    .order('ordem', { ascending: true })
  if (error) throw error
  return data || []
}

export async function criarIniciativa(campos) {
  const { data, error } = await supabase
    .from('pda2_parceiras_iniciativas')
    .insert([campos])
    .select().single()
  if (error) throw error
  return { ...data, pda2_parceiras_semanas: [], pda2_parceiras_secoes: [] }
}

export async function atualizarIniciativa(id, updates) {
  const { data, error } = await supabase
    .from('pda2_parceiras_iniciativas')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarIniciativa(id) {
  const { error } = await supabase.from('pda2_parceiras_iniciativas').delete().eq('id', id)
  if (error) throw error
}

// ── REPLANEJAMENTO ─────────────────────────────────────────
export async function replanejarPrazo(iniciativaId, prazoAnterior, prazoNovo, motivo) {
  const { error: errHist } = await supabase
    .from('pda2_parceiras_historico_prazos')
    .insert([{ iniciativa_id: iniciativaId, prazo_anterior: prazoAnterior, prazo_novo: prazoNovo, motivo: motivo || null }])
  if (errHist) throw errHist

  const { data, error } = await supabase
    .from('pda2_parceiras_iniciativas')
    .update({ prazo_final: prazoNovo, foi_replanejada: true })
    .eq('id', iniciativaId)
    .select().single()
  if (error) throw error
  return data
}

export async function getHistoricoPrazos(iniciativaId) {
  const { data, error } = await supabase
    .from('pda2_parceiras_historico_prazos')
    .select('*')
    .eq('iniciativa_id', iniciativaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ── SEMANA A SEMANA ────────────────────────────────────────
export async function upsertSemana({ iniciativa_id, semana, texto = null, status = 'a_fazer' }) {
  const { data: existente } = await supabase
    .from('pda2_parceiras_semanas').select('id')
    .eq('iniciativa_id', iniciativa_id).eq('semana', semana).maybeSingle()
  if (existente) {
    if (!texto && status === 'a_fazer') {
      const { error } = await supabase.from('pda2_parceiras_semanas').delete().eq('id', existente.id)
      if (error) throw error
      return null
    }
    const { data, error } = await supabase
      .from('pda2_parceiras_semanas')
      .update({ texto, status }).eq('id', existente.id).select().single()
    if (error) throw error
    return data
  } else {
    if (!texto && status === 'a_fazer') return null
    const { data, error } = await supabase
      .from('pda2_parceiras_semanas')
      .insert([{ iniciativa_id, semana, texto, status }])
      .select().single()
    if (error) throw error
    return data
  }
}

// ── SUBTAREFAS: SEÇÕES + ITENS ─────────────────────────────
export async function criarSecao(iniciativa_id, titulo, ordem = 0) {
  const { data, error } = await supabase
    .from('pda2_parceiras_secoes')
    .insert([{ iniciativa_id, titulo, ordem }])
    .select().single()
  if (error) throw error
  return { ...data, pda2_parceiras_itens: [] }
}

export async function atualizarSecao(id, updates) {
  const { data, error } = await supabase
    .from('pda2_parceiras_secoes')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarSecao(id) {
  const { error } = await supabase.from('pda2_parceiras_secoes').delete().eq('id', id)
  if (error) throw error
}

export async function criarItem(secao_id, texto, ordem = 0) {
  const { data, error } = await supabase
    .from('pda2_parceiras_itens')
    .insert([{ secao_id, texto, ordem }])
    .select().single()
  if (error) throw error
  return data
}

export async function atualizarItem(id, updates) {
  const { data, error } = await supabase
    .from('pda2_parceiras_itens')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletarItem(id) {
  const { error } = await supabase.from('pda2_parceiras_itens').delete().eq('id', id)
  if (error) throw error
}
