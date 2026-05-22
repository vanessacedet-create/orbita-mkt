import { supabase } from './client'

// ── CPF — CRIPTOGRAFIA ────────────────────────────────────
export async function saveParceiroCPF(parceiroId, cpf) {
  const { error } = await supabase.rpc('salvar_cpf_parceiro', {
    p_id: parceiroId,
    p_cpf: cpf || null,
  })
  if (error) throw error
}

export async function getParceiroCPF(parceiroId) {
  const { data, error } = await supabase
    .from('parceiros_com_cpf')
    .select('cpf_decriptografado')
    .eq('id', parceiroId)
    .single()
  if (error) throw error
  return data?.cpf_decriptografado || ''
}

// ── PARCEIROS ──────────────────────────────────────────────
export async function getParceiros() {
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  return data || []
}

// Retorna apenas parceiros com status 'active' no CRM
export async function getParceirosAtivos() {
  const { data: statusAtivos, error: se } = await supabase
    .from('parceiro_status_atual')
    .select('partner_id')
    .eq('status', 'active')
  if (se) throw se

  const ids = (statusAtivos || []).map(s => s.partner_id)
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('parceiros')
    .select('*')
    .in('id', ids)
    .order('nome')
  if (error) throw error
  return data || []
}

// Retorna TODOS os parceiros independente de status (uso interno do CRM)
export async function getTodosParceiros() {
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  return data || []
}

// ── PONTUAÇÃO DE PARCEIROS ─────────────────────────────────
export async function getParceirosComPontuacao() {
  const STATUS_VALIDOS = ['publicado','nao_publicou','confirmado','recusou','sem_retorno','agendado']

  const { data: parceiros, error: pe } = await supabase
    .from('parceiros').select('*').order('nome')
  if (pe) throw pe

  const { data: cps, error: ce } = await supabase
    .from('campanha_parceiros')
    .select('id, parceiro_id, status, campanha_id')
    .in('status', STATUS_VALIDOS)
  if (ce) throw ce

  const { data: lps, error: le } = await supabase
    .from('lancamento_parceiros')
    .select('id, parceiro_id, status, data_combinada, lancamento_livro_id')
    .in('status', STATUS_VALIDOS)
  if (le) throw le

  const porParceiro = {}

  for (const cp of (cps || [])) {
    if (!cp.parceiro_id) continue
    if (!porParceiro[cp.parceiro_id]) porParceiro[cp.parceiro_id] = { normais: [], lancamentos: [] }
    porParceiro[cp.parceiro_id].normais.push(cp)
  }

  const llVisto = {}
  for (const lp of (lps || [])) {
    if (!lp.parceiro_id) continue
    if (!porParceiro[lp.parceiro_id]) porParceiro[lp.parceiro_id] = { normais: [], lancamentos: [] }
    const chave = `${lp.parceiro_id}_${lp.lancamento_livro_id}`
    if (llVisto[chave]) continue
    llVisto[chave] = true
    porParceiro[lp.parceiro_id].lancamentos.push({
      ...lp,
      _dataRef: lp.data_combinada || null,
    })
  }

  return parceiros.map(p => ({
    ...p,
    pontuacao: calcularPontuacao(porParceiro[p.id] || { normais: [], lancamentos: [] })
  }))
}

function mesAno(dataStr) {
  if (!dataStr) return null
  const d = new Date(dataStr + 'T12:00:00')
  if (isNaN(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function calcularPontuacao({ normais = [], lancamentos = [] }) {
  const STATUS_VALIDOS = ['publicado','nao_publicou','confirmado','recusou','sem_retorno','agendado']

  const todas = [
    ...normais.filter(cp => STATUS_VALIDOS.includes(cp.status)).map(cp => ({
      status: cp.status, dataRef: cp._dataRef || null,
    })),
    ...lancamentos.filter(lp => STATUS_VALIDOS.includes(lp.status)).map(lp => ({
      status: lp.status, dataRef: lp._dataRef || null,
    }))
  ]

  if (todas.length === 0) return null

  const comprometidos = todas.filter(p => ['confirmado','agendado','publicado'].includes(p.status)).length
  const publicados    = todas.filter(p => p.status === 'publicado').length
  const confiabilidade = comprometidos > 0 ? publicados / comprometidos : 0

  const comRetorno = todas.filter(p => p.status !== 'sem_retorno').length
  const comprometimento = todas.length > 0 ? comRetorno / todas.length : 0

  const mesesComPublicacao = new Set(
    todas.filter(p => p.status === 'publicado' && mesAno(p.dataRef))
         .map(p => mesAno(p.dataRef))
  )
  const todosOsMeses = new Set(
    todas.filter(p => mesAno(p.dataRef)).map(p => mesAno(p.dataRef))
  )
  const recorrencia = todosOsMeses.size > 0 ? mesesComPublicacao.size / todosOsMeses.size : 0

  const notaBruta = (confiabilidade * 0.5 + comprometimento * 0.3 + recorrencia * 0.2) * 10
  const notaFinal = Math.round(notaBruta * 10) / 10

  const porMes = {}
  for (const p of todas) {
    const m = mesAno(p.dataRef)
    if (!m) continue
    if (!porMes[m]) porMes[m] = []
    porMes[m].push(p)
  }
  const notasMensais = {}
  for (const [m, parts] of Object.entries(porMes)) {
    const compMes = parts.filter(p => ['confirmado','agendado','publicado'].includes(p.status)).length
    const pubMes  = parts.filter(p => p.status === 'publicado').length
    const confMes = compMes > 0 ? pubMes / compMes : 0
    const retMes  = parts.filter(p => p.status !== 'sem_retorno').length / parts.length
    const recMes  = pubMes > 0 ? 1 : 0
    const notaMes = (confMes * 0.5 + retMes * 0.3 + recMes * 0.2) * 10
    notasMensais[m] = Math.round(notaMes * 10) / 10
  }

  return {
    nota: notaFinal,
    notasMensais,
    totalCampanhas: todas.length,
    totalLancamentos: lancamentos.length,
    publicadas: publicados,
    confiabilidade: Math.round(confiabilidade * 100),
    comprometimento: Math.round(comprometimento * 100),
    recorrencia: Math.round(recorrencia * 100),
    nivel: notaFinal >= 8 ? 'ouro' : notaFinal >= 6 ? 'prata' : notaFinal >= 4 ? 'bronze' : 'atencao'
  }
}

export async function createParceiro(p) {
  const { cpf, ...rest } = p
  const { data, error } = await supabase.from('parceiros').insert([rest]).select().single()
  if (error) throw error
  if (cpf && cpf.trim()) {
    await supabase.rpc('salvar_cpf_parceiro', { p_id: data.id, p_cpf: cpf.trim() })
  }
  return data
}

export async function updateParceiro(id, updates) {
  const { cpf, ...rest } = updates
  const { data, error } = await supabase.from('parceiros').update(rest).eq('id', id).select().single()
  if (error) throw error
  if (cpf !== undefined) {
    await supabase.rpc('salvar_cpf_parceiro', { p_id: id, p_cpf: cpf?.trim() || null })
  }
  return data
}

export async function deleteParceiro(id) {
  const { error } = await supabase.from('parceiros').delete().eq('id', id)
  if (error) throw error
}

// ── CRM DE INFLUENCERS ─────────────────────────────────────
export async function createParceiroCRM(payload, statusInicial = 'prospected') {
  const { data, error } = await supabase
    .from('parceiros')
    .insert([payload])
    .select('*')
    .single()
  if (error) throw error
  await addStatusHistory(data.id, statusInicial, 'Parceiro cadastrado via CRM')
  return data
}

export async function getCRMParceiros({ grupo } = {}) {
  let q = supabase
    .from('parceiros')
    .select('*, responsavel_interno:usuarios!responsavel_interno_id(id, nome)')
    .order('nome')
  if (grupo) q = q.eq('grupo', grupo)
  const { data, error } = await q
  if (error) throw error

  const ids = (data||[]).map(p=>p.id)
  if (!ids.length) return []

  const { data: statusData } = await supabase
    .from('parceiro_status_atual')
    .select('partner_id, status')
    .in('partner_id', ids)

  const statusMap = {}
  for (const s of (statusData||[])) {
    statusMap[s.partner_id] = s.status
  }

  return (data||[]).map(p => ({
    ...p,
    current_status: statusMap[p.id] || null,
    responsavel_interno_nome: p.responsavel_interno?.nome || null
  }))
}

export async function updateParceiroCRM(id, updates) {
  const { data, error } = await supabase
    .from('parceiros')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getStatusHistory(parceiro_id) {
  const { data, error } = await supabase
    .from('partner_status_history')
    .select('*')
    .eq('partner_id', parceiro_id)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addStatusHistory(parceiro_id, status, reason) {
  const { data, error } = await supabase
    .from('partner_status_history')
    .insert([{ partner_id: parceiro_id, status, reason: reason||null }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function vincularDivulgadorComoParceiro(divulgador) {
  let parceiro = null
  if (divulgador.username) {
    const { data } = await supabase
      .from('parceiros').select('*')
      .ilike('username', divulgador.username).maybeSingle()
    parceiro = data
  }
  if (!parceiro) {
    const { data } = await supabase
      .from('parceiros').select('*')
      .ilike('nome', divulgador.nome).maybeSingle()
    parceiro = data
  }
  if (!parceiro) {
    const { data, error } = await supabase
      .from('parceiros').insert([{
        nome:            divulgador.nome,
        username:        divulgador.username || null,
        platforms:       divulgador.platforms || null,
        followers_count: divulgador.followers_count || null,
        engagement_rate: divulgador.engagement_rate || null,
        profile_url:     divulgador.profile_url || null,
        contact_value:   divulgador.contact_value || null,
        tipo_parceria:   divulgador.tipo_parceria || null,
        notes:           divulgador.notes || null,
      }]).select('*').single()
    if (error) throw error
    parceiro = data
  }
  await supabase.from('divulgadores')
    .update({ parceiro_id: parceiro.id })
    .eq('id', divulgador.id)
  return parceiro
}
