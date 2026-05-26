import { supabase } from './client'

// ── MARCAS ─────────────────────────────────────────────────────
export async function getMarcas() {
  const { data, error } = await supabase
    .from('inbox_marcas')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data || []
}

// ── CONVERSAS ──────────────────────────────────────────────────
export async function getConversas({ marca, status, busca } = {}) {
  let q = supabase
    .from('inbox_conversas')
    .select(`
      *,
      parceiro:parceiros!parceiro_id(id, nome, username, platforms, followers_count, engagement_rate, profile_url),
      responsavel:usuarios!responsavel_id(id, nome)
    `)
    .order('ultima_msg_at', { ascending: false })

  if (marca && marca !== 'todas') q = q.eq('marca', marca)
  if (status && status !== 'todos') q = q.eq('status', status)
  if (busca) q = q.ilike('ultima_mensagem', `%${busca}%`)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getConversa(id) {
  const { data, error } = await supabase
    .from('inbox_conversas')
    .select(`
      *,
      parceiro:parceiros!parceiro_id(
        id, nome, username, platforms, followers_count,
        engagement_rate, profile_url, contact_value, model, notes
      ),
      responsavel:usuarios!responsavel_id(id, nome)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Busca ou cria conversa pelo messenger_id + marca
export async function upsertConversa({ messenger_id, marca, page_id, parceiro_id }) {
  const { data: existente } = await supabase
    .from('inbox_conversas')
    .select('*')
    .eq('messenger_id', messenger_id)
    .eq('marca', marca)
    .maybeSingle()

  if (existente) return existente

  const { data, error } = await supabase
    .from('inbox_conversas')
    .insert([{ messenger_id, marca, page_id, parceiro_id: parceiro_id || null, status: 'aberto' }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateConversa(id, updates) {
  const { data, error } = await supabase
    .from('inbox_conversas')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Vincula conversa a um parceiro do CRM
export async function vincularParceiro(conversaId, parceiroId) {
  return updateConversa(conversaId, { parceiro_id: parceiroId })
}

// ── MENSAGENS ─────────────────────────────────────────────────
export async function getMensagens(conversaId) {
  const { data, error } = await supabase
    .from('inbox_mensagens')
    .select(`*, enviado_por:usuarios!enviada_por_id(id, nome)`)
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addMensagem({ conversa_id, mid, direcao, conteudo, tipo = 'texto', enviada_por_id }) {
  const { data, error } = await supabase
    .from('inbox_mensagens')
    .insert([{ conversa_id, mid: mid || null, direcao, conteudo, tipo, enviada_por_id: enviada_por_id || null }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function marcarLidas(conversaId) {
  const { error } = await supabase
    .from('inbox_mensagens')
    .update({ lida: true })
    .eq('conversa_id', conversaId)
    .eq('lida', false)
    .eq('direcao', 'recebida')
  if (error) throw error
}

// Conta não lidas por marca (para badges na sidebar)
export async function getContagemNaoLidas() {
  const { data, error } = await supabase
    .from('inbox_conversas')
    .select('marca, status')
    .eq('status', 'aberto')
  if (error) throw error

  const contagem = {}
  for (const c of (data || [])) {
    contagem[c.marca] = (contagem[c.marca] || 0) + 1
  }
  contagem._total = Object.values(contagem).reduce((s, n) => s + n, 0)
  return contagem
}

// ── ENVIO VIA META GRAPH API ───────────────────────────────────
// Chama a Graph API do Meta para enviar mensagem pelo Messenger da marca
export async function enviarMensagemMeta({ page_id, access_token, messenger_id, texto }) {
  if (!access_token || !page_id || !messenger_id) {
    throw new Error('Credenciais Meta incompletas. Configure a marca em Configurações.')
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${page_id}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: messenger_id },
        message: { text: texto },
        access_token,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Erro Meta API: ${res.status}`)
  }
  return res.json()
}

// ── REALTIME SUBSCRIPTION ─────────────────────────────────────
// Escuta novas mensagens em tempo real no canal da conversa
export function subscribeConversa(conversaId, onNovaMensagem) {
  const channel = supabase
    .channel(`inbox:${conversaId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'inbox_mensagens',
        filter: `conversa_id=eq.${conversaId}`,
      },
      payload => onNovaMensagem(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Escuta atualizações na lista de conversas (nova mensagem chegou)
export function subscribeConversas(onUpdate) {
  const channel = supabase
    .channel('inbox:conversas')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'inbox_conversas' },
      payload => onUpdate(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
