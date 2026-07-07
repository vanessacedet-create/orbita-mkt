import { supabase } from './client'
import { getConfigEquipe, setConfigEquipe } from './editoras-livrarias'

// ── PROMOÇÕES ───────────────────────────────────────────────

export async function getPromocoes() {
  const { data, error } = await supabase
    .from('promocoes_parceiras')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getPromocao(id) {
  const { data, error } = await supabase
    .from('promocoes_parceiras')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPromocao({ titulo, tipo, canal, data_inicio, data_fim, status, observacao, criado_por }) {
  const { data, error } = await supabase
    .from('promocoes_parceiras')
    .insert([{ titulo, tipo, canal, data_inicio: data_inicio || null, data_fim: data_fim || null, status: status || 'planejada', observacao: observacao || null, criado_por: criado_por || null, ativo: true }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePromocao(id, { titulo, tipo, canal, data_inicio, data_fim, status, observacao }) {
  const { data, error } = await supabase
    .from('promocoes_parceiras')
    .update({ titulo, tipo, canal, data_inicio: data_inicio || null, data_fim: data_fim || null, status, observacao: observacao || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarPromocao(id) {
  const { error } = await supabase.from('promocoes_parceiras').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

// ── PARTICIPANTES (direto na promoção — sem campanha) ──────

export async function getParticipantesPromocao(promocao_id) {
  const { data, error } = await supabase
    .from('promocao_participantes')
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
    .eq('promocao_id', promocao_id)
  if (error) throw error
  return data || []
}

export async function upsertParticipante(promocao_id, { editora_id, livraria_id, status, escopo }) {
  const payload = {
    promocao_id,
    editora_id: editora_id || null,
    livraria_id: livraria_id || null,
    status: status || 'convidado',
    atualizado_em: new Date().toISOString(),
  }
  if (escopo) payload.escopo = escopo
  const onConflict = editora_id ? 'promocao_id,editora_id' : 'promocao_id,livraria_id'
  const { data, error } = await supabase
    .from('promocao_participantes')
    .upsert(payload, { onConflict })
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function removerParticipante(id) {
  const { error } = await supabase.from('promocao_participantes').delete().eq('id', id)
  if (error) throw error
}

// Adiciona uma lista de ids como "convidado" de uma vez — usado tanto para
// "selecionar todas" quanto para "adicionar por grupo/macro/nicho/sub-nicho"
export async function selecionarTodosParticipantes(promocao_id, tipo, ids) {
  if (!ids.length) return []
  const rows = ids.map(id => ({
    promocao_id,
    editora_id: tipo === 'editora' ? id : null,
    livraria_id: tipo === 'livraria' ? id : null,
    status: 'convidado',
  }))
  const onConflict = tipo === 'editora' ? 'promocao_id,editora_id' : 'promocao_id,livraria_id'
  const { data, error } = await supabase
    .from('promocao_participantes')
    .upsert(rows, { onConflict })
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
  if (error) throw error
  return data || []
}

// Remove todos os participantes de um tipo (livraria ou editora) — o outro
// tipo, se existir, não é mexido
export async function removerTodosParticipantes(promocao_id, tipo) {
  let query = supabase.from('promocao_participantes').delete().eq('promocao_id', promocao_id)
  query = tipo === 'editora' ? query.not('editora_id', 'is', null) : query.not('livraria_id', 'is', null)
  const { error } = await query
  if (error) throw error
}

export async function setEscopoParticipante(id, escopo) {
  const { data, error } = await supabase
    .from('promocao_participantes')
    .update({ escopo })
    .eq('id', id)
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
    .single()
  if (error) throw error
  return data
}

// ── LIVROS PONTUAIS DE UM PARTICIPANTE ─────────────────────

export async function getLivrosParticipante(participante_id) {
  const { data, error } = await supabase
    .from('promocao_livros')
    .select('*')
    .eq('participante_id', participante_id)
    .order('titulo', { ascending: true })
  if (error) throw error
  return data || []
}

export async function importarLivrosParticipante(participante_id, titulos) {
  const linhas = titulos.map(t => String(t).trim()).filter(Boolean).map(titulo => ({ participante_id, titulo }))
  if (!linhas.length) return []
  const { data, error } = await supabase.from('promocao_livros').insert(linhas).select()
  if (error) throw error
  return data || []
}

export async function removerLivroParticipante(id) {
  const { error } = await supabase.from('promocao_livros').delete().eq('id', id)
  if (error) throw error
}

// ── PARTICIPAÇÕES DE LIVRARIAS NUM MÊS (para o CRM) ────────
// Usado pelo botão "Atualizar classificação" do CRM — mesma assinatura de
// antes (livraria_id + status), agora lendo direto da promoção.
export async function getParticipacoesLivrariasMes(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data: promocoesNoMes, error: e1 } = await supabase
    .from('promocoes_parceiras')
    .select('id')
    .eq('ativo', true)
    .lte('data_inicio', fim)
    .gte('data_fim', inicio)
  if (e1) throw e1
  const promocaoIds = (promocoesNoMes || []).map(p => p.id)
  if (!promocaoIds.length) return []

  const { data: participacoes, error: e2 } = await supabase
    .from('promocao_participantes')
    .select('promocao_id, livraria_id, status')
    .in('promocao_id', promocaoIds)
    .not('livraria_id', 'is', null)
  if (e2) throw e2
  return participacoes || []
}

// ── CORES PERSONALIZADAS POR TIPO ──────────────────────────
// Reaproveita a mesma tabela de configuração da equipe já usada em
// Monitoramento (chave/valor genérico) — sem precisar de tabela nova.

export async function getCoresTiposPromocao() {
  const cores = await getConfigEquipe('cores_tipos_promocao')
  return cores || {}
}

export async function setCoresTiposPromocao(cores) {
  await setConfigEquipe('cores_tipos_promocao', cores)
}

// ── HELPERS ─────────────────────────────────────────────────

export const TIPOS_PROMOCAO = [
  { value: 'oferta',        label: 'Oferta',        cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'promocao',      label: 'Promoção',      cor: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  { value: 'superpromocao', label: 'Superpromoção', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { value: 'black',         label: 'Black',         cor: '#18181b', bg: 'rgba(24,24,27,0.14)'    },
]

export const PALETA_CORES = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#f59e0b','#eab308','#22c55e','#10b981','#14b8a6','#0ea5e9','#3b82f6','#6b7280','#18181b']

export const CANAIS_PROMOCAO = [
  { value: 'livraria',    label: 'Livraria' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'ambos',       label: 'Livraria + Marketplace' },
]

export const STATUS_PROMOCAO = [
  { value: 'planejada',    label: 'Planejada',    cor: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  { value: 'em_andamento', label: 'Em andamento', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { value: 'concluida',    label: 'Concluída',    cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'cancelada',    label: 'Cancelada',    cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
]

export const STATUS_PARTICIPACAO = [
  { value: 'convidado',   label: 'Convidada',   cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'confirmou',   label: 'Confirmou',   cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'recusou',     label: 'Recusou',     cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { value: 'sem_retorno', label: 'Sem retorno', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
]

export function tipoInfo(v, coresCustom = {}) {
  const base = TIPOS_PROMOCAO.find(t => t.value === v) || TIPOS_PROMOCAO[0]
  const cor = coresCustom[v] || base.cor
  return { ...base, cor }
}
export function statusPromocaoInfo(v) { return STATUS_PROMOCAO.find(s => s.value === v) || STATUS_PROMOCAO[0] }
export function statusParticipacaoInfo(v) { return STATUS_PARTICIPACAO.find(s => s.value === v) || STATUS_PARTICIPACAO[0] }

// Um item "pertence" ao filtro se o período dele encosta no período do filtro
export function promocaoNoPeriodo(promocao, ano, semestre) {
  if (!promocao.data_inicio && !promocao.data_fim) return true
  const inicioFiltro = semestre === 0 ? `${ano}-01-01` : semestre === 1 ? `${ano}-01-01` : `${ano}-07-01`
  const fimFiltro = semestre === 0 ? `${ano}-12-31` : semestre === 1 ? `${ano}-06-30` : `${ano}-12-31`
  const inicio = promocao.data_inicio || promocao.data_fim
  const fim = promocao.data_fim || promocao.data_inicio
  return inicio <= fimFiltro && fim >= inicioFiltro
}

// A promoção toca esse dia específico?
export function promocaoNoDia(promocao, dataKey) {
  const inicio = promocao.data_inicio || promocao.data_fim
  const fim = promocao.data_fim || promocao.data_inicio
  if (!inicio || !fim) return false
  return inicio <= dataKey && fim >= dataKey
}
