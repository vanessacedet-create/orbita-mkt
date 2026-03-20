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

// ── PARCEIROS ──────────────────────────────────────────────
export async function getParceiros() {
  const { data, error } = await supabase.from('parceiros').select('*').order('nome')
  if (error) throw error
  return data
}

// ── PONTUAÇÃO DE PARCEIROS ─────────────────────────────────
export async function getParceirosComPontuacao() {
  // Busca todos os parceiros
  const { data: parceiros, error: pe } = await supabase
    .from('parceiros').select('*').order('nome')
  if (pe) throw pe

  // Busca campanha_parceiros com dados necessários para scoring
  const { data: cps, error: ce } = await supabase
    .from('campanha_parceiros')
    .select(`
      id, parceiro_id, status, data_contato, contato_realizado,
      campanhas(id, nome, data_inicio, status)
    `)
    .not('campanhas', 'is', null)
    .in('status', ['publicado','nao_publicou','confirmado','recusou','sem_retorno'])
  if (ce) throw ce

  // Agrupa campanha_parceiros por parceiro
  const cpsPorParceiro = {}
  for (const cp of cps) {
    if (!cpsPorParceiro[cp.parceiro_id]) cpsPorParceiro[cp.parceiro_id] = []
    cpsPorParceiro[cp.parceiro_id].push(cp)
  }

  return parceiros.map(p => ({
    ...p,
    pontuacao: calcularPontuacao(cpsPorParceiro[p.id] || [])
  }))
}

function calcularPontuacao(participacoes) {
  // Ignora campanhas ainda em aberto (convidado)
  const validas = participacoes.filter(cp =>
    ['publicado','nao_publicou','confirmado','recusou','sem_retorno'].includes(cp.status)
  )
  if (validas.length === 0) return null

  // Nota por campanha
  function notaCampanha(cp) {
    let nota = 0
    switch (cp.status) {
      case 'publicado':    nota = 10; break
      case 'confirmado':   nota = 5;  break
      case 'sem_retorno':  nota = 3;  break
      case 'recusou':      nota = 2;  break
      case 'nao_publicou': nota = 0;  break
      default:             nota = 0
    }
    // Bônus de rapidez: confirmou em até 3 dias da data_inicio da campanha
    if (cp.status === 'publicado' && cp.data_contato && cp.campanhas?.data_inicio) {
      const diasAteContato = Math.abs(
        (new Date(cp.data_contato) - new Date(cp.campanhas.data_inicio)) / 86400000
      )
      if (diasAteContato <= 3) nota = Math.min(10, nota + 1)
    }
    return nota
  }

  // Ordena por data_inicio da campanha (mais recente primeiro)
  const ordenadas = [...validas].sort((a, b) => {
    const da = a.campanhas?.data_inicio || '0000-00-00'
    const db = b.campanhas?.data_inicio || '0000-00-00'
    return db.localeCompare(da)
  })

  // Pesos: mais recente = 2x, segunda = 1.5x, demais = 1x
  const pesos = ordenadas.map((_, i) => i === 0 ? 2 : i === 1 ? 1.5 : 1)
  const somaPesos = pesos.reduce((a, b) => a + b, 0)
  const somaNotas = ordenadas.reduce((acc, cp, i) => acc + notaCampanha(cp) * pesos[i], 0)

  const media = somaNotas / somaPesos
  const notaFinal = Math.round(media * 10) / 10

  // Bônus de constância: +0.5 se publicou em 3+ campanhas
  const publicadas = validas.filter(cp => cp.status === 'publicado').length
  const comBonus = publicadas >= 3 ? Math.min(10, notaFinal + 0.5) : notaFinal

  return {
    nota: Math.round(comBonus * 10) / 10,
    totalCampanhas: validas.length,
    publicadas,
    nivel: comBonus >= 8 ? 'ouro' : comBonus >= 6 ? 'prata' : comBonus >= 4 ? 'bronze' : 'atencao'
  }
}

export async function createParceiro(p) {
  const { data, error } = await supabase.from('parceiros').insert([p]).select().single()
  if (error) throw error
  return data
}
export async function updateParceiro(id, updates) {
  const { data, error } = await supabase.from('parceiros').update(updates).eq('id', id).select().single()
  if (error) throw error
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
      campanha_parceiros(id, status, data_inicio, data_fim, data_publicacao_combinada, link_publicacao, curtidas, visualizacoes, observacoes, parceiros(id, nome, tipo_parceria))
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCampanha({ nome, tipo, status, data_inicio, data_fim, descricao, livro_ids = [] }) {
  const { data: campanha, error } = await supabase
    .from('campanhas')
    .insert([{ nome, tipo, status, data_inicio, data_fim, descricao }])
    .select().single()
  if (error) throw error
  if (livro_ids.length > 0) {
    const { error: le } = await supabase.from('campanha_livros').insert(livro_ids.map(livro_id => ({ campanha_id: campanha.id, livro_id })))
    if (le) throw le
  }
  return getCampanha(campanha.id)
}

export async function updateCampanha(id, { nome, tipo, status, data_inicio, data_fim, descricao, livro_ids }) {
  const { error } = await supabase.from('campanhas').update({ nome, tipo, status, data_inicio, data_fim, descricao }).eq('id', id)
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
    .select('id, livro_id, livros(id, titulo, autor, isbn, sku), lancamento_parceiros(id, status, data_divulgacao, tipo_divulgacao, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria))')
    .eq('campanha_id', campanha_id)
    .order('created_at', { ascending: true })
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
    .select('id, status, data_divulgacao, tipo_divulgacao, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria)')
    .single()
  if (error) throw error
  return data
}

export async function updateLancamentoParceiro(id, updates) {
  const { data, error } = await supabase
    .from('lancamento_parceiros')
    .update(updates)
    .eq('id', id)
    .select('id, status, data_divulgacao, tipo_divulgacao, link, curtidas, comentarios, visualizacoes, observacoes, parceiro_id, parceiros(id, nome, tipo_parceria)')
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
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome))`)
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
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome))`)
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
      tarefa_comentarios(id, texto, created_at, usuario:usuario_id(id, nome))`)
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
  const { data, error } = await supabase
    .from('livros')
    .select('editora')
    .not('editora', 'is', null)
    .neq('editora', '')
    .order('editora')
  if (error) throw error
  // Return unique editoras
  return [...new Set((data || []).map(l => l.editora).filter(Boolean))].sort()
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
