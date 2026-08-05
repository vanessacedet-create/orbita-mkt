import { supabase } from './client'

// =============================================================================
// MÓDULO DE TAREFAS — INFLUENCERS (ISOLADO)
//
// Fork de banco-tarefas.js apontando exclusivamente para as tabelas *_inf.
// Nenhuma função aqui toca em dados de parceiras, marketplaces ou próprias.
//
// Tabelas exclusivas deste módulo:
//   banco_categorias_inf, banco_tarefas_inf, banco_tarefa_checklist_inf,
//   banco_tarefa_responsaveis_inf, tarefas_atribuidas_inf,
//   atribuicao_checklist_inf, atribuicao_responsaveis_inf,
//   tarefas_registro_tempo_inf
//
// Tabelas compartilhadas propositalmente (cadastro único, decisão registrada):
//   usuarios, parceiros, livros
//
// Ganhos da separação já embutidos aqui:
//   - atribuicao_checklist_inf.data_prazo   → data real da etapa (era texto)
//   - banco_tarefa_checklist_inf.dias_antes → offset real (era prefixo [[D-n]])
// =============================================================================

const BANCO_SELECT = `
  id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo, created_by, categoria_id, ordem,
  dia_semana_ideal, dia_mes_ideal,
  responsavel:responsavel_id(id, nome),
  categoria:categoria_id(id, nome, cor),
  responsaveis_padrao:banco_tarefa_responsaveis_inf(id, usuario_id, usuario:usuario_id(id, nome)),
  checklist_padrao:banco_tarefa_checklist_inf(id, texto, ordem, dias_antes),
  subtarefas:banco_tarefas_inf!tarefa_pai_id(
    id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, ativo, categoria_id,
    dia_semana_ideal, dia_mes_ideal,
    responsavel:responsavel_id(id, nome),
    categoria:categoria_id(id, nome, cor),
    responsaveis_padrao:banco_tarefa_responsaveis_inf(id, usuario_id, usuario:usuario_id(id, nome))
  )
`

const ATRIBUIDA_SELECT = `
  *,
  banco_tarefa:banco_tarefa_id(id, nome, descricao, periodicidade, tempo_medio_minutos, tarefa_pai_id, categoria_id,
    categoria:categoria_id(id, nome, cor)
  ),
  responsavel:responsavel_id(id, nome),
  parceiro:parceiro_id(id, nome, livraria),
  atribuida_por:atribuida_por(id, nome),
  registros_tempo:tarefas_registro_tempo_inf(id, evento, registrado_em),
  checklist:atribuicao_checklist_inf(id, texto, concluido, ordem, data_prazo),
  responsaveis:atribuicao_responsaveis_inf(id, usuario_id, usuario:usuario_id(id, nome))
`

// ── CATEGORIAS ────────────────────────────────────────────────────────────────

export async function getCategoriasInf() {
  const { data, error } = await supabase
    .from('banco_categorias_inf')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome')
  if (error) throw error
  return data || []
}

export async function createCategoriaInf(payload) {
  const { data, error } = await supabase
    .from('banco_categorias_inf')
    .insert([{ ...payload, grupo: 'influencers' }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategoriaInf(id, updates) {
  const { data, error } = await supabase
    .from('banco_categorias_inf')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategoriaInf(id) {
  const { error } = await supabase
    .from('banco_categorias_inf')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

// ── BANCO DE TAREFAS (MODELOS) ────────────────────────────────────────────────

export async function getBancoTarefasInf() {
  const { data, error } = await supabase
    .from('banco_tarefas_inf')
    .select(BANCO_SELECT)
    .eq('ativo', true)
    .is('tarefa_pai_id', null)
    .order('ordem', { ascending: true })
    .order('nome')
  if (error) throw error
  return data || []
}

export async function createBancoTarefaInf(payload) {
  const { data, error } = await supabase
    .from('banco_tarefas_inf')
    .insert([{ ...payload, grupo: 'influencers' }])
    .select(BANCO_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateBancoTarefaInf(id, updates) {
  const { data, error } = await supabase
    .from('banco_tarefas_inf')
    .update(updates)
    .eq('id', id)
    .select(BANCO_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function desativarBancoTarefaInf(id) {
  const { error } = await supabase
    .from('banco_tarefas_inf')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function setResponsaveisBancoInf(bancoTarefaId, usuarioIds) {
  await supabase.from('banco_tarefa_responsaveis_inf').delete().eq('banco_tarefa_id', bancoTarefaId)
  const ids = (usuarioIds || []).filter(Boolean)
  if (ids.length > 0) {
    const { error } = await supabase.from('banco_tarefa_responsaveis_inf').insert(
      ids.map(uid => ({ banco_tarefa_id: bancoTarefaId, usuario_id: uid }))
    )
    if (error) throw error
  }
}

// Aceita string (compatível com o formato antigo, inclusive prefixo [[D-n]])
// ou objeto { texto, dias_antes } — que grava o offset na coluna própria.
export async function setChecklistPadraoInf(bancoTarefaId, itens) {
  await supabase.from('banco_tarefa_checklist_inf').delete().eq('banco_tarefa_id', bancoTarefaId)

  const linhas = (itens || []).map((item, i) => {
    if (item && typeof item === 'object') {
      const texto = String(item.texto ?? '').trim()
      if (!texto) return null
      return { banco_tarefa_id: bancoTarefaId, texto, ordem: i, dias_antes: Number(item.dias_antes) || 0 }
    }
    const bruto = String(item ?? '').trim()
    if (!bruto) return null
    const match = bruto.match(/^\[\[D-(\d+)\]\]\s*/)
    return {
      banco_tarefa_id: bancoTarefaId,
      texto: bruto,
      ordem: i,
      dias_antes: match ? Number(match[1]) : 0,
    }
  }).filter(Boolean)

  if (linhas.length > 0) {
    const { error } = await supabase.from('banco_tarefa_checklist_inf').insert(linhas)
    if (error) throw error
  }
}

// ── ATRIBUIÇÕES ───────────────────────────────────────────────────────────────

export async function getAtribuicoesInf({ responsavelId, status } = {}) {
  let query = supabase
    .from('tarefas_atribuidas_inf')
    .select(ATRIBUIDA_SELECT)
    .order('data_atribuicao', { ascending: false })
  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Aceita checklist como string ou { texto, data_prazo }.
export async function atribuirTarefaInf({
  bancoTarefaId, responsavelIds, dataPrazo, especificidade,
  atribuidaPor, checklist, parceiroId, quantidade,
}) {
  const ids = (Array.isArray(responsavelIds) ? responsavelIds : [responsavelIds]).filter(Boolean)

  const { data, error } = await supabase
    .from('tarefas_atribuidas_inf')
    .insert([{
      banco_tarefa_id: bancoTarefaId,
      responsavel_id:  ids[0] || null,
      data_prazo:      dataPrazo || null,
      especificidade:  especificidade || null,
      atribuida_por:   atribuidaPor,
      status:          'a_fazer',
      grupo:           'influencers',
      parceiro_id:     parceiroId || null,
      parceiros_ids:   parceiroId ? [parceiroId] : [],
    }])
    .select('id')
    .single()
  if (error) throw error

  if (ids.length > 0) {
    const { error: errResp } = await supabase.from('atribuicao_responsaveis_inf').insert(
      ids.map(uid => ({ atribuicao_id: data.id, usuario_id: uid }))
    )
    if (errResp) throw errResp
  }

  const linhas = (checklist || []).map((item, i) => {
    if (item && typeof item === 'object') {
      const texto = String(item.texto ?? '').trim()
      if (!texto) return null
      return { atribuicao_id: data.id, texto, ordem: i, data_prazo: item.data_prazo || null }
    }
    const texto = String(item ?? '').trim()
    if (!texto) return null
    return { atribuicao_id: data.id, texto, ordem: i, data_prazo: null }
  }).filter(Boolean)

  if (linhas.length > 0) {
    const { error: errChk } = await supabase.from('atribuicao_checklist_inf').insert(linhas)
    if (errChk) throw errChk
  }

  const { data: completa, error: errFinal } = await supabase
    .from('tarefas_atribuidas_inf')
    .select(ATRIBUIDA_SELECT)
    .eq('id', data.id)
    .single()
  if (errFinal) throw errFinal
  return completa
}

export async function updateAtribuicaoInf(id, updates) {
  const payload = { ...updates }
  const statusAnterior = payload._statusAnterior
  delete payload._statusAnterior

  if (payload.status && statusAnterior && payload.status !== statusAnterior) {
    const eventoMap = {
      em_andamento: statusAnterior === 'pausada' ? 'retorno' : 'inicio',
      pausada:      'pausa',
      concluida:    'conclusao',
    }
    const evento = eventoMap[payload.status]
    if (evento) {
      await supabase.from('tarefas_registro_tempo_inf').insert([{ atribuicao_id: id, evento }])
    }
  }

  if (payload.status === 'concluida' && !payload.concluida_em) {
    payload.concluida_em = new Date().toISOString()
  }

  if (payload._responsaveisIds) {
    const responsavelIds = payload._responsaveisIds.filter(Boolean)
    delete payload._responsaveisIds
    await supabase.from('atribuicao_responsaveis_inf').delete().eq('atribuicao_id', id)
    if (responsavelIds.length > 0) {
      const { error } = await supabase.from('atribuicao_responsaveis_inf').insert(
        responsavelIds.map(uid => ({ atribuicao_id: id, usuario_id: uid }))
      )
      if (error) throw error
      payload.responsavel_id = responsavelIds[0]
    }
  }

  const { data, error } = await supabase
    .from('tarefas_atribuidas_inf')
    .update(payload)
    .eq('id', id)
    .select(ATRIBUIDA_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteAtribuicaoInf(id) {
  const { error } = await supabase.from('tarefas_atribuidas_inf').delete().eq('id', id)
  if (error) throw error
}

// ── CHECKLIST DA ATRIBUIÇÃO ───────────────────────────────────────────────────

export async function addChecklistAtribuicaoInf(atribuicaoId, texto, ordem, dataPrazo = null) {
  const { data, error } = await supabase
    .from('atribuicao_checklist_inf')
    .insert([{ atribuicao_id: atribuicaoId, texto, ordem: ordem || 0, data_prazo: dataPrazo }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleChecklistAtribuicaoInf(id, concluido) {
  const { data, error } = await supabase
    .from('atribuicao_checklist_inf')
    .update({ concluido })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDataEtapaInf(id, dataPrazo) {
  const { data, error } = await supabase
    .from('atribuicao_checklist_inf')
    .update({ data_prazo: dataPrazo || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChecklistAtribuicaoInf(id) {
  const { error } = await supabase.from('atribuicao_checklist_inf').delete().eq('id', id)
  if (error) throw error
}

// ── REORDENAÇÃO ───────────────────────────────────────────────────────────────

export async function reordenarCardsInf(atualizacoes) {
  await Promise.all((atualizacoes || []).map(({ id, ordem, categoria_id }) =>
    supabase.from('banco_tarefas_inf').update({ ordem, categoria_id }).eq('id', id)
  ))
}

export async function reordenarCategoriasInf(atualizacoes) {
  await Promise.all((atualizacoes || []).map(({ id, ordem }) =>
    supabase.from('banco_categorias_inf').update({ ordem }).eq('id', id)
  ))
}

// ── UTILITÁRIOS (sem acesso ao banco) ─────────────────────────────────────────

export function calcularTempoExecucaoInf(registros) {
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
  return totalMs === 0 ? null : Math.round(totalMs / 60000)
}

export function formatarTempoInf(minutos) {
  if (!minutos) return null
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}