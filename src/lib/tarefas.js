import { supabase } from './client'

const TAREFA_SELECT = `*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome),
  tarefa_checklist(id, texto, concluido, ordem),
  tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome)),
  tarefa_livros(id, livros(id, titulo, autor, isbn))`

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
