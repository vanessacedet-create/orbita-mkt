import { supabase } from './client'

// ── PROMOÇÕES (calendário) ─────────────────────────────────
// Reaproveita a mesma tabela calendario_promocoes que o CRM Editoras
// Parceiras já usa para preencher "quais promoções" no score mensal.

export async function getPromocoes() {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getPromocao(id) {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPromocao({ titulo, descricao, data_inicio, data_fim }) {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .insert([{ titulo, descricao: descricao || null, data_inicio: data_inicio || null, data_fim: data_fim || null, ativo: true }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePromocao(id, { titulo, descricao, data_inicio, data_fim }) {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .update({ titulo, descricao: descricao || null, data_inicio: data_inicio || null, data_fim: data_fim || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarPromocao(id) {
  const { error } = await supabase
    .from('calendario_promocoes')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

// ── PARTICIPAÇÃO DAS LIVRARIAS EM CADA PROMOÇÃO ───────────

export async function getParticipacoesPromocao(promocao_id) {
  const { data, error } = await supabase
    .from('promocao_livrarias')
    .select('*, livrarias(id, nome)')
    .eq('promocao_id', promocao_id)
  if (error) throw error
  return data || []
}

export async function upsertParticipacao(promocao_id, livraria_id, { status, observacao }) {
  const { data, error } = await supabase
    .from('promocao_livrarias')
    .upsert(
      { promocao_id, livraria_id, status, observacao: observacao ?? null, atualizado_em: new Date().toISOString() },
      { onConflict: 'promocao_id,livraria_id' }
    )
    .select('*, livrarias(id, nome)')
    .single()
  if (error) throw error
  return data
}

// Conta quantas livrarias estão em cada status para uma promoção —
// usado para mostrar o resumo no card da lista.
export function contarStatusPromocao(participacoes) {
  const contagem = { confirmou: 0, recusou: 0, sem_retorno: 0, convidado: 0 }
  for (const p of participacoes) {
    if (contagem[p.status] !== undefined) contagem[p.status]++
  }
  return contagem
}
