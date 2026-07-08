import { supabase } from './client'
import { getCheckagemMes } from './monitoramento-editoras'

// ── PIPELINE PADRÃO ────────────────────────────────────────
export const PIPELINE_EDITORAS = [
  { value: 'novo_contato',  label: 'Novo contato',  cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { value: 'em_andamento',  label: 'Em andamento',  cor: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 'negociando',    label: 'Negociando',    cor: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { value: 'ativo',         label: 'Ativo',         cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'pausado',       label: 'Pausado',       cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'sem_retorno',   label: 'Sem retorno',   cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { value: 'recusou',       label: 'Recusou',       cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
]

export const TIPOS_CONTATO = [
  { value: 'editora',     label: 'Parceria Editora'   },
  { value: 'livraria',    label: 'Parceria Livraria'  },
  { value: 'marketplace', label: 'Marketplace'        },
  { value: 'cupom',       label: 'Cupom'              },
]

export const ORIGENS_EDITORAS = [
  { value: 'busca_ativa', label: 'Busca ativa'  },
  { value: 'indicacao',   label: 'Indicação'    },
  { value: 'inbound',     label: 'Inbound'      },
  { value: 'evento',      label: 'Evento'       },
]

export function pipelineInfo(value) {
  return PIPELINE_EDITORAS.find(p => p.value === value) || PIPELINE_EDITORAS[0]
}

// ── CONTATOS / PROSPECÇÃO ──────────────────────────────────

export async function getCRMEditoras() {
  const { data, error } = await supabase
    .from('editoras_crm_contatos')
    .select('*, responsavel:usuarios!responsavel_id(id, nome)')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error

  const ids = (data || []).map(c => c.id)
  if (!ids.length) return []

  const { data: statusData } = await supabase
    .from('editoras_crm_status_history')
    .select('contato_id, status, changed_at')
    .in('contato_id', ids)
    .order('changed_at', { ascending: false })

  const statusMap = {}
  for (const s of (statusData || [])) {
    if (!statusMap[s.contato_id]) statusMap[s.contato_id] = s.status
  }

  return (data || []).map(c => ({
    ...c,
    current_status: statusMap[c.id] || 'novo_contato',
    responsavel_nome: c.responsavel?.nome || null,
  }))
}

export async function createCRMEditora(payload, statusInicial = 'novo_contato') {
  const { data, error } = await supabase
    .from('editoras_crm_contatos')
    .insert([payload])
    .select('*')
    .single()
  if (error) throw error
  await addStatusHistoryEditora(data.id, statusInicial, 'Contato cadastrado via CRM')
  return data
}

export async function updateCRMEditora(id, payload) {
  const { data, error } = await supabase
    .from('editoras_crm_contatos')
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteCRMEditora(id) {
  const { error } = await supabase
    .from('editoras_crm_contatos')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function getStatusHistoryEditora(contato_id) {
  const { data, error } = await supabase
    .from('editoras_crm_status_history')
    .select('*, autor:usuarios!changed_by(id, nome)')
    .eq('contato_id', contato_id)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return (data || []).map(h => ({ ...h, changed_by_nome: h.autor?.nome || null }))
}

export async function addStatusHistoryEditora(contato_id, status, reason, changed_by) {
  const { data, error } = await supabase
    .from('editoras_crm_status_history')
    .insert([{ contato_id, status, reason: reason || null, changed_by: changed_by || null }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ── PARCEIROS ATIVOS ───────────────────────────────────────

export async function getEditorasParceirasAtivas() {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .select('*, selos_editoriais(*)')
    .eq('ativo', true)
    .neq('status_parceria', 'finalizada')
    .order('classificacao', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

export async function getLivrariasParceirasAtivas() {
  const { data, error } = await supabase
    .from('livrarias')
    .select('*, editoras_parceiras(id, nome, classificacao, grupo_id, macro, nicho, sub_nicho)')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

// ── SCORE MENSAL — EDITORAS ────────────────────────────────
// A fórmula de pontos (Vendas 80% / Comunicação 15% / Lançamentos 5%)
// está definida mais abaixo, junto com a de livraria, para ficar fácil
// comparar as duas lado a lado.

export async function getScoreMensalEditoras(editora_id) {
  const { data, error } = await supabase
    .from('editoras_score_mensal')
    .select('*')
    .eq('editora_id', editora_id)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllScoreEditorasMes(ano, mes) {
  const { data, error } = await supabase
    .from('editoras_score_mensal')
    .select('*, editoras_parceiras(id, nome, classificacao)')
    .eq('ano', ano)
    .eq('mes', mes)
  if (error) throw error
  return data || []
}

// Busca o score de editoras para vários meses de uma vez (evita repetir a
// consulta mês a mês quando a tela mostra várias colunas ao mesmo tempo)
export async function getScoreEditorasMeses(mesesAnos) {
  if (!mesesAnos.length) return []
  const filtro = mesesAnos.map(({ ano, mes }) => `and(ano.eq.${ano},mes.eq.${mes})`).join(',')
  const { data, error } = await supabase
    .from('editoras_score_mensal')
    .select('*, editoras_parceiras(id, nome, classificacao)')
    .or(filtro)
  if (error) throw error
  return data || []
}

export async function upsertScoreEditora(editora_id, ano, mes, dados) {
  const score = calcularScoreEditora(dados)
  const classificacao = calcularClassificacaoMensalEditora(dados)
  const { data, error } = await supabase
    .from('editoras_score_mensal')
    .upsert(
      { editora_id, ano, mes, ...dados, score, classificacao, atualizado_em: new Date().toISOString() },
      { onConflict: 'editora_id,ano,mes' }
    )
    .select()
    .single()
  if (error) throw error
  // Espelha na editora a classificação mais recente calculada — mesmo
  // padrão já usado para livraria.
  if (classificacao) {
    await supabase.from('editoras_parceiras').update({ classificacao }).eq('id', editora_id)
  }
  return { ...data, score, classificacao }
}

// Apaga o registro do mês inteiro — usado para "zerar" um mês preenchido errado
export async function deleteScoreEditoraMes(editora_id, ano, mes) {
  const { error } = await supabase
    .from('editoras_score_mensal')
    .delete()
    .eq('editora_id', editora_id).eq('ano', ano).eq('mes', mes)
  if (error) throw error
}

// Apaga o score mensal de TODAS as editoras de um mês de uma vez
export async function deleteScoreEditorasMes(ano, mes) {
  const { error, count } = await supabase
    .from('editoras_score_mensal')
    .delete({ count: 'exact' })
    .eq('ano', ano).eq('mes', mes)
  if (error) throw error
  return count || 0
}

// ── SCORE MENSAL — LIVRARIAS ───────────────────────────────

// Quantas peças por semana cada formato exige — mesmo valor já usado no
// Monitoramento (FREQ_SEMANAL: feed 1x/semana, story 2x/semana).
const FREQ_SEMANAL_PUBLICACAO = { feed: 1, story: 2 }

// Pontos de comunicação mensal — de 0 a 15 (editora)
function pontosComunicacaoEditoraMensal(comunicacao) {
  if (comunicacao === 'sempre')       return 15
  if (comunicacao === 'as_vezes')     return 7
  if (comunicacao === 'nao_responde') return 0
  return 0 // nao_aplica
}

// Faixa de vendas (0 = melhor, 5 = pior) — mesmas faixas usadas como
// referência por Vivi, agora escaladas para o peso de cada perfil.
function faixaVendas(vendas) {
  const v = vendas || 0
  if (v >= 100) return 0
  if (v >= 80)  return 1
  if (v >= 60)  return 2
  if (v >= 40)  return 3
  if (v >= 20)  return 4
  return 5
}
function pontosVendasPorFaixa(vendas, maxPts) {
  return Math.round(maxPts * (5 - faixaVendas(vendas)) / 5)
}

// Faixas de vendas de EDITORA — diferentes das de livraria, editora
// costuma vender em volume bem maior. 8 faixas, 80 pts no topo.
// Observação: o pedido tinha um vão entre 300-499 e 600-999 — assumi que
// a faixa que falta é 500-999 (provável erro de digitação do "500").
function pontosVendasEditora(vendas) {
  const v = vendas || 0
  if (v >= 1500) return 80
  if (v >= 1000) return 75
  if (v >= 500)  return 65
  if (v >= 300)  return 55
  if (v >= 100)  return 40
  if (v >= 50)   return 25
  if (v >= 20)   return 10
  return 0
}

// Publicações (30 pts no total) — feed e story se somam num único total de
// "artes esperadas" e "artes postadas" (cada semana de feed = 1 arte, cada
// semana de story = 2 artes), e o percentual do total cai numa régua de
// 5 degraus. Se só um dos dois formatos se aplica pra essa livraria, a
// conta usa só aquele; se nenhum se aplica, o bloco cai fora (como vendas).
function pontosPublicacoesLivraria(dados) {
  const feedAtivo = !dados.feed_nao_aplica
  const storyAtivo = !dados.story_nao_aplica
  if (!feedAtivo && !storyAtivo) return { total: 0, maxPossivel: 0 }

  let esperado = 0
  let postado = 0
  if (feedAtivo) {
    esperado += (dados.semanas_previstas_feed || 0) * FREQ_SEMANAL_PUBLICACAO.feed
    postado  += (dados.semanas_postou_feed || 0) * FREQ_SEMANAL_PUBLICACAO.feed
  }
  if (storyAtivo) {
    esperado += (dados.semanas_previstas_story || 0) * FREQ_SEMANAL_PUBLICACAO.story
    postado  += (dados.semanas_postou_story || 0) * FREQ_SEMANAL_PUBLICACAO.story
  }

  if (esperado === 0) return { total: 0, maxPossivel: 30 }

  const pct = (postado / esperado) * 100
  let pts
  if (pct >= 80) pts = 30
  else if (pct >= 50) pts = 20
  else if (pct >= 20) pts = 10
  else if (pct >= 5) pts = 5
  else pts = 0

  return { total: pts, maxPossivel: 30 }
}

// ── LIVRARIA: Vendas 70% + Publicações 30% (sem comunicação) ───────
// Calcula pontos obtidos e pontos possíveis para o score mensal de
// livraria — usado tanto pelo score numérico (0-10, exibido no modal)
// quanto pela classificação A-F (percentual sobre os blocos ativos).
function pontosLivrariaMensal(dados) {
  let total = 0
  let maxPossivel = 0

  // Vendas (70 pts)
  if (!dados.vendas_nao_aplica) {
    total += pontosVendasPorFaixa(dados.vendas_livraria, 70)
    maxPossivel += 70
  }

  // Publicações (30 pts, dividido entre feed e story conforme o que se aplica)
  const pub = pontosPublicacoesLivraria(dados)
  total += pub.total
  maxPossivel += pub.maxPossivel

  return { total, maxPossivel }
}

export function calcularScoreLivraria(dados) {
  const { total, maxPossivel } = pontosLivrariaMensal(dados)
  if (maxPossivel === 0) return 0
  return Math.min(10, Math.round((total / maxPossivel) * 10 * 10) / 10)
}

// Classificação A-F mensal — única classificação do sistema (não há mais
// versão trimestral). Retorna null quando nenhum bloco se aplica ainda
// (ex.: mês recém-criado, nada preenchido) — nesse caso quem chama deve
// manter a classificação do mês anterior em vez de sobrescrever com null.
export function calcularClassificacaoMensalLivraria(dados) {
  const { total, maxPossivel } = pontosLivrariaMensal(dados)
  if (maxPossivel === 0) return null
  const pct = (total / maxPossivel) * 100
  return classificacaoPorPct(pct)
}

// ── EDITORA: Vendas 80% + Comunicação 15% + Lançamentos 5% ─────────
// Lançamentos é binário: teve pelo menos 1 lançamento no mês → 5 pts
// cheios; não teve → 0. Não entra publicação (isso é só de livraria).
function pontosEditoraMensal(dados) {
  let total = 0
  let maxPossivel = 0

  // Vendas (80 pts)
  if (!dados.vendas_nao_aplica) {
    total += pontosVendasEditora(dados.vendas_editora)
    maxPossivel += 80
  }

  // Comunicação (15 pts)
  if (dados.comunicacao !== 'nao_aplica') {
    total += pontosComunicacaoEditoraMensal(dados.comunicacao)
    maxPossivel += 15
  }

  // Lançamentos (5 pts) — sempre conta, binário
  total += dados.teve_lancamento ? 5 : 0
  maxPossivel += 5

  return { total, maxPossivel }
}

export function calcularScoreEditora(dados) {
  const { total, maxPossivel } = pontosEditoraMensal(dados)
  if (maxPossivel === 0) return 0
  return Math.min(10, Math.round((total / maxPossivel) * 10 * 10) / 10)
}

export function calcularClassificacaoMensalEditora(dados) {
  const { total, maxPossivel } = pontosEditoraMensal(dados)
  if (maxPossivel === 0) return null
  const pct = (total / maxPossivel) * 100
  return classificacaoPorPct(pct)
}

export async function getScoreMensalLivraria(livraria_id) {
  const { data, error } = await supabase
    .from('livrarias_score_mensal')
    .select('*')
    .eq('livraria_id', livraria_id)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllScoreLivrariasMes(ano, mes) {
  const { data, error } = await supabase
    .from('livrarias_score_mensal')
    .select('*, livrarias(id, nome, editora_id, editoras_parceiras(nome))')
    .eq('ano', ano)
    .eq('mes', mes)
  if (error) throw error
  return data || []
}

// Mesma ideia, mas para livrarias
export async function getScoreLivrariasMeses(mesesAnos) {
  if (!mesesAnos.length) return []
  const filtro = mesesAnos.map(({ ano, mes }) => `and(ano.eq.${ano},mes.eq.${mes})`).join(',')
  const { data, error } = await supabase
    .from('livrarias_score_mensal')
    .select('*, livrarias(id, nome, editora_id, editoras_parceiras(nome))')
    .or(filtro)
  if (error) throw error
  return data || []
}

export async function upsertScoreLivraria(livraria_id, ano, mes, dados) {
  const score = calcularScoreLivraria(dados)
  const classificacao = calcularClassificacaoMensalLivraria(dados)
  const { data, error } = await supabase
    .from('livrarias_score_mensal')
    .upsert(
      { livraria_id, ano, mes, ...dados, score, classificacao, atualizado_em: new Date().toISOString() },
      { onConflict: 'livraria_id,ano,mes' }
    )
    .select()
    .single()
  if (error) throw error
  // Espelha na livraria a classificação mais recente calculada — é o valor
  // usado para colorir/ordenar em Editoras & Livrarias e no Monitoramento.
  if (classificacao) {
    await supabase.from('livrarias').update({ classificacao }).eq('id', livraria_id)
  }
  return { ...data, score, classificacao }
}

// Apaga o registro do mês inteiro — usado para "zerar" um mês preenchido errado
export async function deleteScoreLivrariaMes(livraria_id, ano, mes) {
  const { error } = await supabase
    .from('livrarias_score_mensal')
    .delete()
    .eq('livraria_id', livraria_id).eq('ano', ano).eq('mes', mes)
  if (error) throw error
}

// Apaga o score mensal de TODAS as livrarias de um mês de uma vez —
// útil quando o mês inteiro foi preenchido errado
export async function deleteScoreLivrariasMes(ano, mes) {
  const { error, count } = await supabase
    .from('livrarias_score_mensal')
    .delete({ count: 'exact' })
    .eq('ano', ano).eq('mes', mes)
  if (error) throw error
  return count || 0
}

// ── ATUALIZAÇÃO AUTOMÁTICA (Monitoramento + Promoções) ─────

// Uma semana (segunda-feira) para cada dia útil do mês — usada para agrupar
// o checkagem diário do Monitoramento em contagem de semanas.
function segundaFeiraDe(dataStr) {
  const d = new Date(dataStr + 'T12:00:00')
  const diaSemana = d.getDay()
  const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana
  const seg = new Date(d); seg.setDate(d.getDate() + diffSeg)
  return `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, '0')}-${String(seg.getDate()).padStart(2, '0')}`
}

// Lê o checkagem do Monitoramento do mês e devolve, por livraria (chave =
// editora_id, que é o campo usado no checkagem), quantas semanas eram
// esperadas e quantas tiveram feed/story postados pelo menos uma vez.
async function buscarPublicacoesMes(ano, mes) {
  const registros = await getCheckagemMes({ ano, mes })
  const porChave = {}
  for (const r of registros) {
    if (r.formato !== 'feed' && r.formato !== 'story') continue
    // Semana ainda "pendente" (ninguém conferiu, ou material nunca saiu) não
    // conta nem a favor nem contra — só entram semanas com desfecho definido.
    if (r.status !== 'postou' && r.status !== 'nao_postou') continue
    if (!porChave[r.editora_id]) porChave[r.editora_id] = { feedSemanas: new Set(), feedPostou: new Set(), storySemanas: new Set(), storyPostou: new Set() }
    const semana = segundaFeiraDe(r.data_esperada)
    if (r.formato === 'feed') {
      porChave[r.editora_id].feedSemanas.add(semana)
      if (r.status === 'postou') porChave[r.editora_id].feedPostou.add(semana)
    }
    if (r.formato === 'story') {
      porChave[r.editora_id].storySemanas.add(semana)
      if (r.status === 'postou') porChave[r.editora_id].storyPostou.add(semana)
    }
  }
  const resultado = {}
  for (const [chave, info] of Object.entries(porChave)) {
    resultado[chave] = {
      semanas_previstas_feed: info.feedSemanas.size,
      semanas_postou_feed: info.feedPostou.size,
      semanas_previstas_story: info.storySemanas.size,
      semanas_postou_story: info.storyPostou.size,
    }
  }
  return resultado
}

// Busca as publicações de uma única livraria num mês específico — usada
// pelo botão "Puxar publicações" dentro do modal de score da livraria.
export async function getPublicacoesLivrariaMes(livraria, ano, mes) {
  const mapa = await buscarPublicacoesMes(ano, mes)
  return mapa[livraria.editora_id] || null
}

// Puxa do Monitoramento (publicações) o mês indicado e atualiza a
// classificação de todas as livrarias ativas. Vendas, comunicação e
// observação — preenchidas manualmente — não são mexidas. Promoção não
// entra mais no cálculo do score, então não é mais buscada aqui.
// Pode ser chamada quantas vezes quiser, a qualquer momento, para
// qualquer mês (ano, mes são escolhidos por quem chama, não fixos em hoje).
export async function atualizarClassificacaoMensalLivrarias(ano, mes) {
  const [livrarias, publicacoesPorChave, scoresAtuais] = await Promise.all([
    getLivrariasParceirasAtivas(),
    buscarPublicacoesMes(ano, mes),
    getAllScoreLivrariasMes(ano, mes),
  ])
  const scoreExistente = {}
  for (const s of scoresAtuais) scoreExistente[s.livraria_id] = s

  const resultado = { atualizadas: 0, semDadosNovos: 0, erros: [] }
  for (const l of livrarias) {
    const pub = publicacoesPorChave[l.editora_id]
    const temFeed = pub && pub.semanas_previstas_feed > 0
    const temStory = pub && pub.semanas_previstas_story > 0
    if (!temFeed && !temStory) { resultado.semDadosNovos++; continue }
    try {
      const { id, livraria_id, ano: _a, mes: _m, score, classificacao, criado_em, atualizado_em, livrarias, ...base } = scoreExistente[l.id] || {}
      const dados = { ...base }
      if (temFeed) {
        dados.semanas_previstas_feed = pub.semanas_previstas_feed
        dados.semanas_postou_feed = pub.semanas_postou_feed
        dados.feed_nao_aplica = false
      }
      if (temStory) {
        dados.semanas_previstas_story = pub.semanas_previstas_story
        dados.semanas_postou_story = pub.semanas_postou_story
        dados.story_nao_aplica = false
      }
      await upsertScoreLivraria(l.id, ano, mes, dados)
      resultado.atualizadas++
    } catch (e) {
      resultado.erros.push(`${l.nome}: ${e.message}`)
    }
  }
  return resultado
}

// ── CALENDÁRIO DE PROMOÇÕES ────────────────────────────────

export async function getCalendarioPromocoes() {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createPromocao(payload) {
  const { data, error } = await supabase
    .from('calendario_promocoes')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

// ── SCORE TRIMESTRAL — LIVRARIAS ───────────────────────────

// Faixas de vendas (35 pts)
function pontosVendasLivraria(vendas) {
  if (vendas >= 300) return 35
  if (vendas >= 200) return 28
  if (vendas >= 100) return 21
  if (vendas >= 50)  return 14
  if (vendas >= 1)   return 7
  return 0
}

// Pontos de publicações (30 pts) — % de semanas que postou
function pontosPublicacoes(semanas_previstas, semanas_postou) {
  if (!semanas_previstas || semanas_previstas === 0) return 0
  const pct = semanas_postou / semanas_previstas
  if (pct >= 0.90) return 30
  if (pct >= 0.70) return 22
  if (pct >= 0.50) return 15
  if (pct >= 0.30) return 8
  return 0
}

// Pontos de promoções (20 pts)
function pontosPromocaoTrimestral(participacao) {
  if (participacao === 'confirmou')    return 20
  if (participacao === 'sem_retorno')  return 8
  if (participacao === 'recusou')      return 2
  return 0 // nao_aplica
}

// Pontos de comunicação (15 pts)
function pontosComunicacao(comunicacao) {
  if (comunicacao === 'sempre')       return 15
  if (comunicacao === 'as_vezes')     return 7
  if (comunicacao === 'nao_responde') return 0
  return 0 // nao_aplica
}

export function calcularScoreTrimestralLivraria(dados) {
  let total = 0
  let maxPossivel = 0

  // Vendas
  if (!dados.vendas_nao_aplica) {
    total += pontosVendasLivraria(dados.vendas || 0)
    maxPossivel += 35
  }

  // Publicações
  if (!dados.publicacoes_nao_aplica) {
    const postou = (dados.semanas_postou_feed || 0) + (dados.semanas_postou_story || 0)
    const previstas = (dados.semanas_previstas || 0) * 2 // feed + story
    total += pontosPublicacoes(previstas, postou)
    maxPossivel += 30
  }

  // Promoções
  if (!dados.promocoes_nao_aplica && dados.participacao_promocao !== 'nao_aplica') {
    total += pontosPromocaoTrimestral(dados.participacao_promocao)
    maxPossivel += 20
  }

  // Comunicação
  if (dados.comunicacao !== 'nao_aplica') {
    total += pontosComunicacao(dados.comunicacao)
    maxPossivel += 15
  }

  if (maxPossivel === 0) return { score: 0, classificacao: 'N/A' }

  const pct = (total / maxPossivel) * 100
  return {
    score: Math.round(pct * 10) / 10,
    classificacao: classificacaoPorPct(pct),
  }
}

// Score trimestral editoras (80/10/10)
function pontosVendasEditoraTrimestral(vendas, faixas) {
  // faixas definidas futuramente — por ora retorna proporcional
  if (!faixas) return Math.min(80, (vendas || 0) * 0.1)
  for (const f of faixas) {
    if (vendas >= f.min) return f.pts
  }
  return 0
}

export function calcularScoreTrimestralEditora(dados) {
  let total = 0
  let maxPossivel = 0

  // Vendas
  if (!dados.vendas_nao_aplica) {
    total += pontosVendasEditoraTrimestral(dados.vendas || 0)
    maxPossivel += 80
  }

  // Promoções
  if (!dados.promocoes_nao_aplica && dados.participacao_promocao !== 'nao_aplica') {
    total += pontosPromocaoTrimestral(dados.participacao_promocao) * 0.5 // escala 20→10
    maxPossivel += 10
  }

  // Comunicação
  if (dados.comunicacao !== 'nao_aplica') {
    total += pontosComunicacao(dados.comunicacao) * (10/15) // escala 15→10
    maxPossivel += 10
  }

  if (maxPossivel === 0) return { score: 0, classificacao: 'N/A' }

  const pct = (total / maxPossivel) * 100
  return {
    score: Math.round(pct * 10) / 10,
    classificacao: classificacaoPorPct(pct),
  }
}

export function classificacaoPorPct(pct) {
  if (pct >= 85) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 55) return 'C'
  if (pct >= 40) return 'D'
  if (pct >= 25) return 'E'
  return 'F'
}

export async function upsertScoreTrimestralLivraria(livraria_id, ano, trimestre, dados) {
  const { score, classificacao } = calcularScoreTrimestralLivraria(dados)
  const { data, error } = await supabase
    .from('livrarias_score_trimestral')
    .upsert(
      { livraria_id, ano, trimestre, ...dados, score, atualizado_em: new Date().toISOString() },
      { onConflict: 'livraria_id,ano,trimestre' }
    )
    .select()
    .single()
  if (error) throw error
  return { ...data, score, classificacao }
}

export async function getScoreTrimestralLivrarias(ano) {
  const { data, error } = await supabase
    .from('livrarias_score_trimestral')
    .select('*, livrarias(id, nome, editoras_parceiras(nome))')
    .eq('ano', ano)
    .order('trimestre', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getScoreTrimestralLivraria(livraria_id) {
  const { data, error } = await supabase
    .from('livrarias_score_trimestral')
    .select('*')
    .eq('livraria_id', livraria_id)
    .order('ano', { ascending: false })
    .order('trimestre', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertScoreTrimestralEditora(editora_id, ano, trimestre, dados) {
  const { score, classificacao } = calcularScoreTrimestralEditora(dados)
  const { data, error } = await supabase
    .from('editoras_score_trimestral')
    .upsert(
      { editora_id, ano, trimestre, ...dados, score, classificacao, atualizado_em: new Date().toISOString() },
      { onConflict: 'editora_id,ano,trimestre' }
    )
    .select()
    .single()
  if (error) throw error
  return { ...data, score, classificacao }
}

export async function getScoreTrimestralEditoras(ano) {
  const { data, error } = await supabase
    .from('editoras_score_trimestral')
    .select('*, editoras_parceiras(id, nome, classificacao)')
    .eq('ano', ano)
    .order('trimestre', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getScoreTrimestralEditora(editora_id) {
  const { data, error } = await supabase
    .from('editoras_score_trimestral')
    .select('*')
    .eq('editora_id', editora_id)
    .order('ano', { ascending: false })
    .order('trimestre', { ascending: false })
  if (error) throw error
  return data || []
}

// ── IMPORTAÇÃO COM CONFERÊNCIA ─────────────────────────────

// Normaliza nomes para matching tolerante: minúsculas, sem acentos,
// pontuação vira espaço, espaços duplicados colapsados
export function normalizarNome(nome) {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Similaridade simples entre nomes já normalizados (0 a 1)
function similaridadeNomes(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const ta = a.split(' ').filter(Boolean)
  const tb = new Set(b.split(' ').filter(Boolean))
  let comum = 0
  for (const t of ta) if (tb.has(t)) comum++
  return comum / Math.max(ta.length, tb.size)
}

// Confere a planilha contra o banco SEM salvar nada.
// rows: [{ nome, vendas }] | tipo: 'livraria' ou 'editora'
// Retorna { encontradas, parecidas, ignoradas }
export async function conferirVendas(rows, tipo) {
  const tabela = tipo === 'livraria' ? 'livrarias' : 'editoras_parceiras'
  const { data, error } = await supabase.from(tabela).select('id, nome').eq('ativo', true)
  if (error) throw error
  const registros = data || []
  const porNorm = new Map()
  for (const r of registros) {
    const n = normalizarNome(r.nome)
    if (!porNorm.has(n)) porNorm.set(n, r)
  }

  const encontradas = [], parecidas = [], ignoradas = []
  for (const row of rows) {
    const nomePlanilha = String(row.nome || '').trim()
    if (!nomePlanilha) continue
    const vendas = Number(row.vendas) || 0
    const norm = normalizarNome(nomePlanilha)
    const exato = porNorm.get(norm)
    if (exato) { encontradas.push({ nomePlanilha, vendas, alvo: exato }); continue }
    const sugestoes = registros
      .map(r => ({ r, sim: similaridadeNomes(norm, normalizarNome(r.nome)) }))
      .filter(x => x.sim >= 0.6)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3)
      .map(x => x.r)
    if (sugestoes.length > 0) parecidas.push({ nomePlanilha, vendas, sugestoes })
    else ignoradas.push({ nomePlanilha, vendas })
  }
  return { encontradas, parecidas, ignoradas }
}

// Salva apenas os itens confirmados pela usuária.
// confirmadas: [{ nomePlanilha, vendas, alvo: { id, nome } }]
// periodo: { mes } para mensal OU { trimestre } para trimestral
export async function salvarVendasConfirmadas(confirmadas, tipo, ano, periodo) {
  const resultados = { importados: 0, erros: [] }
  const eMensal = !!periodo.mes

  for (const item of confirmadas) {
    try {
      const vendas = Number(item.vendas) || 0
      if (tipo === 'livraria') {
        if (eMensal) {
          const existente = await supabase
            .from('livrarias_score_mensal').select('*')
            .eq('livraria_id', item.alvo.id).eq('ano', ano).eq('mes', periodo.mes)
            .maybeSingle()
          const { id, livraria_id, ano: _a, mes: _m, score, criado_em, atualizado_em, ...dadosBase } = existente.data || {}
          await upsertScoreLivraria(item.alvo.id, ano, periodo.mes, {
            ...dadosBase, vendas_livraria: vendas, vendas_nao_aplica: false,
          })
        } else {
          const existente = await supabase
            .from('livrarias_score_trimestral').select('*')
            .eq('livraria_id', item.alvo.id).eq('ano', ano).eq('trimestre', periodo.trimestre)
            .maybeSingle()
          const { id, livraria_id, ano: _a, trimestre: _t, score, classificacao, criado_em, atualizado_em, ...dadosBase } = existente.data || {}
          await upsertScoreTrimestralLivraria(item.alvo.id, ano, periodo.trimestre, {
            ...dadosBase, vendas, vendas_nao_aplica: false,
          })
        }
      } else {
        if (eMensal) {
          const existente = await supabase
            .from('editoras_score_mensal').select('*')
            .eq('editora_id', item.alvo.id).eq('ano', ano).eq('mes', periodo.mes)
            .maybeSingle()
          const { id, editora_id, ano: _a, mes: _m, score, criado_em, atualizado_em, ...dadosBase } = existente.data || {}
          await upsertScoreEditora(item.alvo.id, ano, periodo.mes, {
            ...dadosBase, vendas_editora: vendas,
          })
        } else {
          const existente = await supabase
            .from('editoras_score_trimestral').select('*')
            .eq('editora_id', item.alvo.id).eq('ano', ano).eq('trimestre', periodo.trimestre)
            .maybeSingle()
          const { id, editora_id, ano: _a, trimestre: _t, score, classificacao, criado_em, atualizado_em, ...dadosBase } = existente.data || {}
          await upsertScoreTrimestralEditora(item.alvo.id, ano, periodo.trimestre, {
            ...dadosBase, vendas, vendas_nao_aplica: false,
          })
        }
      }
      resultados.importados++
    } catch (e) {
      resultados.erros.push(`${item.nomePlanilha}: ${e.message}`)
    }
  }
  return resultados
}

// Importação de vendas por planilha
export async function importarVendasLivraria(rows, ano, trimestre) {
  // rows: [{ livraria_nome, vendas }]
  const { data: livrarias } = await supabase.from('livrarias').select('id, nome').eq('ativo', true)
  const resultados = { importados: 0, naoEncontrados: [], erros: [] }

  for (const row of rows) {
    const livraria = (livrarias || []).find(l =>
      l.nome.toLowerCase().trim() === String(row.livraria_nome || '').toLowerCase().trim()
    )
    if (!livraria) { resultados.naoEncontrados.push(row.livraria_nome); continue }
    try {
      const existente = await supabase
        .from('livrarias_score_trimestral')
        .select('*')
        .eq('livraria_id', livraria.id)
        .eq('ano', ano)
        .eq('trimestre', trimestre)
        .maybeSingle()

      const dadosBase = existente.data || {}
      await upsertScoreTrimestralLivraria(livraria.id, ano, trimestre, {
        ...dadosBase,
        vendas: Number(row.vendas) || 0,
        vendas_nao_aplica: false,
      })
      resultados.importados++
    } catch (e) {
      resultados.erros.push(`${row.livraria_nome}: ${e.message}`)
    }
  }
  return resultados
}

export async function importarVendasEditora(rows, ano, trimestre) {
  const { data: editoras } = await supabase.from('editoras_parceiras').select('id, nome').eq('ativo', true)
  const resultados = { importados: 0, naoEncontrados: [], erros: [] }

  for (const row of rows) {
    const editora = (editoras || []).find(e =>
      e.nome.toLowerCase().trim() === String(row.editora_nome || '').toLowerCase().trim()
    )
    if (!editora) { resultados.naoEncontrados.push(row.editora_nome); continue }
    try {
      const existente = await supabase
        .from('editoras_score_trimestral')
        .select('*')
        .eq('editora_id', editora.id)
        .eq('ano', ano)
        .eq('trimestre', trimestre)
        .maybeSingle()

      const dadosBase = existente.data || {}
      await upsertScoreTrimestralEditora(editora.id, ano, trimestre, {
        ...dadosBase,
        vendas: Number(row.vendas) || 0,
        vendas_nao_aplica: false,
      })
      resultados.importados++
    } catch (e) {
      resultados.erros.push(`${row.editora_nome}: ${e.message}`)
    }
  }
  return resultados
}

// ── HELPERS ────────────────────────────────────────────────

export const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export const TRIMESTRES_LABEL = {
  1: 'T1 — Jan/Fev/Mar',
  2: 'T2 — Abr/Mai/Jun',
  3: 'T3 — Jul/Ago/Set',
  4: 'T4 — Out/Nov/Dez',
}

export function trimestreAtual() {
  const m = new Date().getMonth() + 1
  if (m <= 3) return 1
  if (m <= 6) return 2
  if (m <= 9) return 3
  return 4
}

export function mesAnoLabel(mes, ano) {
  return `${MESES_LABEL[mes - 1]}/${String(ano).slice(2)}`
}

export function getMesesDisponiveis(n = 12) {
  const hoje = new Date()
  const meses = []
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
  }
  return meses
}

export function getTrimestresDisponiveis(n = 6) {
  const trimestres = []
  let ano = new Date().getFullYear()
  let tri = trimestreAtual()
  for (let i = 0; i < n; i++) {
    trimestres.push({ trimestre: tri, ano })
    tri--
    if (tri < 1) { tri = 4; ano-- }
  }
  return trimestres
}

export function corScore(nota) {
  if (nota === null || nota === undefined) return { bg: 'transparent', cor: 'var(--text-muted)' }
  if (nota >= 8) return { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b' }
  if (nota >= 6) return { bg: 'rgba(148,163,184,0.15)', cor: '#94a3b8' }
  if (nota >= 4) return { bg: 'rgba(180,83,9,0.15)', cor: '#b45309' }
  if (nota > 0)  return { bg: 'rgba(239,68,68,0.12)', cor: '#ef4444' }
  return { bg: 'transparent', cor: 'var(--text-muted)' }
}

export function corClassificacao(cls) {
  const mapa = {
    A: '#22c55e', B: '#84cc16', C: '#f59e0b',
    D: '#fb923c', E: '#ef4444', F: '#6b7280',
  }
  return mapa[cls] || 'var(--text-muted)'
}

export async function getAtivacoesporMes() {
  const { data, error } = await supabase
    .from('editoras_crm_status_history')
    .select('changed_at, status')
    .eq('status', 'ativo')
    .order('changed_at', { ascending: false })
  if (error) throw error

  const porMes = {}
  for (const r of (data || [])) {
    const d = new Date(r.changed_at)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    porMes[chave] = (porMes[chave] || 0) + 1
  }
  return porMes
}
