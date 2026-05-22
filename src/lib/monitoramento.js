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

export async function getLancamentosMonitoramento({ ano, mes, grupo } = {}) {
  const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  const { data: lancData, error: lancError } = await supabase
    .from('lancamento_parceiros')
    .select(`
      id, status, data_combinada, tipo_divulgacao, link,
      parceiros(id, nome),
      lancamento_livros(id, livros(id, titulo), campanhas(id, nome, tipo))
    `)
    .not('data_combinada', 'is', null)
    .gte('data_combinada', ini)
    .lte('data_combinada', fim)
  if (lancError) throw lancError

  let qCampPromo = supabase.from('campanhas').select('id, nome').eq('tipo', 'Promoção')
  if (grupo) qCampPromo = qCampPromo.eq('grupo', grupo)
  const { data: campPromo } = await qCampPromo

  const campPromoIds = (campPromo || []).map(c => c.id)
  const campPromoMap = Object.fromEntries((campPromo || []).map(c => [c.id, c.nome]))

  let promNorm = []
  if (campPromoIds.length > 0) {
    const { data: cpData } = await supabase
      .from('campanha_parceiros')
      .select('id, campanha_id, parceiros(id, nome)')
      .in('campanha_id', campPromoIds)

    const cpIds = (cpData || []).map(cp => cp.id)
    const cpMap = Object.fromEntries((cpData || []).map(cp => [cp.id, cp]))

    if (cpIds.length > 0) {
      const { data: divData } = await supabase
        .from('campanha_divulgacoes')
        .select('id, tipo, origem, data_divulgacao, link, campanha_parceiro_id')
        .in('campanha_parceiro_id', cpIds)
        .gte('data_divulgacao', ini)
        .lte('data_divulgacao', fim)

      promNorm = (divData || []).map(d => {
        const cp = cpMap[d.campanha_parceiro_id]
        return {
          id: d.id,
          status: 'pendente',
          data_combinada: d.data_divulgacao,
          tipo_divulgacao: d.tipo || null,
          link: d.link || null,
          parceiros: cp?.parceiros,
          _campanha: campPromoMap[cp?.campanha_id],
          _tipo_campanha: 'Promoção',
          _origem_campanha: 'promocao',
          _origem: d.origem || 'combinada',
        }
      })
    }
  }

  const lancNorm = (lancData || []).map(lp => ({
    ...lp,
    _campanha: lp.lancamento_livros?.campanhas?.nome,
    _livro: lp.lancamento_livros?.livros?.titulo,
    _tipo_campanha: lp.lancamento_livros?.campanhas?.tipo || 'Lançamento',
    _origem_campanha: 'lancamento',
  }))

  return [...lancNorm, ...promNorm]
}
