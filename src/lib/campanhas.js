import { supabase } from './client'

export async function getCampanhas({ grupo } = {}) {
  let q = supabase
    .from('campanhas')
    .select(`
      *,
      campanha_livros(id, livros(id, titulo, autor, editora)),
      campanha_parceiros(id, status, parceiros(id, nome, tipo_parceria)),
      lancamento_livros(id, lancamento_parceiros(id, status))
    `)
  if (grupo) q = q.eq('grupo', grupo)
  q = q.order('ordem', { ascending: true, nullsFirst: false })
       .order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getCampanha(id) {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      *,
      campanha_livros(id, livros(id, titulo, autor, isbn, sku, editora)),
      campanha_parceiros(id, status, data_inicio, data_fim, data_publicacao_combinada, link_publicacao, curtidas, visualizacoes, observacoes, parceiros(id, nome, tipo_parceria, responsavel_interno_id))
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCampanha({ nome, tipo, status, data_inicio, data_fim, descricao, grupo = null, livro_ids = [], adicionar_lancamentos_auto = false }) {
  const { data: campanha, error } = await supabase
    .from('campanhas')
    .insert([{ nome, tipo, status, data_inicio, data_fim, descricao, grupo }])
    .select().single()
  if (error) throw error

  let autoAdicionados = 0

  if (adicionar_lancamentos_auto && (tipo === 'Lançamento' || tipo === 'Geral' || tipo === 'Book Time') && data_inicio && data_fim) {
    const { data: livrosNoRange } = await supabase
      .from('livros')
      .select('id')
      .not('data_lancamento', 'is', null)
      .gte('data_lancamento', data_inicio)
      .lte('data_lancamento', data_fim)

    if (livrosNoRange?.length) {
      const inserir = livrosNoRange.map(l => ({ campanha_id: campanha.id, livro_id: l.id }))
      const { error: le } = await supabase.from('lancamento_livros').insert(inserir)
      if (le) throw le
      autoAdicionados = livrosNoRange.length
    }
  } else if (livro_ids.length > 0) {
    const { error: le } = await supabase.from('campanha_livros').insert(
      livro_ids.map(livro_id => ({ campanha_id: campanha.id, livro_id }))
    )
    if (le) throw le
  }

  const result = await getCampanha(campanha.id)
  result._livrosAutoAdicionados = autoAdicionados
  return result
}

export async function updateCampanha(id, { nome, tipo, status, data_inicio, data_fim, descricao, livro_ids }) {
  const updates = { nome, status, data_inicio, data_fim, descricao }
  if (tipo !== undefined) updates.tipo = tipo
  const { error } = await supabase.from('campanhas').update(updates).eq('id', id)
  if (error) throw error
  if (livro_ids !== undefined) {
    await supabase.from('campanha_livros').delete().eq('campanha_id', id)
    if (livro_ids.length > 0) {
      const { error: le } = await supabase.from('campanha_livros').insert(livro_ids.map(livro_id => ({ campanha_id: id, livro_id })))
      if (le) throw le
    }
  }
  return getCampanha(id)
}

export async function reordenarCampanhas(ordens) {
  // ordens = [{ id, ordem }]
  // Usa RPC para executar todos os updates em uma única transação atômica.
  // Se a função RPC não existir no banco, cai para o fallback com Promise.all.
  const { error } = await supabase.rpc('reordenar_campanhas', { ordens_json: ordens })
  if (!error) return

  // Fallback: updates individuais em paralelo (comportamento anterior)
  // Para criar a RPC e eliminar este fallback, execute no Supabase SQL Editor:
  //
  // create or replace function reordenar_campanhas(ordens_json jsonb)
  // returns void language plpgsql as $$
  // declare item jsonb;
  // begin
  //   for item in select * from jsonb_array_elements(ordens_json)
  //   loop
  //     update campanhas set ordem = (item->>'ordem')::int where id = (item->>'id')::uuid;
  //   end loop;
  // end;
  // $$;
  await Promise.all(ordens.map(({ id, ordem }) =>
    supabase.from('campanhas').update({ ordem }).eq('id', id)
  ))
}

export async function deleteCampanha(id) {
  const { error } = await supabase.from('campanhas').delete().eq('id', id)
  if (error) throw error
}

export async function addParceiroCampanha(campanha_id, parceiro_id) {
  const { data, error } = await supabase.from('campanha_parceiros')
    .insert([{ campanha_id, parceiro_id, status: 'convidado' }])
    .select(`*, parceiros(id, nome, tipo_parceria)`).single()
  if (error) throw error
  return data
}

export async function updateParceiroCampanha(id, updates) {
  const { data, error } = await supabase.from('campanha_parceiros')
    .update(updates).eq('id', id)
    .select(`*, parceiros(id, nome, tipo_parceria)`).single()
  if (error) throw error
  return data
}

export async function removeParceiroCampanha(id) {
  const { error } = await supabase.from('campanha_parceiros').delete().eq('id', id)
  if (error) throw error
}

export async function addLivroCampanha(campanha_id, livro_id) {
  const { data: existing } = await supabase
    .from('campanha_livros').select('id').eq('campanha_id', campanha_id).eq('livro_id', livro_id).maybeSingle()
  if (existing) return existing
  const { data, error } = await supabase
    .from('campanha_livros')
    .insert([{ campanha_id, livro_id }])
    .select('id, livros(id, titulo, autor, isbn, sku, editora)')
    .single()
  if (error) throw error
  return data
}

export async function removeLivroCampanha(id) {
  const { error } = await supabase.from('campanha_livros').delete().eq('id', id)
  if (error) throw error
}

export async function getFollowUps() {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      id, nome, tipo, status, data_inicio,
      campanha_parceiros(id, status, contato_realizado, data_contato, nota_contato, parceiros(id, nome, tipo_parceria))
    `)
    .in('status', ['planejamento', 'em_andamento'])
    .not('data_inicio', 'is', null)
    .order('data_inicio', { ascending: true })
  if (error) throw error
  return data
}

export async function registrarContato(campanhaParceirolId, { data_contato, nota_contato }) {
  const { data, error } = await supabase
    .from('campanha_parceiros')
    .update({ contato_realizado: true, data_contato, nota_contato })
    .eq('id', campanhaParceirolId)
    .select(`*, parceiros(id, nome, tipo_parceria)`)
    .single()
  if (error) throw error
  return data
}

export async function getDivulgacoesParceiro(campanha_parceiro_id) {
  const { data, error } = await supabase
    .from('campanha_divulgacoes')
    .select('*, livros(id, titulo)')
    .eq('campanha_parceiro_id', campanha_parceiro_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createDivulgacaoCampanha(payload) {
  const { data, error } = await supabase
    .from('campanha_divulgacoes')
    .insert([payload])
    .select('*, livros(id, titulo)')
    .single()
  if (error) throw error
  return data
}

export async function updateDivulgacaoCampanha(id, updates) {
  const { data, error } = await supabase
    .from('campanha_divulgacoes')
    .update(updates)
    .eq('id', id)
    .select('*, livros(id, titulo)')
    .single()
  if (error) throw error
  return data
}

export async function deleteDivulgacaoCampanha(id) {
  const { error } = await supabase.from('campanha_divulgacoes').delete().eq('id', id)
  if (error) throw error
}

export async function getLancamentoLivros(campanha_id) {
  const { data, error } = await supabase
    .from('lancamento_livros')
    .select('id, livro_id, livros(id, titulo, autor, isbn, sku, data_lancamento), lancamento_parceiros(id, status, data_combinada, data_divulgacao, tipo_divulgacao, origem, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria, responsavel_interno_id))')
    .eq('campanha_id', campanha_id)
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: false, foreignTable: 'lancamento_parceiros' })
  if (error) throw error
  return data || []
}

export async function addLancamentoLivro(campanha_id, livro_id) {
  const { data, error } = await supabase
    .from('lancamento_livros')
    .insert([{ campanha_id, livro_id }])
    .select('id, livro_id, livros(id, titulo, autor, isbn, sku)')
    .single()
  if (error) throw error
  return { ...data, lancamento_parceiros: [] }
}

export async function removeLancamentoLivro(id) {
  const { error } = await supabase.from('lancamento_livros').delete().eq('id', id)
  if (error) throw error
}

export async function addLancamentoParceiro(lancamento_livro_id, parceiro_id) {
  const { data, error } = await supabase
    .from('lancamento_parceiros')
    .insert([{ lancamento_livro_id, parceiro_id, status: 'convidado' }])
    .select('id, status, data_combinada, data_divulgacao, tipo_divulgacao, origem, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria)')
    .single()
  if (error) throw error
  return data
}

export async function updateLancamentoParceiro(id, updates) {
  const { data, error } = await supabase
    .from('lancamento_parceiros')
    .update(updates)
    .eq('id', id)
    .select('id, status, data_combinada, data_divulgacao, tipo_divulgacao, origem, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria)')
    .single()
  if (error) throw error
  return data
}

export async function getLancamentoParceiro(id) {
  const { data, error } = await supabase
    .from('lancamento_parceiros')
    .select('id, status, data_combinada, data_divulgacao, tipo_divulgacao, origem, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function removeLancamentoParceiro(id) {
  const { error } = await supabase.from('lancamento_parceiros').delete().eq('id', id)
  if (error) throw error
}

export async function getLivrosDestaqueParceiro(campanha_parceiro_id) {
  const { data, error } = await supabase
    .from('campanha_parceiro_livros')
    .select('id, livro_id, livros(id, titulo, isbn, autor, editora)')
    .eq('campanha_parceiro_id', campanha_parceiro_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addLivroDestaqueParceiro(campanha_parceiro_id, livro_id) {
  const { data: existing } = await supabase
    .from('campanha_parceiro_livros')
    .select('id')
    .eq('campanha_parceiro_id', campanha_parceiro_id)
    .eq('livro_id', livro_id)
    .maybeSingle()
  if (existing) return existing
  const { data, error } = await supabase
    .from('campanha_parceiro_livros')
    .insert([{ campanha_parceiro_id, livro_id }])
    .select('id, livro_id, livros(id, titulo, isbn, autor, editora)')
    .single()
  if (error) throw error
  return data
}

export async function removeLivroDestaqueParceiro(id) {
  const { error } = await supabase.from('campanha_parceiro_livros').delete().eq('id', id)
  if (error) throw error
}

export async function importarLivrosDestaquePlanilha(campanha_parceiro_id, isbns) {
  const results = { adicionados: 0, naoEncontrados: [], erros: [] }
  for (const isbn of isbns) {
    try {
      const isbnStr = String(isbn).replace(/\.0$/, '').trim()
      if (!isbnStr) continue
      const { data: livro } = await supabase
        .from('livros').select('id, titulo').eq('isbn', isbnStr).maybeSingle()
      if (!livro) { results.naoEncontrados.push(isbnStr); continue }
      await addLivroDestaqueParceiro(campanha_parceiro_id, livro.id)
      results.adicionados++
    } catch(e) {
      results.erros.push(`${isbn}: ${e?.message || e}`)
    }
  }
  return results
}

export async function getDivulgacoesLibraria(campanha_id) {
  const { data, error } = await supabase
    .from('divulgacoes_livraria')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .eq('campanha_id', campanha_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createDivulgacaoLibraria(payload) {
  const { data, error } = await supabase
    .from('divulgacoes_livraria')
    .insert([payload])
    .select('*, parceiros(id, nome, tipo_parceria)')
    .single()
  if (error) throw error
  return data
}

export async function updateDivulgacaoLibraria(id, updates) {
  const { data, error } = await supabase
    .from('divulgacoes_livraria')
    .update(updates)
    .eq('id', id)
    .select('*, parceiros(id, nome, tipo_parceria)')
    .single()
  if (error) throw error
  return data
}

export async function deleteDivulgacaoLibraria(id) {
  const { error } = await supabase.from('divulgacoes_livraria').delete().eq('id', id)
  if (error) throw error
}

export async function importarDivulgacoesPromocao(campanhaId, rows) {
  const results = { criados: 0, erros: [] }

  const { data: cps } = await supabase
    .from('campanha_parceiros')
    .select('id, parceiro_id, parceiros(id, nome)')
    .eq('campanha_id', campanhaId)

  const isbns = [...new Set(rows.map(r => r.isbn).filter(Boolean))]
  const livrosMap = {}
  for (const isbn of isbns) {
    const { data } = await supabase.from('livros').select('id, titulo, isbn').eq('isbn', isbn).maybeSingle()
    if (data) livrosMap[isbn] = data
  }

  for (const row of rows) {
    try {
      const cp = cps?.find(c =>
        c.parceiros?.nome?.toLowerCase().trim() === row.parceiro_nome?.toLowerCase().trim()
      )
      if (!cp) { results.erros.push(`Parceiro não encontrado: "${row.parceiro_nome}"`); continue }

      const livro = row.isbn ? livrosMap[row.isbn] : null
      if (row.isbn && !livro) { results.erros.push(`ISBN não encontrado: ${row.isbn} (parceiro: ${row.parceiro_nome})`); continue }

      await supabase.from('campanha_divulgacoes').insert([{
        campanha_parceiro_id: cp.id,
        livro_id: livro?.id || null,
        tipo: row.tipo || null,
        origem: row.origem || 'combinada',
        data_divulgacao: row.data_divulgacao || null,
      }])
      results.criados++
    } catch(e) {
      results.erros.push(`${row.parceiro_nome}: ${e?.message || e}`)
    }
  }
  return results
}

export async function getDashboardStats({ dataInicio, dataFim, tipoCampanha, origem, grupo } = {}) {
  let qParceiros = supabase.from('parceiros').select('*', { count: 'exact', head: true })
  if (dataInicio) qParceiros = qParceiros.gte('created_at', dataInicio)
  if (dataFim)    qParceiros = qParceiros.lte('created_at', dataFim + 'T23:59:59')
  const { count: totalParceiros } = await qParceiros

  let qCampanhas = supabase.from('campanhas').select('*', { count: 'exact', head: true })
  if (dataInicio) qCampanhas = qCampanhas.gte('data_inicio', dataInicio)
  if (dataFim)    qCampanhas = qCampanhas.lte('data_inicio', dataFim)
  if (tipoCampanha) qCampanhas = qCampanhas.eq('tipo', tipoCampanha)
  if (grupo) qCampanhas = qCampanhas.eq('grupo', grupo)
  const { count: totalCampanhas } = await qCampanhas

  let qLP = supabase.from('lancamento_parceiros').select('id, status, origem, data_divulgacao').eq('status', 'publicado')
  if (dataInicio) qLP = qLP.gte('data_divulgacao', dataInicio)
  if (dataFim)    qLP = qLP.lte('data_divulgacao', dataFim)
  if (origem)     qLP = origem === 'organica' ? qLP.eq('origem','organica') : qLP.neq('origem','organica')
  const { data: lpData } = await qLP

  let qCP = supabase.from('campanha_parceiros').select('id, status, origem, campanhas(tipo)').eq('status','publicado')
  if (origem)     qCP = origem === 'organica' ? qCP.eq('origem','organica') : qCP.neq('origem','organica')
  const { data: cpData } = await qCP

  let qDL = supabase.from('divulgacoes_livraria').select('id, origem, data_divulgacao')
  if (dataInicio) qDL = qDL.gte('data_divulgacao', dataInicio)
  if (dataFim)    qDL = qDL.lte('data_divulgacao', dataFim)
  if (origem)     qDL = origem === 'organica' ? qDL.eq('origem','organica') : qDL.neq('origem','organica')
  const { data: dlData } = await qDL

  const lpPublicados = lpData || []
  const cpPublicados = cpData || []
  const dlAll        = dlData || []

  const lpFiltrados = tipoCampanha && !['Lançamento','Geral','Book Time'].includes(tipoCampanha) ? [] : lpPublicados
  const cpFiltrados = tipoCampanha && tipoCampanha !== 'Promoção' ? [] : cpPublicados
  const dlFiltrados = tipoCampanha && tipoCampanha !== 'Geral' ? [] : dlAll

  const divLancOrg  = lpFiltrados.filter(lp => lp.origem === 'organica').length
  const divLancComb = lpFiltrados.filter(lp => lp.origem !== 'organica').length
  const divPromOrg  = cpFiltrados.filter(cp => cp.origem === 'organica').length
  const divPromComb = cpFiltrados.filter(cp => cp.origem !== 'organica').length
  const divLibOrg   = dlFiltrados.filter(d  => d.origem  === 'organica').length
  const divLibComb  = dlFiltrados.filter(d  => d.origem  !== 'organica').length

  const totalDivulgacoes = lpFiltrados.length + cpFiltrados.length + dlFiltrados.length
  const totalOrganicas   = divLancOrg  + divPromOrg  + divLibOrg
  const totalCombinadas  = divLancComb + divPromComb + divLibComb

  const { data: parceirosRaw } = await supabase.from('parceiros').select('id, tipo_parceria, status')
  const parcs = parceirosRaw || []
  const parceirosPorTipo   = parcs.reduce((a,p)=>{ const t=p.tipo_parceria||'Sem tipo'; a[t]=(a[t]||0)+1; return a },{})
  const parceirosPorStatus = parcs.reduce((a,p)=>{ const s=p.status||'ativo'; a[s]=(a[s]||0)+1; return a },{})

  let qCampsRaw = supabase.from('campanhas').select('id, tipo, status')
  if (grupo) qCampsRaw = qCampsRaw.eq('grupo', grupo)
  const { data: campanhasRaw } = await qCampsRaw
  const camps = campanhasRaw || []
  const campanhasPorTipo   = camps.reduce((a,c)=>{ const t=c.tipo||'Sem tipo'; a[t]=(a[t]||0)+1; return a },{})
  const campanhasPorStatus = camps.reduce((a,c)=>{ const s=c.status||'planejamento'; a[s]=(a[s]||0)+1; return a },{})

  return {
    totalParceiros: totalParceiros || 0,
    totalCampanhas: totalCampanhas || 0,
    totalDivulgacoes,
    totalOrganicas,
    totalCombinadas,
    parceirosPorTipo,
    parceirosPorStatus,
    campanhasPorTipo,
    campanhasPorStatus,
    breakdown: {
      lancamento: { total: lpFiltrados.length, organica: divLancOrg,  combinada: divLancComb },
      promocao:   { total: cpFiltrados.length, organica: divPromOrg,  combinada: divPromComb },
      livraria:   { total: dlFiltrados.length, organica: divLibOrg,   combinada: divLibComb  },
    }
  }
}
