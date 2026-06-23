import { supabase } from './supabase'

/**
 * Busca todos os registros de checagem criativo de um mês
 */
export async function getCheckagemCriativoMes({ ano, mes }) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim    = `${ano}-${String(mes).padStart(2, '0')}-31`

  const { data, error } = await supabase
    .from('monitoramento_criativo')
    .select('*')
    .gte('data_esperada', inicio)
    .lte('data_esperada', fim)

  if (error) throw error
  return data || []
}

/**
 * Cria ou atualiza um registro de checagem criativo para uma editora/formato/dia
 */
export async function upsertCheckagemCriativoDia({ editora_id, formato, data_esperada, status, responsavel }) {
  const { data, error } = await supabase
    .from('monitoramento_criativo')
    .upsert(
      { editora_id, formato, data_esperada, status, responsavel },
      { onConflict: 'editora_id,formato,data_esperada' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
