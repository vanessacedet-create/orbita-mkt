import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ⚠️ TROQUE pelo SEU e-mail de login no Orbita (só você acessa esta tela)
const DONO_EMAIL = 'vanessa@cedet.com.br'

// ── Paleta / helpers de estilo ──────────────────────────────────
const CORES_PROJETO = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const STATUS_LABEL = { a_fazer: 'A fazer', fazendo: 'Fazendo', pausada: 'Pausada', concluida: 'Concluída' }
const STATUS_COR   = { a_fazer: '#64748b', fazendo: '#0ea5e9', pausada: '#94a3b8', concluida: '#10b981' }
const PRIO_LABEL   = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const PRIO_COR     = { baixa: '#94a3b8', media: '#f59e0b', alta: '#ef4444' }
const PROJ_STATUS  = { ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído', arquivado: 'Arquivado' }

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : null)
const hojeISO = () => new Date().toISOString().slice(0, 10)
const atrasada = (t) => t.prazo && t.status !== 'concluida' && t.prazo < hojeISO()

const FASE_LABEL = {
  planejado: 'Planejado',
  preparacao: 'Em preparação',
  andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
}
const FASE_COR = {
  planejado: '#64748b',
  preparacao: '#f59e0b',
  andamento: '#0ea5e9',
  pausado: '#94a3b8',
  concluido: '#10b981',
}

function faseDoProjeto(projeto, tarefasProjeto) {
  if (projeto.status === 'concluido') return 'concluido'
  if (projeto.status === 'pausado') return 'pausado'
  if (!tarefasProjeto.length) return 'planejado'
  const iniciou = tarefasProjeto.some((t) => ['fazendo', 'concluida'].includes(t.status))
  return iniciou ? 'andamento' : 'preparacao'
}

function limiteTrimestre(offset = 0) {
  const agora = new Date()
  const trimestreAtual = Math.floor(agora.getMonth() / 3)
  const inicio = new Date(agora.getFullYear(), (trimestreAtual + offset) * 3, 1)
  const fim = new Date(agora.getFullYear(), (trimestreAtual + offset + 1) * 3, 0)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { inicio: iso(inicio), fim: iso(fim) }
}

function pertenceAoTrimestre(projeto, filtro) {
  if (filtro === 'todos') return true
  if (filtro === 'sem_prazo') return !projeto.prazo
  if (!projeto.prazo) return false
  const periodo = limiteTrimestre(filtro === 'proximo' ? 1 : 0)
  return projeto.prazo >= periodo.inicio && projeto.prazo <= periodo.fim
}

// Ordena tarefas: concluídas no fim; ativas por prazo crescente (sem prazo por último)
const ordenaTarefas = (arr) => [...arr].sort((a, b) => {
  const ca = a.status === 'concluida' ? 1 : 0
  const cb = b.status === 'concluida' ? 1 : 0
  if (ca !== cb) return ca - cb
  if (!a.prazo && !b.prazo) return 0
  if (!a.prazo) return 1
  if (!b.prazo) return -1
  return a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : 0
})

const s = {
  page:    { padding: 24, maxWidth: 1100, margin: '0 auto', color: 'var(--text, #e5e7eb)' },
  h1:      { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text, #f1f5f9)' },
  sub:     { color: 'var(--text-muted, #94a3b8)', marginTop: 4, fontSize: 14 },
  btn:     { background: 'var(--accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost:{ background: 'var(--card-bg, rgba(255,255,255,0.04))', color: 'var(--text, #e5e7eb)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer' },
  card:    { background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.10))', borderRadius: 12, padding: 16, marginBottom: 16 },
  input:   { width: '100%', padding: '9px 12px', border: '1px solid var(--border, rgba(255,255,255,0.15))', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: 'var(--input-bg, rgba(255,255,255,0.05))', color: 'var(--text, #e5e7eb)' },
  label:   { fontSize: 13, fontWeight: 600, color: 'var(--text-muted, #cbd5e1)', display: 'block', marginBottom: 4, marginTop: 10 },
  badge:   (bg) => ({ background: bg, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }),
  chip:    (c) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c, marginRight: 8 }),
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', fontSize: 14, padding: '2px 6px' },
}

export default function BaseComando() {
  const [autorizada, setAutorizada] = useState(null) // null = verificando
  const [projetos, setProjetos] = useState([])
  const [tarefas, setTarefas]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null) // 'projeto' | 'tarefa' | {tipo:'editar-projeto',p} | {tipo:'editar-tarefa',t} | {tipo:'excluir-projeto',p}
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroFase, setFiltroFase] = useState('todas')
  const [filtroTrimestre, setFiltroTrimestre] = useState('atual')
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const dragId = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)

  // Trava de acesso por e-mail
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email?.toLowerCase()
      setAutorizada(email === DONO_EMAIL.toLowerCase())
    })
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [{ data: proj }, { data: tar }] = await Promise.all([
      supabase.from('bc_projetos').select('*').order('ordem', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('bc_tarefas').select('*').order('created_at', { ascending: false }),
    ])
    setProjetos(proj || [])
    setTarefas(tar || [])
    setCarregando(false)
  }, [])

  useEffect(() => { if (autorizada) carregar() }, [autorizada, carregar])

  // ── Ações de tarefa ───────────────────────────────────────────
  const toggleConcluida = async (t) => {
    const nova = t.status === 'concluida' ? 'a_fazer' : 'concluida'
    await supabase.from('bc_tarefas').update({
      status: nova,
      concluida_em: nova === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', t.id)
    carregar()
  }

  const mudarStatus = async (t, status) => {
    await supabase.from('bc_tarefas').update({
      status,
      concluida_em: status === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', t.id)
    carregar()
  }

  const excluirTarefa = async (id) => {
    if (!window.confirm('Excluir esta tarefa?')) return
    await supabase.from('bc_tarefas').delete().eq('id', id)
    carregar()
  }

  // Tarefa rápida (input inline no rodapé do projeto)
  const criarTarefaRapida = async (titulo, projeto_id) => {
    if (!titulo.trim()) return
    await supabase.from('bc_tarefas').insert([{ titulo: titulo.trim(), projeto_id: projeto_id || null, prioridade: 'media', status: 'a_fazer' }])
    carregar()
  }

  // ── Ações de projeto ──────────────────────────────────────────
  const toggleColapso = async (p) => {
    // otimista: atualiza na tela antes do banco
    setProjetos((prev) => prev.map((x) => x.id === p.id ? { ...x, colapsado: !p.colapsado } : x))
    await supabase.from('bc_projetos').update({ colapsado: !p.colapsado }).eq('id', p.id)
  }

  const arquivarProjeto = async (p) => {
    await supabase.from('bc_projetos').update({ status: 'arquivado' }).eq('id', p.id)
    setModal(null)
    carregar()
  }

  const excluirProjeto = async (p) => {
    await supabase.from('bc_projetos').delete().eq('id', p.id)
    setModal(null)
    carregar()
  }

  // ── Drag-and-drop de projetos (HTML5 nativo) ──────────────────
  const onDrop = async (targetId) => {
    const fromId = dragId.current
    dragId.current = null
    setDragOverId(null)
    if (!fromId || fromId === targetId) return
    const lista = projetos.filter((p) => p.status !== 'arquivado' || mostrarArquivados)
    const ids = lista.map((p) => p.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    // reordena no estado (otimista) e persiste "ordem" sequencial
    const mapa = Object.fromEntries(ids.map((id, i) => [id, i + 1]))
    const novos = [...projetos].sort((a, b) => (mapa[a.id] ?? 999) - (mapa[b.id] ?? 999))
    setProjetos(novos)
    await Promise.all(ids.map((id, i) => supabase.from('bc_projetos').update({ ordem: i + 1 }).eq('id', id)))
  }

  // ── Filtro ────────────────────────────────────────────────────
  const passaFiltro = (t) => {
    if (filtroStatus === 'ativas') return t.status !== 'concluida'
    if (filtroStatus === 'concluidas') return t.status === 'concluida'
    return true
  }
  const tarefasFiltradas = tarefas.filter(passaFiltro)
  const avulsas = ordenaTarefas(tarefasFiltradas.filter((t) => !t.projeto_id))
  const porProjeto = (pid) => ordenaTarefas(tarefasFiltradas.filter((t) => t.projeto_id === pid))

  const projetosComFase = projetos.map((p) => {
    const tarefasProjeto = tarefas.filter((t) => t.projeto_id === p.id)
    return { ...p, faseCalculada: faseDoProjeto(p, tarefasProjeto), tarefasProjeto }
  })
  const contagemFases = Object.keys(FASE_LABEL).reduce((acc, fase) => {
    acc[fase] = projetosComFase.filter((p) => p.status !== 'arquivado' && p.faseCalculada === fase).length
    return acc
  }, {})
  const projetosVisiveis = projetosComFase
    .filter((p) => mostrarArquivados || p.status !== 'arquivado')
    .filter((p) => filtroFase === 'todas' || p.faseCalculada === filtroFase)
    .filter((p) => pertenceAoTrimestre(p, filtroTrimestre))
  const temArquivados = projetos.some((p) => p.status === 'arquivado')

  // ── Estados de acesso ─────────────────────────────────────────
  if (autorizada === null) return <div style={s.page}><p style={{ color: 'var(--text-muted, #94a3b8)' }}>Verificando acesso…</p></div>
  if (!autorizada) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <p>Esta é uma área privada da Base de Comando.</p>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={s.h1}>🛰️ Projetos do Trimestre</h1>
          <p style={s.sub}>Planejamento e acompanhamento dos seus projetos. Área privada de Vanessa Rocha.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnGhost} onClick={() => setModal('projeto')}>+ Projeto</button>
          <button style={s.btn} onClick={() => setModal('tarefa')}>+ Tarefa</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:10, margin:'18px 0 14px' }}>
        {Object.entries(FASE_LABEL).map(([fase, label]) => (
          <button key={fase} onClick={() => setFiltroFase(filtroFase === fase ? 'todas' : fase)}
            style={{ ...s.card, margin:0, padding:'12px 14px', cursor:'pointer', textAlign:'left', borderTop:`3px solid ${FASE_COR[fase]}`, ...(filtroFase === fase ? { background:'var(--accent-glow)', borderColor:FASE_COR[fase] } : {}) }}>
            <div style={{ fontSize:11, color:'var(--text-muted, #94a3b8)', fontWeight:700, textTransform:'uppercase' }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:FASE_COR[fase], marginTop:3 }}>{contagemFases[fase] || 0}</div>
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filtroTrimestre} onChange={(e) => setFiltroTrimestre(e.target.value)} style={{ ...s.input, width:'auto', minWidth:180 }}>
          <option value="atual" style={{ color:'#0f172a', background:'#fff' }}>Trimestre atual</option>
          <option value="proximo" style={{ color:'#0f172a', background:'#fff' }}>Próximo trimestre</option>
          <option value="sem_prazo" style={{ color:'#0f172a', background:'#fff' }}>Sem prazo definido</option>
          <option value="todos" style={{ color:'#0f172a', background:'#fff' }}>Todos os períodos</option>
        </select>
        {[['todas', 'Todas as tarefas'], ['ativas', 'Tarefas ativas'], ['concluidas', 'Tarefas concluídas']].map(([k, v]) => (
          <button key={k} onClick={() => setFiltroStatus(k)}
            style={{ ...s.btnGhost, ...(filtroStatus === k ? { background:'#6366f1', color:'#fff', borderColor:'#6366f1' } : {}) }}>{v}</button>
        ))}
        {(filtroFase !== 'todas' || filtroTrimestre !== 'atual') && (
          <button style={s.btnGhost} onClick={() => { setFiltroFase('todas'); setFiltroTrimestre('atual') }}>Limpar filtros</button>
        )}
        {temArquivados && (
          <label style={{ marginLeft:'auto', fontSize:13, color:'var(--text-muted, #94a3b8)', display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="checkbox" checked={mostrarArquivados} onChange={(e) => setMostrarArquivados(e.target.checked)} />
            Mostrar arquivados
          </label>
        )}
      </div>

      {carregando ? (
        <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Carregando…</p>
      ) : (
        <>
          {projetosVisiveis.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
              Nenhum projeto ainda. Crie o primeiro em <b>+ Projeto</b>.
            </div>
          )}

          {projetosVisiveis.map((p) => {
            const ts = porProjeto(p.id)
            const doProjeto = tarefas.filter((t) => t.projeto_id === p.id)
            const pausadas = doProjeto.filter((t) => t.status === 'pausada').length
            const ativas = doProjeto.filter((t) => t.status !== 'pausada')
            const feitas = ativas.filter((t) => t.status === 'concluida').length
            const total = ativas.length
            const pct = total > 0 ? Math.round((feitas / total) * 100) : 0
            const arquivado = p.status === 'arquivado'
            const proximaAcao = ordenaTarefas(doProjeto.filter((t) => t.status !== 'concluida'))[0]
            return (
              <div key={p.id}
                draggable
                onDragStart={(e) => { dragId.current = p.id; e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== p.id) setDragOverId(p.id) }}
                onDragLeave={() => setDragOverId((cur) => (cur === p.id ? null : cur))}
                onDrop={(e) => { e.preventDefault(); onDrop(p.id) }}
                onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
                style={{
                  ...s.card,
                  borderLeft: `4px solid ${p.cor || '#6366f1'}`,
                  opacity: arquivado ? 0.55 : 1,
                  outline: dragOverId === p.id ? '2px dashed #6366f1' : 'none',
                  outlineOffset: 2,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span title="Arraste para reordenar" style={{ cursor: 'grab', color: 'var(--text-muted, #64748b)', fontSize: 14, userSelect: 'none' }}>⠿</span>
                    <button style={s.iconBtn} title={p.colapsado ? 'Expandir' : 'Recolher'} onClick={() => toggleColapso(p)}>
                      {p.colapsado ? '▸' : '▾'}
                    </button>
                    <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text, #f1f5f9)' }}>
                      <span style={s.chip(p.cor || '#6366f1')} />{p.nome}
                    </span>
                    <span style={{ marginLeft:6, ...s.badge(FASE_COR[p.faseCalculada]) }}>{FASE_LABEL[p.faseCalculada]}</span>
                    {p.prazo && <span style={{ marginLeft:4, fontSize:12, color:'var(--text-muted, #94a3b8)' }}>prazo {fmtData(p.prazo)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                      {feitas}/{total} concluídas{pausadas > 0 && <span style={{ color: STATUS_COR.pausada }}> · {pausadas} pausada{pausadas > 1 ? 's' : ''}</span>}
                    </span>
                    <button style={s.iconBtn} title="Editar projeto" onClick={() => setModal({ tipo: 'editar-projeto', p })}>✏️</button>
                    <button style={{ ...s.btnGhost, padding: '4px 10px', color: '#ef4444' }} onClick={() => setModal({ tipo: 'excluir-projeto', p })}>excluir</button>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: p.cor || '#6366f1', transition: 'width .3s' }} />
                </div>

                {!p.colapsado && (
                  <>
                    {p.descricao && <p style={{ color:'var(--text-muted, #94a3b8)', fontSize:13, margin:'8px 0 0 18px' }}>{p.descricao}</p>}
                    {proximaAcao && (
                      <div style={{ margin:'10px 0 0 18px', padding:'8px 10px', borderRadius:8, background:'var(--accent-glow)', border:'1px solid var(--border, rgba(255,255,255,.1))', fontSize:12 }}>
                        <strong style={{ color:'var(--accent)' }}>Próxima ação:</strong> <span style={{ color:'var(--text)' }}>{proximaAcao.titulo}</span>
                        {proximaAcao.responsavel && <span style={{ color:'var(--text-muted)', marginLeft:8 }}>· {proximaAcao.responsavel}</span>}
                        {proximaAcao.prazo && <span style={{ color:'var(--text-muted)', marginLeft:8 }}>· {fmtData(proximaAcao.prazo)}</span>}
                      </div>
                    )}
                    <div style={{ marginTop:10 }}>
                      {ts.length === 0
                        ? <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 13, marginLeft: 18 }}>Sem tarefas neste filtro.</p>
                        : ts.map((t) => <LinhaTarefa key={t.id} t={t} onToggle={toggleConcluida} onStatus={mudarStatus} onDelete={excluirTarefa} onEdit={() => setModal({ tipo: 'editar-tarefa', t })} />)}
                    </div>
                    <TarefaRapida onAdd={(titulo) => criarTarefaRapida(titulo, p.id)} />
                  </>
                )}
              </div>
            )
          })}

          <div style={{ ...s.card, borderLeft: '4px dashed #cbd5e1' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-muted, #cbd5e1)' }}>Demandas avulsas</div>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, margin: '2px 0 10px' }}>Tarefas que não pertencem a nenhum projeto.</p>
            {avulsas.length === 0
              ? <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 13 }}>Nenhuma demanda avulsa neste filtro.</p>
              : avulsas.map((t) => <LinhaTarefa key={t.id} t={t} onToggle={toggleConcluida} onStatus={mudarStatus} onDelete={excluirTarefa} onEdit={() => setModal({ tipo: 'editar-tarefa', t })} />)}
            <TarefaRapida onAdd={(titulo) => criarTarefaRapida(titulo, null)} />
          </div>
        </>
      )}

      {modal === 'projeto' && <ModalProjeto onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
      {modal === 'tarefa'  && <ModalTarefa projetos={projetos} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
      {modal?.tipo === 'editar-projeto' && <ModalProjeto projeto={modal.p} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
      {modal?.tipo === 'editar-tarefa'  && <ModalTarefa tarefa={modal.t} projetos={projetos} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
      {modal?.tipo === 'excluir-projeto' && (
        <ModalExcluirProjeto p={modal.p} onClose={() => setModal(null)} onArquivar={() => arquivarProjeto(modal.p)} onExcluir={() => excluirProjeto(modal.p)} />
      )}
    </div>
  )
}

// ── Input de tarefa rápida ────────────────────────────────────
function TarefaRapida({ onAdd }) {
  const [v, setV] = useState('')
  const enviar = () => { if (v.trim()) { onAdd(v); setV('') } }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        style={{ ...s.input, fontSize: 13, padding: '7px 10px' }}
        placeholder="+ Adicionar tarefa rápida e apertar Enter…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') enviar() }}
      />
    </div>
  )
}

// ── Linha de tarefa ───────────────────────────────────────────
function LinhaTarefa({ t, onToggle, onStatus, onDelete, onEdit }) {
  const feita = t.status === 'concluida'
  const pausada = t.status === 'pausada'
  const late = atrasada(t)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', opacity: pausada ? 0.6 : 1 }}>
      <input type="checkbox" checked={feita} onChange={() => onToggle(t)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: feita ? 'var(--text-muted, #94a3b8)' : 'var(--text, #f1f5f9)', textDecoration: feita ? 'line-through' : 'none' }}>
          {t.titulo}
          {late && <span style={{ ...s.badge('#ef4444'), marginLeft: 8 }}>atrasada</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
          <span style={s.badge(PRIO_COR[t.prioridade])}>{PRIO_LABEL[t.prioridade]}</span>
          {t.responsavel && <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>👤 {t.responsavel}</span>}
          {t.prazo && <span style={{ fontSize: 11, color: late ? '#ef4444' : 'var(--text-muted, #94a3b8)', fontWeight: late ? 700 : 400 }}>📅 {fmtData(t.prazo)}</span>}
        </div>
      </div>
      <select value={t.status} onChange={(e) => onStatus(t, e.target.value)}
        style={{ border: `1px solid ${STATUS_COR[t.status]}`, color: STATUS_COR[t.status], borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: 'var(--card-bg, rgba(255,255,255,0.05))' }}>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k} style={{ color: '#0f172a', background: '#fff' }}>{v}</option>)}
      </select>
      <button onClick={onEdit} style={s.iconBtn} title="Editar tarefa">✏️</button>
      <button onClick={() => onDelete(t.id)} style={{ ...s.btnGhost, padding: '4px 10px', color: '#ef4444' }}>×</button>
    </div>
  )
}

// ── Modal: projeto (novo ou edição) ───────────────────────────
function ModalProjeto({ projeto, onClose, onSaved }) {
  const editando = !!projeto
  const [form, setForm] = useState(editando
    ? { nome: projeto.nome || '', descricao: projeto.descricao || '', status: projeto.status || 'ativo', cor: projeto.cor || CORES_PROJETO[0], prazo: projeto.prazo || '' }
    : { nome: '', descricao: '', status: 'ativo', cor: CORES_PROJETO[0], prazo: '' })
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!form.nome.trim()) return alert('Dê um nome ao projeto.')
    setSalvando(true)
    const payload = { ...form, prazo: form.prazo || null }
    if (editando) await supabase.from('bc_projetos').update(payload).eq('id', projeto.id)
    else await supabase.from('bc_projetos').insert([payload])
    setSalvando(false)
    onSaved()
  }
  return (
    <Overlay onClose={onClose} titulo={editando ? 'Editar projeto' : 'Novo projeto'}>
      <label style={s.label}>Nome</label>
      <input style={s.input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lançamento do Livro X" />
      <label style={s.label}>Descrição</label>
      <textarea style={{ ...s.input, minHeight: 60 }} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      {editando && (
        <>
          <label style={s.label}>Status</label>
          <select style={s.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(PROJ_STATUS).map(([k, v]) => <option key={k} value={k} style={{ color: '#0f172a', background: '#fff' }}>{v}</option>)}
          </select>
        </>
      )}
      <label style={s.label}>Cor</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {CORES_PROJETO.map((c) => (
          <div key={c} onClick={() => setForm({ ...form, cor: c })}
            style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: form.cor === c ? '3px solid #fff' : '3px solid transparent' }} />
        ))}
      </div>
      <label style={s.label}>Prazo (opcional)</label>
      <input type="date" style={s.input} value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
      <BotoesModal onClose={onClose} onSalvar={salvar} salvando={salvando} />
    </Overlay>
  )
}

// ── Modal: tarefa (nova ou edição) ────────────────────────────
function ModalTarefa({ tarefa, projetos, onClose, onSaved }) {
  const editando = !!tarefa
  const [form, setForm] = useState(editando
    ? { titulo: tarefa.titulo || '', descricao: tarefa.descricao || '', projeto_id: tarefa.projeto_id || '', prioridade: tarefa.prioridade || 'media', responsavel: tarefa.responsavel || '', prazo: tarefa.prazo || '', status: tarefa.status || 'a_fazer' }
    : { titulo: '', descricao: '', projeto_id: '', prioridade: 'media', responsavel: '', prazo: '', status: 'a_fazer' })
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!form.titulo.trim()) return alert('Dê um título à tarefa.')
    setSalvando(true)
    const payload = {
      ...form,
      projeto_id: form.projeto_id || null, // vazio = avulsa
      prazo: form.prazo || null,
      concluida_em: form.status === 'concluida' ? (tarefa?.concluida_em || new Date().toISOString()) : null,
    }
    if (editando) await supabase.from('bc_tarefas').update(payload).eq('id', tarefa.id)
    else await supabase.from('bc_tarefas').insert([payload])
    setSalvando(false)
    onSaved()
  }
  return (
    <Overlay onClose={onClose} titulo={editando ? 'Editar tarefa' : 'Nova tarefa'}>
      <label style={s.label}>Título</label>
      <input style={s.input} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Definir preço e margem" />
      <label style={s.label}>Projeto</label>
      <select style={s.input} value={form.projeto_id} onChange={(e) => setForm({ ...form, projeto_id: e.target.value })}>
        <option value="" style={{ color: '#0f172a', background: '#fff' }}>— Nenhum (demanda avulsa) —</option>
        {projetos.map((p) => <option key={p.id} value={p.id} style={{ color: '#0f172a', background: '#fff' }}>{p.nome}</option>)}
      </select>
      <label style={s.label}>Descrição</label>
      <textarea style={{ ...s.input, minHeight: 60 }} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Prioridade</label>
          <select style={s.input} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
            {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k} style={{ color: '#0f172a', background: '#fff' }}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Prazo</label>
          <input type="date" style={s.input} value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
        </div>
      </div>
      {editando && (
        <>
          <label style={s.label}>Status</label>
          <select style={s.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k} style={{ color: '#0f172a', background: '#fff' }}>{v}</option>)}
          </select>
        </>
      )}
      <label style={s.label}>Responsável (opcional)</label>
      <input style={s.input} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Ex: João, Viviane, Jefferson…" />
      <BotoesModal onClose={onClose} onSalvar={salvar} salvando={salvando} />
    </Overlay>
  )
}

// ── Modal: excluir/arquivar projeto ───────────────────────────
function ModalExcluirProjeto({ p, onClose, onArquivar, onExcluir }) {
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)
  return (
    <Overlay onClose={onClose} titulo={`Projeto "${p.nome}"`}>
      <p style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)', marginTop: 12 }}>
        Prefere <b>arquivar</b>? O projeto sai da vista mas fica guardado (você pode reexibi-lo com "Mostrar arquivados").
        Excluir é permanente e as tarefas dele viram avulsas.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
        <button style={s.btn} onClick={onArquivar}>📦 Arquivar</button>
        {!confirmaExcluir
          ? <button style={{ ...s.btnGhost, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setConfirmaExcluir(true)}>Excluir…</button>
          : <button style={{ ...s.btn, background: '#ef4444' }} onClick={onExcluir}>Confirmar exclusão</button>}
      </div>
    </Overlay>
  )
}

// ── UI reaproveitada ──────────────────────────────────────────
function Overlay({ titulo, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--modal-bg, #1a1a2e)', borderRadius: 14, padding: 24, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: 0, fontSize: 19, color: 'var(--text, #f1f5f9)' }}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

function BotoesModal({ onClose, onSalvar, salvando }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
      <button style={s.btn} onClick={onSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
    </div>
  )
}
