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
  const { data, error } = await supabase
    .from('monitoramento_criativo')
    .upsert(
      { editora_id, formato, data_esperada, status, responsavel },
      { onConflict: 'editora_id,formato,data_esperada' }
    )
    .select('*')
    .single()

  if (error) throw error
  return data
}
