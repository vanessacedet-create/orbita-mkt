import { supabase } from './client'

const TAREFA_SELECT = `*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome),
  tarefa_checklist(id, texto, concluido, ordem),
  tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome)),
  tarefa_livros(id, livros(id, titulo, autor, isbn)),
  tarefa_responsaveis(id, usuario_id, concluido, concluido_em, usuario:usuario_id(id, nome))`

export async function getTarefas() {
  const { data, error } = await supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTarefa(payload) {
  const { data, error } = await supabase
    .from('tarefas')
    .insert([payload])
    .select(TAREFA_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateTarefa(id, updates) {
  const { data, error } = await supabase
    .from('tarefas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(TAREFA_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteTarefa(id) {
  const { error } = await supabase.from('tarefas').delete().eq('id', id)
  if (error) throw error
}

export async function addChecklistItem(tarefa_id, texto) {
  const { data, error } = await supabase
    .from('tarefa_checklist')
    .insert([{ tarefa_id, texto, concluido: false }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateChecklistItem(id, updates) {
  const { data, error } = await supabase
    .from('tarefa_checklist')
    .update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteChecklistItem(id) {
  const { error } = await supabase.from('tarefa_checklist').delete().eq('id', id)
  if (error) throw error
}

export async function addLivroTarefa(tarefa_id, livro_id) {
  const { data: existing } = await supabase
    .from('tarefa_livros')
    .select('id, livros(id, titulo, autor, isbn)')
    .eq('tarefa_id', tarefa_id)
    .eq('livro_id', livro_id)
    .maybeSingle()
  if (existing) return existing
  const { data, error } = await supabase
    .from('tarefa_livros')
    .insert([{ tarefa_id, livro_id }])
    .select('id, livros(id, titulo, autor, isbn)')
    .single()
  if (error) throw error
  return data
}

export async function removeLivroTarefa(id) {
  const { error } = await supabase.from('tarefa_livros').delete().eq('id', id)
  if (error) throw error
}

export async function importarTarefasLote({ tarefas, ignoradas, filename, userId }) {
  if (!userId) throw new Error('Usuário não autenticado')
  if (!tarefas || tarefas.length === 0) throw new Error('Nenhuma tarefa válida para importar')

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert([{
      imported_by: userId,
      source_filename: filename,
      total_rows: tarefas.length + (ignoradas?.length || 0),
      successful_rows: tarefas.length,
      ignored_rows: ignoradas?.length || 0,
      ignored_rows_data: ignoradas || [],
    }])
    .select('id')
    .single()
  if (batchError) throw batchError

  const batchId = batch.id
  const agora = new Date().toISOString()

  const tarefasParaInserir = tarefas.map(t => ({
    titulo:           t.titulo,
    descricao:        t.descricao || null,
    status:           t.status || 'a_fazer',
    prioridade:       t.prioridade || 'media',
    responsavel_id:   t.responsavel_id || null,
    data_prazo:       t.data_prazo || null,
    created_by:       userId,
    created_via:      'planilha_xlsx',
    imported_by:      userId,
    imported_at:      agora,
    import_batch_id:  batchId,
    source_filename:  filename,
  }))

  const { data: tarefasCriadas, error: insertError } = await supabase
    .from('tarefas')
    .insert(tarefasParaInserir)
    .select('id')
  if (insertError) throw insertError

  let livrosVinculados = 0
  const linhasTarefaLivros = []
  tarefas.forEach((t, idx) => {
    const tarefaId = tarefasCriadas[idx]?.id
    if (!tarefaId) return
    if (t.livro_ids && t.livro_ids.length > 0) {
      t.livro_ids.forEach(livro_id => {
        linhasTarefaLivros.push({ tarefa_id: tarefaId, livro_id })
      })
    }
  })

  if (linhasTarefaLivros.length > 0) {
    const { error: tlError } = await supabase
      .from('tarefa_livros')
      .insert(linhasTarefaLivros)
    if (tlError) {
      console.error('Erro ao vincular livros:', tlError)
    } else {
      livrosVinculados = linhasTarefaLivros.length
    }
  }

  return {
    batchId,
    criadas: tarefasCriadas.length,
    livrosVinculados,
    ignoradas: ignoradas?.length || 0,
  }
}

export async function desfazerImportacao(batchId) {
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .single()
  if (batchError) throw batchError
  if (!batch) throw new Error('Lote não encontrado')

  const importadoEm = new Date(batch.imported_at)
  const agora = new Date()
  const horasPassadas = (agora - importadoEm) / (1000 * 60 * 60)
  if (horasPassadas > 24) throw new Error('Janela de 24 horas para desfazer já expirou')
  if (batch.undone_at) throw new Error('Este lote já foi desfeito')

  const { error: deleteError } = await supabase
    .from('tarefas')
    .delete()
    .eq('import_batch_id', batchId)
  if (deleteError) throw deleteError

  const { error: updateError } = await supabase
    .from('import_batches')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', batchId)
  if (updateError) throw updateError

  return { ok: true }
}

export async function getLotesRecentes() {
  const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .gte('imported_at', vinteQuatroHorasAtras)
    .is('undone_at', null)
    .order('imported_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addComentario(tarefa_id, usuario_id, texto) {
  const { data, error } = await supabase
    .from('tarefa_comentarios')
    .insert([{ tarefa_id, usuario_id, texto }])
    .select(`id, texto, created_at, usuario:usuario_id(id, nome)`)
    .single()
  if (error) throw error
  return data
}

// ── RECORRÊNCIA ─────────────────────────────────────────────────────────────

/**
 * Calcula o próximo prazo a partir de uma data de referência,
 * com base no tipo e config de recorrência.
 * Para tipo 'personalizada', chama a API do Claude para interpretar
 * a descrição em linguagem natural.
 */
export async function calcularProximoPrazo(dataRef, tipo, config = {}) {
  const d = new Date(dataRef + 'T12:00:00')

  if (tipo === 'diaria') {
    d.setDate(d.getDate() + 1)
    return toISO(d)
  }

  if (tipo === 'semanal') {
    const alvo = config.dia_semana ?? d.getDay()
    d.setDate(d.getDate() + 7)
    // ajusta para o dia da semana correto se necessário
    while (d.getDay() !== alvo) d.setDate(d.getDate() + 1)
    return toISO(d)
  }

  if (tipo === 'quinzenal') {
    d.setDate(d.getDate() + 14)
    return toISO(d)
  }

  if (tipo === 'mensal') {
    if (config.ultimo_dia_util) {
      d.setMonth(d.getMonth() + 2, 0) // último dia do próximo mês
      while (!isDiaUtil(d)) d.setDate(d.getDate() - 1)
      return toISO(d)
    }
    const dia = config.dia_mes ?? d.getDate()
    d.setMonth(d.getMonth() + 1, dia)
    return toISO(d)
  }

  if (tipo === 'anual') {
    d.setFullYear(d.getFullYear() + 1)
    return toISO(d)
  }

  if (tipo === 'personalizada') {
    return await calcularProximoPrazoIA(dataRef, config.descricao || '')
  }

  return null
}

function toISO(d) {
  return d.toISOString().slice(0, 10)
}

function isDiaUtil(d) {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6
}

async function calcularProximoPrazoIA(dataRef, descricao) {
  const prompt = `Hoje é ${dataRef}. A regra de recorrência é: "${descricao}".
Qual é a próxima data de vencimento após ${dataRef}?
Responda APENAS com a data no formato YYYY-MM-DD, sem nenhum texto adicional.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const json = await res.json()
    const texto = json?.content?.[0]?.text?.trim() || ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  } catch (e) {
    console.error('Erro ao calcular prazo via IA:', e)
  }
  return null
}

/**
 * Ao concluir uma tarefa recorrente: cria a próxima ocorrência no banco.
 * Retorna a nova tarefa criada (ou null se não houver recorrência).
 */
export async function gerarProximaOcorrencia(tarefa) {
  if (!tarefa.recorrencia_ativa || !tarefa.recorrencia_tipo) return null

  const proximoPrazo = await calcularProximoPrazo(
    tarefa.data_prazo || toISO(new Date()),
    tarefa.recorrencia_tipo,
    tarefa.recorrencia_config || {}
  )
  if (!proximoPrazo) return null

  const payload = {
    titulo:              tarefa.titulo,
    descricao:           tarefa.descricao,
    status:              'a_fazer',
    prioridade:          tarefa.prioridade,
    responsavel_id:      tarefa.responsavel_id,
    grupo:               tarefa.grupo,
    created_by:          tarefa.created_by,
    data_prazo:          proximoPrazo,
    recorrencia_ativa:   true,
    recorrencia_tipo:    tarefa.recorrencia_tipo,
    recorrencia_config:  tarefa.recorrencia_config,
    recorrencia_origem_id: tarefa.recorrencia_origem_id || tarefa.id,
  }

  const { data, error } = await supabase
    .from('tarefas')
    .insert([payload])
    .select('id')
    .single()
  if (error) throw error

  // Copia os responsáveis (com conclusão zerada)
  const responsaveis = (tarefa.tarefa_responsaveis || [])
  if (responsaveis.length > 0) {
    await supabase.from('tarefa_responsaveis').insert(
      responsaveis.map(r => ({ tarefa_id: data.id, usuario_id: r.usuario_id, concluido: false }))
    )
  } else if (tarefa.responsavel_id) {
    await supabase.from('tarefa_responsaveis').insert(
      [{ tarefa_id: data.id, usuario_id: tarefa.responsavel_id, concluido: false }]
    )
  }

  // Copia o checklist (desmarcado)
  const checklist = (tarefa.tarefa_checklist || [])
  if (checklist.length > 0) {
    await supabase.from('tarefa_checklist').insert(
      checklist.map(c => ({ tarefa_id: data.id, texto: c.texto, concluido: false, ordem: c.ordem }))
    )
  }

  // Retorna a tarefa completa
  const { data: completa, error: e2 } = await supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .eq('id', data.id)
    .single()
  if (e2) throw e2
  return completa
}

// ── MÚLTIPLOS RESPONSÁVEIS ──────────────────────────────────────────────────

/** Sincroniza a lista de responsáveis de uma tarefa (adiciona novos, remove os que saíram). */
export async function setResponsaveisTarefa(tarefaId, usuarioIds) {
  const ids = [...new Set(usuarioIds || [])]
  const { data: atuais, error: e1 } = await supabase
    .from('tarefa_responsaveis')
    .select('id, usuario_id')
    .eq('tarefa_id', tarefaId)
  if (e1) throw e1

  const atuaisIds = (atuais || []).map(r => r.usuario_id)
  const adicionar = ids.filter(id => !atuaisIds.includes(id))
  const remover   = (atuais || []).filter(r => !ids.includes(r.usuario_id)).map(r => r.id)

  if (remover.length > 0) {
    const { error } = await supabase.from('tarefa_responsaveis').delete().in('id', remover)
    if (error) throw error
  }
  if (adicionar.length > 0) {
    const { error } = await supabase.from('tarefa_responsaveis')
      .insert(adicionar.map(usuario_id => ({ tarefa_id: tarefaId, usuario_id, concluido: false })))
    if (error) throw error
  }
}

/** Marca/desmarca a parte de um responsável. Retorna a linha atualizada. */
export async function toggleParteResponsavel(linhaId, concluido) {
  const { data, error } = await supabase
    .from('tarefa_responsaveis')
    .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
    .eq('id', linhaId)
    .select('id, usuario_id, concluido, concluido_em')
    .single()
  if (error) throw error
  return data
}

/** Marca todas as partes como concluídas (usado ao concluir a tarefa direto no kanban). */
export async function concluirTodasAsPartes(tarefaId) {
  const { error } = await supabase
    .from('tarefa_responsaveis')
    .update({ concluido: true, concluido_em: new Date().toISOString() })
    .eq('tarefa_id', tarefaId)
    .eq('concluido', false)
  if (error) throw error
}
