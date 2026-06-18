import { supabase } from './client'

const BANCO_SELECT = `
  id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo, created_by,
  responsavel:responsavel_id(id, nome),
  subtarefas:banco_tarefas!tarefa_pai_id(
    id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo,
    responsavel:responsavel_id(id, nome)
  )
`

const ATRIBUIDA_SELECT = `
  *,
  banco_tarefa:banco_tarefa_id(id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id),
  responsavel:responsavel_id(id, nome),
  atribuida_por:atribuida_por(id, nome),
  registros_tempo:tarefas_registro_tempo(id, evento, registrado_em)
`

// ── BANCO DE TAREFAS (modelos) ───────────────────────────────────────────────

/** Lista apenas tarefas pai (sem subtarefas) com suas subtarefas aninhadas */
export async function getBancoTarefas() {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .select(BANCO_SELECT)
    .eq('ativo', true)
    .is('tarefa_pai_id', null)
    .order('nome')
  if (error) throw error
  return data || []
}

/** Cria um novo modelo no banco */
export async function createBancoTarefa(payload) {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .insert([payload])
    .select(BANCO_SELECT)
    .single()
  if (error) throw error
  return data
}

/** Edita um modelo existente */
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

/** Desativa um modelo (soft delete) */
export async function desativarBancoTarefa(id) {
  const { error } = await supabase
    .from('banco_tarefas')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

// ── ATRIBUIÇÕES ──────────────────────────────────────────────────────────────

/** Busca todas as atribuições (admin/gerente) */
export async function getAtribuicoes({ responsavelId, status } = {}) {
  let query = supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .order('data_atribuicao', { ascending: false })

  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (status)        query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** Busca apenas as atribuições do usuário logado */
export async function getMinhasAtribuicoes(userId) {
  const { data, error } = await supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .eq('responsavel_id', userId)
    .order('data_atribuicao', { ascending: false })
  if (error) throw error
  return data || []
}

/** Atribui uma tarefa do banco a alguém */
export async function atribuirTarefa({ bancoTarefaId, responsavelId, dataPrazo, especificidade, atribuidaPor }) {
  const { data, error } = await supabase
    .from('tarefas_atribuidas')
    .insert([{
      banco_tarefa_id:  bancoTarefaId,
      responsavel_id:   responsavelId,
      data_prazo:       dataPrazo || null,
      especificidade:   especificidade || null,
      atribuida_por:    atribuidaPor,
      status:           'a_fazer',
    }])
    .select(ATRIBUIDA_SELECT)
    .single()
  if (error) throw error
  return data
}

/** Atualiza uma atribuição e registra eventos de tempo */
export async function updateAtribuicao(id, updates) {
  const statusAnterior = updates._statusAnterior
  delete updates._statusAnterior

  // Registra evento de tempo baseado na mudança de status
  if (updates.status && statusAnterior && updates.status !== statusAnterior) {
    const eventoMap = {
      'em_andamento': statusAnterior === 'a_fazer' || statusAnterior === 'pausada' ? 
        (statusAnterior === 'pausada' ? 'retorno' : 'inicio') : null,
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

  const { data, error } = await supabase
    .from('tarefas_atribuidas')
    .update(updates)
    .eq('id', id)
    .select(ATRIBUIDA_SELECT)
    .single()
  if (error) throw error
  return data
}

/** Remove uma atribuição */
export async function deleteAtribuicao(id) {
  const { error } = await supabase.from('tarefas_atribuidas').delete().eq('id', id)
  if (error) throw error
}

/** Calcula o tempo total de execução de uma atribuição em minutos */
export function calcularTempoExecucao(registros) {
  if (!registros || registros.length === 0) return null

  const ordenados = [...registros].sort((a, b) => 
    new Date(a.registrado_em) - new Date(b.registrado_em)
  )

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
  return Math.round(totalMs / 60000) // retorna em minutos
}

/** Formata minutos para exibição (ex: 90 → "1h 30min") */
export function formatarTempo(minutos) {
  if (!minutos) return null
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
