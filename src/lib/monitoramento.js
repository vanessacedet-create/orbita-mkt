import { supabase } from './client'

export async function getRegistrosMonitoramento({ ano, mes, grupo } = {}) {
  const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
  let q = supabase
    .from('monitoramento')
    .select('*, parceiros(id, nome)')
    .gte('data', ini).lte('data', fim)
    .order('data', { ascending: true })
  if (grupo) q = q.eq('grupo', grupo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createRegistroMonitoramento(payload) {
  const { data, error } = await supabase
    .from('monitoramento')
    .insert([payload])
    .select('*, parceiros(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function updateRegistroMonitoramento(id, updates) {
  const { data, error } = await supabase
    .from('monitoramento')
    .update(updates)
    .eq('id', id)
    .select('*, parceiros(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function deleteRegistroMonitoramento(id) {
  const { error } = await supabase.from('monitoramento').delete().eq('id', id)
  if (error) throw error
}

// Marca uma divulgação de campanha como publicada (chamada pelo Monitoramento)
export async function marcarDivulgacaoPublicada(id, { data_publicada, link } = {}) {
  const updates = { data_publicada: data_publicada || null }
  if (link !== undefined && link !== null && link !== '') updates.link = link
  const { data, error } = await supabase
    .from('campanha_divulgacoes')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Edita uma divulgação importada de LANÇAMENTO (tabela lancamento_parceiros)
export async function updateLancamentoParceiro(id, updates) {
  const { data, error } = await supabase
    .from('lancamento_parceiros')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Edita uma divulgação importada de CAMPANHA (tabela campanha_divulgacoes)
export async function updateDivulgacaoCampanha(id, updates) {
  const { data, error } = await supabase
    .from('campanha_divulgacoes')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getLancamentosMonitoramento({ ano, mes, grupo } = {}) {
  const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  // ── 1. Lançamentos (lancamento_parceiros — já tem status próprio) ──
  // Data efetiva = data_combinada; na falta dela, data_divulgacao (mesma data).
  let qLanc = supabase
    .from('lancamento_parceiros')
    .select(`
      id, status, data_combinada, data_divulgacao, tipo_divulgacao, link,
      parceiros(id, nome),
      lancamento_livros!inner(id, livros(id, titulo), campanhas!inner(id, nome, tipo, grupo))
    `)
    .or(`and(data_combinada.gte.${ini},data_combinada.lte.${fim}),and(data_combinada.is.null,data_divulgacao.gte.${ini},data_divulgacao.lte.${fim})`)
  if (grupo) qLanc = qLanc.eq('lancamento_livros.campanhas.grupo', grupo)
  const { data: lancData, error: lancError } = await qLanc
  if (lancError) throw lancError

  // ── 2. Divulgações de campanha (campanha_divulgacoes — TODOS os tipos) ──
  // Fluxo CEDET: data_divulgacao = data COMBINADA (planejada na campanha).
  // data_publicada = preenchida quando o parceiro posta.
  // Monitoramento: sem data_publicada e data vencida → fila de cobrança.
  let qCamp = supabase.from('campanhas').select('id, nome, tipo')
  if (grupo) qCamp = qCamp.eq('grupo', grupo)
  const { data: campAll } = await qCamp

  const campIds = (campAll || []).map(c => c.id)
  const campMap = Object.fromEntries((campAll || []).map(c => [c.id, c]))

  let divNorm = []
  if (campIds.length > 0) {
    const { data: cpData } = await supabase
      .from('campanha_parceiros')
      .select('id, campanha_id, parceiros(id, nome)')
      .in('campanha_id', campIds)

    const cpIds = (cpData || []).map(cp => cp.id)
    const cpMap = Object.fromEntries((cpData || []).map(cp => [cp.id, cp]))

    if (cpIds.length > 0) {
      const { data: divData, error: divError } = await supabase
        .from('campanha_divulgacoes')
        .select('id, tipo, origem, data_divulgacao, data_publicada, link, campanha_parceiro_id, livros(id, titulo)')
        .in('campanha_parceiro_id', cpIds)
        .gte('data_divulgacao', ini)
        .lte('data_divulgacao', fim)
      if (divError) throw divError

      divNorm = (divData || []).map(d => {
        const cp = cpMap[d.campanha_parceiro_id]
        const camp = campMap[cp?.campanha_id]
        // Orgânica = aconteceu espontaneamente (já nasce publicada).
        const publicada = !!d.data_publicada || d.origem === 'organica'
        return {
          id: d.id,
          _divulgacaoCampanhaId: d.id, // habilita "marcar como postou" na página
          status: publicada ? 'publicado' : 'pendente',
          data_combinada: d.data_divulgacao,
          data_publicada: d.data_publicada || null,
          tipo_divulgacao: d.tipo || null,
          link: d.link || null,
          parceiros: cp?.parceiros,
          _campanha: camp?.nome,
          _livro: d.livros?.titulo,
          _tipo_campanha: camp?.tipo || 'Campanha',
          _origem_campanha: 'campanha',
          _origem: d.origem || 'combinada',
        }
      })
    }
  }

  const lancNorm = (lancData || []).map(lp => ({
    ...lp,
    // Sem data combinada: considera a data divulgada como a mesma data
    data_combinada: lp.data_combinada || lp.data_divulgacao,
    _campanha: lp.lancamento_livros?.campanhas?.nome,
    _livro: lp.lancamento_livros?.livros?.titulo,
    _tipo_campanha: lp.lancamento_livros?.campanhas?.tipo || 'Lançamento',
    _origem_campanha: 'lancamento',
  }))

  return [...lancNorm, ...divNorm]
}
