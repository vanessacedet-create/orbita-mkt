import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getBancoTarefas } from '../lib/banco-tarefas'
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Settings, Users } from 'lucide-react'

// ── CONSTANTES ────────────────────────────────────────────────
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const DIAS_ABREV  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const TIPOS_BLOCO = [
  { value: 'tarefa',    label: 'Tarefa',    cor: '#6366f1' },
  { value: 'reuniao',   label: 'Reunião',   cor: '#f59e0b' },
  { value: 'fixo',      label: 'Fixo',      cor: '#10b981' },
  { value: 'bloqueado', label: 'Bloqueado', cor: '#6b7280' },
]

const CORES_DISPONIVEIS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#0ea5e9', '#6b7280',
]

const SEMANAS_LABELS = ['1ª semana', '2ª semana', '3ª semana', '4ª semana']

// ── UTILITÁRIOS ───────────────────────────────────────────────
function horaParaMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function minutosParaHora(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function gerarSlots(horaInicio, horaFim) {
  const slots = []
  let cur = horaParaMinutos(horaInicio)
  const fim = horaParaMinutos(horaFim)
  while (cur < fim) {
    slots.push(minutosParaHora(cur))
    cur += 30
  }
  return slots
}

function duracaoEmBlocos(horaInicio, horaFim) {
  return (horaParaMinutos(horaFim) - horaParaMinutos(horaInicio)) / 30
}

function semanasDoMes(date) {
  const ano = date.getFullYear()
  const mes = date.getMonth()
  const semanas = []
  let semanaAtual = 1
  for (let dia = 1; dia <= new Date(ano, mes + 1, 0).getDate(); dia++) {
    const d = new Date(ano, mes, dia)
    if (d.getDay() === 1 || dia === 1) {
      semanas.push(semanaAtual)
      semanaAtual++
    }
  }
  return semanas
}

function semanaAtualDoMes(date) {
  const inicio = new Date(date.getFullYear(), date.getMonth(), 1)
  const diff = Math.floor((date - inicio) / (7 * 24 * 60 * 60 * 1000))
  return diff + 1
}

// ── FUNÇÕES SUPABASE ──────────────────────────────────────────
async function getAgendaConfig(usuarioId) {
  const { data } = await supabase
    .from('agenda_config')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  return data
}

async function saveAgendaConfig(usuarioId, config) {
  const { data: existing } = await supabase
    .from('agenda_config')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('agenda_config')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('agenda_config')
      .insert([{ usuario_id: usuarioId, ...config }])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

async function getAgendaBlocos(usuarioId) {
  const { data, error } = await supabase
    .from('agenda_blocos')
    .select('*, banco_tarefa:banco_tarefa_id(id, nome)')
    .eq('usuario_id', usuarioId)
    .eq('ativo', true)
    .order('hora_inicio')
  if (error) throw error
  return data || []
}

async function createAgendaBloco(payload) {
  const { data, error } = await supabase
    .from('agenda_blocos')
    .insert([payload])
    .select('*, banco_tarefa:banco_tarefa_id(id, nome)')
    .single()
  if (error) throw error
  return data
}

async function updateAgendaBloco(id, updates) {
  const { data, error } = await supabase
    .from('agenda_blocos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, banco_tarefa:banco_tarefa_id(id, nome)')
    .single()
  if (error) throw error
  return data
}

async function deleteAgendaBloco(id) {
  const { error } = await supabase.from('agenda_blocos').delete().eq('id', id)
  if (error) throw error
}

async function getUsuariosAgenda() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, perfil')
    .in('perfil', ['supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras'])
    .order('nome')
  if (error) throw error
  return data || []
}

// ── MODAL DE BLOCO ────────────────────────────────────────────
function ModalBloco({ bloco, usuarioId, bancoTarefas, onSave, onClose, onDelete, diaPreSelecionado, horaPreSelecionada, criadorId }) {
  const FORM_VAZIO = {
    titulo: '',
    tipo: 'tarefa',
    cor: '#6366f1',
    dia_semana: diaPreSelecionado || 1,
    semana_do_mes: [1, 2, 3, 4],
    hora_inicio: horaPreSelecionada || '08:00',
    hora_fim: horaPreSelecionada ? minutosParaHora(horaParaMinutos(horaPreSelecionada) + 60) : '09:00',
    banco_tarefa_id: '',
    observacao: '',
  }

  const [form, setForm] = useState(bloco ? {
    titulo: bloco.titulo,
    tipo: bloco.tipo,
    cor: bloco.cor,
    dia_semana: bloco.dia_semana,
    semana_do_mes: bloco.semana_do_mes || [1, 2, 3, 4],
    hora_inicio: bloco.hora_inicio,
    hora_fim: bloco.hora_fim,
    banco_tarefa_id: bloco.banco_tarefa_id || '',
    observacao: bloco.observacao || '',
  } : FORM_VAZIO)

  const [saving, setSaving] = useState(false)

  function toggleSemana(s) {
    setForm(f => ({
      ...f,
      semana_do_mes: f.semana_do_mes.includes(s)
        ? f.semana_do_mes.filter(x => x !== s)
        : [...f.semana_do_mes, s].sort()
    }))
  }

  async function salvar() {
    if (!form.titulo.trim()) return
    if (horaParaMinutos(form.hora_fim) <= horaParaMinutos(form.hora_inicio)) {
      alert('O horário de fim deve ser após o início.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        usuario_id: usuarioId,
        banco_tarefa_id: form.banco_tarefa_id || null,
        observacao: form.observacao || null,
        created_by: criadorId,
      }
      await onSave(bloco?.id, payload)
      onClose()
    } catch (e) { alert('Erro ao salvar: ' + e.message) } finally { setSaving(false) }
  }

  // Gerar opções de horário
  const horasOpcoes = []
  for (let h = 6; h <= 20; h++) {
    horasOpcoes.push(`${String(h).padStart(2,'0')}:00`)
    horasOpcoes.push(`${String(h).padStart(2,'0')}:30`)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{bloco ? 'Editar bloco' : 'Novo bloco'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {bloco && <button className="btn btn-danger btn-sm" onClick={() => { onDelete(bloco.id); onClose() }}><Trash2 size={13}/></button>}
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de equipe"/>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e => {
                const tipo = e.target.value
                const corPadrao = TIPOS_BLOCO.find(t => t.value === tipo)?.cor || '#6366f1'
                setForm(f => ({ ...f, tipo, cor: corPadrao }))
              }}>
                {TIPOS_BLOCO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dia da semana</label>
              <select className="form-select" value={form.dia_semana} onChange={e => setForm(f => ({ ...f, dia_semana: Number(e.target.value) }))}>
                {DIAS_SEMANA.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Início</label>
              <select className="form-select" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                {horasOpcoes.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fim</label>
              <select className="form-select" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}>
                {horasOpcoes.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Aparece nas semanas</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SEMANAS_LABELS.map((label, i) => {
                const s = i + 1
                const ativo = form.semana_do_mes.includes(s)
                return (
                  <button key={s} type="button" onClick={() => toggleSemana(s)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid', borderColor: ativo ? 'var(--accent)' : 'var(--border)', background: ativo ? 'var(--accent-glow)' : 'transparent', color: ativo ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Selecione em quais semanas do mês este bloco aparece na agenda.
            </div>
          </div>

          {form.tipo === 'tarefa' && (
            <div className="form-group">
              <label className="form-label">Tarefa do banco (opcional)</label>
              <select className="form-select" value={form.banco_tarefa_id} onChange={e => setForm(f => ({ ...f, banco_tarefa_id: e.target.value }))}>
                <option value=''>Sem vínculo</option>
                {bancoTarefas.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CORES_DISPONIVEIS.map(cor => (
                <button key={cor} type="button" onClick={() => setForm(f => ({ ...f, cor }))} style={{ width: 28, height: 28, borderRadius: '50%', background: cor, border: form.cor === cor ? '3px solid white' : '2px solid transparent', outline: form.cor === cor ? `2px solid ${cor}` : 'none', cursor: 'pointer', transition: 'all 0.15s' }}/>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observação (opcional)</label>
            <textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Detalhes, instruções..."/>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.titulo.trim()}>
            {saving ? 'Salvando...' : bloco ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL CONFIG HORÁRIO ──────────────────────────────────────
function ModalConfig({ config, usuarioNome, onSave, onClose }) {
  const [form, setForm] = useState({
    hora_inicio: config?.hora_inicio || '08:00',
    hora_fim:    config?.hora_fim    || '17:00',
    hora_almoco: config?.hora_almoco || '12:00',
    dur_almoco:  config?.dur_almoco  || 60,
  })

  const horasOpcoes = []
  for (let h = 6; h <= 20; h++) {
    horasOpcoes.push(`${String(h).padStart(2,'0')}:00`)
    horasOpcoes.push(`${String(h).padStart(2,'0')}:30`)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">Horário: {usuarioNome}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Entrada</label>
              <select className="form-select" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                {horasOpcoes.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Saída</label>
              <select className="form-select" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}>
                {horasOpcoes.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Início almoço</label>
              <select className="form-select" value={form.hora_almoco} onChange={e => setForm(f => ({ ...f, hora_almoco: e.target.value }))}>
                {horasOpcoes.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duração almoço</label>
              <select className="form-select" value={form.dur_almoco} onChange={e => setForm(f => ({ ...f, dur_almoco: Number(e.target.value) }))}>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h30</option>
              </select>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(form); onClose() }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────
export default function Agenda() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente' || usuario?.perfil === 'supervisor_parceiras'

  const [usuarios, setUsuarios] = useState([])
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)
  const [config, setConfig] = useState(null)
  const [blocos, setBlocos] = useState([])
  const [bancoTarefas, setBancoTarefas] = useState([])
  const [loading, setLoading] = useState(true)

  // Navegação de semana
  const hoje = new Date()
  const [semanaRef, setSemanaRef] = useState(() => {
    const d = new Date()
    const dia = d.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Modal
  const [modalBloco, setModalBloco] = useState(null) // null | 'new' | blocoObj
  const [diaPreSel, setDiaPreSel] = useState(null)
  const [horaPreSel, setHoraPreSel] = useState(null)
  const [modalConfig, setModalConfig] = useState(false)

  // Semana atual do mês (1-4)
  const semanaDoMes = semanaAtualDoMes(semanaRef)

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [usersData, bancoData] = await Promise.all([
          getUsuariosAgenda(),
          getBancoTarefas(),
        ])
        setBancoTarefas(bancoData)

        // Adicionar o próprio usuário se for admin e não estiver na lista
        let lista = usersData
        if (isAdmin && !lista.find(u => u.id === usuario.id)) {
          lista = [{ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, ...lista]
        }
        setUsuarios(lista)

        // Selecionar o próprio usuário por padrão
        const eu = lista.find(u => u.id === usuario.id) || lista[0]
        if (eu) {
          setUsuarioSelecionado(eu)
          await carregarAgenda(eu.id)
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    init()
  }, [])

  async function carregarAgenda(userId) {
    const [configData, blocosData] = await Promise.all([
      getAgendaConfig(userId),
      getAgendaBlocos(userId),
    ])
    setConfig(configData || { hora_inicio: '08:00', hora_fim: '17:00', hora_almoco: '12:00', dur_almoco: 60 })
    setBlocos(blocosData)
  }

  async function selecionarUsuario(u) {
    setUsuarioSelecionado(u)
    setLoading(true)
    try { await carregarAgenda(u.id) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function navegarSemana(dir) {
    setSemanaRef(d => {
      const nova = new Date(d)
      nova.setDate(nova.getDate() + dir * 7)
      return nova
    })
  }

  function voltarHoje() {
    const d = new Date()
    const dia = d.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    setSemanaRef(d)
  }

  async function handleSaveBloco(id, payload) {
    if (id) {
      const atualizado = await updateAgendaBloco(id, payload)
      setBlocos(b => b.map(x => x.id === atualizado.id ? atualizado : x))
    } else {
      const novo = await createAgendaBloco(payload)
      setBlocos(b => [...b, novo])
    }
  }

  async function handleDeleteBloco(id) {
    await deleteAgendaBloco(id)
    setBlocos(b => b.filter(x => x.id !== id))
  }

  async function handleSaveConfig(novaConfig) {
    const saved = await saveAgendaConfig(usuarioSelecionado.id, novaConfig)
    setConfig(saved)
  }

  // Formatar datas da semana
  function datasDaSemana() {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(semanaRef)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const datas = datasDaSemana()
  const mesAno = semanaRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Slots de horário
  const slots = config ? gerarSlots(config.hora_inicio, config.hora_fim) : []

  // Blocos filtrados para a semana atual
  function blocosDoSlot(diaSemana, hora) {
    return blocos.filter(b => {
      if (b.dia_semana !== diaSemana) return false
      if (b.hora_inicio !== hora) return false
      const semanas = b.semana_do_mes || [1, 2, 3, 4]
      return semanas.includes(semanaDoMes)
    })
  }

  // Verificar se slot é horário de almoço
  function isAlmoco(hora) {
    if (!config?.hora_almoco) return false
    const inicio = horaParaMinutos(config.hora_almoco)
    const fim = inicio + (config.dur_almoco || 60)
    const slot = horaParaMinutos(hora)
    return slot >= inicio && slot < fim
  }

  if (loading) return <div className="loading"><div className="spinner"/></div>

  const podeEditar = isAdmin

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Agenda</h1>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Navegação de semana */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
            <button onClick={() => navegarSemana(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><ChevronLeft size={16}/></button>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{mesAno}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{semanaDoMes}ª semana · {datas[0].getDate()}/{datas[0].getMonth()+1} – {datas[4].getDate()}/{datas[4].getMonth()+1}</div>
            </div>
            <button onClick={() => navegarSemana(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><ChevronRight size={16}/></button>
          </div>

          <button onClick={voltarHoje} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Hoje</button>

          {podeEditar && usuarioSelecionado && (
            <button onClick={() => setModalConfig(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <Settings size={14}/> Horário
            </button>
          )}
        </div>
      </div>

      {/* Seletor de pessoa (só admin vê) */}
      {isAdmin && usuarios.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {usuarios.map(u => (
            <button key={u.id} onClick={() => selecionarUsuario(u)} style={{ padding: '6px 16px', borderRadius: 20, border: '2px solid', borderColor: usuarioSelecionado?.id === u.id ? 'var(--accent)' : 'var(--border)', background: usuarioSelecionado?.id === u.id ? 'var(--accent-glow)' : 'transparent', color: usuarioSelecionado?.id === u.id ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
              {u.nome.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Grade semanal */}
      {!usuarioSelecionado ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>Selecione uma pessoa para ver a agenda.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 700 }}>
            {/* Cabeçalho dos dias */}
            <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)', gap: 0, marginBottom: 2 }}>
              <div/>
              {datas.map((d, i) => {
                const isHoje = d.toDateString() === hoje.toDateString()
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: isHoje ? 'var(--accent-glow)' : 'transparent' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isHoje ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DIAS_ABREV[i]}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: isHoje ? 'var(--accent)' : 'var(--text)', marginTop: 2 }}>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>

            {/* Grade de horários */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {slots.map((hora, si) => {
                const isMeiaHora = hora.endsWith(':30')
                return (
                  <div key={hora} style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)', borderBottom: si < slots.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 40, background: 'var(--surface)' }}>
                    {/* Hora */}
                    <div style={{ padding: '0 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 4, borderRight: '1px solid var(--border)' }}>
                      {!isMeiaHora && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{hora}</span>}
                    </div>

                    {/* Células por dia */}
                    {Array.from({ length: 5 }, (_, di) => {
                      const diaSemana = di + 1
                      const blocosAqui = blocosDoSlot(diaSemana, hora)
                      const isHojeCol = datas[di].toDateString() === hoje.toDateString()

                      return (
                        <div key={di} style={{ borderRight: di < 4 ? '1px solid var(--border)' : 'none', padding: '2px 4px', minHeight: 40, background: isHojeCol ? 'rgba(99,102,241,0.02)' : 'transparent', position: 'relative', cursor: podeEditar ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (!podeEditar) return
                            setDiaPreSel(diaSemana)
                            setHoraPreSel(hora)
                            setModalBloco('new')
                          }}
                        >
                          {blocosAqui.map(b => {
                            const duracaoBlocos = duracaoEmBlocos(b.hora_inicio, b.hora_fim)
                            return (
                              <div key={b.id}
                                onClick={e => { e.stopPropagation(); if (podeEditar) setModalBloco(b) }}
                                style={{
                                  background: b.cor + '22',
                                  border: `1.5px solid ${b.cor}`,
                                  borderRadius: 6,
                                  padding: '3px 6px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: b.cor,
                                  cursor: podeEditar ? 'pointer' : 'default',
                                  position: 'absolute',
                                  left: 4,
                                  right: 4,
                                  top: 2,
                                  height: `calc(${duracaoBlocos * 40}px - 4px)`,
                                  zIndex: 1,
                                  overflow: 'hidden',
                                  lineHeight: 1.3,
                                }}
                              >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.titulo}</div>
                                <div style={{ fontSize: 10, opacity: 0.8 }}>{b.hora_inicio} – {b.hora_fim}</div>
                                {b.banco_tarefa && <div style={{ fontSize: 10, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📋 {b.banco_tarefa.nome}</div>}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {TIPOS_BLOCO.map(t => (
                <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: t.cor }}/>
                  {t.label}
                </div>
              ))}
              {podeEditar && (
                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Clique em qualquer horário vazio para adicionar um bloco
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de bloco */}
      {modalBloco && (
        <ModalBloco
          bloco={modalBloco === 'new' ? null : modalBloco}
          usuarioId={usuarioSelecionado?.id}
          bancoTarefas={bancoTarefas}
          onSave={handleSaveBloco}
          onClose={() => { setModalBloco(null); setDiaPreSel(null); setHoraPreSel(null) }}
          onDelete={handleDeleteBloco}
          diaPreSelecionado={diaPreSel}
          horaPreSelecionada={horaPreSel}
          criadorId={usuario.id}
        />
      )}

      {/* Modal de config */}
      {modalConfig && (
        <ModalConfig
          config={config}
          usuarioNome={usuarioSelecionado?.nome}
          onSave={handleSaveConfig}
          onClose={() => setModalConfig(false)}
        />
      )}
    </div>
  )
}
