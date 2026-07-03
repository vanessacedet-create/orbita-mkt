import { supabase } from './client'

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
    .select('*, editoras_parceiras(id, nome, classificacao)')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

// ── SCORE MENSAL — EDITORAS ────────────────────────────────

const PESOS_EDITORA = {
  promocao_geral:      { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  promocao_particular: { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  campanha:            { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  teve_lancamento:     5,
  qtd_lancamentos:     2,
  fez_reuniao:         5,
  respondeu_whatsapp:  5,
  publicou_feed:       3,
  publicou_story:      3,
  publicou_reels:      4,
  vendas_editora:      0.1,
  responde_artes:      5,
  faz_cortesia:        5,
  cria_cupom:          3,
}

export function calcularScoreEditora(dados) {
  let pts = 0
  const p = PESOS_EDITORA
  pts += p.promocao_geral[dados.promocao_geral] || 0
  pts += p.promocao_particular[dados.promocao_particular] || 0
  pts += p.campanha[dados.campanha] || 0
  if (dados.teve_lancamento) pts += p.teve_lancamento
  pts += Math.min(10, (dados.qtd_lancamentos || 0) * p.qtd_lancamentos)
  if (dados.fez_reuniao) pts += p.fez_reuniao
  if (dados.respondeu_whatsapp) pts += p.respondeu_whatsapp
  if (dados.publicou_feed) pts += p.publicou_feed
  if (dados.publicou_story) pts += p.publicou_story
  if (dados.publicou_reels) pts += p.publicou_reels
  pts += Math.min(10, (dados.vendas_editora || 0) * p.vendas_editora)
  if (dados.responde_artes) pts += p.responde_artes
  if (dados.faz_cortesia) pts += p.faz_cortesia
  if (dados.cria_cupom) pts += p.cria_cupom
  const max = 79
  return Math.min(10, Math.round((pts / max) * 10 * 10) / 10)
}

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

export async function upsertScoreEditora(editora_id, ano, mes, dados) {
  const score = calcularScoreEditora(dados)
  const { data, error } = await supabase
    .from('editoras_score_mensal')
    .upsert(
      { editora_id, ano, mes, ...dados, score, atualizado_em: new Date().toISOString() },
      { onConflict: 'editora_id,ano,mes' }
    )
    .select()
    .single()
  if (error) throw error
  return { ...data, score }
}

// ── SCORE MENSAL — LIVRARIAS ───────────────────────────────

// Pontos de promoção mensal
function pontosPromocaoMensal(participacao) {
  if (participacao === 'confirmou')   return 20
  if (participacao === 'sem_retorno') return 8
  if (participacao === 'recusou')     return 2
  return 0 // nao_aplica
}

// Pontos de publicações mensais (semanas)
function pontosPublicacoesMensal(semanas_previstas, semanas_postou_feed, semanas_postou_story) {
  if (!semanas_previstas || semanas_previstas === 0) return 0
  const total = semanas_postou_feed + semanas_postou_story
  const maxPossivel = semanas_previstas * 2
  const pct = total / maxPossivel
  if (pct >= 0.90) return 30
  if (pct >= 0.70) return 22
  if (pct >= 0.50) return 15
  if (pct >= 0.30) return 8
  return 0
}

// Pontos de comunicação mensal
function pontosComunicacaoMensal(comunicacao) {
  if (comunicacao === 'sempre')       return 15
  if (comunicacao === 'as_vezes')     return 7
  if (comunicacao === 'nao_responde') return 0
  return 0 // nao_aplica
}

export function calcularScoreLivraria(dados) {
  let total = 0
  let maxPossivel = 0

  // Vendas (35 pts)
  if (!dados.vendas_nao_aplica) {
    const v = dados.vendas_livraria || 0
    if (v >= 300) total += 35
    else if (v >= 200) total += 28
    else if (v >= 100) total += 21
    else if (v >= 50)  total += 14
    else if (v >= 1)   total += 7
    maxPossivel += 35
  }

  // Promoções (20 pts)
  if (!dados.promocoes_nao_aplica && dados.promocao_geral !== 'nao_aplica') {
    total += pontosPromocaoMensal(dados.promocao_geral)
    maxPossivel += 20
  }

  // Publicações (30 pts)
  if (!dados.publicacoes_nao_aplica) {
    total += pontosPublicacoesMensal(dados.semanas_previstas, dados.semanas_postou_feed, dados.semanas_postou_story)
    maxPossivel += 30
  }

  // Comunicação (15 pts)
  if (dados.comunicacao !== 'nao_aplica') {
    total += pontosComunicacaoMensal(dados.comunicacao)
    maxPossivel += 15
  }

  if (maxPossivel === 0) return 0
  return Math.min(10, Math.round((total / maxPossivel) * 10 * 10) / 10)
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

export async function upsertScoreLivraria(livraria_id, ano, mes, dados) {
  const score = calcularScoreLivraria(dados)
  const { data, error } = await supabase
    .from('livrarias_score_mensal')
    .upsert(
      { livraria_id, ano, mes, ...dados, score, atualizado_em: new Date().toISOString() },
      { onConflict: 'livraria_id,ano,mes' }
    )
    .select()
    .single()
  if (error) throw error
  return { ...data, score }
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
function pontosVendasEditora(vendas, faixas) {
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
    total += pontosVendasEditora(dados.vendas || 0)
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
