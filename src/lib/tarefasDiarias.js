import { supabase } from './client'

// ── CONSTANTES ─────────────────────────────────────────────
export const TIPOS_TAREFA = [
  { value: 'email',      label: 'E-mail' },
  { value: 'stories',    label: 'Stories' },
  { value: 'carrossel',  label: 'Carrossel' },
  { value: 'video',      label: 'Vídeo' },
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'prospeccao', label: 'Prospecção' },
]

export const OBJETIVOS_TAREFA = [
  { value: 'novidade',      label: 'Novidade / Lançamento' },
  { value: 'promocao',      label: 'Promoção / Oferta' },
  { value: 'conteudo',      label: 'Conteúdo' },
  { value: 'reengajamento', label: 'Reengajamento' },
]

// WhatsApp não usa objetivo "conteúdo"; prospecção não usa objetivo
export function objetivosPorTipo(tipo) {
  if (tipo === 'prospeccao') return []
  if (tipo === 'whatsapp') return OBJETIVOS_TAREFA.filter(o => o.value !== 'conteudo')
  return OBJETIVOS_TAREFA
}

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
]

const GRUPO = 'influencers'

// ── DATAS (sem Date('YYYY-MM-DD') pra evitar bug de fuso) ──
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function diaSemanaDeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function addDiasISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Semana de segunda a domingo contendo a data
export function semanaDeISO(iso) {
  const dow = diaSemanaDeISO(iso)          // 0=dom ... 6=sáb
  const offsetSegunda = dow === 0 ? -6 : 1 - dow
  const inicio = addDiasISO(iso, offsetSegunda)
  return Array.from({ length: 7 }, (_, i) => addDiasISO(inicio, i))
}

// ── METAS SEMANAIS ─────────────────────────────────────────
export async function getMetasSemanais() {
  const { data, error } = await supabase
    .from('metas_semanais_tarefas')
    .select('*')
    .eq('grupo', GRUPO)
  if (error) throw error
  return data || []
}

// metas: [{ dia_semana, tipo_tarefa, quantidade }]
export async function salvarMetasSemanais(metas, userId) {
  const rows = metas.map(m => ({
    grupo: GRUPO,
    dia_semana: m.dia_semana,
    tipo_tarefa: m.tipo_tarefa,
    quantidade: m.quantidade,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  }))
  const { error } = await supabase
    .from('metas_semanais_tarefas')
    .upsert(rows, { onConflict: 'grupo,dia_semana,tipo_tarefa' })
  if (error) throw error
}

// ── GERAÇÃO DE VAGAS ───────────────────────────────────────
export async function gerarVagasDoDia(dataISO) {
  const { data, error } = await supabase.rpc('gerar_vagas_do_dia', {
    p_data: dataISO,
    p_grupo: GRUPO,
  })
  if (error) throw error
  return data // nº de vagas criadas
}

export async function gerarVagasDaSemana(dataISO) {
  const dias = semanaDeISO(dataISO)
  let total = 0
  for (const dia of dias) total += await gerarVagasDoDia(dia)
  return total
}

// ── LISTAGEM ───────────────────────────────────────────────
const SELECT_TAREFA = `
  *,
  parceiro:parceiros ( id, nome, responsavel_interno_id ),
  responsavel:usuarios!tarefas_diarias_responsavel_id_fkey ( id, nome )
`

export async function getTarefasPorPeriodo(inicioISO, fimISO, { responsavelId = null } = {}) {
  let q = supabase
    .from('tarefas_diarias')
    .select(SELECT_TAREFA)
    .eq('grupo', GRUPO)
    .gte('data', inicioISO)
    .lte('data', fimISO)
    .order('data')
    .order('tipo_tarefa')
    .order('created_at')
  if (responsavelId) q = q.eq('responsavel_id', responsavelId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getTarefasDoDia(dataISO, opts) {
  return getTarefasPorPeriodo(dataISO, dataISO, opts)
}

export async function getTarefasDaSemana(dataISO, opts) {
  const dias = semanaDeISO(dataISO)
  return getTarefasPorPeriodo(dias[0], dias[6], opts)
}

// ── PREENCHER / ATUALIZAR VAGA ─────────────────────────────
// Busca o responsável cadastrado no CRM pro parceiro selecionado
export async function getResponsavelDoParceiro(parceiroId) {
  const { data, error } = await supabase
    .from('parceiros')
    .select('responsavel_interno_id')
    .eq('id', parceiroId)
    .single()
  if (error) throw error
  return data?.responsavel_interno_id || null
}

export async function preencherVaga(tarefaId, { parceiroId = null, objetivo = null, responsavelId, observacao = null }) {
  const { data, error } = await supabase
    .from('tarefas_diarias')
    .update({
      parceiro_id: parceiroId,
      objetivo,
      responsavel_id: responsavelId,
      observacao,
      status: 'pendente',
      preenchida_em: new Date().toISOString(),
    })
    .eq('id', tarefaId)
    .select(SELECT_TAREFA)
    .single()
  if (error) throw error
  return data
}

export async function atualizarTarefa(tarefaId, updates) {
  const { data, error } = await supabase
    .from('tarefas_diarias')
    .update(updates)
    .eq('id', tarefaId)
    .select(SELECT_TAREFA)
    .single()
  if (error) throw error
  return data
}

export async function concluirTarefa(tarefaId, userId, resultado = null) {
  return atualizarTarefa(tarefaId, {
    status: 'feita',
    resultado,
    concluida_em: new Date().toISOString(),
    concluida_por: userId || null,
  })
}

export async function reabrirTarefa(tarefaId) {
  return atualizarTarefa(tarefaId, {
    status: 'pendente',
    resultado: null,
    concluida_em: null,
    concluida_por: null,
  })
}

// Volta o slot pra vaga (desfaz preenchimento)
export async function esvaziarVaga(tarefaId) {
  return atualizarTarefa(tarefaId, {
    status: 'vaga',
    parceiro_id: null,
    objetivo: null,
    responsavel_id: null,
    observacao: null,
    resultado: null,
    preenchida_em: null,
    concluida_em: null,
    concluida_por: null,
  })
}

export async function deletarTarefa(tarefaId) {
  const { error } = await supabase.from('tarefas_diarias').delete().eq('id', tarefaId)
  if (error) throw error
}
