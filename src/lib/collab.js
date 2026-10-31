import { supabase } from './client'

// ── Collab BookTime — acesso a dados ──────────────────────────
// Tabelas: collab_config, collab_parceiros, collab_videos,
//          collab_video_livros, collab_recusas (RLS: só equipe de influencers)

const SEL_PARCEIRO = 'id, nome, username, livraria, library_url'
const SEL_LIVRO = 'id, titulo, autor, isbn, sku'
const SEL_VIDEO = `*, parceiro:parceiros(${SEL_PARCEIRO}), livros:collab_video_livros(livro:livros(${SEL_LIVRO}))`

const PERFIS_EQUIPE = ['administrador', 'gerente', 'analista_influencers', 'estagiario_influencers']

// Colunas de collab_videos que a tela pode gravar
const CAMPOS_VIDEO = [
  'parceiro_id', 'etapa', 'em_ajuste', 'historico', 'data_postagem', 'data_confirmada',
  'resp_curadoria', 'resp_producao', 'livraria', 'link_dm', 'palavra', 'roteiro', 'legenda',
  'link_video_cru', 'video_cru_whatsapp', 'link_video_editado', 'link_capa', 'link_post',
  'dt_livro_sugerido', 'dt_livro_aceito', 'dt_roteiro_enviado', 'dt_roteiro_aprovado',
  'dt_video_cru', 'dt_edicao', 'dt_automacao', 'dt_agendado', 'dt_postado',
  'resultado_visualizacoes', 'resultado_pessoas_palavra', 'resultado_vendas_unid', 'dt_resultado',
  'observacoes',
]

const CAMPOS_ADESAO = [
  'parceiro_id', 'status', 'data_convite', 'data_resposta', 'videos_por_semana', 'ritmo_periodo',
  'horario_preferido', 'dias_preferidos',
  'prazo_livro_aceito', 'prazo_roteiro_enviado', 'prazo_roteiro_aprovado', 'prazo_video_cru',
  'prazo_edicao', 'prazo_automacao', 'prazo_agendado', 'observacoes',
]

// Remove caracteres que alteram filtros do PostgREST (.or / ilike)
function limparBusca(s) {
  return String(s || '').replace(/[,()%*\\"':]/g, ' ').replace(/\s+/g, ' ').trim()
}

function escaparIlike(s) {
  return String(s || '').replace(/[\\%_]/g, m => '\\' + m)
}

function vazioParaNull(v) {
  return v === '' || v === undefined ? null : v
}

function pegarCampos(obj, campos) {
  const out = {}
  campos.forEach(c => { if (c in obj) out[c] = vazioParaNull(obj[c]) })
  return out
}

// Busca todas as linhas, contornando o limite de 1000 do Supabase
async function buscarTudo(montarQuery) {
  const tamanho = 1000
  let pagina = 0
  let todas = []
  for (;;) {
    const { data, error } = await montarQuery().range(pagina * tamanho, (pagina + 1) * tamanho - 1)
    if (error) throw error
    todas = todas.concat(data || [])
    if (!data || data.length < tamanho) break
    pagina += 1
  }
  return todas
}

// ── CONFIGURAÇÃO ─────────────────────────────────────────────
export async function getCollabConfig() {
  const { data, error } = await supabase.from('collab_config').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updateCollabConfig(campos) {
  const { data, error } = await supabase
    .from('collab_config')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── EQUIPE ───────────────────────────────────────────────────
export async function getEquipeCollab() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, perfil')
    .eq('ativo', true)
    .in('perfil', PERFIS_EQUIPE)
    .order('nome')
  if (error) throw error
  return data || []
}

// ── PARCEIROS / ADESÃO ───────────────────────────────────────
export async function getAdesoes() {
  const { data, error } = await supabase
    .from('collab_parceiros')
    .select(`*, parceiro:parceiros(${SEL_PARCEIRO})`)
    .order('created_at')
  if (error) throw error
  return (data || []).sort((a, b) => (a.parceiro?.nome || '').localeCompare(b.parceiro?.nome || ''))
}

export async function buscarParceirosInfluencers(termo) {
  const s = limparBusca(termo)
  if (s.length < 2) return []
  const { data, error } = await supabase
    .from('parceiros')
    .select(SEL_PARCEIRO)
    .eq('grupo', 'influencers')
    .or(`nome.ilike.%${s}%,username.ilike.%${s}%`)
    .order('nome')
    .limit(20)
  if (error) throw error
  return data || []
}

export async function salvarAdesao(adesao) {
  const campos = pegarCampos(adesao, CAMPOS_ADESAO)
  campos.updated_at = new Date().toISOString()
  const q = adesao.id
    ? supabase.from('collab_parceiros').update(campos).eq('id', adesao.id)
    : supabase.from('collab_parceiros').insert(campos)
  const { data, error } = await q.select(`*, parceiro:parceiros(${SEL_PARCEIRO})`).single()
  if (error) throw error
  return data
}

// ── VÍDEOS ───────────────────────────────────────────────────
export async function getVideos() {
  return buscarTudo(() =>
    supabase.from('collab_videos').select(SEL_VIDEO).order('data_postagem', { ascending: true }).order('id')
  )
}

export async function getVideo(id) {
  const { data, error } = await supabase.from('collab_videos').select(SEL_VIDEO).eq('id', id).single()
  if (error) throw error
  return data
}

export async function sincronizarLivros(videoId, livroIds) {
  const ids = Array.from(new Set(livroIds || []))
  const { data: atuais, error: e1 } = await supabase
    .from('collab_video_livros')
    .select('livro_id')
    .eq('video_id', videoId)
  if (e1) throw e1
  const atuaisIds = (atuais || []).map(r => r.livro_id)
  const remover = atuaisIds.filter(id => !ids.includes(id))
  const inserir = ids.filter(id => !atuaisIds.includes(id))
  if (remover.length) {
    const { error } = await supabase
      .from('collab_video_livros')
      .delete()
      .eq('video_id', videoId)
      .in('livro_id', remover)
    if (error) throw error
  }
  if (inserir.length) {
    const { error } = await supabase
      .from('collab_video_livros')
      .insert(inserir.map(livro_id => ({ video_id: videoId, livro_id })))
    if (error) throw error
  }
}

export async function salvarVideo(video, livroIds, usuarioId) {
  const campos = pegarCampos(video, CAMPOS_VIDEO)
  campos.updated_at = new Date().toISOString()
  let id = video.id
  if (id) {
    const { error } = await supabase.from('collab_videos').update(campos).eq('id', id)
    if (error) throw error
  } else {
    if (usuarioId) campos.criado_por = usuarioId
    const { data, error } = await supabase.from('collab_videos').insert(campos).select('id').single()
    if (error) throw error
    id = data.id
  }
  await sincronizarLivros(id, livroIds)
  return getVideo(id)
}

export async function excluirVideo(id) {
  const { error } = await supabase.from('collab_videos').delete().eq('id', id)
  if (error) throw error
}

// Palavra de comentário já usada em outro vídeo (só aviso, não bloqueia)
export async function palavraEmUso(palavra, ignorarId) {
  const p = String(palavra || '').trim()
  if (!p) return []
  let q = supabase
    .from('collab_videos')
    .select('id, palavra, data_postagem, parceiro:parceiros(nome)')
    .ilike('palavra', escaparIlike(p))
    .limit(5)
  if (ignorarId) q = q.neq('id', ignorarId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ── LIVROS ───────────────────────────────────────────────────
export async function buscarLivrosCollab(termo) {
  const s = limparBusca(termo)
  if (s.length < 2) return []
  const { data, error } = await supabase
    .from('livros')
    .select(SEL_LIVRO)
    .or(`titulo.ilike.%${s}%,autor.ilike.%${s}%,isbn.ilike.%${s}%,sku.ilike.%${s}%`)
    .order('titulo')
    .limit(20)
  if (error) throw error
  return data || []
}

// ── RECUSAS ──────────────────────────────────────────────────
export async function getRecusasParceiro(parceiroId) {
  if (!parceiroId) return []
  const { data, error } = await supabase
    .from('collab_recusas')
    .select(`*, livro:livros(${SEL_LIVRO})`)
    .eq('parceiro_id', parceiroId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function registrarRecusa({ video_id, parceiro_id, livro_id, motivo, observacao }) {
  const { error } = await supabase.from('collab_recusas').insert({
    video_id: video_id || null,
    parceiro_id,
    livro_id,
    motivo,
    observacao: vazioParaNull(observacao),
  })
  if (error) throw error
}
