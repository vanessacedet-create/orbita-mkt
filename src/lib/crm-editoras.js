import { supabase } from './client'

// ── TABELA DE CLASSIFICAÇÃO ────────────────────────────────
// Vendas + WhatsApp → Classe A-F
// Baseado na planilha de indicadores
export function calcularClasse(vendas, whatsapp) {
  const v = Number(vendas) || 0
  const w = whatsapp === true || whatsapp === 'true' || whatsapp === 'sim' || whatsapp === 'corresponde'

  if (v >= 100) return w ? 'A' : 'B'
  if (v >= 80)  return w ? 'A' : 'B'
  if (v >= 60)  return w ? 'B' : 'C'
  if (v >= 40)  return w ? 'C' : 'D'
  if (v >= 20)  return w ? 'D' : 'E'
  return w ? 'E' : 'F'
}

// ── INDICADORES MENSAIS ────────────────────────────────────

export async function getIndicadoresEditora(editora_id) {
  const { data, error } = await supabase
    .from('editoras_indicadores')
    .select('*')
    .eq('editora_id', editora_id)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getUltimoIndicador(editora_id) {
  const { data, error } = await supabase
    .from('editoras_indicadores')
    .select('*')
    .eq('editora_id', editora_id)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getAllIndicadoresMes(ano, mes) {
  const { data, error } = await supabase
    .from('editoras_indicadores')
    .select('*, editoras_parceiras(id, nome, classificacao)')
    .eq('ano', ano)
    .eq('mes', mes)
  if (error) throw error
  return data || []
}

export async function upsertIndicador({ editora_id, ano, mes, vendas_livraria, whatsapp_corresponde, observacao }) {
  const classe = calcularClasse(vendas_livraria, whatsapp_corresponde)

  const { data, error } = await supabase
    .from('editoras_indicadores')
    .upsert(
      { editora_id, ano, mes, vendas_livraria, whatsapp_corresponde, observacao, classe, atualizado_em: new Date().toISOString() },
      { onConflict: 'editora_id,ano,mes' }
    )
    .select()
    .single()
  if (error) throw error

  // Atualiza classificacao na tabela principal
  await supabase
    .from('editoras_parceiras')
    .update({ classificacao: classe })
    .eq('id', editora_id)

  return { ...data, classe }
}

export async function deleteIndicador(id) {
  const { error } = await supabase.from('editoras_indicadores').delete().eq('id', id)
  if (error) throw error
}

// ── EDITORAS ───────────────────────────────────────────────

export async function getEditorasParaCRM() {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .select('id, nome, classificacao, status_parceria, grupo_id, contato, instagram')
    .eq('ativo', true)
    .neq('status_parceria', 'finalizada')
    .order('nome', { ascending: true })
  if (error) throw error

  // Ordena por classificação A → F → sem classe
  const ordem = ['A','B','C','D','E','F']
  return [...(data || [])].sort((a, b) => {
    const ia = a.classificacao ? ordem.indexOf(a.classificacao) : 99
    const ib = b.classificacao ? ordem.indexOf(b.classificacao) : 99
    if (ia !== ib) return ia - ib
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

// ── MESES ──────────────────────────────────────────────────

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
