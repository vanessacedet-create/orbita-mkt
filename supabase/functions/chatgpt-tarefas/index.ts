import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-orbita-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedKey = Deno.env.get('ORBITA_CHATGPT_API_KEY')
  const receivedKey = req.headers.get('x-orbita-api-key')
  if (!expectedKey || !receivedKey || receivedKey !== expectedKey) {
    return json({ error: 'Não autorizado' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const url = new URL(req.url)
  const path = url.pathname.replace(/^.*\/chatgpt-tarefas\/?/, '')
  const method = req.method.toUpperCase()

  try {
    // GET /usuarios?nome=Yasmin
    if (method === 'GET' && path === 'usuarios') {
      const nome = url.searchParams.get('nome')?.trim()
      let q = db.from('usuarios').select('id,nome,email,perfil').order('nome')
      if (nome) q = q.ilike('nome', `%${nome}%`)
      const { data, error } = await q.limit(20)
      if (error) throw error
      return json({ usuarios: data || [] })
    }

    // GET /tarefas?responsavel=Yasmin&status=a_fazer
    if (method === 'GET' && path === 'tarefas') {
      const responsavel = url.searchParams.get('responsavel')?.trim()
      const status = url.searchParams.get('status')?.trim()

      let responsavelId: string | null = null
      if (responsavel) {
        const { data: pessoas, error: pe } = await db
          .from('usuarios').select('id,nome').ilike('nome', `%${responsavel}%`).limit(10)
        if (pe) throw pe
        const exatas = (pessoas || []).filter(p => normalizar(p.nome) === normalizar(responsavel))
        const candidatos = exatas.length ? exatas : (pessoas || [])
        if (candidatos.length !== 1) {
          return json({ error: candidatos.length ? 'Responsável ambíguo' : 'Responsável não encontrado', candidatos }, 409)
        }
        responsavelId = candidatos[0].id
      }

      let q = db.from('tarefas_atribuidas').select(
        'id,banco_tarefa_id,especificidade,status,data_prazo,data_atribuicao,responsavel:responsavel_id(id,nome),banco_tarefa:banco_tarefa_id(id,nome,descricao)'
      ).eq('grupo', 'parceiras').order('data_atribuicao', { ascending: false })
      if (responsavelId) q = q.eq('responsavel_id', responsavelId)
      if (status) q = q.eq('status', status)
      const { data, error } = await q.limit(100)
      if (error) throw error
      return json({ tarefas: data || [] })
    }

    // POST /tarefas
    if (method === 'POST' && path === 'tarefas') {
      const body = await req.json()
      const titulo = String(body.titulo || '').trim()
      const responsavel = String(body.responsavel || '').trim()
      if (!titulo || !responsavel) return json({ error: 'titulo e responsavel são obrigatórios' }, 400)

      const { data: pessoas, error: pe } = await db
        .from('usuarios').select('id,nome,email').ilike('nome', `%${responsavel}%`).limit(10)
      if (pe) throw pe
      const exatas = (pessoas || []).filter(p => normalizar(p.nome) === normalizar(responsavel))
      const candidatos = exatas.length ? exatas : (pessoas || [])
      if (candidatos.length !== 1) {
        return json({ error: candidatos.length ? 'Responsável ambíguo' : 'Responsável não encontrado', candidatos }, 409)
      }
      const pessoa = candidatos[0]

      const prioridade = body.prioridade || 'media'
      if (!['baixa', 'media', 'alta', 'urgente'].includes(prioridade)) {
        return json({ error: 'prioridade inválida' }, 400)
      }

      // O módulo atual de Parceiras trabalha com um modelo do banco de tarefas
      // e uma atribuição. Para uma tarefa avulsa criada pelo chat, criamos um
      // modelo avulso e já o atribuímos à pessoa escolhida.
      const { data: criador, error: criadorError } = await db
        .from('usuarios').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle()
      if (criadorError) throw criadorError
      const atribuidaPor = body.atribuida_por || body.created_by || criador?.id || pessoa.id

      const { data: modelo, error: modeloError } = await db.from('banco_tarefas').insert([{
        nome: titulo,
        descricao: body.descricao || null,
        periodicidade: 'avulsa',
        responsavel_id: pessoa.id,
        created_by: atribuidaPor,
        grupo: 'parceiras',
        ativo: true,
      }]).select('id,nome,descricao').single()
      if (modeloError) throw modeloError

      const detalhes = [
        `Prioridade: ${prioridade}`,
        body.descricao ? String(body.descricao).trim() : '',
      ].filter(Boolean).join('\n')

      const { data: tarefa, error } = await db.from('tarefas_atribuidas').insert([{
        banco_tarefa_id: modelo.id,
        responsavel_id: pessoa.id,
        data_prazo: body.data_prazo || null,
        especificidade: detalhes || null,
        atribuida_por: atribuidaPor,
        status: 'a_fazer',
        grupo: 'parceiras',
        parceiros_ids: [],
      }]).select('id,banco_tarefa_id,status,data_prazo,especificidade').single()
      if (error) {
        await db.from('banco_tarefas').delete().eq('id', modelo.id)
        throw error
      }

      const { error: re } = await db.from('atribuicao_responsaveis').insert([
        { atribuicao_id: tarefa.id, usuario_id: pessoa.id },
      ])
      if (re) throw re

      const checklist = Array.isArray(body.checklist) ? body.checklist.map((x: unknown) => String(x).trim()).filter(Boolean) : []
      if (checklist.length) {
        const { error: ce } = await db.from('atribuicao_checklist').insert(
          checklist.map((texto: string, ordem: number) => ({ atribuicao_id: tarefa.id, texto, concluido: false, ordem }))
        )
        if (ce) throw ce
      }

      return json({ ok: true, tarefa: { ...tarefa, titulo: modelo.nome, responsavel: pessoa.nome } }, 201)
    }

    // PATCH /tarefas/:id
    if (method === 'PATCH' && path.startsWith('tarefas/')) {
      const id = path.split('/')[1]
      const body = await req.json()
      const permitidos = ['status', 'data_prazo']
      const updates: Record<string, unknown> = {}
      for (const campo of permitidos) if (campo in body) updates[campo] = body[campo]
      if (body.prioridade || body.descricao) {
        const { data: atual, error: ae } = await db.from('tarefas_atribuidas').select('especificidade').eq('id', id).single()
        if (ae) throw ae
        const linhas = String(atual?.especificidade || '').split('\n').filter(Boolean)
        const semPrioridade = linhas.filter((x: string) => !x.startsWith('Prioridade: '))
        updates.especificidade = [`Prioridade: ${body.prioridade || 'media'}`, body.descricao || semPrioridade.join('\n')].filter(Boolean).join('\n')
      }
      const { data, error } = await db.from('tarefas_atribuidas').update(updates).eq('id', id)
        .select('id,banco_tarefa_id,status,data_prazo,especificidade').single()
      if (error) throw error      return json({ ok: true, tarefa: data })
    }

    return json({ error: 'Rota não encontrada' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Erro interno' }, 500)
  }
})
