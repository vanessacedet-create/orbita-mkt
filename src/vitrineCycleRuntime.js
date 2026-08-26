import { supabase } from './lib/supabase'
import { createVitrineCycleMarker, installVitrineCycleQueryPatch } from './lib/vitrineCycle'

// Faz a Vitrine Pública contar o limite a partir da última liberação manual.
installVitrineCycleQueryPatch()

function estilizarBotao(botao) {
  Object.assign(botao.style, {
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#15803d',
    borderRadius: '7px',
    padding: '5px 8px',
    marginRight: '4px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })
}

async function liberarNovoCiclo(email, nome, botao) {
  if (!email || email === '—') return

  const confirmado = window.confirm(
    `Liberar um novo pedido para ${nome || email}?\n\nOs pedidos anteriores deste mês deixarão de consumir o limite do novo ciclo. Depois do próximo pedido, a trava volta a valer normalmente.`
  )
  if (!confirmado) return

  const textoOriginal = botao.textContent
  botao.disabled = true
  botao.textContent = 'Liberando...'

  try {
    const { data: ultimoPedido, error: erroBusca } = await supabase
      .from('vitrine_pedidos')
      .select('id, observacoes')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (erroBusca) throw erroBusca

    if (!ultimoPedido) {
      window.alert('Este parceiro ainda não possui pedido anterior. Ele já pode solicitar normalmente na Vitrine.')
      return
    }

    const marker = createVitrineCycleMarker()
    const observacoes = [ultimoPedido.observacoes, marker].filter(Boolean).join(' ')

    const { error } = await supabase
      .from('vitrine_pedidos')
      .update({ observacoes })
      .eq('id', ultimoPedido.id)

    if (error) throw error

    window.alert(`Novo ciclo liberado para ${nome || email}. O parceiro já pode escolher novamente conforme o limite do grupo.`)
  } catch (err) {
    console.error('[Vitrine] Erro ao liberar novo ciclo:', err)
    window.alert('Não foi possível liberar o novo pedido. Tente novamente.')
  } finally {
    botao.disabled = false
    botao.textContent = textoOriginal
  }
}

function adicionarBotoesLiberacao() {
  if (window.location.pathname !== '/vitrine-admin') return

  const tabelas = Array.from(document.querySelectorAll('table'))
  for (const tabela of tabelas) {
    const cabecalhos = Array.from(tabela.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase())
    if (!cabecalhos.includes('nome') || !cabecalhos.includes('e-mail') || !cabecalhos.includes('grupo')) continue

    for (const linha of tabela.querySelectorAll('tbody tr')) {
      if (linha.querySelector('[data-orbita-liberar-ciclo="1"]')) continue

      const celulas = linha.querySelectorAll('td')
      if (celulas.length < 6) continue

      const nome = celulas[0]?.textContent?.trim() || ''
      const email = celulas[1]?.textContent?.trim() || ''
      const areaAcoes = celulas[celulas.length - 1]?.querySelector('div') || celulas[celulas.length - 1]
      if (!areaAcoes || !email || email === '—') continue

      const botao = document.createElement('button')
      botao.type = 'button'
      botao.dataset.orbitaLiberarCiclo = '1'
      botao.title = 'Liberar novo pedido antes da virada do mês'
      botao.textContent = 'Novo ciclo'
      estilizarBotao(botao)
      botao.addEventListener('click', () => liberarNovoCiclo(email, nome, botao))
      areaAcoes.prepend(botao)
    }
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const observer = new MutationObserver(adicionarBotoesLiberacao)
  const iniciar = () => {
    adicionarBotoesLiberacao()
    observer.observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true })
  } else {
    iniciar()
  }

  // React Router altera a URL sem recarregar a página; este intervalo leve garante
  // que o botão apareça ao entrar na Vitrine Admin depois da navegação interna.
  window.setInterval(adicionarBotoesLiberacao, 1500)
}
