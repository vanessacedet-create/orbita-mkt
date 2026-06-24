import { supabase } from './client'

export const GRUPOS = [
  { id: 1, romano: 'I',    label: 'Católico, tradicional e doutrinário' },
  { id: 2, romano: 'II',   label: 'Católico, formação e família' },
  { id: 3, romano: 'III',  label: 'Católico, generalista e espiritualidade' },
  { id: 4, romano: 'IV',   label: 'Conservadorismo e política' },
  { id: 5, romano: 'V',    label: 'Cultura, literatura e ensaio' },
  { id: 6, romano: 'VI',   label: 'Educação' },
  { id: 7, romano: 'VII',  label: 'Negócios' },
  { id: 8, romano: 'VIII', label: 'Entretenimento' },
]

export const STATUS_PARCERIA = ['ativa', 'encerramento', 'finalizada', 'pendente']
export const STATUS_LIVRARIA = ['ativa', 'encerramento', 'finalizada', 'pendente']

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
  const { error } = await supabase.from('editoras_parceiras').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function desativarEditorasLote(ids) {
  const { error } = await supabase.from('editoras_parceiras').update({ ativo: false }).in('id', ids)
  if (error) throw error
}

export async function importarEditorasPlanilha(rows) {
  const GRUPO_MAPA = { 'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8 }

  const dados = rows
    .filter(r => r[0]?.toString().trim())
    .map(r => ({
      nome:            r[0]?.toString().trim(),
      macro:           r[2]?.toString().trim() || null,
      nicho:           r[3]?.toString().trim() || null,
      sub_nicho:       r[4]?.toString().trim() || null,
      posicionamento:  r[5]?.toString().trim() || null,
      grupo_id:        GRUPO_MAPA[r[6]?.toString().trim()] || null,
      status_parceria: r[7]?.toString().trim().toLowerCase() || 'ativa',
      ativo:           true,
    }))

  const LOTE = 50
  for (let i = 0; i < dados.length; i += LOTE) {
    const { error } = await supabase
      .from('editoras_parceiras')
      .upsert(dados.slice(i, i + LOTE), { onConflict: 'nome', ignoreDuplicates: false })
    if (error) throw error
  }
  return dados
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
  const { error } = await supabase.from('livrarias').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function desativarLivrariaLote(ids) {
  const { error } = await supabase.from('livrarias').update({ ativo: false }).in('id', ids)
  if (error) throw error
}

function parseDataExcel(val) {
  if (!val || val === '-') return null
  // Se for objeto Date (cellDates:true)
  if (val instanceof Date) return val.toISOString().split('T')[0]
  // Se for número serial do Excel
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split('T')[0]
  }
  // Se for string, tenta parsear
  const str = val.toString().trim()
  if (!str || str === '-') return null
  // Tenta formato dd/mm/yyyy
  const partes = str.split('/')
  if (partes.length === 3) {
    const [d, m, a] = partes
    return `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return null
}

function limparTexto(val) {
  if (val === null || val === undefined) return null
  const s = val.toString().trim()
  return s === '' ? null : s
}

export async function importarLivrariasPlanilha(rows, editoras) {
  // Colunas esperadas:
  // A=Nome Livraria, B=Editora, C=Contato, D=Site, E=Instagram, F=YouTube, G=Data Inauguração, H=Observação, I=Status

  const dados = rows
    .filter(r => r[0]?.toString().trim())
    .map(r => {
      const nomeEditora = limparTexto(r[1])
      const editora = editoras.find(e =>
        e.nome?.toLowerCase().trim() === nomeEditora?.toLowerCase()
      )
      return {
        nome:        limparTexto(r[0]),
        editora_id:  editora?.id || null,
        contato:     limparTexto(r[2]),
        site:        limparTexto(r[3]),
        instagram:   limparTexto(r[4]),
        youtube:     limparTexto(r[5]),
        inauguracao: parseDataExcel(r[6]),
        observacao:  limparTexto(r[7]),
        status:      limparTexto(r[8])?.toLowerCase() || 'ativa',
        ativo:       true,
      }
    })

  const LOTE = 50
  const resultado = []
  for (let i = 0; i < dados.length; i += LOTE) {
    const { data, error } = await supabase
      .from('livrarias')
      .upsert(dados.slice(i, i + LOTE), { onConflict: 'nome', ignoreDuplicates: false })
      .select('*, editoras_parceiras(id, nome)')
    if (error) throw error
    resultado.push(...(data || []))
  }
  return resultado
}
