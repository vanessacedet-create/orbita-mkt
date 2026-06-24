import { supabase } from './client'

export const GRUPOS = [
  { id: 1, label: 'Católico tradicional doutrinário' },
  { id: 2, label: 'Católico formação família' },
  { id: 3, label: 'Católicas geral/espiritualidade' },
  { id: 4, label: 'Conservadorismo e política' },
  { id: 5, label: 'Cultura; literatura; ensaio' },
  { id: 6, label: 'Educação' },
  { id: 7, label: 'Negócios' },
  { id: 8, label: 'Entretenimento' },
]

export const STATUS_PARCERIA = ['ativa', 'encerramento', 'finalizada', 'pendente']

// Ordenação: classificadas (A→Z), depois sem classificação (alfabética)
function ordenarEditoras(lista) {
  const ordemClass = ['A','B','C','D','E','F','G','H']
  return [...lista].sort((a, b) => {
    const ca = a.classificacao, cb = b.classificacao
    if (ca && cb) {
      const ia = ordemClass.indexOf(ca), ib = ordemClass.indexOf(cb)
      if (ia !== ib) return ia - ib
      return a.nome.localeCompare(b.nome, 'pt-BR')
    }
    if (ca && !cb) return -1
    if (!ca && cb) return 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

// ── EDITORAS ───────────────────────────────────────────────

export async function getEditorasCompletas() {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .select('*, selos_editoriais(*)')
    .eq('ativo', true)
    .neq('status_parceria', 'finalizada')
    .order('nome', { ascending: true })
  if (error) throw error
  return ordenarEditoras(data || [])
}

export async function createEditora(payload) {
  const { selos, ...rest } = payload
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .insert([rest])
    .select('*')
    .single()
  if (error) throw error
  if (selos?.length) {
    await supabase.from('selos_editoriais').insert(selos.map(nome => ({ editora_id: data.id, nome })))
  }
  return { ...data, selos_editoriais: selos?.map(nome => ({ nome })) || [] }
}

export async function updateEditora(id, payload) {
  const { selos, ...rest } = payload
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .update(rest)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  if (selos !== undefined) {
    await supabase.from('selos_editoriais').delete().eq('editora_id', id)
    if (selos.length) {
      await supabase.from('selos_editoriais').insert(selos.map(nome => ({ editora_id: id, nome })))
    }
  }
  return { ...data, selos_editoriais: selos?.map(nome => ({ nome })) || data.selos_editoriais || [] }
}

export async function desativarEditora(id) {
  const { error } = await supabase
    .from('editoras_parceiras')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function importarEditorasPlanilha(rows) {
  const GRUPO_MAPA = { 'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8 }
  const data = rows.map(r => ({
    nome:            r[0]?.toString().trim() || null,
    macro:           r[2]?.toString().trim() || null,
    nicho:           r[3]?.toString().trim() || null,
    sub_nicho:       r[4]?.toString().trim() || null,
    posicionamento:  r[5]?.toString().trim() || null,
    grupo_id:        GRUPO_MAPA[r[6]?.toString().trim()] || null,
    status_parceria: r[7]?.toString().trim() || 'ativa',
  })).filter(r => r.nome)

  // Inserir em lotes de 50 para evitar limite do Supabase
  const LOTE = 50
  const resultado = []
  for (let i = 0; i < data.length; i += LOTE) {
    const lote = data.slice(i, i + LOTE)
    const { data: inserted, error } = await supabase
      .from('editoras_parceiras')
      .insert(lote)
      .select('*')
    if (error) throw error
    resultado.push(...(inserted || []))
  }
  return resultado
}

// ── LIVRARIAS ──────────────────────────────────────────────

export async function getLivrarias() {
  const { data, error } = await supabase
    .from('livrarias')
    .select('*, editoras_parceiras(id, nome)')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createLivraria(payload) {
  const { data, error } = await supabase
    .from('livrarias')
    .insert([payload])
    .select('*, editoras_parceiras(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function updateLivraria(id, payload) {
  const { data, error } = await supabase
    .from('livrarias')
    .update(payload)
    .eq('id', id)
    .select('*, editoras_parceiras(id, nome)')
    .single()
  if (error) throw error
  return data
}

export async function desativarLivraria(id) {
  const { error } = await supabase
    .from('livrarias')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function importarLivrariasPlanilha(rows, editoras) {
  // Colunas esperadas na planilha:
  // A=Editora, B=Contato Editora, C=Email Editora, D=Nome Livraria, E=Site Livraria,
  // F=Contato Livraria, G=Email Livraria, H=Telefone, I=Data Contrato, J=Data Inauguração, K=Observação
  function parseData(val) {
    if (!val) return null
    // Excel serializa datas como número
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      return d.toISOString().split('T')[0]
    }
    return val?.toString().trim() || null
  }
  const data = rows.map(r => {
    const nomeEditora = r[0]?.toString().trim()
    const editora = editoras.find(e =>
      e.nome?.toLowerCase().trim() === nomeEditora?.toLowerCase()
    )
    return {
      editora_id:   editora?.id || null,
      nome:         r[3]?.toString().trim() || null,
      site:         r[4]?.toString().trim() || null,
      contato:      r[5]?.toString().trim() || null,
      email:        r[6]?.toString().trim() || null,
      instagram:    null,
      inauguracao:  parseData(r[9]),
    }
  }).filter(r => r.nome)
  const { data: inserted, error } = await supabase
    .from('livrarias')
    .insert(data)
    .select('*, editoras_parceiras(id, nome)')
  if (error) throw error
  return inserted || []
}
