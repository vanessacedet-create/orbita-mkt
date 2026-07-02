import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ⚠️ TROQUE pelo SEU e-mail de login no Orbita (só você acessa esta tela)
const DONO_EMAIL = 'vanessa@cedet.com.br'

// ── Paleta / helpers de estilo ──────────────────────────────────
const CORES_PROJETO = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const STATUS_LABEL = { a_fazer: 'A fazer', fazendo: 'Fazendo', concluida: 'Concluída' }
const STATUS_COR   = { a_fazer: '#64748b', fazendo: '#0ea5e9', concluida: '#10b981' }
const PRIO_LABEL   = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const PRIO_COR     = { baixa: '#94a3b8', media: '#f59e0b', alta: '#ef4444' }
const PROJ_STATUS  = { ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído', arquivado: 'Arquivado' }

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : null)

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
}

export default function BaseComando() {
  const [autorizada, setAutorizada] = useState(null) // null = verificando
  const [projetos, setProjetos] = useState([])
  const [tarefas, setTarefas]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('todas')

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
      supabase.from('bc_projetos').select('*').order('created_at', { ascending: false }),
      supabase.from('bc_tarefas').select('*').order('created_at', { ascending: false }),
    ])
    setProjetos(proj || [])
    setTarefas(tar || [])
    setCarregando(false)
  }, [])

  useEffect(() => { if (autorizada) carregar() }, [autorizada, carregar])

  // ── Ações ─────────────────────────────────────────────────────
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

  const excluirProjeto = async (id) => {
    if (!window.confirm('Excluir este projeto? As tarefas dele viram avulsas.')) return
    await supabase.from('bc_projetos').delete().eq('id', id)
    carregar()
  }

  // ── Filtro ────────────────────────────────────────────────────
  const passaFiltro = (t) => {
    if (filtroStatus === 'ativas') return t.status !== 'concluida'
    if (filtroStatus === 'concluidas') return t.status === 'concluida'
    return true
  }
  const tarefasFiltradas = tarefas.filter(passaFiltro)
  const avulsas = tarefasFiltradas.filter((t) => !t.projeto_id)
  const porProjeto = (pid) => tarefasFiltradas.filter((t) => t.projeto_id === pid)

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
          <h1 style={s.h1}>🛰️ Base de Comando</h1>
          <p style={s.sub}>Seus projetos e demandas — vinculadas ou avulsas. Só você vê esta tela.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnGhost} onClick={() => setModal('projeto')}>+ Projeto</button>
          <button style={s.btn} onClick={() => setModal('tarefa')}>+ Tarefa</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0' }}>
        {[['todas', 'Todas'], ['ativas', 'Ativas'], ['concluidas', 'Concluídas']].map(([k, v]) => (
          <button key={k} onClick={() => setFiltroStatus(k)}
            style={{ ...s.btnGhost, ...(filtroStatus === k ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' } : {}) }}>{v}</button>
        ))}
      </div>

      {carregando ? (
        <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Carregando…</p>
      ) : (
        <>
          {projetos.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
              Nenhum projeto ainda. Crie o primeiro em <b>+ Projeto</b>.
            </div>
          )}

          {projetos.map((p) => {
            const ts = porProjeto(p.id)
            const feitas = tarefas.filter((t) => t.projeto_id === p.id && t.status === 'concluida').length
            const total = tarefas.filter((t) => t.projeto_id === p.id).length
            return (
              <div key={p.id} style={{ ...s.card, borderLeft: `4px solid ${p.cor || '#6366f1'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text, #f1f5f9)' }}>
                      <span style={s.chip(p.cor || '#6366f1')} />{p.nome}
                    </span>
                    <span style={{ marginLeft: 10, ...s.badge('#e2e8f0'), color: 'var(--text-muted, #cbd5e1)' }}>{PROJ_STATUS[p.status]}</span>
                    {p.prazo && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>prazo {fmtData(p.prazo)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{feitas}/{total} concluídas</span>
                    <button style={{ ...s.btnGhost, padding: '4px 10px', color: '#ef4444' }} onClick={() => excluirProjeto(p.id)}>excluir</button>
                  </div>
                </div>
                {p.descricao && <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, margin: '6px 0 0 18px' }}>{p.descricao}</p>}

                <div style={{ marginTop: 12 }}>
                  {ts.length === 0
                    ? <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 13, marginLeft: 18 }}>Sem tarefas neste filtro.</p>
                    : ts.map((t) => <LinhaTarefa key={t.id} t={t} onToggle={toggleConcluida} onStatus={mudarStatus} onDelete={excluirTarefa} />)}
                </div>
              </div>
            )
          })}

          <div style={{ ...s.card, borderLeft: '4px dashed #cbd5e1' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-muted, #cbd5e1)' }}>Demandas avulsas</div>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, margin: '2px 0 10px' }}>Tarefas que não pertencem a nenhum projeto.</p>
            {avulsas.length === 0
              ? <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 13 }}>Nenhuma demanda avulsa neste filtro.</p>
              : avulsas.map((t) => <LinhaTarefa key={t.id} t={t} onToggle={toggleConcluida} onStatus={mudarStatus} onDelete={excluirTarefa} />)}
          </div>
        </>
      )}

      {modal === 'projeto' && <ModalProjeto onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
      {modal === 'tarefa'  && <ModalTarefa projetos={projetos} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar() }} />}
    </div>
  )
}

// ── Linha de tarefa ───────────────────────────────────────────
function LinhaTarefa({ t, onToggle, onStatus, onDelete }) {
  const feita = t.status === 'concluida'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
      <input type="checkbox" checked={feita} onChange={() => onToggle(t)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: feita ? 'var(--text-muted, #94a3b8)' : 'var(--text, #f1f5f9)', textDecoration: feita ? 'line-through' : 'none' }}>{t.titulo}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
          <span style={s.badge(PRIO_COR[t.prioridade])}>{PRIO_LABEL[t.prioridade]}</span>
          {t.responsavel && <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>👤 {t.responsavel}</span>}
          {t.prazo && <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>📅 {fmtData(t.prazo)}</span>}
        </div>
      </div>
      <select value={t.status} onChange={(e) => onStatus(t, e.target.value)}
        style={{ border: `1px solid ${STATUS_COR[t.status]}`, color: STATUS_COR[t.status], borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: 'var(--card-bg, rgba(255,255,255,0.05))' }}>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k} style={{ color: '#0f172a', background: '#fff' }}>{v}</option>)}
      </select>
      <button onClick={() => onDelete(t.id)} style={{ ...s.btnGhost, padding: '4px 10px', color: '#ef4444' }}>×</button>
    </div>
  )
}

// ── Modal: novo projeto ───────────────────────────────────────
function ModalProjeto({ onClose, onSaved }) {
  const [form, setForm] = useState({ nome: '', descricao: '', status: 'ativo', cor: CORES_PROJETO[0], prazo: '' })
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!form.nome.trim()) return alert('Dê um nome ao projeto.')
    setSalvando(true)
    await supabase.from('bc_projetos').insert([{ ...form, prazo: form.prazo || null }])
    setSalvando(false)
    onSaved()
  }
  return (
    <Overlay onClose={onClose} titulo="Novo projeto">
      <label style={s.label}>Nome</label>
      <input style={s.input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lançamento do Livro X" />
      <label style={s.label}>Descrição</label>
      <textarea style={{ ...s.input, minHeight: 60 }} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      <label style={s.label}>Cor</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {CORES_PROJETO.map((c) => (
          <div key={c} onClick={() => setForm({ ...form, cor: c })}
            style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: form.cor === c ? '3px solid #0f172a' : '3px solid transparent' }} />
        ))}
      </div>
      <label style={s.label}>Prazo (opcional)</label>
      <input type="date" style={s.input} value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
      <BotoesModal onClose={onClose} onSalvar={salvar} salvando={salvando} />
    </Overlay>
  )
}

// ── Modal: nova tarefa ────────────────────────────────────────
function ModalTarefa({ projetos, onClose, onSaved }) {
  const [form, setForm] = useState({ titulo: '', descricao: '', projeto_id: '', prioridade: 'media', responsavel: '', prazo: '' })
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!form.titulo.trim()) return alert('Dê um título à tarefa.')
    setSalvando(true)
    await supabase.from('bc_tarefas').insert([{
      ...form,
      projeto_id: form.projeto_id || null, // vazio = avulsa
      prazo: form.prazo || null,
    }])
    setSalvando(false)
    onSaved()
  }
  return (
    <Overlay onClose={onClose} titulo="Nova tarefa">
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
      <label style={s.label}>Responsável (opcional)</label>
      <input style={s.input} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Ex: João, Viviane, Jefferson…" />
      <BotoesModal onClose={onClose} onSalvar={salvar} salvando={salvando} />
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
