// ═══════════════════════════════════════════════════════════════
// ORBITA MKT — Edge Function: Webhook Meta Messenger
// Caminho: supabase/functions/meta-webhook/index.ts
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const VERIFY_TOKEN       = Deno.env.get('META_VERIFY_TOKEN')!   // você define este valor

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── HANDLER PRINCIPAL ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // ── GET: verificação do webhook pelo Meta ──────────────────
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado com sucesso')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Token inválido', { status: 403 })
  }

  // ── POST: receber eventos de mensagem ──────────────────────
  if (req.method === 'POST') {
    const body = await req.json()

    // O Meta envia um array de "entry", cada um com um array de "messaging"
    for (const entry of body?.entry || []) {
      const pageId = entry.id  // ID da página que recebeu a mensagem

      // Busca a marca correspondente a essa página
      const { data: marca } = await supabase
        .from('inbox_marcas')
        .select('*')
        .eq('page_id', pageId)
        .eq('ativo', true)
        .maybeSingle()

      if (!marca) {
        console.log(`Página ${pageId} não encontrada nas marcas cadastradas`)
        continue
      }

      for (const event of entry.messaging || []) {
        // Ignora eventos que não sejam mensagens (ex: delivery, read)
        if (!event.message) continue

        // Ignora mensagens enviadas pela própria página (eco)
        if (event.message.is_echo) continue

        const messengerId = event.sender.id
        const mid         = event.message.mid
        const texto       = event.message.text

        // Só processa mensagens de texto por enquanto
        if (!texto) continue

        // Busca parceiro vinculado a esse messenger_id, se existir
        const { data: conversaExistente } = await supabase
          .from('inbox_conversas')
          .select('parceiro_id')
          .eq('messenger_id', messengerId)
          .eq('marca', marca.nome)
          .maybeSingle()

        // Cria ou recupera a conversa
        let conversa
        const { data: conversaData, error: conversaError } = await supabase
          .from('inbox_conversas')
          .upsert(
            {
              messenger_id: messengerId,
              marca:        marca.nome,
              page_id:      pageId,
              parceiro_id:  conversaExistente?.parceiro_id || null,
              status:       'aberto',
            },
            { onConflict: 'messenger_id,marca', ignoreDuplicates: false }
          )
          .select('*')
          .maybeSingle()

        if (conversaError) {
          console.error('Erro ao criar conversa:', conversaError)
          continue
        }
        conversa = conversaData

        // Salva a mensagem (mid único evita duplicatas)
        const { error: msgError } = await supabase
          .from('inbox_mensagens')
          .insert({
            conversa_id: conversa.id,
            mid,
            direcao:     'recebida',
            conteudo:    texto,
            tipo:        'texto',
            lida:        false,
          })

        if (msgError && msgError.code !== '23505') {
          // 23505 = unique_violation (mensagem duplicada) — pode ignorar
          console.error('Erro ao salvar mensagem:', msgError)
        } else {
          console.log(`Mensagem salva — marca: ${marca.nome}, sender: ${messengerId}`)
        }
      }
    }

    // O Meta exige resposta 200 em menos de 20 segundos
    return new Response('OK', { status: 200 })
  }

  return new Response('Método não permitido', { status: 405 })
})
