// src/lib/crm-status.js
import { supabase } from './client'

const PIPELINE_FALLBACK = [
  { value: 'novo',      label: 'Novo',      cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)', ordem: 0 },
  { value: 'andamento', label: 'Andamento', cor: '#eab308', bg: 'rgba(234,179,8,0.12)', ordem: 1 },
  { value: 'fechado',   label: 'Fechado',   cor: '#22c55e', bg: 'rgba(34,197,94,0.12)', ordem: 2 },
]

// Busca o pipeline configurado para um grupo. Se não existir, devolve um padrão.
export async function getCRMStatusConfig(grupo) {
  if (!grupo) return PIPELINE_FALLBACK
  const { data, error } = await supabase
    .from('crm_status_config')
    .select('statuses')
    .eq('grupo', grupo)
    .maybeSingle()
  if (error) {
    console.error('getCRMStatusConfig error:', error)
    return PIPELINE_FALLBACK
  }
  const arr = data?.statuses || []
  if (!arr.length) return PIPELINE_FALLBACK
  return [...arr].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

// Atualiza (ou cria) a configuração de status de um grupo.
// `statuses` é o array completo — quem chama deve normalizar antes.
export async function saveCRMStatusConfig(grupo, statuses, updated_by) {
  // Normaliza ordens sequenciais
  const normalizado = statuses.map((s, i) => ({
    value: (s.value || '').trim() || `status_${i}`,
    label: (s.label || '').trim() || `Status ${i + 1}`,
    cor:   s.cor || '#6b7280',
    bg:    s.bg  || 'rgba(107,114,128,0.12)',
    ordem: i,
  }))
  const payload = {
    grupo,
    statuses: normalizado,
    updated_at: new Date().toISOString(),
    updated_by: updated_by || null,
  }
  const { data, error } = await supabase
    .from('crm_status_config')
    .upsert(payload, { onConflict: 'grupo' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Versão de fallback (cores padrão) para gerar variações de bg a partir da cor.
export function corParaBg(cor) {
  // converte #rrggbb em rgba com 0.12 de alpha
  const m = /^#([0-9a-f]{6})$/i.exec((cor || '').trim())
  if (!m) return 'rgba(107,114,128,0.12)'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r},${g},${b},0.12)`
}
