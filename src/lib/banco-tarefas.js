import { supabase } from './client'

const BANCO_SELECT = `
  id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo, created_by, categoria_id, ordem,
  dia_semana_ideal, dia_mes_ideal,
  responsavel:responsavel_id(id, nome),
  categoria:categoria_id(id, nome, cor),
  responsaveis_padrao:banco_tarefa_responsaveis(id, usuario_id, usuario:usuario_id(id, nome)),
  checklist_padrao:banco_tarefa_checklist(id, texto, ordem),
  subtarefas:banco_tarefas!tarefa_pai_id(
    id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo, categoria_id,
    dia_semana_ideal, dia_mes_ideal,
    responsavel:responsavel_id(id, nome),
    categoria:categoria_id(id, nome, cor),
    responsaveis_padrao:banco_tarefa_responsaveis(id, usuario_id, usuario:usuario_id(id, nome))
  )
`

const ATRIBUIDA_SELECT = `
  *,
  banco_tarefa:banco_tarefa_id(id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, categoria_id,
    categoria:categoria_id(id, nome, cor)
  ),
  responsavel:responsavel_id(id, nome),
  parceiro:parceiro_id(id, nome),
  atribuida_por:atribuida_por(id, nome),
  registros_tempo:tarefas_registro_tempo(id, evento, registrado_em),
  checklist:atribuicao_checklist(id, texto, concluido, ordem),
  responsaveis:atribuicao_responsaveis(id, usuario_id, usuario:usuario_id(id, nome))
`

// ── CATEGORIAS ────────────────────────────────────────────────────────────────

export async function getCategorias(grupo = 'parceiras') {
  const { data, error } = await supabase
    .from('banco_categorias')
    .select('*')
    .eq('grupo', grupo)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome')
  if (error) throw error
  return data || []
}

export async function createCategoria(payload) {
  const { data, error } = await supabase
    .from('banco_categorias')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategoria(id, updates) {
  const { data, error } = await supabase
    .from('banco_categorias')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategoria(id) {
  const { error } = await supabase
    .from('banco_categorias')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

// ── BANCO DE TAREFAS ──────────────────────────────────────────────────────────

export async function getBancoTarefas(grupo = 'parceiras') {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .select(BANCO_SELECT)
    .eq('grupo', grupo)
    .eq('ativo', true)
    .is('tarefa_pai_id', null)
    .order('ordem', { ascending: true })
    .order('nome')
  if (error) throw error
  return data || []
}

export async function createBancoTarefa(payload) {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .insert([payload])
    .select(BANCO_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateBancoTarefa(id, updates) {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .update(updates)
    .eq('id', id)
    .select(BANCO_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function desativarBancoTarefa(id) {
  const { error } = await supabase
    .from('banco_tarefas')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

// ── ATRIBUIÇÕES ───────────────────────────────────────────────────────────────

export async function getAtribuicoes({ responsavelId, status, grupo } = {}) {
  let query = supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .order('data_atribuicao', { ascending: false })
  if (grupo) query = query.eq('grupo', grupo)
  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getMinhasAtribuicoes(userId, grupo = null) {
  const { data: atribIds } = await supabase
    .from('atribuicao_responsaveis')
    .select('atribuicao_id')
    .eq('usuario_id', userId)

  const ids = (atribIds || []).map(a => a.atribuicao_id)

  let q = supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .or(`responsavel_id.eq.${userId}${ids.length > 0 ? `,id.in.(${ids.join(',')})` : ''}`)
    .order('data_atribuicao', { ascending: false })
  if (grupo) q = q.eq('grupo', grupo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function atribuirTarefa({ bancoTarefaId, responsavelIds, dataPrazo, especificidade, atribuidaPor, checklist, grupo, parceiroId }) {
  const responsavelPrincipal = Array.isArray(responsavelIds) ? responsavelIds[0] : responsavelIds

  const { data, error } = await supabase
    .from('tarefas_atribuidas')
    .insert([{
      banco_tarefa_id: bancoTarefaId,
      responsavel_id:  responsavelPrincipal,
      data_prazo:      dataPrazo || null,
      especificidade:  especificidade || null,
      atribuida_por:   atribuidaPor,
      status:          'a_fazer',
      grupo:           grupo || 'parceiras',
      parceiro_id:     parceiroId || null,
    }])
    .select('id')
    .single()
  if (error) throw error

  const ids = Array.isArray(responsavelIds) ? responsavelIds : [responsavelIds]
  if (ids.length > 0) {
    await supabase.from('atribuicao_responsaveis').insert(
      ids.map(uid => ({ atribuicao_id: data.id, usuario_id: uid }))
    )
  }

  if (checklist && checklist.length > 0) {
    await supabase.from('atribuicao_checklist').insert(
      checklist.map((texto, i) => ({ atribuicao_id: data.id, texto, ordem: i }))
    )
  }

  const { data: completa, error: e2 } = await supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .eq('id', data.id)
    .single()
  if (e2) throw e2
  return completa
}

export async function updateAtribuicao(id, updates) {
  const statusAnterior = updates._statusAnterior
  delete updates._statusAnterior

  if (updates.status && statusAnterior && updates.status !== statusAnterior) {
    const eventoMap = {
      'em_andamento': statusAnterior === 'pausada' ? 'retorno' : 'inicio',
      'pausada':   'pausa',
      'concluida': 'conclusao',
    }
    const evento = eventoMap[updates.status]
    if (evento) {
      await supabase.from('tarefas_registro_tempo').insert([{ atribuicao_id: id, evento }])
    }
  }

  if (updates.status === 'concluida' && !updates.concluida_em) {
    updates.concluida_em = new Date().toISOString()
  }

  if (updates._responsaveisIds) {
    const responsavelIds = updates._responsaveisIds
    delete updates._responsaveisIds
    await supabase.from('atribuicao_responsaveis').delete().eq('atribuicao_id', id)
    if (responsavelIds.length > 0) {
      await supabase.from('atribuicao_responsaveis').insert(
        responsavelIds.map(uid => ({ atribuicao_id: id, usuario_id: uid }))
      )
      updates.responsavel_id = responsavelIds[0]
    }
  }

  const { data, error } = await supabase
    .from('tarefas_atribuidas')
    .update(updates)
    .eq('id', id)
    .select(ATRIBUIDA_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteAtribuicao(id) {
  const { error } = await supabase.from('tarefas_atribuidas').delete().eq('id', id)
  if (error) throw error
}

// ── CHECKLIST ─────────────────────────────────────────────────────────────────

export async function addChecklistAtribuicao(atribuicaoId, texto, ordem) {
  const { data, error } = await supabase
    .from('atribuicao_checklist')
    .insert([{ atribuicao_id: atribuicaoId, texto, ordem: ordem || 0 }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleChecklistAtribuicao(id, concluido) {
  const { data, error } = await supabase
    .from('atribuicao_checklist')
    .update({ concluido })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChecklistAtribuicao(id) {
  const { error } = await supabase.from('atribuicao_checklist').delete().eq('id', id)
  if (error) throw error
}

// ── RESPONSÁVEIS DO BANCO ────────────────────────────────────────────────────────

export async function setResponsaveisBanco(bancoTarefaId, usuarioIds) {
  // Remove todos e reinsere
  await supabase.from('banco_tarefa_responsaveis').delete().eq('banco_tarefa_id', bancoTarefaId)
  if (usuarioIds.length > 0) {
    await supabase.from('banco_tarefa_responsaveis').insert(
      usuarioIds.map(uid => ({ banco_tarefa_id: bancoTarefaId, usuario_id: uid }))
    )
  }
}

// ── REORDENAÇÃO ──────────────────────────────────────────────────────────────────

export async function reordenarCards(atualizacoes) {
  // atualizacoes: [{ id, ordem, categoria_id }]
  const promises = atualizacoes.map(({ id, ordem, categoria_id }) =>
    supabase.from('banco_tarefas').update({ ordem, categoria_id }).eq('id', id)
  )
  await Promise.all(promises)
}

export async function reordenarCategorias(atualizacoes) {
  // atualizacoes: [{ id, ordem }]
  const promises = atualizacoes.map(({ id, ordem }) =>
    supabase.from('banco_categorias').update({ ordem }).eq('id', id)
  )
  await Promise.all(promises)
}

// ── UTILITÁRIOS ───────────────────────────────────────────────────────────────

export function calcularTempoExecucao(registros) {
  if (!registros || registros.length === 0) return null
  const ordenados = [...registros].sort((a, b) => new Date(a.registrado_em) - new Date(b.registrado_em))
  let totalMs = 0
  let inicioAtual = null
  for (const r of ordenados) {
    if (r.evento === 'inicio' || r.evento === 'retorno') {
      inicioAtual = new Date(r.registrado_em)
    } else if ((r.evento === 'pausa' || r.evento === 'conclusao') && inicioAtual) {
      totalMs += new Date(r.registrado_em) - inicioAtual
      inicioAtual = null
    }
  }
  if (totalMs === 0) return null
  return Math.round(totalMs / 60000)
}

export function formatarTempo(minutos) {
  if (!minutos) return null
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ── CHECKLIST PADRÃO DO TIPO (template) ─────────────────────────────────────
export async function setChecklistPadrao(bancoTarefaId, itens) {
  await supabase.from('banco_tarefa_checklist').delete().eq('banco_tarefa_id', bancoTarefaId)
  const textos = (itens || []).map(t => String(t).trim()).filter(Boolean)
  if (textos.length > 0) {
    const { error } = await supabase.from('banco_tarefa_checklist').insert(
      textos.map((texto, i) => ({ banco_tarefa_id: bancoTarefaId, texto, ordem: i }))
    )
    if (error) throw error
  }
}
