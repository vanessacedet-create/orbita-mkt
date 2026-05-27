// src/pages/Treinamentos.js
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  GraduationCap, Plus, ChevronDown, X, Trash2, Bell,
  CheckCircle, MessageSquare, Clock, Users, ArrowLeft,
  Pencil, FileSpreadsheet, Copy
} from 'lucide-react'

// ── UTILITÁRIOS ────────────────────────────────────────────

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 4000) }
  return [t, show]
}

function now() {
  const d = new Date()
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function short(t, n = 55) { return t && t.length > n ? t.substring(0, n) + '…' : (t || '') }

function fmtData(d) {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

const STAGES = [0, 20, 40, 60, 80, 100]

// ── SUPABASE HELPERS ───────────────────────────────────────

async function getColaboradores() {
  const { data } = await supabase
    .from('rh_colaboradores')
    .select('id, nome, cargo, gestor_direto, rh_grupos(nome)')
    .eq('status', 'ativo')
    .order('nome')
  return data || []
}

async function getPlanos() {
  const { data } = await supabase
    .from('planos_treinamento')
    .select('*, rh_colaboradores(id, nome, cargo, rh_grupos(nome))')
    .order('created_at', { ascending: false })
  return data || []
}

async function getPlanoCompleto(id) {
  const { data } = await supabase
    .from('planos_treinamento')
    .select(`
      *, rh_colaboradores(id, nome, cargo, rh_grupos(nome)),
      planos_secoes(id, titulo, ordem, planos_tarefas(id, texto, progresso, observacao, validado_em, ordem)),
      planos_historico(id, tipo, descricao, supervisor_nome, secao_titulo, tarefa_texto, created_at),
      planos_notificacoes(id, mensagem, lida, created_at)
    `)
    .eq('id', id)
    .single()
  if (!data) return null
  // Ordenar seções e tarefas
  data.planos_secoes = (data.planos_secoes || []).sort((a, b) => a.ordem - b.ordem)
  data.planos_secoes.forEach(s => {
    s.planos_tarefas = (s.planos_tarefas || []).sort((a, b) => a.ordem - b.ordem)
  })
  data.planos_historico = (data.planos_historico || []).sort((a, b) =>
    b.created_at.localeCompare(a.created_at))
  data.planos_notificacoes = (data.planos_notificacoes || []).sort((a, b) =>
    b.created_at.localeCompare(a.created_at))
  return data
}

async function criarPlano({ funcionario_id, supervisor_nome, versao, cargo_atual, cargo_alvo }) {
  const { data } = await supabase
    .from('planos_treinamento')
    .insert([{ funcionario_id, supervisor_nome, versao: versao || '01', cargo_atual, cargo_alvo }])
    .select('*, rh_colaboradores(id, nome, cargo, rh_grupos(nome))')
    .single()
  return data
}

async function deletarPlano(id) {
  await supabase.from('planos_treinamento').delete().eq('id', id)
}

async function criarSecao(plano_id, titulo, ordem) {
  const { data } = await supabase
    .from('planos_secoes')
    .insert([{ plano_id, titulo, ordem }])
    .select('id, titulo, ordem')
    .single()
  return { ...data, planos_tarefas: [] }
}

async function deletarSecao(id) {
  await supabase.from('planos_secoes').delete().eq('id', id)
}

async function criarTarefa(secao_id, texto, ordem) {
  const { data } = await supabase
    .from('planos_tarefas')
    .insert([{ secao_id, texto, progresso: 0, ordem }])
    .select()
    .single()
  return data
}

async function atualizarTarefa(id, fields) {
  const { data } = await supabase
    .from('planos_tarefas')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  return data
}

async function deletarTarefa(id) {
  await supabase.from('planos_tarefas').delete().eq('id', id)
}

async function atualizarSupervisor(plano_id, supervisor_nome) {
  const { data } = await supabase
    .from('planos_treinamento')
    .update({ supervisor_nome })
    .eq('id', plano_id)
    .select()
    .single()
  return data
}

async function importarTarefasPlanilha(secao_id, tarefas) {
  const ordemBase = tarefas.length
  const rows = tarefas.map((texto, i) => ({ secao_id, texto, progresso: 0, ordem: ordemBase + i }))
  const { data } = await supabase.from('planos_tarefas').insert(rows).select()
  return data || []
}

async function registrarHistorico(plano_id, tipo, descricao, secao_titulo, tarefa_texto, supervisor_nome) {
  const { data } = await supabase
    .from('planos_historico')
    .insert([{ plano_id, tipo, descricao, secao_titulo, tarefa_texto, supervisor_nome }])
    .select()
    .single()
  return data
}

async function criarNotificacao(plano_id, mensagem) {
  const { data } = await supabase
    .from('planos_notificacoes')
    .insert([{ plano_id, mensagem, lida: false }])
    .select()
    .single()
  return data
}

async function marcarTodasLidas(plano_id) {
  await supabase.from('planos_notificacoes').update({ lida: true }).eq('plano_id', plano_id).eq('lida', false)
}

// ── MODAL NOVO PLANO ───────────────────────────────────────

function ModalNovoPano({ colaboradores, supervisorNome, onSave, onClose }) {
  const [form, setForm] = useState({
    funcionario_id: '',
    cargo_alvo: '',
    versao: '01',
  })
  const [saving, setSaving] = useState(false)
  const colab = colaboradores.find(c => c.id === form.funcionario_id)

  async function save() {
    if (!form.funcionario_id) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        cargo_atual: colab?.cargo || '',
        supervisor_nome: supervisorNome,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Novo Plano de Treinamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Funcionário *</label>
            <select className="form-select" value={form.funcionario_id}
              onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}>
              <option value="">Selecionar...</option>
              {colaboradores.map(c => (
                <option key={c.id} value={c.id}>{c.nome} — {c.cargo}</option>
              ))}
            </select>
          </div>
          {colab && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
              Cargo atual: <strong style={{ color: 'var(--text)' }}>{colab.cargo}</strong>
              {colab.rh_grupos?.nome && <> · Grupo: <strong style={{ color: 'var(--accent)' }}>{colab.rh_grupos.nome}</strong></>}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Cargo a alcançar</label>
            <input className="form-input" value={form.cargo_alvo}
              onChange={e => setForm(f => ({ ...f, cargo_alvo: e.target.value }))}
              placeholder="Ex: Analista de Marketing Júnior" />
          </div>
          <div className="form-group">
            <label className="form-label">Versão</label>
            <input className="form-input" value={form.versao}
              onChange={e => setForm(f => ({ ...f, versao: e.target.value }))}
              placeholder="01" style={{ maxWidth: 100 }} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}
            disabled={saving || !form.funcionario_id}>
            {saving ? 'Criando...' : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── MODAL DUPLICAR PLANO ───────────────────────────────────

function ModalDuplicar({ plano, colaboradores, supervisorNome, onSave, onClose }) {
  const [funcionarioId, setFuncionarioId] = useState('')
  const [saving, setSaving] = useState(false)
  const colab = colaboradores.find(c => c.id === funcionarioId)

  async function save() {
    if (!funcionarioId) return
    setSaving(true)
    try { await onSave(funcionarioId, colab) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Duplicar Treinamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          Copiando estrutura de <strong style={{ color: 'var(--text)' }}>{plano.rh_colaboradores?.nome}</strong> — {plano.planos_secoes?.length || 0} seções e todas as tarefas (sem progresso)
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Funcionária destino *</label>
            <select className="form-select" value={funcionarioId}
              onChange={e => setFuncionarioId(e.target.value)}>
              <option value="">Selecionar...</option>
              {colaboradores.filter(c => c.id !== plano.funcionario_id).map(c => (
                <option key={c.id} value={c.id}>{c.nome} — {c.cargo}</option>
              ))}
            </select>
          </div>
          {colab && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
              Cargo: <strong style={{ color: 'var(--text)' }}>{colab.cargo}</strong>
              {colab.rh_grupos?.nome && <> · Grupo: <strong style={{ color: 'var(--accent)' }}>{colab.rh_grupos.nome}</strong></>}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !funcionarioId}>
            {saving ? 'Duplicando...' : 'Duplicar treinamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CARD DE PLANO (LISTA) ──────────────────────────────────

function CardPlano({ plano, onClick, onDelete, onDuplicate }) {
  const total = (plano._total_tarefas || 0)
  const concluidas = (plano._concluidas || 0)
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
  const barColor = pct === 100 ? 'var(--green)' : 'var(--accent)'

  return (
    <div className="table-card" style={{ padding: '16px 20px', cursor: 'pointer' }}
      onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {plano.rh_colaboradores?.nome || '—'}
            </span>
            {pct === 100 && (
              <span className="badge badge-green" style={{ fontSize: 10 }}>Concluído</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {plano.cargo_atual}
            {plano.cargo_alvo && (
              <span> → <span style={{ color: 'var(--accent)' }}>{plano.cargo_alvo}</span></span>
            )}
          </div>
          {plano.rh_colaboradores?.rh_grupos?.nome && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {plano.rh_colaboradores.rh_grupos.nome}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: barColor, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {concluidas}/{total} tarefas
          </div>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Supervisor: {plano.supervisor_nome || '—'} · v{plano.versao} · {fmtData(plano.created_at?.slice(0, 10))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-icon btn-sm" title="Duplicar para outra funcionária"
            onClick={e => { e.stopPropagation(); onDuplicate(plano) }}>
            <Copy size={12} />
          </button>
          <button className="btn btn-danger btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onDelete(plano.id) }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DETALHE DO PLANO ───────────────────────────────────────

function DetalhePlano({ planoId, supervisorNome, onSupervisorChange, onBack, showToast }) {
  const [plano, setPlano] = useState(null)
  const [loading, setLoading] = useState(true)
  const [secExpanded, setSecExpanded] = useState({})
  const [histExpanded, setHistExpanded] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [addingSecao, setAddingSecao] = useState(false)
  const [novaSecao, setNovaSecao] = useState('')
  const [addingTarefa, setAddingTarefa] = useState({})
  const [novaTarefa, setNovaTarefa] = useState({})
  const [noteOpen, setNoteOpen] = useState({})
  const [noteText, setNoteText] = useState({})
  const [editingSupervisor, setEditingSupervisor] = useState(false)
  const [newSupervisor, setNewSupervisor] = useState('')
  const [importingSecao, setImportingSecao] = useState(null)
  const [editingTarefa, setEditingTarefa] = useState(null) // { id, texto }
  const importFileRef = useRef()

  useEffect(() => {
    getPlanoCompleto(planoId).then(p => {
      setPlano(p)
      if (p?.planos_secoes) {
        const exp = {}
        p.planos_secoes.forEach(s => { exp[s.id] = true })
        setSecExpanded(exp)
      }
    }).finally(() => setLoading(false))
  }, [planoId])

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!plano) return <div className="empty-state"><p>Plano não encontrado.</p></div>

  const allTasks = plano.planos_secoes?.flatMap(s => s.planos_tarefas || []) || []
  const total = allTasks.length
  const concluidas = allTasks.filter(t => t.progresso === 100).length
  const pctGeral = total > 0 ? Math.round((concluidas / total) * 100) : 0
  const unread = (plano.planos_notificacoes || []).filter(n => !n.lida).length

  function secPct(sec) {
    const ts = sec.planos_tarefas || []
    if (!ts.length) return 0
    return Math.round(ts.reduce((a, t) => a + t.progresso, 0) / (ts.length * 100) * 100)
  }

  async function handleStage(tarefa, sec, stage) {
    const prev = tarefa.progresso
    const novo = (prev === stage && stage > 0) ? stage - 20 : stage
    const fields = { progresso: novo }
    if (novo === 100 && !tarefa.validado_em) fields.validado_em = new Date().toISOString()
    if (novo < 100) fields.validado_em = null

    const updated = await atualizarTarefa(tarefa.id, fields)
    // Atualizar estado local
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s,
        planos_tarefas: s.planos_tarefas.map(t => t.id !== tarefa.id ? t : updated)
      })
    }))
    // Histórico
    const tipo = novo > prev ? 'validate' : 'adjust'
    const desc = novo > prev
      ? `Validou ${novo}% em "${short(tarefa.texto, 50)}"`
      : `Ajustou de ${prev}% para ${novo}% em "${short(tarefa.texto, 50)}"`
    const h = await registrarHistorico(plano.id, tipo, desc, sec.titulo, short(tarefa.texto, 55), supervisorNome)
    setPlano(p => ({ ...p, planos_historico: [h, ...(p.planos_historico || [])] }))
    // Notificação
    if (novo > prev) {
      const n = await criarNotificacao(plano.id, `${supervisorNome} validou "${short(tarefa.texto, 45)}" a ${novo}%`)
      setPlano(p => ({ ...p, planos_notificacoes: [n, ...(p.planos_notificacoes || [])] }))
    }
  }

  async function handleZerarTarefa(tarefa, sec) {
    const prev = tarefa.progresso
    if (prev === 0) return
    const updated = await atualizarTarefa(tarefa.id, { progresso: 0, validado_em: null })
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s,
        planos_tarefas: s.planos_tarefas.map(t => t.id !== tarefa.id ? t : updated)
      })
    }))
    const h = await registrarHistorico(plano.id, 'adjust',
      `Zerou (0%) "${short(tarefa.texto, 50)}"`, sec.titulo, short(tarefa.texto, 55), supervisorNome)
    setPlano(p => ({ ...p, planos_historico: [h, ...(p.planos_historico || [])] }))
    showToast('Tarefa zerada.')
  }

  async function handleSaveEditTarefa(tarefa, sec) {
    if (!editingTarefa || editingTarefa.id !== tarefa.id) return
    const texto = editingTarefa.texto.trim()
    if (!texto || texto === tarefa.texto) { setEditingTarefa(null); return }
    const updated = await atualizarTarefa(tarefa.id, { texto })
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s,
        planos_tarefas: s.planos_tarefas.map(t => t.id !== tarefa.id ? t : updated)
      })
    }))
    const h = await registrarHistorico(plano.id, 'adjust',
      `Editou texto da tarefa: "${short(texto, 55)}"`, sec.titulo, short(texto, 55), supervisorNome)
    setPlano(p => ({ ...p, planos_historico: [h, ...(p.planos_historico || [])] }))
    setEditingTarefa(null)
    showToast('Tarefa atualizada!')
  }

  async function handleSaveNote(tarefa, sec) {
    const text = (noteText[tarefa.id] ?? tarefa.observacao ?? '').trim()
    const updated = await atualizarTarefa(tarefa.id, { observacao: text })
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s,
        planos_tarefas: s.planos_tarefas.map(t => t.id !== tarefa.id ? t : updated)
      })
    }))
    if (text) {
      const h = await registrarHistorico(plano.id, 'note',
        `Observação em "${short(tarefa.texto, 50)}": "${short(text, 45)}"`,
        sec.titulo, short(tarefa.texto, 55), supervisorNome)
      const n = await criarNotificacao(plano.id,
        `${supervisorNome} adicionou observação em "${short(tarefa.texto, 45)}"`)
      setPlano(p => ({
        ...p,
        planos_historico: [h, ...(p.planos_historico || [])],
        planos_notificacoes: [n, ...(p.planos_notificacoes || [])]
      }))
    }
    setNoteOpen(o => ({ ...o, [tarefa.id]: false }))
    showToast('Observação salva!')
  }

  async function handleAddSecao() {
    if (!novaSecao.trim()) return
    const ordem = (plano.planos_secoes?.length || 0)
    const sec = await criarSecao(plano.id, novaSecao.trim(), ordem)
    setPlano(p => ({ ...p, planos_secoes: [...(p.planos_secoes || []), sec] }))
    setSecExpanded(e => ({ ...e, [sec.id]: true }))
    setAddingSecao(false)
    setNovaSecao('')
    showToast('Seção adicionada!')
  }

  async function handleChangeSupervisor() {
    if (!newSupervisor.trim()) return
    await atualizarSupervisor(plano.id, newSupervisor.trim())
    onSupervisorChange?.(plano.id, newSupervisor.trim())
    const h = await registrarHistorico(plano.id, 'adjust',
      `Supervisor alterado para "${newSupervisor.trim()}"`, '', '', newSupervisor.trim())
    setPlano(p => ({ ...p, supervisor_nome: newSupervisor.trim(), planos_historico: [h, ...(p.planos_historico || [])] }))
    setEditingSupervisor(false)
    setNewSupervisor('')
    showToast('Supervisor atualizado!')
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file || !importingSecao) return
    try {
      const XLSX = await import('xlsx')
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf)
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const textos = rows
        .map(r => String(r[0] || '').trim())
        .filter(t => t && t.toLowerCase() !== 'tarefa' && t.toLowerCase() !== 'título' && t.toLowerCase() !== 'titulo')
      if (!textos.length) { showToast('Nenhuma tarefa encontrada na planilha.', 'error'); return }
      const sec = plano.planos_secoes.find(s => s.id === importingSecao)
      const ordemBase = sec?.planos_tarefas?.length || 0
      const novas = await importarTarefasPlanilha(importingSecao, textos)
      setPlano(p => ({
        ...p,
        planos_secoes: p.planos_secoes.map(s => s.id !== importingSecao ? s : {
          ...s, planos_tarefas: [...(s.planos_tarefas || []), ...novas]
        })
      }))
      showToast(`${novas.length} tarefa${novas.length !== 1 ? 's' : ''} importada${novas.length !== 1 ? 's' : ''}!`)
    } catch(err) {
      showToast('Erro ao importar: ' + (err?.message || err), 'error')
    } finally {
      setImportingSecao(null)
      e.target.value = ''
    }
  }

  async function handleDeleteSecao(sec) {
    if (!window.confirm(`Excluir a seção "${sec.titulo}" e todas as suas tarefas?`)) return
    await deletarSecao(sec.id)
    setPlano(p => ({ ...p, planos_secoes: p.planos_secoes.filter(s => s.id !== sec.id) }))
    showToast('Seção removida!')
  }

  async function handleAddTarefa(sec) {
    const texto = (novaTarefa[sec.id] || '').trim()
    if (!texto) return
    const ordem = (sec.planos_tarefas?.length || 0)
    const t = await criarTarefa(sec.id, texto, ordem)
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s, planos_tarefas: [...(s.planos_tarefas || []), t]
      })
    }))
    setAddingTarefa(a => ({ ...a, [sec.id]: false }))
    setNovaTarefa(n => ({ ...n, [sec.id]: '' }))
    showToast('Tarefa adicionada!')
  }

  async function handleDeleteTarefa(tarefa, sec) {
    if (!window.confirm('Excluir esta tarefa?')) return
    await deletarTarefa(tarefa.id)
    setPlano(p => ({
      ...p,
      planos_secoes: p.planos_secoes.map(s => s.id !== sec.id ? s : {
        ...s, planos_tarefas: s.planos_tarefas.filter(t => t.id !== tarefa.id)
      })
    }))
    showToast('Tarefa removida!')
  }

  async function handleMarcarLidas() {
    await marcarTodasLidas(plano.id)
    setPlano(p => ({
      ...p,
      planos_notificacoes: p.planos_notificacoes.map(n => ({ ...n, lida: true }))
    }))
  }

  const barColor = pctGeral === 100 ? 'var(--green)' : 'var(--accent)'
  const colab = plano.rh_colaboradores || {}

  // ── Ícone e cor por tipo de histórico ─────────────────
  const histConfig = {
    validate:     { label: h => `Validou ${h.descricao?.match(/\d+%/)?.[0] || ''} em "${h.tarefa_texto}"`,      color: 'var(--accent)' },
    adjust:       { label: h => h.descricao,                                                                    color: 'var(--text-muted)' },
    note:         { label: h => `Observação em "${h.tarefa_texto}"`,                                            color: 'var(--amber)' },
    'note-removed':{ label: h => `Observação removida de "${h.tarefa_texto}"`,                                  color: 'var(--red)' },
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{colab.nome}</h1>
            {pctGeral === 100 && <span className="badge badge-green">Concluído</span>}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {plano.cargo_atual}
            {plano.cargo_alvo && <> → <span style={{ color: 'var(--accent)' }}>{plano.cargo_alvo}</span></>}
            {colab.rh_grupos?.nome && <> · {colab.rh_grupos.nome}</>}
          </p>
        </div>
      </div>

      {/* Barra do supervisor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--amber)', flexShrink: 0 }}>
          {(plano.supervisor_nome || supervisorNome).split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editingSupervisor ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 200 }}
                value={newSupervisor} onChange={e => setNewSupervisor(e.target.value)}
                placeholder="Nome do supervisor..."
                onKeyDown={e => { if (e.key === 'Enter') handleChangeSupervisor(); if (e.key === 'Escape') setEditingSupervisor(false) }}
                autoFocus />
              <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={handleChangeSupervisor}>Salvar</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingSupervisor(false)}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{plano.supervisor_nome || supervisorNome}</p>
              <button className="btn btn-ghost btn-icon" style={{ width: 20, height: 20, padding: 0 }}
                title="Alterar supervisor"
                onClick={() => { setNewSupervisor(plano.supervisor_nome || supervisorNome); setEditingSupervisor(true) }}>
                <Pencil size={11} color="var(--text-muted)" />
              </button>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Supervisor — validando progresso do treinamento</p>
        </div>
        <span className="badge badge-amber" style={{ fontSize: 10, marginRight: 6 }}>Supervisor</span>
        {/* Sino de notificações */}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setNotifOpen(o => !o)}
            style={{ position: 'relative' }}>
            <Bell size={16} color={unread > 0 ? 'var(--amber)' : 'var(--text-muted)'} />
          </button>
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 99, padding: '0 3px', background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      </div>

      {/* Painel de notificações */}
      {notifOpen && (
        <div className="table-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Notificações para {colab.nome}
            </span>
            {unread > 0 && (
              <button onClick={handleMarcarLidas}
                style={{ fontSize: 11, color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer' }}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {!(plano.planos_notificacoes?.length) ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              Nenhuma notificação ainda.
            </div>
          ) : plano.planos_notificacoes.slice(0, 10).map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: n.lida ? '' : 'var(--surface-2)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={13} color="var(--indigo)" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>{n.mensagem}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!n.lida && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0, marginTop: 5 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        {[
          ['Progresso geral', `${pctGeral}%`],
          ['Tarefas validadas', `${concluidas}/${total}`],
          ['Seções', plano.planos_secoes?.length || 0],
        ].map(([l, v]) => (
          <div key={l} className="stat-card" style={{ padding: '12px 16px' }}>
            <div className="stat-label">{l}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ height: '100%', width: `${pctGeral}%`, background: barColor, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Seções */}
      {(plano.planos_secoes || []).map(sec => {
        const sp = secPct(sec)
        const isOpen = secExpanded[sec.id] !== false
        return (
          <div key={sec.id} className="table-card" style={{ marginBottom: 10, overflow: 'hidden' }}>
            {/* Cabeçalho da seção */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>
              <button style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setSecExpanded(e => ({ ...e, [sec.id]: !isOpen }))}>
                <ChevronDown size={15} color="var(--text-muted)"
                  style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{sec.titulo}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {sec.planos_tarefas?.length || 0} tarefa{sec.planos_tarefas?.length !== 1 ? 's' : ''}
                </span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
                <span className={`badge ${sp === 100 ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                  {sp}% validado
                </span>
                <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDeleteSecao(sec)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {isOpen && (
              <>
                {/* Header das colunas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(6,44px) 36px', padding: '7px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tarefa</span>
                  {STAGES.map(s => (
                    <span key={s} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' }}>{s}%</span>
                  ))}
                  <span />
                </div>

                {/* Tarefas */}
                {(sec.planos_tarefas || []).map((tarefa, ti) => {
                  const isLast = ti === (sec.planos_tarefas?.length || 0) - 1
                  const noteIsOpen = noteOpen[tarefa.id]
                  const noteVal = noteText[tarefa.id] ?? tarefa.observacao ?? ''
                  const rowBg = tarefa.progresso === 100 ? 'var(--green-light)' : ''
                  return (
                    <div key={tarefa.id}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(6,44px) 36px', padding: '10px 20px', borderBottom: (!isLast || noteIsOpen) ? '1px solid var(--border)' : 'none', alignItems: 'center', background: rowBg }}>
                        {/* Texto */}
                        <div style={{ paddingRight: 12 }}>
                          {editingTarefa?.id === tarefa.id
                            ? <input
                                autoFocus
                                value={editingTarefa.texto}
                                onChange={e => setEditingTarefa(prev => ({ ...prev, texto: e.target.value }))}
                                onBlur={() => handleSaveEditTarefa(tarefa, sec)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEditTarefa(tarefa, sec); if (e.key === 'Escape') setEditingTarefa(null) }}
                                style={{ width: '100%', fontSize: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text)', padding: '2px 0', marginBottom: 4 }}
                              />
                            : <p
                                onClick={() => setEditingTarefa({ id: tarefa.id, texto: tarefa.texto })}
                                title="Clique para editar"
                                style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.5, color: tarefa.progresso === 100 ? 'var(--green)' : 'var(--text)', cursor: 'text' }}
                              >
                                {tarefa.texto}
                              </p>
                          }
                          <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: tarefa.observacao || tarefa.validado_em ? 4 : 0 }}>
                            <div style={{ height: '100%', width: `${tarefa.progresso}%`, background: tarefa.progresso === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.2s' }} />
                          </div>
                          {tarefa.progresso === 100 && tarefa.validado_em && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--green-light)', color: 'var(--green)' }}>
                              <CheckCircle size={9} /> {supervisorNome} · {new Date(tarefa.validado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {tarefa.observacao && (
                            <div style={{ marginTop: 5, padding: '4px 8px', background: 'var(--amber-light)', borderRadius: 6, borderLeft: '2px solid var(--amber)' }}>
                              <span style={{ fontSize: 11, color: 'var(--amber)' }}>
                                <MessageSquare size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                                {short(tarefa.observacao, 80)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Botões de progresso */}
                        {STAGES.map(stage => {
                          const done = stage === 0 ? tarefa.progresso === 0 : tarefa.progresso >= stage
                          const complete = tarefa.progresso === 100
                          return (
                            <div key={stage} style={{ display: 'flex', justifyContent: 'center' }}>
                              <button
                                onClick={() => stage === 0 ? handleZerarTarefa(tarefa, sec) : handleStage(tarefa, sec, stage)}
                                title={stage === 0 ? 'Marcar como 0%' : `Validar ${stage}%`}
                                style={{
                                  width: 24, height: 24, borderRadius: 5,
                                  border: `1px solid ${done ? 'transparent' : 'var(--border)'}`,
                                  background: done ? (complete ? 'var(--green)' : 'var(--accent)') : 'var(--surface-2)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s', flexShrink: 0,
                                }}
                              >
                                {done && <CheckCircle size={12} color="#fff" />}
                              </button>
                            </div>
                          )
                        })}

                        {/* Botão de observação + zerar */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                          <button
                            onClick={() => {
                              setNoteText(n => ({ ...n, [tarefa.id]: tarefa.observacao || '' }))
                              setNoteOpen(o => ({ ...o, [tarefa.id]: !noteIsOpen }))
                            }}
                            title={tarefa.observacao ? 'Ver/editar observação' : 'Adicionar observação'}
                            style={{
                              width: 28, height: 28, borderRadius: 6,
                              border: `1px solid ${tarefa.observacao ? 'var(--amber)' : 'var(--border)'}`,
                              background: tarefa.observacao ? 'var(--amber-light)' : 'none',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <MessageSquare size={13} color={tarefa.observacao ? 'var(--amber)' : 'var(--text-muted)'} />
                          </button>
                          <button
                            onClick={() => handleDeleteTarefa(tarefa, sec)}
                            className="btn btn-danger btn-icon btn-sm"
                            title="Excluir tarefa"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Editor de observação inline */}
                      {noteIsOpen && (
                        <div style={{ padding: '12px 20px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)', background: 'var(--amber-light)' }}>
                          <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Observação do supervisor
                          </p>
                          <textarea
                            className="form-textarea"
                            style={{ minHeight: 64, fontSize: 12 }}
                            value={noteVal}
                            onChange={e => setNoteText(n => ({ ...n, [tarefa.id]: e.target.value }))}
                            placeholder="Adicione um comentário ou feedback sobre esta tarefa..."
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleSaveNote(tarefa, sec)}>
                              Salvar
                            </button>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => setNoteOpen(o => ({ ...o, [tarefa.id]: false }))}>
                              Cancelar
                            </button>
                            {tarefa.observacao && (
                              <button className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setNoteText(n => ({ ...n, [tarefa.id]: '' }))
                                  handleSaveNote({ ...tarefa, observacao: '' }, sec)
                                }}>
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Adicionar tarefa */}
                {addingTarefa[sec.id] ? (
                  <div style={{ padding: '10px 20px', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                    <input className="form-input"
                      value={novaTarefa[sec.id] || ''}
                      onChange={e => setNovaTarefa(n => ({ ...n, [sec.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTarefa(sec); if (e.key === 'Escape') setAddingTarefa(a => ({ ...a, [sec.id]: false })) }}
                      placeholder="Descreva a nova tarefa..."
                      autoFocus />
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddTarefa(sec)}>Salvar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingTarefa(a => ({ ...a, [sec.id]: false }))}>Cancelar</button>
                  </div>
                ) : (
                  <button style={{ width: '100%', padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => setAddingTarefa(a => ({ ...a, [sec.id]: true }))}>
                    <Plus size={14} /> Adicionar tarefa
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Adicionar seção */}
      {addingSecao ? (
        <div className="table-card" style={{ padding: '14px 20px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input"
            value={novaSecao}
            onChange={e => setNovaSecao(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSecao(); if (e.key === 'Escape') setAddingSecao(false) }}
            placeholder="Nome da seção (ex: Tarefas — CRM, Tarefas — Redes Sociais...)"
            autoFocus />
          <button className="btn btn-primary btn-sm" onClick={handleAddSecao}>Salvar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingSecao(false)}>Cancelar</button>
        </div>
      ) : (
        <button
          style={{ width: '100%', padding: 12, border: '1px dashed var(--border)', borderRadius: 10, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          onClick={() => setAddingSecao(true)}>
          <Plus size={16} /> Adicionar seção
        </button>
      )}

      {/* Histórico */}
      <div className="table-card" style={{ overflow: 'hidden' }}>
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: histExpanded && plano.planos_historico?.length ? '1px solid var(--border)' : 'none' }}
          onClick={() => setHistExpanded(h => !h)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChevronDown size={15} color="var(--text-muted)"
              style={{ transform: histExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Histórico de alterações</span>
            {plano.planos_historico?.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {plano.planos_historico.length} registro{plano.planos_historico.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ações do supervisor</span>
        </button>
        {histExpanded && (
          plano.planos_historico?.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma alteração registrada ainda.
            </div>
          ) : plano.planos_historico?.map(h => {
            const cfg = histConfig[h.tipo] || { label: () => h.descricao, color: 'var(--text-muted)' }
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={13} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text)' }}>{cfg.label(h)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                    {h.supervisor_nome} · {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {h.secao_titulo}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────

export default function Treinamentos() {
  const { usuario } = useAuth()
  const [planos, setPlanos] = useState([])
  const [colaboradores, setColabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [planoAtivo, setPlanoAtivo] = useState(null) // id do plano aberto
  const [modalNovo, setModalNovo] = useState(false)
  const [modalDuplicar, setModalDuplicar] = useState(null) // plano a duplicar
  const [busca, setBusca] = useState('')
  const [toast, showToast] = useToast()

  const supervisorNome = usuario?.nome || 'Supervisor'

  async function carregar() {
    const [ps, cs] = await Promise.all([getPlanos(), getColaboradores()])
    // Calcular totais de tarefas para cada plano
    const planosComStats = await Promise.all(ps.map(async p => {
      const { data: secoes } = await supabase
        .from('planos_secoes')
        .select('planos_tarefas(progresso)')
        .eq('plano_id', p.id)
      const tarefas = (secoes || []).flatMap(s => s.planos_tarefas || [])
      return { ...p, _total_tarefas: tarefas.length, _concluidas: tarefas.filter(t => t.progresso === 100).length }
    }))
    setPlanos(planosComStats)
    setColabs(cs)
  }

  useEffect(() => { carregar().finally(() => setLoading(false)) }, [])

  async function handleCriarPlano(form) {
    const p = await criarPlano(form)
    setModalNovo(false)
    showToast('Plano criado!')
    // Recarregar para pegar stats
    await carregar()
    setPlanoAtivo(p.id)
  }

  async function handleDeletar(id) {
    if (!window.confirm('Excluir este plano de treinamento?')) return
    await deletarPlano(id)
    setPlanos(ps => ps.filter(p => p.id !== id))
    showToast('Plano removido!')
  }

  async function handleDuplicar(planoOrigem, funcionarioDestino, colabDestino) {
    // Busca o plano completo com seções e tarefas
    const planoCompleto = await getPlanoCompleto(planoOrigem.id)
    // Cria o novo plano
    const novo = await criarPlano({
      funcionario_id: funcionarioDestino,
      supervisor_nome: supervisorNome,
      versao: '01',
      cargo_atual: colabDestino?.cargo || '',
      cargo_alvo: planoOrigem.cargo_alvo || '',
    })
    // Duplica seções e tarefas (sem progresso/validações)
    for (const sec of (planoCompleto.planos_secoes || [])) {
      const novaSec = await criarSecao(novo.id, sec.titulo, sec.ordem)
      if (sec.planos_tarefas?.length) {
        const rows = sec.planos_tarefas.map(t => ({
          secao_id: novaSec.id,
          texto: t.texto,
          progresso: 0,
          ordem: t.ordem,
        }))
        await supabase.from('planos_tarefas').insert(rows)
      }
    }
    setModalDuplicar(null)
    showToast('Treinamento duplicado com sucesso!')
    await carregar()
    setPlanoAtivo(novo.id)
  }

  const planosFiltrados = planos.filter(p => {
    if (!busca) return true
    const nome = p.rh_colaboradores?.nome?.toLowerCase() || ''
    const cargo = p.cargo_atual?.toLowerCase() || ''
    return nome.includes(busca.toLowerCase()) || cargo.includes(busca.toLowerCase())
  })

  if (loading) return <div className="loading"><div className="spinner" /></div>

  // Vista de detalhe
  if (planoAtivo) return (
    <DetalhePlano
      planoId={planoAtivo}
      supervisorNome={supervisorNome}
      onSupervisorChange={(id, nome) => setPlanos(ps => ps.map(p => p.id === id ? { ...p, supervisor_nome: nome } : p))}
      onBack={() => setPlanoAtivo(null)}
      showToast={showToast}
    />
  )

  // Vista de lista
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <GraduationCap size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Treinamentos</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {planos.length} plano{planos.length !== 1 ? 's' : ''} · {planos.filter(p => p._concluidas === p._total_tarefas && p._total_tarefas > 0).length} concluído{planos.filter(p => p._concluidas === p._total_tarefas && p._total_tarefas > 0).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModalNovo(true)}>
          <Plus size={14} /> Novo plano
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="search-input" style={{ width: '100%', maxWidth: 360 }}
          placeholder="Buscar por nome ou cargo..."
          value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {planosFiltrados.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={36} strokeWidth={1} style={{ marginBottom: 12 }} />
          <p>Nenhum plano de treinamento encontrado.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModalNovo(true)}>
            <Plus size={14} /> Criar primeiro plano
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {planosFiltrados.map(p => (
            <CardPlano key={p.id} plano={p}
              onClick={() => setPlanoAtivo(p.id)}
              onDelete={handleDeletar}
              onDuplicate={setModalDuplicar} />
          ))}
        </div>
      )}

      {modalDuplicar && (
        <ModalDuplicar
          plano={modalDuplicar}
          colaboradores={colaboradores}
          supervisorNome={supervisorNome}
          onSave={(funcId, colab) => handleDuplicar(modalDuplicar, funcId, colab)}
          onClose={() => setModalDuplicar(null)}
        />
      )}
      {modalNovo && (
        <ModalNovoPano
          colaboradores={colaboradores}
          supervisorNome={supervisorNome}
          onSave={handleCriarPlano}
          onClose={() => setModalNovo(false)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
