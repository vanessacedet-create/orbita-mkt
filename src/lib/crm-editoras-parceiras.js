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
  qtd_lancamentos:     2,   // por lançamento, até 10pts
  fez_reuniao:         5,
  respondeu_whatsapp:  5,
  publicou_feed:       3,
  publicou_story:      3,
  publicou_reels:      4,
  vendas_editora:      0.1, // por unidade
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

  // Máximo teórico ~79pts → normaliza para 0-10
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

const PESOS_LIVRARIA = {
  promocao_geral:      { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  promocao_particular: { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  campanha:            { confirmou: 10, sem_retorno: 3, recusou: 2, nao_participou: 0 },
  publicou_feed:       3,
  publicou_story:      3,
  publicou_reels:      4,
  vendas_livraria:     0.1,
  responde_artes:      5,
}

export function calcularScoreLivraria(dados) {
  let pts = 0
  const p = PESOS_LIVRARIA

  pts += p.promocao_geral[dados.promocao_geral] || 0
  pts += p.promocao_particular[dados.promocao_particular] || 0
  pts += p.campanha[dados.campanha] || 0
  if (dados.publicou_feed) pts += p.publicou_feed
  if (dados.publicou_story) pts += p.publicou_story
  if (dados.publicou_reels) pts += p.publicou_reels
  pts += Math.min(10, (dados.vendas_livraria || 0) * p.vendas_livraria)
  if (dados.responde_artes) pts += p.responde_artes

  const max = 44
  return Math.min(10, Math.round((pts / max) * 10 * 10) / 10)
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

// ── HELPERS ────────────────────────────────────────────────

export const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

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

export function corScore(nota) {
  if (nota === null || nota === undefined) return { bg: 'transparent', cor: 'var(--text-muted)' }
  if (nota >= 8) return { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b' }
  if (nota >= 6) return { bg: 'rgba(148,163,184,0.15)', cor: '#94a3b8' }
  if (nota >= 4) return { bg: 'rgba(180,83,9,0.15)', cor: '#b45309' }
  if (nota > 0)  return { bg: 'rgba(239,68,68,0.12)', cor: '#ef4444' }
  return { bg: 'transparent', cor: 'var(--text-muted)' }
}

// Contagem mensal de ativações (quantas editoras/livrarias ficaram ativas por mês)
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
