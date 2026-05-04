import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── AUTH ───────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── PERFIL DO USUÁRIO ──────────────────────────────────────
export async function getUsuarioPerfil(userId) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

// ── USUÁRIOS (admin) ───────────────────────────────────────
export async function getUsuarios() {
  const { data, error } = await supabase.from('usuarios').select('*').order('nome')
  if (error) throw error
  return data
}
export async function updateUsuario(id, updates) {
  const { data, error } = await supabase.from('usuarios').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function createUsuarioAdmin({ email, password, nome, perfil }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password, options: { data: { nome, perfil } }
  })
  if (authError) throw authError
  return authData
}


// ── CPF — CRIPTOGRAFIA ────────────────────────────────────
export async function saveParceiroCPF(parceiroId, cpf) {
  // Chama a função do banco para criptografar e salvar
  const { error } = await supabase.rpc('salvar_cpf_parceiro', {
    p_id: parceiroId,
    p_cpf: cpf || null,
  })
  if (error) throw error
}

export async function getParceiroCPF(parceiroId) {
  // Busca o CPF descriptografado (o banco aplica máscara conforme perfil)
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
  // Retorna TODOS os parceiros — visível para todos os usuários em todas as telas
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  return data || []
}

// Retorna apenas parceiros com status 'active' no CRM — usado em Campanhas, Cortesias, Monitoramento
export async function getParceirosAtivos() {
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  const todos = data || []
  if (!todos.length) return []
  try {
    const { data: statusData, error: se } = await supabase
      .from('parceiro_status_atual')
      .select('partner_id, status')
      .in('partner_id', todos.map(p=>p.id))
    if (se) return todos
    const statusMap = {}
    for (const s of (statusData||[])) {
      statusMap[s.partner_id] = s.status
    }
    const ativos = todos.filter(p => statusMap[p.id] === 'active')
    return ativos.length > 0 ? ativos : todos
  } catch {
    return todos
  }
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

  // Busca todos os parceiros
  const { data: parceiros, error: pe } = await supabase
    .from('parceiros').select('*').order('nome')
  if (pe) throw pe

  // Busca campanha_parceiros — sem join complexo
  const { data: cps, error: ce } = await supabase
    .from('campanha_parceiros')
    .select('id, parceiro_id, status, campanha_id')
    .in('status', STATUS_VALIDOS)
  if (ce) throw ce

  // Busca lancamento_parceiros — sem join complexo
  const { data: lps, error: le } = await supabase
    .from('lancamento_parceiros')
    .select('id, parceiro_id, status, data_combinada, lancamento_livro_id')
    .in('status', STATUS_VALIDOS)
  if (le) throw le

  // Agrupa por parceiro
  const porParceiro = {}

  for (const cp of (cps || [])) {
    if (!cp.parceiro_id) continue
    if (!porParceiro[cp.parceiro_id]) porParceiro[cp.parceiro_id] = { normais: [], lancamentos: [] }
    porParceiro[cp.parceiro_id].normais.push(cp)
  }

  // Para lancamentos, agrupa por parceiro evitando duplicar a mesma campanha
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

  // Normaliza todas as participações
  const todas = [
    ...normais.filter(cp => STATUS_VALIDOS.includes(cp.status)).map(cp => ({
      status: cp.status, dataRef: cp._dataRef || null,
    })),
    ...lancamentos.filter(lp => STATUS_VALIDOS.includes(lp.status)).map(lp => ({
      status: lp.status, dataRef: lp._dataRef || null,
    }))
  ]

  if (todas.length === 0) return null

  // ── DIMENSÃO 1: CONFIABILIDADE (50%) ──────────────────────
  // Quando confirmou/agendou/publicou, cumpriu?
  const comprometidos = todas.filter(p => ['confirmado','agendado','publicado'].includes(p.status)).length
  const publicados    = todas.filter(p => p.status === 'publicado').length
  const confiabilidade = comprometidos > 0 ? publicados / comprometidos : 0

  // ── DIMENSÃO 2: COMPROMETIMENTO (30%) ─────────────────────
  // Quando entrei em contato, deu retorno (mesmo recusando)?
  const comRetorno = todas.filter(p => p.status !== 'sem_retorno').length
  const comprometimento = todas.length > 0 ? comRetorno / todas.length : 0

  // ── DIMENSÃO 3: RECORRÊNCIA (20%) ─────────────────────────
  // Quantos meses distintos publicou / total de meses no histórico
  const mesesComPublicacao = new Set(
    todas.filter(p => p.status === 'publicado' && mesAno(p.dataRef))
         .map(p => mesAno(p.dataRef))
  )
  const todosOsMeses = new Set(
    todas.filter(p => mesAno(p.dataRef)).map(p => mesAno(p.dataRef))
  )
  const recorrencia = todosOsMeses.size > 0 ? mesesComPublicacao.size / todosOsMeses.size : 0

  // ── NOTA FINAL ────────────────────────────────────────────
  const notaBruta = (confiabilidade * 0.5 + comprometimento * 0.3 + recorrencia * 0.2) * 10
  const notaFinal = Math.round(notaBruta * 10) / 10

  // ── NOTA MENSAL ───────────────────────────────────────────
  // Mesma lógica das 3 dimensões aplicada só aos dados do mês
  const porMes = {}
  for (const p of todas) {
    const m = mesAno(p.dataRef)
    if (!m) continue
    if (!porMes[m]) porMes[m] = []
    porMes[m].push(p)
  }
  const notasMensais = {}
  for (const [m, parts] of Object.entries(porMes)) {
    // Confiabilidade do mês (50%): publicou ÷ (confirmados+agendados+publicados)
    const compMes = parts.filter(p => ['confirmado','agendado','publicado'].includes(p.status)).length
    const pubMes  = parts.filter(p => p.status === 'publicado').length
    const confMes = compMes > 0 ? pubMes / compMes : 0

    // Comprometimento do mês (30%): deu retorno ÷ total de contatos no mês
    const retMes  = parts.filter(p => p.status !== 'sem_retorno').length / parts.length

    // Recorrência do mês (20%): publicou neste mês = 100%, não publicou = 0%
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
  // Criptografa o CPF se fornecido
  if (cpf && cpf.trim()) {
    await supabase.rpc('salvar_cpf_parceiro', { p_id: data.id, p_cpf: cpf.trim() })
  }
  return data
}
export async function updateParceiro(id, updates) {
  const { cpf, ...rest } = updates
  const { data, error } = await supabase.from('parceiros').update(rest).eq('id', id).select().single()
  if (error) throw error
  // Atualiza CPF criptografado se veio no payload
  if (cpf !== undefined) {
    await supabase.rpc('salvar_cpf_parceiro', { p_id: id, p_cpf: cpf?.trim() || null })
  }
  return data
}
export async function deleteParceiro(id) {
  const { error } = await supabase.from('parceiros').delete().eq('id', id)
  if (error) throw error
}

// ── LIVROS ─────────────────────────────────────────────────
export async function getLivros({ page = 0, pageSize = 50, search = '' } = {}) {
  let query = supabase.from('livros').select('*', { count: 'exact' }).order('titulo')

  if (search && search.trim()) {
    const s = search.trim()
    query = query.or(`titulo.ilike.%${s}%,autor.ilike.%${s}%,isbn.ilike.%${s}%,sku.ilike.%${s}%`)
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await query
  if (error) { console.error('getLivros error:', error); throw error }
  return { data: data || [], count: count || 0 }
}
export async function createLivro(l) {
  const { data, error } = await supabase.from('livros').insert([l]).select().single()
  if (error) throw error
  return data
}
export async function updateLivro(id, updates) {
  const { data, error } = await supabase.from('livros').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteLivro(id) {
  const { error } = await supabase.from('livros').delete().eq('id', id)
  if (error) throw error
}

// ── ENVIOS (com múltiplos livros via envio_livros) ─────────
export async function getEnvios() {
  // 1. Busca envios + parceiros
  const { data: envios, error } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  if (!envios || envios.length === 0) return []

  // 2. Busca TODOS os envio_livros de uma vez (evita o limite de 5 por relação aninhada)
  const envioIds = envios.map(e => e.id)
  const { data: todosLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, envio_id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .in('envio_id', envioIds)
    .limit(5000)
  if (livrosError) throw livrosError

  // 3. Agrupa os livros por envio_id
  const livrosPorEnvio = {}
  for (const el of (todosLivros || [])) {
    if (!livrosPorEnvio[el.envio_id]) livrosPorEnvio[el.envio_id] = []
    livrosPorEnvio[el.envio_id].push(el)
  }

  // 4. Junta tudo
  return envios.map(e => ({ ...e, envio_livros: livrosPorEnvio[e.id] || [] }))
}

export async function getEnvioCompleto(id) {
  // Busca envio principal + parceiro
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .select('*, parceiros(id, nome, tipo_parceria)')
    .eq('id', id)
    .single()
  if (envioError) throw envioError

  // Busca envio_livros separadamente para contornar o limite de 5 do Supabase
  const { data: envioLivros, error: livrosError } = await supabase
    .from('envio_livros')
    .select('id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku)')
    .eq('envio_id', id)
    .limit(200)
  if (livrosError) throw livrosError

  return { ...envio, envio_livros: envioLivros || [] }
}

export async function createEnvio({ parceiro_id, status, data_envio, observacoes, livro_ids }) {
  // 1. Cria o envio principal
  const { data: envio, error: envioError } = await supabase
    .from('envios')
    .insert([{ parceiro_id, status, data_envio, observacoes }])
    .select(`*, parceiros(id, nome, tipo_parceria)`)
    .single()
  if (envioError) throw envioError

  // 2. Vincula os livros
  if (livro_ids && livro_ids.length > 0) {
    const linhas = livro_ids.map(livro_id => ({ envio_id: envio.id, livro_id }))
    const { error: livrosError } = await supabase.from('envio_livros').insert(linhas)
    if (livrosError) throw livrosError
  }

  // 3. Retorna o envio com livros
  const { data: completo, error: fetchError } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', envio.id)
    .single()
  if (fetchError) throw fetchError
  return completo
}

export async function updateEnvio(id, { parceiro_id, status, data_envio, observacoes, livro_ids }) {
  // 1. Atualiza dados do envio
  const { error: envioError } = await supabase
    .from('envios')
    .update({ parceiro_id, status, data_envio, observacoes })
    .eq('id', id)
  if (envioError) throw envioError

  // 2. Substitui os livros se foram passados
  if (livro_ids) {
    await supabase.from('envio_livros').delete().eq('envio_id', id)
    if (livro_ids.length > 0) {
      const linhas = livro_ids.map(livro_id => ({ envio_id: id, livro_id }))
      const { error } = await supabase.from('envio_livros').insert(linhas)
      if (error) throw error
    }
  }

  // 3. Retorna o envio atualizado
  const { data, error } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateEnvioStatus(id, status) {
  const { error } = await supabase.from('envios').update({ status }).eq('id', id)
  if (error) throw error
  const { data, error: fetchError } = await supabase
    .from('envios')
    .select(`*, parceiros(id, nome, tipo_parceria), envio_livros(id, divulgado, data_divulgacao, livros(id, titulo, autor, isbn, sku))`)
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  return data
}

export async function deleteEnvio(id) {
  const { error } = await supabase.from('envios').delete().eq('id', id)
  if (error) throw error
}

// ── STATS ──────────────────────────────────────────────────
export async function getStats() {
  const [parceiros, livros, envios] = await Promise.all([
    supabase.from('parceiros').select('id', { count: 'exact', head: true }),
    supabase.from('livros').select('id', { count: 'exact', head: true }),
    supabase.from('envios').select('status'),
  ])
  const enviosData = envios.data || []
  return {
    totalParceiros: parceiros.count || 0,
    totalLivros: livros.count || 0,
    totalEnvios: enviosData.length,
    confirmados: enviosData.filter(e => e.status === 'divulgado').length,
    pendentes: enviosData.filter(e => e.status === 'enviado').length,
  }
}

// ── DIVULGAÇÃO POR LIVRO ───────────────────────────────────
export async function updateEnvioLivroDivulgacao(envioLivroId, { divulgado, data_divulgacao }) {
  const { error } = await supabase
    .from('envio_livros')
    .update({ divulgado, data_divulgacao: data_divulgacao || null })
    .eq('id', envioLivroId)
  if (error) throw error
}

// ── CAMPANHAS ──────────────────────────────────────────────
export async function getCampanhas() {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`
      *,
      campanha_livros(id, livros(id, titulo, autor, editora)),
      campanha_parceiros(id, status, parceiros(id, nome, tipo_parceria)),
      lancamento_livros(id, lancamento_parceiros(id, status))
    `)
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
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

export async function createCampanha({ nome, tipo, status, data_inicio, data_fim, descricao, livro_ids = [], adicionar_lancamentos_auto = false }) {
  const { data: campanha, error } = await supabase
    .from('campanhas')
    .insert([{ nome, tipo, status, data_inicio, data_fim, descricao }])
    .select().single()
  if (error) throw error

  let autoAdicionados = 0

  if (adicionar_lancamentos_auto && (tipo === 'Lançamento' || tipo === 'Geral' || tipo === 'Book Time') && data_inicio && data_fim) {
    // Busca livros com data_lancamento dentro do range (somente se checkbox ativado)
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
    // Para outros tipos, usa campanha_livros normalmente
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


// ── REORDENAÇÃO DE CAMPANHAS ───────────────────────────────
export async function reordenarCampanhas(ordens) {
  // ordens = [{ id, ordem }]
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

// ── FOLLOW-UP / CONTATO ────────────────────────────────────
export async function getFollowUps() {
  // Busca campanhas em planejamento ou em_andamento com data_inicio definida
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

// ── DIVULGAÇÕES DE CAMPANHA ────────────────────────────────
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

// ── LANÇAMENTOS ────────────────────────────────────────────
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

// ── LANÇAMENTOS (calendário) ───────────────────────────────
export async function getLivrosLancamento({ ano, mes } = {}) {
  let q = supabase
    .from('livros')
    .select('id, titulo, autor, editora, isbn, sku, data_lancamento')
    .not('data_lancamento', 'is', null)
    .order('data_lancamento', { ascending: true })
  if (ano && mes) {
    const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
    // Calcula o último dia real do mês (evita fevereiro-31 que quebra o Postgres)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    q = q.gte('data_lancamento', ini).lte('data_lancamento', fim)
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function importarLancamentos(livros) {
  // Upsert por ISBN (atualiza se existir, cria se não existir)
  const rows = livros.map(l => ({
    titulo:          l.titulo,
    autor:           l.autor || null,
    editora:         l.editora || null,
    // Garante string limpa (ISBN pode vir como número do Excel)
    isbn:            l.isbn ? String(l.isbn).replace(/\.0$/, '').trim() : null,
    sku:             l.sku  ? String(l.sku).replace(/\.0$/, '').trim()  : null,
    data_lancamento: l.data_lancamento || null,
  }))
  // Separate: update existing by isbn/sku, insert new ones
  const results = { atualizados: 0, criados: 0, erros: [] }
  for (const row of rows) {
    try {
      const isbnStr = row.isbn ? String(row.isbn).replace(/\.0$/, '').trim() : null
      const skuStr  = row.sku  ? String(row.sku).replace(/\.0$/, '').trim()  : null
      // Salva sempre com string limpa
      row.isbn = isbnStr
      row.sku  = skuStr

      let existing = null
      // 1. Busca por ISBN
      if (isbnStr) {
        const { data } = await supabase.from('livros').select('id').eq('isbn', isbnStr).maybeSingle()
        existing = data
      }
      // 2. Busca por SKU
      if (!existing && skuStr) {
        const { data } = await supabase.from('livros').select('id').eq('sku', skuStr).maybeSingle()
        existing = data
      }
      // 3. Busca por título + data (evita duplicatas sem ISBN)
      if (!existing && row.titulo && row.data_lancamento) {
        const { data } = await supabase.from('livros').select('id')
          .ilike('titulo', row.titulo.trim())
          .eq('data_lancamento', row.data_lancamento)
          .maybeSingle()
        existing = data
      }
      // 4. Busca só por título (pega cadastros antigos sem data)
      if (!existing && row.titulo) {
        const { data } = await supabase.from('livros').select('id')
          .ilike('titulo', row.titulo.trim())
          .maybeSingle()
        existing = data
      }
      if (existing) {
        const { error: updErr } = await supabase.from('livros').update(row).eq('id', existing.id)
        if (updErr) throw updErr
        results.atualizados++
      } else {
        const { error: insErr } = await supabase.from('livros').insert([row])
        if (insErr) throw insErr
        results.criados++
      }
    } catch(e) {
      results.erros.push(`${row.titulo || 'desconhecido'}: ${e?.message || e}`)
    }
  }
  return results
}

// ── TAREFAS ────────────────────────────────────────────────
export async function getTarefas() {
  const { data, error } = await supabase
    .from('tarefas')
    .select(`*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome),
      tarefa_checklist(id, texto, concluido, ordem),
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome)),
      tarefa_livros(id, livros(id, titulo, autor, isbn))`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTarefa(payload) {
  const { data, error } = await supabase
    .from('tarefas')
    .insert([payload])
    .select(`*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome),
      tarefa_checklist(id, texto, concluido, ordem),
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome)),
      tarefa_livros(id, livros(id, titulo, autor, isbn))`)
    .single()
  if (error) throw error
  return data
}

export async function updateTarefa(id, updates) {
  const { data, error } = await supabase
    .from('tarefas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`*, responsavel:responsavel_id(id, nome), criador:created_by(id, nome),
      tarefa_checklist(id, texto, concluido, ordem),
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome)),
      tarefa_livros(id, livros(id, titulo, autor, isbn))`)
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

// ── TAREFA ↔ LIVROS ────────────────────────────────────────
export async function addLivroTarefa(tarefa_id, livro_id) {
  // Evita duplicata silenciosamente
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

export async function buscarLivroPorISBN(isbn) {
  const isbnLimpo = String(isbn || '').replace(/[^0-9]/g, '').trim()
  if (!isbnLimpo) return null
  const { data } = await supabase
    .from('livros')
    .select('id, titulo, autor, isbn')
    .eq('isbn', isbnLimpo)
    .maybeSingle()
  return data
}

// ── IMPORTAÇÃO DE TAREFAS VIA PLANILHA ─────────────────────
// Importa tarefas em lote, registrando o lote em import_batches.
// Retorna { batchId, criadas, livrosVinculados }
export async function importarTarefasLote({ tarefas, ignoradas, filename, userId }) {
  if (!userId) throw new Error('Usuário não autenticado')
  if (!tarefas || tarefas.length === 0) throw new Error('Nenhuma tarefa válida para importar')

  // 1. Cria o registro do lote primeiro (precisamos do batch_id para vincular nas tarefas)
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

  // 2. Prepara as tarefas para insert (sem livros, esses serão vinculados depois)
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

  // 3. Insere todas as tarefas em uma chamada
  const { data: tarefasCriadas, error: insertError } = await supabase
    .from('tarefas')
    .insert(tarefasParaInserir)
    .select('id')
  if (insertError) throw insertError

  // 4. Vincula livros (se houver) — uma linha por (tarefa, livro)
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
      // Não falha a importação inteira por causa de livros — só registra
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

// Desfaz uma importação: apaga todas as tarefas do lote (em até 24h).
// Apenas quem importou pode desfazer.
export async function desfazerImportacao(batchId) {
  // 1. Busca o lote
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .single()
  if (batchError) throw batchError
  if (!batch) throw new Error('Lote não encontrado')

  // 2. Verifica janela de 24h
  const importadoEm = new Date(batch.imported_at)
  const agora = new Date()
  const horasPassadas = (agora - importadoEm) / (1000 * 60 * 60)
  if (horasPassadas > 24) {
    throw new Error('Janela de 24 horas para desfazer já expirou')
  }

  if (batch.undone_at) {
    throw new Error('Este lote já foi desfeito')
  }

  // 3. Apaga todas as tarefas do lote (CASCADE remove tarefa_livros automaticamente)
  const { error: deleteError } = await supabase
    .from('tarefas')
    .delete()
    .eq('import_batch_id', batchId)
  if (deleteError) throw deleteError

  // 4. Marca o lote como desfeito
  const { error: updateError } = await supabase
    .from('import_batches')
    .update({
      undone_at: new Date().toISOString(),
    })
    .eq('id', batchId)
  if (updateError) throw updateError

  return { ok: true }
}

// Busca os lotes de importação recentes do usuário (últimas 24h)
// Útil para mostrar o botão "Desfazer importação" enquanto a janela ainda está aberta
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

// ── EDITORAS ───────────────────────────────────────────────
export async function getEditoras() {
  // Busca todas as editoras únicas — usa paginação para garantir que busca além do limite de 1000
  let todas = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('livros')
      .select('editora')
      .not('editora', 'is', null)
      .neq('editora', '')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    todas = todas.concat(data.map(l => l.editora).filter(Boolean))
    if (data.length < pageSize) break
    page++
  }
  return [...new Set(todas)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
// ── MONITORAMENTO ──────────────────────────────────────────
export async function getRegistrosMonitoramento({ ano, mes } = {}) {
  const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
  const { data, error } = await supabase
    .from('monitoramento')
    .select('*, parceiros(id, nome)')
    .gte('data', ini).lte('data', fim)
    .order('data', { ascending: true })
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

// ── MONITORAMENTO — LANÇAMENTOS ────────────────────────────
// Retorna lancamento_parceiros com data_combinada no mês para integração com Monitoramento
export async function getLancamentosMonitoramento({ ano, mes } = {}) {
  const ini = `${ano}-${String(mes).padStart(2,'0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`

  // Busca divulgações de Lançamento/Geral (lancamento_parceiros)
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

  // Busca IDs das campanhas do tipo Promoção
  const { data: campPromo } = await supabase
    .from('campanhas')
    .select('id, nome')
    .eq('tipo', 'Promoção')

  const campPromoIds = (campPromo || []).map(c => c.id)
  const campPromoMap = Object.fromEntries((campPromo || []).map(c => [c.id, c.nome]))

  let promNorm = []
  if (campPromoIds.length > 0) {
    // Busca campanha_parceiros dessas campanhas
    const { data: cpData } = await supabase
      .from('campanha_parceiros')
      .select('id, campanha_id, parceiros(id, nome)')
      .in('campanha_id', campPromoIds)

    const cpIds = (cpData || []).map(cp => cp.id)
    const cpMap = Object.fromEntries((cpData || []).map(cp => [cp.id, cp]))

    if (cpIds.length > 0) {
      // Busca divulgações desses campanha_parceiros no mês
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

// ── IMPORTAR DIVULGAÇÕES PROMOÇÃO POR PLANILHA ─────────────
// Planilha: coluna Parceiro + coluna ISBN → cria divulgações para cada parceiro
export async function importarDivulgacoesPromocao(campanhaId, rows) {
  // rows = [{ parceiro_nome, isbn, tipo, origem, data_divulgacao }]
  const results = { criados: 0, erros: [] }

  // Busca todos os campanha_parceiros da campanha
  const { data: cps } = await supabase
    .from('campanha_parceiros')
    .select('id, parceiro_id, parceiros(id, nome)')
    .eq('campanha_id', campanhaId)

  // Busca livros pelos ISBNs
  const isbns = [...new Set(rows.map(r => r.isbn).filter(Boolean))]
  const livrosMap = {}
  for (const isbn of isbns) {
    const { data } = await supabase.from('livros').select('id, titulo, isbn').eq('isbn', isbn).maybeSingle()
    if (data) livrosMap[isbn] = data
  }

  for (const row of rows) {
    try {
      // Encontra o campanha_parceiro pelo nome do parceiro
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

// ── LIVROS DESTAQUE POR PARCEIRO NA CAMPANHA ───────────────
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
  // Evita duplicata
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
  // isbns = string[] de ISBNs vindos da planilha
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

// ── CRM DE INFLUENCERS ─────────────────────────────────────

export async function createParceiroCRM(payload, statusInicial = 'prospected') {
  // Cria o parceiro
  const { data, error } = await supabase
    .from('parceiros')
    .insert([payload])
    .select('*')
    .single()
  if (error) throw error
  // Adiciona status inicial no histórico
  await addStatusHistory(data.id, statusInicial, 'Parceiro cadastrado via CRM')
  return data
}

export async function getCRMParceiros() {
  const { data, error } = await supabase
    .from('parceiros')
    .select('*, responsavel_interno:usuarios!responsavel_interno_id(id, nome)')
    .order('nome')
  if (error) throw error

  const ids = (data||[]).map(p=>p.id)
  if (!ids.length) return []

  // Usa a view que retorna o status mais recente de cada parceiro sem ambiguidade
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

// ── DIVULGAÇÕES DA LIVRARIA (campanha Geral) ───────────────
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

// ── DASHBOARD STATS ────────────────────────────────────────
export async function getDashboardStats({ dataInicio, dataFim, tipoCampanha, origem } = {}) {
  // Parceiros — filtro por data de cadastro (created_at)
  let qParceiros = supabase.from('parceiros').select('*', { count: 'exact', head: true })
  if (dataInicio) qParceiros = qParceiros.gte('created_at', dataInicio)
  if (dataFim)    qParceiros = qParceiros.lte('created_at', dataFim + 'T23:59:59')
  const { count: totalParceiros } = await qParceiros

  // Campanhas — filtro por data_inicio da campanha
  let qCampanhas = supabase.from('campanhas').select('*', { count: 'exact', head: true })
  if (dataInicio) qCampanhas = qCampanhas.gte('data_inicio', dataInicio)
  if (dataFim)    qCampanhas = qCampanhas.lte('data_inicio', dataFim)
  if (tipoCampanha) qCampanhas = qCampanhas.eq('tipo', tipoCampanha)
  const { count: totalCampanhas } = await qCampanhas

  // Divulgações lançamento/geral
  let qLP = supabase.from('lancamento_parceiros').select('id, status, origem, data_divulgacao').eq('status', 'publicado')
  if (dataInicio) qLP = qLP.gte('data_divulgacao', dataInicio)
  if (dataFim)    qLP = qLP.lte('data_divulgacao', dataFim)
  if (origem)     qLP = origem === 'organica' ? qLP.eq('origem','organica') : qLP.neq('origem','organica')
  const { data: lpData } = await qLP

  // Divulgações promoção
  let qCP = supabase.from('campanha_parceiros').select('id, status, origem, campanhas(tipo)').eq('status','publicado')
  if (origem)     qCP = origem === 'organica' ? qCP.eq('origem','organica') : qCP.neq('origem','organica')
  const { data: cpData } = await qCP

  // Divulgações livraria
  let qDL = supabase.from('divulgacoes_livraria').select('id, origem, data_divulgacao')
  if (dataInicio) qDL = qDL.gte('data_divulgacao', dataInicio)
  if (dataFim)    qDL = qDL.lte('data_divulgacao', dataFim)
  if (origem)     qDL = origem === 'organica' ? qDL.eq('origem','organica') : qDL.neq('origem','organica')
  const { data: dlData } = await qDL

  const lpPublicados = lpData || []
  const cpPublicados = cpData || []
  const dlAll        = dlData || []

  // Aplica filtro de tipoCampanha nas divulgações também
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

  // Parceiros por tipo e nível (para filtros)
  const { data: parceirosRaw } = await supabase.from('parceiros').select('id, tipo_parceria, status')
  const parcs = parceirosRaw || []
  const parceirosPorTipo   = parcs.reduce((a,p)=>{ const t=p.tipo_parceria||'Sem tipo'; a[t]=(a[t]||0)+1; return a },{})
  const parceirosPorStatus = parcs.reduce((a,p)=>{ const s=p.status||'ativo'; a[s]=(a[s]||0)+1; return a },{})

  // Campanhas por tipo e status (para filtros)
  const { data: campanhasRaw } = await supabase.from('campanhas').select('id, tipo, status')
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

// ── CRM LITERÁRIO ─────────────────────────────────────────────

export async function getLivrosCRM(mes, ano) {
  let q = supabase.from('livros_crm').select('*').eq('ativo', true).order('titulo')
  if (mes) q = q.eq('mes', mes)
  if (ano) q = q.eq('ano', ano)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createLivroCRM(payload) {
  const { data, error } = await supabase
    .from('livros_crm').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateLivroCRM(id, updates) {
  const { data, error } = await supabase
    .from('livros_crm').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function getContatosCRM({ search, nicho } = {}) {
  let q = supabase.from('contatos_crm').select('*').order('nome')
  if (nicho) q = q.eq('nicho', nicho)
  if (search) q = q.or(`nome.ilike.%${search}%,handle.ilike.%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createContatoCRM(payload) {
  const { data, error } = await supabase
    .from('contatos_crm').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateContatoCRM(id, updates) {
  const { data, error } = await supabase
    .from('contatos_crm').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function getCampanhaLiteraria(livro_id) {
  const { data, error } = await supabase
    .from('campanha_literaria')
    .select('*, contato:contatos_crm(*)')
    .eq('livro_id', livro_id)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function addContatosCampanha(livro_id, contato_ids) {
  const rows = contato_ids.map(contato_id => ({ livro_id, contato_id, status: 'encontrado' }))
  const { data, error } = await supabase
    .from('campanha_literaria').insert(rows).select('*, contato:contatos_crm(*)')
  if (error) throw error
  return data || []
}

export async function updateStatusCampanha(id, status, nota) {
  const updates = { status }
  if (nota !== undefined) updates.nota = nota
  const { data, error } = await supabase
    .from('campanha_literaria').update(updates).eq('id', id)
    .select('*, contato:contatos_crm(*)').single()
  if (error) throw error
  return data
}

export async function bulkUpdateStatusCampanha(ids, status) {
  const { data, error } = await supabase
    .from('campanha_literaria').update({ status }).in('id', ids).select('id, status')
  if (error) throw error
  return data || []
}

export async function removeContatoCampanha(id) {
  const { error } = await supabase.from('campanha_literaria').delete().eq('id', id)
  if (error) throw error
}

// ── CRM LITERÁRIO — DIVULGADORES ──────────────────────────────

export async function getDivulgadores({ search, tipo } = {}) {
  let q = supabase.from('divulgadores').select('*').order('nome')
  if (tipo) q = q.eq('tipo_parceria', tipo)
  if (search) q = q.or(`nome.ilike.%${search}%,username.ilike.%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createDivulgador(payload) {
  const { data, error } = await supabase
    .from('divulgadores').insert([payload]).select('*').single()
  if (error) throw error
  return data
}

export async function updateDivulgador(id, updates) {
  const { data, error } = await supabase
    .from('divulgadores').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

// ── CRM LITERÁRIO — DIVULGAÇÃO POR LIVRO ─────────────────────

export async function getDivulgacaoLivro(livro_id) {
  const { data, error } = await supabase
    .from('divulgacao_livro')
    .select('*, divulgador:divulgadores(*)')
    .eq('livro_id', livro_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addDivulgadoresLivro(livro_id, divulgador_ids) {
  const rows = divulgador_ids.map(divulgador_id => ({
    livro_id, divulgador_id, status: 'encontrado'
  }))
  const { data, error } = await supabase
    .from('divulgacao_livro').insert(rows)
    .select('*, divulgador:divulgadores(*)')
  if (error) throw error
  return data || []
}

export async function updateDivulgacaoStatus(id, status, nota) {
  const updates = { status }
  if (nota !== undefined) updates.nota = nota
  const { data, error } = await supabase
    .from('divulgacao_livro').update(updates).eq('id', id)
    .select('*, divulgador:divulgadores(*)').single()
  if (error) throw error
  return data
}

export async function bulkUpdateDivulgacao(ids, status) {
  const { data, error } = await supabase
    .from('divulgacao_livro').update({ status }).in('id', ids).select('id, status')
  if (error) throw error
  return data || []
}

export async function removeDivulgacaoLivro(id) {
  const { error } = await supabase.from('divulgacao_livro').delete().eq('id', id)
  if (error) throw error
}

// Busca ou cria parceiro na tabela parceiros baseado no divulgador
// Evita duplicatas verificando username ou nome
export async function vincularDivulgadorComoParceiro(divulgador) {
  // Tenta encontrar parceiro existente por username ou nome
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
  // Se não existe, cria
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
  // Atualiza divulgador com referência ao parceiro
  await supabase.from('divulgadores')
    .update({ parceiro_id: parceiro.id })
    .eq('id', divulgador.id)
  return parceiro
}
