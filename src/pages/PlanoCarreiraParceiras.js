// src/pages/PlanoCarreiraParceiras.js
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, ChevronDown, CheckCircle, Clock, Target, Users, Info } from 'lucide-react'

/* ============================================
   PLANO DE CARREIRA — EDITORAS PARCEIRAS
   Tabelas: pd_cargos, pd_tarefas, pd_competencias, pd_cobertura,
            pd_colaboradores, pd_avaliacoes, pd_historico
   Privacidade garantida no banco (RLS): cada colaboradora só
   recebe o próprio plano; supervisão e administração recebem todos.
   ============================================ */

const PERFIS_GESTAO = ['supervisor_parceiras', 'administrador']

const ESCALA = {
  1: 'Em treinamento',
  2: 'Executa com revisão',
  3: 'Autônoma (domina)',
  4: 'Referência',
}

const COLUNA_ESPERADO = {
  E: 'esperado_estagiario',
  J: 'esperado_junior',
  P: 'esperado_pleno',
  S: 'esperado_senior_supervisao',
}

const BLOCOS = {
  A: { titulo: 'Bloco A · Consolidar o cargo atual', cor: '#3b82f6' },
  B: { titulo: 'Bloco B · Preparar o próximo cargo', cor: '#8b5cf6' },
  C: { titulo: 'Bloco C · Cobertura de férias', cor: '#f59e0b' },
}

const STATUS = {
  nao: { label: 'Não avaliado',       cor: 'var(--text-muted)', fundo: 'var(--surface-2)' },
  dev: { label: 'Em desenvolvimento', cor: '#f97316',           fundo: 'rgba(249,115,22,0.12)' },
  ok:  { label: 'Atingido',           cor: 'var(--green)',      fundo: 'rgba(34,197,94,0.12)' },
}

const TAG_TOPO = { senior: 'só Sênior', supervisao: 'só Supervisão' }

// ════════════════════════════════════════════════════════════════
// REGRAS DOS BLOCOS (mesma lógica dos modelos em Excel)
// ════════════════════════════════════════════════════════════════
function trilhaDoCargo(codigo) {
  if (codigo.endsWith('_mkt')) return 'marketing'
  if (codigo.endsWith('_ops')) return 'operacoes'
  return null
}

function tarefasBlocoA(codigo, tarefas) {
  const sufixo = codigo.endsWith('_mkt') ? 'mkt' : codigo.endsWith('_ops') ? 'ops' : null
  let lista = []
  if (codigo === 'estagiario') lista = tarefas.filter(t => t.nivel_obrigatorio === 'base')
  else if (codigo.startsWith('junior_')) lista = tarefas.filter(t => ['base', `junior_${sufixo}`].includes(t.nivel_obrigatorio))
  else if (codigo.startsWith('pleno_')) lista = tarefas.filter(t => ['base', `junior_${sufixo}`, `pleno_${sufixo}`].includes(t.nivel_obrigatorio))
  else if (codigo === 'supervisao') lista = tarefas.filter(t => ['senior_supervisao', 'supervisao'].includes(t.nivel_obrigatorio) && ['ambos', 'supervisao'].includes(t.perfil_topo))
  else if (codigo === 'senior') lista = tarefas.filter(t => t.nivel_obrigatorio === 'senior_supervisao' && ['ambos', 'senior'].includes(t.perfil_topo))
  return lista
}

function gruposCompetenciaA(codigo) {
  if (codigo === 'estagiario') return ['transversal', 'marketing', 'operacoes']
  if (codigo === 'senior') return ['transversal', 'marketing', 'operacoes', 'senior']
  if (codigo === 'supervisao') return ['transversal', 'supervisao']
  return ['transversal', trilhaDoCargo(codigo)]
}

function montarPlano(colab, est, avaliacoes) {
  const cargo = est.cargos.find(c => c.codigo === colab.cargo_atual)
  if (!cargo) return null
  const nomeCargo = cod => est.cargos.find(c => c.codigo === cod)?.nome || cod
  const itens = []

  const addTarefa = (bloco, t, tag) => itens.push({
    bloco, tipo: 'tarefa', item_id: t.id, titulo: t.tarefa, grupo: t.familia, tag,
    esperado: bloco === 'A' ? 'Executa com autonomia, seguindo o POP' : 'Executa com autonomia',
    exigido: 3, periodicidade: t.periodicidade,
  })
  const addComp = (bloco, c, coluna, tag) => itens.push({
    bloco, tipo: 'competencia', item_id: c.id, titulo: c.competencia, grupo: 'Competências', tag,
    esperado: c[COLUNA_ESPERADO[coluna]] || '—', definicao: c.definicao, exigido: 3,
  })

  // Bloco A
  tarefasBlocoA(cargo.codigo, est.tarefas).forEach(t => addTarefa('A', t))
  const gruposA = gruposCompetenciaA(cargo.codigo)
  est.competencias.filter(c => gruposA.includes(c.grupo)).forEach(c => addComp('A', c, cargo.coluna_competencia))

  // Bloco B
  const topo = !(cargo.proximos || []).length
  if (!topo) {
    if (cargo.codigo === 'estagiario') {
      est.competencias.filter(c => c.grupo === 'transversal').forEach(c => addComp('B', c, 'J'))
    } else if (cargo.codigo.startsWith('junior_')) {
      const trilha = trilhaDoCargo(cargo.codigo)
      const sufixo = cargo.codigo.endsWith('_mkt') ? 'mkt' : 'ops'
      est.tarefas.filter(t => t.nivel_obrigatorio === `pleno_${sufixo}`).forEach(t => addTarefa('B', t))
      est.competencias.filter(c => ['transversal', trilha].includes(c.grupo)).forEach(c => addComp('B', c, 'P'))
    } else if (cargo.codigo.startsWith('pleno_')) {
      const trilha = trilhaDoCargo(cargo.codigo)
      est.tarefas.filter(t => t.nivel_obrigatorio === 'senior_supervisao').forEach(t => addTarefa('B', t, TAG_TOPO[t.perfil_topo]))
      est.competencias
        .filter(c => ['transversal', trilha, 'supervisao', 'senior'].includes(c.grupo))
        .forEach(c => addComp('B', c, 'S', c.grupo === 'supervisao' ? 'Supervisão' : c.grupo === 'senior' ? 'Sênior' : null))
    }
  }

  // Bloco C
  est.cobertura.filter(c => c.cargo_que_cobre === cargo.codigo).forEach(c => itens.push({
    bloco: 'C', tipo: 'cobertura', item_id: c.id, titulo: c.item, grupo: 'Cobertura de férias',
    esperado: `Cobre na ausência de: ${nomeCargo(c.na_ausencia_de)}`, exigido: 2,
  }))

  // Junta com as avaliações gravadas
  const mapa = new Map(avaliacoes.map(a => [`${a.bloco}|${a.tipo}|${a.item_id}`, a]))
  itens.forEach(i => {
    const a = mapa.get(`${i.bloco}|${i.tipo}|${i.item_id}`) || {}
    i.avaliacao = a
    i.status = a.nota_supervisao == null ? 'nao' : a.nota_supervisao >= i.exigido ? 'ok' : 'dev'
  })

  const pct = bloco => {
    const doBloco = itens.filter(i => i.bloco === bloco)
    if (!doBloco.length) return null
    return Math.round((doBloco.filter(i => i.status === 'ok').length / doBloco.length) * 100)
  }
  const pctA = pct('A'), pctB = pct('B'), pctC = pct('C')

  const alvoLabel = colab.cargo_alvo
    ? nomeCargo(colab.cargo_alvo)
    : topo ? 'Topo da trilha' : (cargo.proximos || []).map(nomeCargo).join(' ou ') + ' (a definir)'

  return {
    cargo, itens, pctA, pctB, pctC, topo, alvoLabel,
    apta: !topo && pctA === 100 && (pctB === null || pctB === 100),
    prontaFerias: pctC !== null && pctC === 100,
  }
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function PlanoCarreiraParceiras() {
  const { usuario } = useAuth()
  const [est, setEst] = useState(null)
  const [colab, setColab] = useState(null)
  const [avaliacoes, setAvaliacoes] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState(null)

  const ehGestao = PERFIS_GESTAO.includes(usuario?.perfil)

  useEffect(() => { if (usuario?.id) carregar() }, [usuario?.id])

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      const [cg, tf, cp, cb] = await Promise.all([
        supabase.from('pd_cargos').select('*').order('nivel_ordem'),
        supabase.from('pd_tarefas').select('*').order('id'),
        supabase.from('pd_competencias').select('*').order('id'),
        supabase.from('pd_cobertura').select('*').order('id'),
      ])
      const falha = [cg, tf, cp, cb].find(r => r.error)
      if (falha) throw falha.error
      setEst({ cargos: cg.data || [], tarefas: tf.data || [], competencias: cp.data || [], cobertura: cb.data || [] })

      const { data: meu, error: eColab } = await supabase
        .from('pd_colaboradores').select('*').eq('usuario_id', usuario.id).eq('ativo', true).maybeSingle()
      if (eColab) throw eColab
      setColab(meu || null)

      if (meu) {
        const [av, hi] = await Promise.all([
          supabase.from('pd_avaliacoes').select('*').eq('colaborador_id', meu.id),
          supabase.from('pd_historico').select('*').eq('colaborador_id', meu.id).order('data'),
        ])
        if (av.error) throw av.error
        if (hi.error) throw hi.error
        setAvaliacoes(av.data || [])
        setHistorico(hi.data || [])
      }
    } catch (e) {
      setErro('Erro ao carregar o plano: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function salvarAutoavaliacao(item, valor) {
    const nota = valor === '' ? null : Number(valor)
    const { data, error } = await supabase
      .from('pd_avaliacoes')
      .upsert(
        { colaborador_id: colab.id, bloco: item.bloco, tipo: item.tipo, item_id: item.item_id, autoavaliacao: nota },
        { onConflict: 'colaborador_id,bloco,tipo,item_id' }
      )
      .select()
      .single()
    if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return }
    setAvaliacoes(prev => {
      const outras = prev.filter(a => a.id !== data.id)
      return [...outras, data]
    })
    mostrarToast('Autoavaliação salva!')
  }

  const plano = useMemo(
    () => (colab && est ? montarPlano(colab, est, avaliacoes) : null),
    [colab, est, avaliacoes]
  )

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <TrendingUp size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Plano de Carreira</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Editoras Parceiras · desenvolvimento e prontidão por cargo
          </p>
        </div>
      </div>

      {erro && <Aviso texto={erro} />}

      {!erro && ehGestao && !colab && (
        <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={34} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14 }}>A tela da equipe está em construção (próxima etapa).</p>
        </div>
      )}

      {!erro && !ehGestao && !colab && (
        <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Info size={34} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Seu plano ainda não foi cadastrado. Fale com a supervisão.</p>
        </div>
      )}

      {!erro && colab && plano && (
        <MeuPlano nome={usuario?.nome} plano={plano} historico={historico} onAutoavaliar={salvarAutoavaliacao} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 420,
          background: toast.tipo === 'erro' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// TELA "MEU PLANO"
// ════════════════════════════════════════════════════════════════
function MeuPlano({ nome, plano, historico, onAutoavaliar }) {
  return (
    <>
      <div className="table-card" style={{ padding: '16px 20px', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{nome}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {plano.cargo.nome} <span style={{ margin: '0 6px' }}>→</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{plano.alvoLabel}</span>
        </div>
      </div>

      <Prontidao plano={plano} />

      <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 14px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>Escala:</span>
        {Object.entries(ESCALA).map(([n, l]) => <span key={n}><strong>{n}</strong> {l}</span>)}
        <span>· Exigido: 3 nos Blocos A e B, 2 no Bloco C</span>
      </div>

      {['A', 'B', 'C'].map(b => {
        const itens = plano.itens.filter(i => i.bloco === b)
        if (!itens.length) return null
        return <BlocoItens key={b} bloco={b} itens={itens} onAutoavaliar={onAutoavaliar} />
      })}

      <Historico historico={historico} />
    </>
  )
}

function Prontidao({ plano }) {
  const barras = [
    { k: 'A', v: plano.pctA },
    { k: 'B', v: plano.pctB },
    { k: 'C', v: plano.pctC },
  ]
  return (
    <div className="table-card" style={{ padding: '16px 20px', marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {barras.map(({ k, v }) => (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{BLOCOS[k].titulo}</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{v === null ? '—' : `${v}%`}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${v || 0}%`, background: BLOCOS[k].cor, borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
            {v === null && k === 'B' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Topo da trilha</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {plano.topo
          ? <Selo ok texto="Topo da trilha" />
          : <Selo ok={plano.apta} texto={plano.apta ? 'Apta à promoção, conforme oportunidade' : 'Ainda não apta à promoção'} />}
        <Selo ok={plano.prontaFerias} texto={plano.prontaFerias ? 'Pronta para cobrir férias' : 'Ainda não pronta para cobrir férias'} />
      </div>
    </div>
  )
}

function Selo({ ok, texto }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      padding: '5px 10px', borderRadius: 20,
      background: ok ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)',
      color: ok ? 'var(--green)' : 'var(--text-muted)',
    }}>
      {ok ? <CheckCircle size={13} /> : <Clock size={13} />} {texto}
    </span>
  )
}

function BlocoItens({ bloco, itens, onAutoavaliar }) {
  const [aberto, setAberto] = useState(true)
  const atingidos = itens.filter(i => i.status === 'ok').length

  // agrupa: tarefas por família, depois competências, depois cobertura
  const grupos = []
  itens.forEach(i => {
    const nomeGrupo = i.tipo === 'tarefa' ? `Tarefas · ${i.grupo}` : i.grupo
    let g = grupos.find(x => x.nome === nomeGrupo)
    if (!g) { g = { nome: nomeGrupo, itens: [] }; grupos.push(g) }
    g.itens.push(i)
  })

  return (
    <div className="table-card" style={{ marginBottom: 12, overflow: 'hidden', borderLeft: `3px solid ${BLOCOS[bloco].cor}` }}>
      <button onClick={() => setAberto(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
        background: 'none', border: 'none', cursor: 'pointer', borderBottom: aberto ? '1px solid var(--border)' : 'none',
      }}>
        <ChevronDown size={15} color="var(--text-muted)" style={{ transform: aberto ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{BLOCOS[bloco].titulo}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{atingidos}/{itens.length} atingidos</span>
      </button>

      {aberto && grupos.map(g => (
        <div key={g.nome}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 110px 150px 130px', gap: 8,
            padding: '7px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>{g.nome}</span>
            <span style={{ textAlign: 'center' }}>Exigido</span>
            <span style={{ textAlign: 'center' }}>Supervisão</span>
            <span style={{ textAlign: 'center' }}>Minha autoavaliação</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>
          {g.itens.map(i => <LinhaItem key={`${i.bloco}-${i.tipo}-${i.item_id}`} item={i} onAutoavaliar={onAutoavaliar} />)}
        </div>
      ))}
    </div>
  )
}

function LinhaItem({ item, onAutoavaliar }) {
  const a = item.avaliacao || {}
  const st = STATUS[item.status]
  const diverge = a.nota_supervisao != null && a.autoavaliacao != null && a.nota_supervisao !== a.autoavaliacao
  return (
    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 110px 150px 130px', gap: 8, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {item.titulo}
            {item.tag && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, padding: '0 5px' }}>
                {item.tag}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.esperado}</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.exigido}</div>
        <div style={{ textAlign: 'center' }} title={a.nota_supervisao ? ESCALA[a.nota_supervisao] : 'Ainda não avaliado'}>
          {a.nota_supervisao
            ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.nota_supervisao}</span>
            : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <select className="form-select" value={a.autoavaliacao ?? ''} onChange={e => onAutoavaliar(item, e.target.value)}
            style={{ padding: '4px 6px', fontSize: 12, width: '100%', borderColor: diverge ? '#f97316' : undefined }}
            title={diverge ? 'Sua autoavaliação está diferente da avaliação da supervisão' : ''}>
            <option value="">—</option>
            {Object.entries(ESCALA).map(([n, l]) => <option key={n} value={n}>{n} · {l}</option>)}
          </select>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: st.cor, background: st.fundo, whiteSpace: 'nowrap' }}>
            {st.label}
          </span>
        </div>
      </div>
      {(a.evidencia || a.acao || a.prazo) && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {a.evidencia && <span><strong>Evidência:</strong> {a.evidencia}</span>}
          {a.acao && <span><strong>Ação de desenvolvimento:</strong> {a.acao}</span>}
          {a.prazo && <span><strong>Prazo:</strong> {fmtData(a.prazo)}</span>}
        </div>
      )}
    </div>
  )
}

// ── Histórico trimestral (gráfico simples em SVG) ──────────────
function Historico({ historico }) {
  return (
    <div className="table-card" style={{ padding: '16px 20px', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Target size={16} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Histórico trimestral</span>
      </div>
      {historico.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Ainda não há avaliações trimestrais registradas. A evolução aparece aqui a cada trimestre.
        </p>
      ) : (
        <>
          <GraficoHistorico historico={historico} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...historico].reverse().map(h => (
              <div key={h.id} style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <strong style={{ color: 'var(--text)' }}>{h.trimestre}</strong> · {fmtData(h.data)} · A {fmtPct(h.pct_a)} · B {fmtPct(h.pct_b)} · C {fmtPct(h.pct_c)}
                {h.avancos && <div><strong>Avanços:</strong> {h.avancos}</div>}
                {h.prioridades && <div><strong>Prioridades do próximo trimestre:</strong> {h.prioridades}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GraficoHistorico({ historico }) {
  const W = 600, H = 180, P = 30
  const n = historico.length
  const x = i => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1))
  const y = v => H - P - ((Number(v) || 0) * (H - 2 * P)) / 100
  const series = [
    { k: 'pct_a', cor: BLOCOS.A.cor, nome: 'A' },
    { k: 'pct_b', cor: BLOCOS.B.cor, nome: 'B' },
    { k: 'pct_c', cor: BLOCOS.C.cor, nome: 'C' },
  ]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 700, height: 'auto' }}>
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={4} y={y(v) + 4} fontSize="10" fill="var(--text-muted)">{v}%</text>
          </g>
        ))}
        {series.map(s => {
          const pts = historico.map((h, i) => (h[s.k] == null ? null : [x(i), y(h[s.k])])).filter(Boolean)
          return (
            <g key={s.k}>
              {pts.length > 1 && <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.cor} strokeWidth="2" />}
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.cor} />)}
            </g>
          )
        })}
        {historico.map((h, i) => (
          <text key={h.id} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--text-muted)">{h.trimestre}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
        {series.map(s => (
          <span key={s.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.cor }} /> Bloco {s.nome}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Auxiliares ──────────────────────────────────────────────────
function fmtData(d) {
  if (!d) return '—'
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

function fmtPct(v) {
  return v == null ? '—' : `${Math.round(Number(v))}%`
}

function Aviso({ texto }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>
      {texto}
    </div>
  )
}
