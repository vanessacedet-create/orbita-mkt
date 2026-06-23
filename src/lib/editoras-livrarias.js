import { supabase } from './client'

// ── GRUPOS ─────────────────────────────────────────────────
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

// ── EDITORAS ───────────────────────────────────────────────

export async function getEditorasCompletas() {
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .select('*, selos_editoriais(*)')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error

  const ordemClass = ['A','B','C','D','E','F','G','H']
  return (data || []).sort((a, b) => {
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
  const selosData = selos?.map(nome => ({ nome })) || data.selos_editoriais || []
  return { ...data, selos_editoriais: selosData }
}

export async function desativarEditora(id) {
  const { error } = await supabase
    .from('editoras_parceiras')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

export async function importarEditorasPlanilhaCompleta(editoras) {
  const rows = editoras.map(e => ({
    nome:           e.nome          || null,
    contato:        e.contato       || null,
    email:          e.email         || null,
    instagram:      e.instagram     || null,
    youtube:        e.youtube       || null,
    site:           e.site          || null,
    seguidores:     e.seguidores    ? Number(e.seguidores) : null,
    canal_venda:    e.canal_venda   || null,
    tem_grupo:      e.tem_grupo     === 'Sim' || e.tem_grupo === true,
    macro:          e.macro         || null,
    nicho:          e.nicho         || null,
    sub_nicho:      e.sub_nicho     || null,
    posicionamento: e.posicionamento|| null,
    grupo_id:       e.grupo_id      ? Number(e.grupo_id) : null,
    status_parceria: e.status_parceria || 'ativa',
  }))
  const { data, error } = await supabase
    .from('editoras_parceiras')
    .insert(rows)
    .select('*')
  if (error) throw error
  return data || []
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

export async function importarLivrariasPlanilha(livrarias) {
  const rows = livrarias.map(l => ({
    nome:      l.nome      || null,
    contato:   l.contato   || null,
    email:     l.email     || null,
    whatsapp:  l.whatsapp  || null,
    site:      l.site      || null,
    editora_id: l.editora_id || null,
  }))
  const { data, error } = await supabase
    .from('livrarias')
    .insert(rows)
    .select('*, editoras_parceiras(id, nome)')
  if (error) throw error
  return data || []
}
