import { supabase } from './supabase'

export async function getCheckagemCriativoMes({ ano, mes }) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('monitoramento_criativo')
    .select('*')
    .gte('data_esperada', inicio)
    .lte('data_esperada', fim)

  if (error) throw error
  return data || []
}

export async function upsertCheckagemCriativoDia({ editora_id, formato, data_esperada, status, responsavel }) {
  const { data: existing } = await supabase
    .from('monitoramento_criativo')
    .select('id')
    .eq('editora_id', editora_id)
    .eq('formato', formato)
    .eq('data_esperada', data_esperada)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('monitoramento_criativo')
      .update({ status, responsavel })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('monitoramento_criativo')
      .insert({ editora_id, formato, data_esperada, status, responsavel })
      .select('*')
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteCheckagemCriativoDia({ editora_id, formato, data_esperada }) {
  const { error } = await supabase
    .from('monitoramento_criativo')
    .delete()
    .eq('editora_id', editora_id)
    .eq('formato', formato)
    .eq('data_esperada', data_esperada)
  if (error) throw error
}
