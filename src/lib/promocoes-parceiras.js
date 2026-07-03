import { supabase } from './client'

// Participações de livrarias em campanhas cujo período toca um determinado mês —
// usada pelo CRM para puxar automaticamente a participação em promoções.
export async function getParticipacoesLivrariasMes(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data: campanhas, error: e1 } = await supabase
    .from('campanhas_promocao')
    .select('id')
    .eq('tipo_participante', 'livraria')
    .eq('ativo', true)
    .lte('data_inicio', fim)
    .gte('data_fim', inicio)
  if (e1) throw e1
  const campanhaIds = (campanhas || []).map(c => c.id)
  if (!campanhaIds.length) return []

  const { data: participacoes, error: e2 } = await supabase
    .from('campanha_promocao_participantes')
    .select('campanha_id, livraria_id, status')
    .in('campanha_id', campanhaIds)
    .not('livraria_id', 'is', null)
  if (e2) throw e2
  return participacoes || []
}

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
    .insert([{
      titulo, tipo, canal,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      status: status || 'planejada',
      observacao: observacao || null,
      criado_por: criado_por || null,
      ativo: true,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePromocao(id, { titulo, tipo, canal, data_inicio, data_fim, status, observacao }) {
  const { data, error } = await supabase
    .from('promocoes_parceiras')
    .update({
      titulo, tipo, canal,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      status,
      observacao: observacao || null,
    })
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

// ── CAMPANHAS DENTRO DE UMA PROMOÇÃO ───────────────────────

export async function getCampanhasPromocao(promocao_id) {
  const { data, error } = await supabase
    .from('campanhas_promocao')
    .select('*')
    .eq('promocao_id', promocao_id)
    .eq('ativo', true)
    .order('data_inicio', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getCampanhaPromocao(id) {
  const { data, error } = await supabase
    .from('campanhas_promocao')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCampanhaPromocao(promocao_id, { titulo, tipo_participante, data_inicio, data_fim, status, observacao, criado_por }) {
  const { data, error } = await supabase
    .from('campanhas_promocao')
    .insert([{
      promocao_id, titulo, tipo_participante,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      status: status || 'planejada',
      observacao: observacao || null,
      criado_por: criado_por || null,
      ativo: true,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCampanhaPromocao(id, { titulo, data_inicio, data_fim, status, observacao }) {
  const { data, error } = await supabase
    .from('campanhas_promocao')
    .update({
      titulo,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      status,
      observacao: observacao || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarCampanhaPromocao(id) {
  const { error } = await supabase.from('campanhas_promocao').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

// Todas as campanhas de todas as promoções — usado na linha do tempo
export async function getTodasCampanhasPromocao() {
  const { data, error } = await supabase
    .from('campanhas_promocao')
    .select('*')
    .eq('ativo', true)
  if (error) throw error
  return data || []
}

// ── PARTICIPANTES DE UMA CAMPANHA ──────────────────────────
// Uma linha só existe quando a editora/livraria está de alguma forma
// envolvida. Sem linha = "não se aplica" (não participa).

export async function getParticipantesCampanha(campanha_id) {
  const { data, error } = await supabase
    .from('campanha_promocao_participantes')
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
    .eq('campanha_id', campanha_id)
  if (error) throw error
  return data || []
}

export async function upsertParticipante(campanha_id, { editora_id, livraria_id, status, escopo }) {
  const payload = {
    campanha_id,
    editora_id: editora_id || null,
    livraria_id: livraria_id || null,
    status: status || 'convidado',
    atualizado_em: new Date().toISOString(),
  }
  if (escopo) payload.escopo = escopo
  const onConflict = editora_id ? 'campanha_id,editora_id' : 'campanha_id,livraria_id'
  const { data, error } = await supabase
    .from('campanha_promocao_participantes')
    .upsert(payload, { onConflict })
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function removerParticipante(id) {
  const { error } = await supabase.from('campanha_promocao_participantes').delete().eq('id', id)
  if (error) throw error
}

// Coloca todo mundo como "convidado" de uma vez
export async function selecionarTodosParticipantes(campanha_id, tipo, ids) {
  const rows = ids.map(id => ({
    campanha_id,
    editora_id: tipo === 'editora' ? id : null,
    livraria_id: tipo === 'livraria' ? id : null,
    status: 'convidado',
  }))
  const onConflict = tipo === 'editora' ? 'campanha_id,editora_id' : 'campanha_id,livraria_id'
  const { data, error } = await supabase
    .from('campanha_promocao_participantes')
    .upsert(rows, { onConflict })
    .select('*, editoras_parceiras(id, nome), livrarias(id, nome)')
  if (error) throw error
  return data || []
}

// Remove todo mundo (volta tudo para "não se aplica")
export async function removerTodosParticipantes(campanha_id) {
  const { error } = await supabase.from('campanha_promocao_participantes').delete().eq('campanha_id', campanha_id)
  if (error) throw error
}

export async function setEscopoParticipante(id, escopo) {
  const { data, error } = await supabase
    .from('campanha_promocao_participantes')
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
    .from('campanha_promocao_livros')
    .select('*')
    .eq('participante_id', participante_id)
    .order('titulo', { ascending: true })
  if (error) throw error
  return data || []
}

export async function importarLivrosParticipante(participante_id, titulos) {
  const linhas = titulos.map(t => String(t).trim()).filter(Boolean).map(titulo => ({ participante_id, titulo }))
  if (!linhas.length) return []
  const { data, error } = await supabase
    .from('campanha_promocao_livros')
    .insert(linhas)
    .select()
  if (error) throw error
  return data || []
}

export async function removerLivroParticipante(id) {
  const { error } = await supabase.from('campanha_promocao_livros').delete().eq('id', id)
  if (error) throw error
}

// ── HELPERS ─────────────────────────────────────────────────

export const TIPOS_PROMOCAO = [
  { value: 'oferta',         label: 'Oferta',         cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'promocao',       label: 'Promoção',       cor: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  { value: 'superpromocao',  label: 'Superpromoção',  cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { value: 'black',          label: 'Black',          cor: '#18181b', bg: 'rgba(24,24,27,0.14)'    },
]

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

export function tipoInfo(v) { return TIPOS_PROMOCAO.find(t => t.value === v) || TIPOS_PROMOCAO[0] }
export function statusPromocaoInfo(v) { return STATUS_PROMOCAO.find(s => s.value === v) || STATUS_PROMOCAO[0] }
export function statusParticipacaoInfo(v) { return STATUS_PARTICIPACAO.find(s => s.value === v) || STATUS_PARTICIPACAO[0] }

// Semestre de uma data: 1 = Jan-Jun, 2 = Jul-Dez
export function semestreDeData(dataStr) {
  if (!dataStr) return null
  const mes = Number(dataStr.slice(5, 7))
  return mes <= 6 ? 1 : 2
}

// Um item "pertence" ao filtro se o período dele encosta no período do filtro
export function promocaoNoPeriodo(promocao, ano, semestre) {
  if (!promocao.data_inicio && !promocao.data_fim) return true
  const inicioFiltro = semestre === 0 ? `${ano}-01-01` : semestre === 1 ? `${ano}-01-01` : `${ano}-07-01`
  const fimFiltro = semestre === 0 ? `${ano}-12-31` : semestre === 1 ? `${ano}-06-30` : `${ano}-12-31`
  const inicio = promocao.data_inicio || promocao.data_fim
  const fim = promocao.data_fim || promocao.data_inicio
  return inicio <= fimFiltro && fim >= inicioFiltro
}
