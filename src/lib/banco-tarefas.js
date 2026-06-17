import { supabase } from './client'

const ATRIBUIDA_SELECT = `
  *,
  banco_tarefa:banco_tarefa_id(id, nome, descricao, periodicidade),
  responsavel:responsavel_id(id, nome),
  atribuida_por:atribuida_por(id, nome)
`

// ── BANCO DE TAREFAS (modelos) ───────────────────────────────────────────────

/** Lista todos os modelos ativos do banco */
export async function getBancoTarefas() {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .select('*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome)')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data || []
}

/** Lista todos os modelos, incluindo inativos (para administradores) */
export async function getBancoTarefasTodos() {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .select('*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome)')
    .order('nome')
  if (error) throw error
  return data || []
}

/** Cria um novo modelo no banco */
export async function createBancoTarefa(payload) {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .insert([payload])
    .select('*, responsavel:responsavel_id(id, nome)')
    .single()
  if (error) throw error
  return data
}

/** Edita um modelo existente (não afeta atribuições já criadas) */
export async function updateBancoTarefa(id, updates) {
  const { data, error } = await supabase
    .from('banco_tarefas')
    .update(updates)
    .eq('id', id)
    .select('*, responsavel:responsavel_id(id, nome)')
    .single()
  if (error) throw error
  return data
}

/** Desativa um modelo (soft delete — não apaga do banco) */
export async function desativarBancoTarefa(id) {
  return updateBancoTarefa(id, { ativo: false })
}

// ── ATRIBUIÇÕES (ocorrências reais) ─────────────────────────────────────────

/** Busca todas as atribuições (visão de admin/gerente) */
export async function getAtribuicoes({ data, responsavelId, status } = {}) {
  let query = supabase
    .from('tarefas_atribuidas')
    .select(ATRIBUIDA_SELECT)
    .order('data_atribuicao', { ascending: false })

  if (data)          query = query.eq('data_atribuicao', data)
  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (status)        query = query.eq('status', status)

  const { data: rows, error } = await query
  if (error) throw error
  return rows || []
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

/**
 * "Puxa" uma tarefa do banco e atribui a alguém.
 * A tarefa original (banco_tarefas) não é alterada.
 */
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

/** Atualiza uma atribuição (troca responsável, adiciona especificidade, muda status etc.) */
export async function updateAtribuicao(id, updates) {
  // Se está sendo concluída, registra o momento
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
  const { error } = await supabase
    .from('tarefas_atribuidas')
    .delete()
    .eq('id', id)
  if (error) throw error
}
