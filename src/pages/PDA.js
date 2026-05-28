import { useEffect, useState, useMemo } from 'react'
import {
  getSemestres, criarSemestre,
  getIniciativas, criarIniciativa, atualizarIniciativa, deletarIniciativa,
  upsertCelula,
} from '../lib/pda'
import {
  Target, Plus, Trash2, X, Check, Clock, AlertCircle, Square,
  Grid3x3, FileText, ChevronLeft, ChevronRight, ChevronDown, Printer, GripVertical
} from 'lucide-react'

// ── ÁREAS ──────────────────────────────────────────────────
const AREAS = [
  { value: 'geral',        label: 'Geral' },
  { value: 'influencers',  label: 'Influencers' },
  { value: 'proprias',     label: 'Próprias' },
  { value: 'marketplaces', label: 'Marketplaces' },
  { value: 'eventos',      label: 'Eventos' },
]

// ── STATUS COM CORES ───────────────────────────────────────
const STATUS_INFO = {
  a_fazer:        { label: 'A fazer',               bg: 'transparent',              text: 'var(--text-muted)',  border: 'var(--border)',  icon: Square },
  em_andamento:   { label: 'Em andamento',          bg: 'rgba(234, 179, 8, 0.18)',  text: '#854F0B',            border: '#EAB308',        icon: Clock },
  feito:          { label: 'Feito',                 bg: 'rgba(34, 197, 94, 0.18)',  text: '#0F6E56',            border: 'var(--green)',   icon: Check },
  feito_atrasado: { label: 'Concluído fora do prazo', bg: 'rgba(34, 197, 94, 0.18)', text: '#0F6E56',           border: '#EF9F27',        icon: Check },
  atrasado:       { label: 'Atrasado',              bg: 'rgba(239, 68, 68, 0.18)',  text: '#A32D2D',            border: 'var(--red)',     icon: AlertCircle },
}
const STATUS_CICLO = ['a_fazer', 'em_andamento', 'feito', 'feito_atrasado', 'atrasado']

// ── SEMANAS ────────────────────────────────────────────────
const SEMANA_LABELS = [
  '1 a 3',   '4 a 10',  '11 a 17', '18 a 24', '25-31',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28', '29 a 4/Abr',
  '5 a 11',  '12 a 18', '19 a 25', '26 a 2/Mai',
  '3 a 9',   '10 a 16', '17 a 23', '24 a 30', '31 a 6/Jun',
  '7 a 13',  '14 a 20', '21 a 27', '28 a 4/Jul',
  '5 a 11',
]
// Mapeamento de mês → semanas (1-indexed)
const MESES = [
  { nome: 'Janeiro',   sigla: 'Jan', semanas: [1, 2, 3, 4, 5] },
  { nome: 'Fevereiro', sigla: 'Fev', semanas: [6, 7, 8, 9] },
  { nome: 'Março',     sigla: 'Mar', semanas: [10, 11, 12, 13, 14] },
  { nome: 'Abril',     sigla: 'Abr', semanas: [15, 16, 17, 18] },
  { nome: 'Maio',      sigla: 'Mai', semanas: [19, 20, 21, 22, 23] },
  { nome: 'Junho',     sigla: 'Jun', semanas: [24, 25, 26, 27] },
  { nome: 'Julho',     sigla: 'Jul', semanas: [28] },
]
const SEMANA_DATA = [
  [2026,1,1],[2026,1,4],[2026,1,11],[2026,1,18],[2026,1,25],
  [2026,2,1],[2026,2,8],[2026,2,15],[2026,2,22],
  [2026,3,1],[2026,3,8],[2026,3,15],[2026,3,22],[2026,3,29],
  [2026,4,5],[2026,4,12],[2026,4,19],[2026,4,26],
  [2026,5,3],[2026,5,10],[2026,5,17],[2026,5,24],[2026,5,31],
  [2026,6,7],[2026,6,14],[2026,6,21],[2026,6,28],
  [2026,7,5],
]

// ── HELPERS ────────────────────────────────────────────────
function semanaAtual() {
  const hoje = new Date()
  for (let i = SEMANA_DATA.length - 1; i >= 0; i--) {
    const [a, m, d] = SEMANA_DATA[i]
    if (hoje >= new Date(a, m - 1, d)) return i + 1
  }
  return 1
}

function mesDaSemana(semana) {
  return MESES.findIndex(m => m.semanas.includes(semana))
}

function proximoStatus(s) {
  const idx = STATUS_CICLO.indexOf(s || 'a_fazer')
  return STATUS_CICLO[(idx + 1) % STATUS_CICLO.length]
}

function calcularStats(iniciativas, semanasFiltro = null) {
  let total = 0, feitas = 0, em = 0, atr = 0, feitoAtr = 0
  for (const ini of iniciativas) {
    if (ini.eh_grupo) continue // grupos não contam (não têm células próprias)
    for (const c of (ini.pda_celulas || [])) {
      if (semanasFiltro && !semanasFiltro.includes(c.semana)) continue
      total++
      if (c.status === 'feito') feitas++
      else if (c.status === 'feito_atrasado') feitoAtr++
      else if (c.status === 'em_andamento') em++
      else if (c.status === 'atrasado') atr++
    }
  }
  return { total, feitas, feitoAtr, em, atr, pct: total ? Math.round(feitas / total * 100) : 0 }
}

// Classifica uma iniciativa (linha) com base nas células dela
// Hierarquia: feito > feito_atrasado > em_andamento > atrasado > nao_iniciada
function statusDaLinha(ini, semanasFiltro = null) {
  const celulas = (ini.pda_celulas || [])
    .filter(c => !semanasFiltro || semanasFiltro.includes(c.semana))
    .filter(c => c.texto) // só células com conteúdo
  if (celulas.length === 0) return 'nao_iniciada'
  // Se alguma célula está verde, a linha foi concluída
  if (celulas.some(c => c.status === 'feito')) return 'feita'
  // Se alguma está "feita fora do prazo", a linha foi concluída (com atraso)
  if (celulas.some(c => c.status === 'feito_atrasado')) return 'feita_atrasado'
  // Se tem vermelha (e nenhuma verde), está atrasada de verdade
  if (celulas.some(c => c.status === 'atrasado')) return 'atrasada'
  // Se só tem amarela ou a_fazer com conteúdo, está em andamento
  if (celulas.some(c => c.status === 'em_andamento')) return 'em_andamento'
  return 'nao_iniciada'
}

// Calcula estatísticas POR LINHA (iniciativa), não por célula
function calcularStatsPorLinha(iniciativas, semanasFiltro = null) {
  let total = 0, feitas = 0, feitoAtr = 0, em = 0, atr = 0, naoIniciadas = 0
  for (const ini of iniciativas) {
    if (ini.eh_grupo) continue
    // Filtro de semana: só considera linhas que TÊM alguma célula nas semanas dadas
    if (semanasFiltro) {
      const temCelulaNaSemana = (ini.pda_celulas || []).some(c => semanasFiltro.includes(c.semana) && c.texto)
      if (!temCelulaNaSemana) continue
    }
    total++
    const st = statusDaLinha(ini, semanasFiltro)
    if (st === 'feita') feitas++
    else if (st === 'feita_atrasado') feitoAtr++
    else if (st === 'em_andamento') em++
    else if (st === 'atrasada') atr++
    else naoIniciadas++
  }
  const concluidasTotal = feitas + feitoAtr
  return { total, feitas, feitoAtr, em, atr, naoIniciadas, pct: total ? Math.round(concluidasTotal / total * 100) : 0 }
}

// Organiza iniciativas em uma estrutura agrupada que respeita ordem:
// [{ tipo: 'grupo', grupo, filhas: [...] }, { tipo: 'avulsa', iniciativa }, ...]
function agruparIniciativas(iniciativas) {
  const grupos = new Map() // grupo_id → { grupo, filhas }
  const ordemRender = []

  // Primeiro passe: identifica grupos
  for (const ini of iniciativas) {
    if (ini.eh_grupo) {
      grupos.set(ini.id, { grupo: ini, filhas: [] })
      ordemRender.push({ tipo: 'grupo', id: ini.id })
    }
  }

  // Segundo passe: atribui filhas e identifica avulsas
  for (const ini of iniciativas) {
    if (ini.eh_grupo) continue
    if (ini.grupo_id && grupos.has(ini.grupo_id)) {
      grupos.get(ini.grupo_id).filhas.push(ini)
    } else {
      ordemRender.push({ tipo: 'avulsa', iniciativa: ini })
    }
  }

  // Monta o resultado na ordem de render
  return ordemRender.map(item => {
    if (item.tipo === 'grupo') {
      const g = grupos.get(item.id)
      return { tipo: 'grupo', grupo: g.grupo, filhas: g.filhas }
    }
    return item
  })
}

// Acha o grupo pai de uma iniciativa (para uso no Status Report)
function grupoDe(iniciativa, todas) {
  if (!iniciativa.grupo_id) return null
  return todas.find(i => i.id === iniciativa.grupo_id && i.eh_grupo) || null
}

// ── TOAST ──────────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3000) }
  return [t, show]
}

// ── MODAIS ─────────────────────────────────────────────────
function ModalNovaIniciativa({ area, grupos, preset, onSave, onClose }) {
  const [titulo, setTitulo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [tipo, setTipo] = useState(preset?.tipo || 'avulsa') // 'avulsa' | 'grupo' | 'em_grupo'
  const [grupoId, setGrupoId] = useState(preset?.grupoId || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!titulo.trim()) return
    if (tipo === 'em_grupo' && !grupoId) return
    setSaving(true)
    try {
      await onSave({
        titulo: titulo.trim(),
        responsavel: responsavel.trim() || null,
        eh_grupo: tipo === 'grupo',
        grupo_id: tipo === 'em_grupo' ? grupoId : null,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nova iniciativa — {AREAS.find(a => a.value === area)?.label}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setTipo('avulsa')}
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${tipo === 'avulsa' ? 'var(--accent)' : 'var(--border)'}`,
                  background: tipo === 'avulsa' ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  color: tipo === 'avulsa' ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 6, cursor: 'pointer',
                }}>Iniciativa avulsa</button>
              <button type="button" onClick={() => setTipo('grupo')}
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${tipo === 'grupo' ? 'var(--accent)' : 'var(--border)'}`,
                  background: tipo === 'grupo' ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  color: tipo === 'grupo' ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 6, cursor: 'pointer',
                }}>Novo grupo</button>
              <button type="button" onClick={() => setTipo('em_grupo')} disabled={!grupos || grupos.length === 0}
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${tipo === 'em_grupo' ? 'var(--accent)' : 'var(--border)'}`,
                  background: tipo === 'em_grupo' ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  color: tipo === 'em_grupo' ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 6, cursor: 'pointer',
                  opacity: (!grupos || grupos.length === 0) ? 0.4 : 1,
                }}>Dentro de grupo</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              {tipo === 'avulsa' && 'Iniciativa independente, com células de semana próprias.'}
              {tipo === 'grupo' && 'Cabeçalho que agrupa outras iniciativas. Não tem células de semana.'}
              {tipo === 'em_grupo' && 'Iniciativa que faz parte de um grupo existente.'}
            </div>
          </div>
          {tipo === 'em_grupo' && (
            <div className="form-group">
              <label className="form-label">Grupo *</label>
              <select className="form-select" value={grupoId} onChange={e => setGrupoId(e.target.value)}>
                <option value="">Selecione...</option>
                {(grupos || []).map(g => <option key={g.id} value={g.id}>{g.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" autoFocus value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          {tipo !== 'grupo' && (
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <input className="form-input" value={responsavel}
                onChange={e => setResponsavel(e.target.value)}
                placeholder="Ex: Vanessa, João Gabriel..." />
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !titulo.trim() || (tipo === 'em_grupo' && !grupoId)}>
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalNovoSemestre({ onSave, onClose }) {
  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!nome.trim() || !dataInicio || !dataFim) return
    setSaving(true)
    try { await onSave({ nome: nome.trim(), data_inicio: dataInicio, data_fim: dataFim }) }
    finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Novo semestre</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" autoFocus value={nome}
              onChange={e => setNome(e.target.value)} placeholder="Ex: 2S2026" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Início *</label>
              <input className="form-input" type="date" value={dataInicio}
                onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fim *</label>
              <input className="form-input" type="date" value={dataFim}
                onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !nome.trim()}>
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// VISÃO 1 — MATRIZ MENSAL (uso diário)
// ═══════════════════════════════════════════════════════════
function VisaoMatriz({
  iniciativas, mesIdx, setMesIdx, semanaAtualIdx,
  editandoCelula, setEditandoCelula,
  editandoTitulo, setEditandoTitulo,
  onSalvarTitulo, onSalvarCelula, onDeletarIniciativa, onNovaIniciativa, onReordenarGrupos, area,
}) {
  const mes = MESES[mesIdx]
  const semanasDoMes = mes.semanas
  const [gruposColapsados, setGruposColapsados] = useState(new Set())
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  function toggleGrupo(id) {
    setGruposColapsados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function handleDragStart(e, grupoId) {
    setDraggingId(grupoId)
    e.dataTransfer.effectAllowed = 'move'
    // alguns navegadores precisam disso
    e.dataTransfer.setData('text/plain', grupoId)
  }

  function handleDragOver(e, grupoId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (grupoId !== draggingId) setDragOverId(grupoId)
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  function handleDrop(e, alvoId) {
    e.preventDefault()
    if (!draggingId || draggingId === alvoId) {
      setDraggingId(null); setDragOverId(null); return
    }
    onReordenarGrupos(draggingId, alvoId)
    setDraggingId(null); setDragOverId(null)
  }

  function handleDragEnd() {
    setDraggingId(null); setDragOverId(null)
  }

  const estrutura = useMemo(() => agruparIniciativas(iniciativas), [iniciativas])

  function getCelula(ini, semana) {
    return (ini.pda_celulas || []).find(c => c.semana === semana)
  }

  // Renderiza uma linha de iniciativa (não-grupo)
  function renderLinhaIniciativa(ini, ehFilha = false) {
    return (
      <div key={ini.id} style={{
        display: 'grid',
        gridTemplateColumns: `260px repeat(${semanasDoMes.length}, 1fr)`,
        borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))',
        minHeight: 42,
      }}>
        {/* TÍTULO */}
        <div style={{ padding: '8px 14px', paddingLeft: ehFilha ? 32 : 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          {editandoTitulo?.id === ini.id ? (
            <input
              autoFocus
              value={editandoTitulo.titulo}
              onChange={e => setEditandoTitulo(p => ({ ...p, titulo: e.target.value }))}
              onBlur={onSalvarTitulo}
              onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
              style={{ flex: 1, fontSize: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text)' }}
            />
          ) : (
            <div
              onClick={() => setEditandoTitulo({ id: ini.id, titulo: ini.titulo, responsavel: ini.responsavel || '' })}
              style={{ flex: 1, cursor: 'text', overflow: 'hidden' }}
              title={ini.titulo}>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.3 }}>
                {ini.titulo}
              </div>
              {ini.responsavel && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{ini.responsavel}</div>
              )}
            </div>
          )}
          <button onClick={() => { if (window.confirm(`Remover "${ini.titulo}"?`)) onDeletarIniciativa(ini.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0.3 }}>
            <Trash2 size={11} />
          </button>
        </div>
        {/* CÉLULAS */}
        {semanasDoMes.map(semana => {
          const celula = getCelula(ini, semana)
          const stInfo = STATUS_INFO[celula?.status || 'a_fazer']
          const isEdit = editandoCelula?.iniciativaId === ini.id && editandoCelula?.semana === semana
          const ehSemAtual = semana === semanaAtualIdx
          return (
            <div key={semana} style={{
              borderLeft: '1px solid var(--border-light, rgba(255,255,255,0.05))',
              background: celula ? stInfo.bg : (ehSemAtual ? 'rgba(249, 115, 22, 0.04)' : 'transparent'),
              position: 'relative',
              minHeight: 42,
            }}>
              {isEdit ? (
                <input
                  autoFocus
                  value={editandoCelula.texto}
                  onChange={e => setEditandoCelula(p => ({ ...p, texto: e.target.value }))}
                  onBlur={async () => {
                    await onSalvarCelula(ini.id, semana, editandoCelula.texto, celula?.status || 'a_fazer')
                    setEditandoCelula(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditandoCelula(null)
                  }}
                  style={{ width: '100%', height: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--surface)', border: '1px solid var(--accent)', outline: 'none', color: 'var(--text)' }}
                />
              ) : (
                <div
                  onClick={() => setEditandoCelula({ iniciativaId: ini.id, semana, texto: celula?.texto || '' })}
                  style={{ padding: '6px 8px', fontSize: 11, color: stInfo.text, cursor: 'text', minHeight: 30, lineHeight: 1.25, fontWeight: celula?.status === 'feito' ? 600 : 400, textAlign: 'center' }}>
                  {celula?.texto || ''}
                </div>
              )}
              {celula && celula.texto && (
                <button
                  onClick={async e => {
                    e.stopPropagation()
                    await onSalvarCelula(ini.id, semana, celula.texto, proximoStatus(celula.status))
                  }}
                  title={`Status: ${stInfo.label} (clique para mudar)`}
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 14, height: 14, padding: 0,
                    background: stInfo.border, color: 'white',
                    border: 'none', borderRadius: 3,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <stInfo.icon size={9} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Renderiza um cabeçalho de grupo
  function renderCabecalhoGrupo(grupo, filhas) {
    const colapsado = gruposColapsados.has(grupo.id)
    // Stats por LINHA: cada sub-iniciativa conta como 1, classificada pelo estado dela
    const stats = calcularStatsPorLinha(filhas)
    const concluidas = stats.feitas + stats.feitoAtr
    const corBarra = stats.atr > 0 ? 'var(--red)' : (stats.pct === 100 && stats.total > 0 ? 'var(--green)' : 'var(--accent)')
    return (
      <div key={grupo.id}
        draggable
        onDragStart={e => handleDragStart(e, grupo.id)}
        onDragOver={e => handleDragOver(e, grupo.id)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, grupo.id)}
        onDragEnd={handleDragEnd}
        style={{
        display: 'grid',
        gridTemplateColumns: `260px 1fr`,
        background: draggingId === grupo.id ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.06)',
        borderTop: dragOverId === grupo.id ? '2px solid var(--accent)' : '1px solid var(--accent)',
        borderBottom: '1px solid var(--border)',
        opacity: draggingId === grupo.id ? 0.5 : 1,
        cursor: draggingId === grupo.id ? 'grabbing' : 'default',
        transition: 'background 0.15s',
      }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', opacity: 0.4 }} title="Arraste para reordenar">
            <GripVertical size={14} />
          </div>
          <button onClick={() => toggleGrupo(grupo.id)}
            style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--accent)' }}>
            {colapsado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          {editandoTitulo?.id === grupo.id ? (
            <input
              autoFocus
              value={editandoTitulo.titulo}
              onChange={e => setEditandoTitulo(p => ({ ...p, titulo: e.target.value }))}
              onBlur={onSalvarTitulo}
              onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
              style={{ flex: 1, fontSize: 13, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text)' }}
            />
          ) : (
            <div
              onClick={() => setEditandoTitulo({ id: grupo.id, titulo: grupo.titulo, responsavel: grupo.responsavel || '' })}
              style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.3 }}
              title={grupo.titulo}>
              {grupo.titulo}
            </div>
          )}
          <button onClick={() => onNovaIniciativa({ tipo: 'em_grupo', grupoId: grupo.id })}
            title={`Adicionar iniciativa a "${grupo.titulo}"`}
            style={{
              background: 'none', color: 'var(--accent)', border: 'none',
              padding: 2, cursor: 'pointer', display: 'flex', opacity: 0.6,
            }}>
            <Plus size={13} />
          </button>
          <button onClick={() => { if (window.confirm(`Remover o grupo "${grupo.titulo}"?\n\nAs iniciativas dentro dele NÃO serão deletadas — só sairão do grupo.`)) onDeletarIniciativa(grupo.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0.4 }}>
            <Trash2 size={11} />
          </button>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {filhas.length} iniciativa{filhas.length !== 1 ? 's' : ''}
          </span>
          {stats.total > 0 && (
            <>
              <span style={{ color: 'var(--green)', fontWeight: 600 }} title="Iniciativas concluídas (no prazo)">✓ {stats.feitas}</span>
              {stats.feitoAtr > 0 && <span style={{ color: '#EF9F27', fontWeight: 600 }} title="Iniciativas concluídas fora do prazo">⚑ {stats.feitoAtr}</span>}
              {stats.em > 0 && <span style={{ color: '#854F0B', fontWeight: 600 }} title="Iniciativas em andamento">◐ {stats.em}</span>}
              {stats.atr > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }} title="Iniciativas atrasadas">! {stats.atr}</span>}
              <span style={{ color: 'var(--text-muted)' }}>de {stats.total}</span>
              <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }} title={`${concluidas} de ${stats.total} concluídas`}>
                <div style={{ height: '100%', width: `${stats.pct}%`, background: corBarra }} />
              </div>
              <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: 38, textAlign: 'right' }}>{stats.pct}%</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* NAVEGAÇÃO DE MÊS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm"
          onClick={() => setMesIdx(Math.max(0, mesIdx - 1))}
          disabled={mesIdx === 0}>
          <ChevronLeft size={14} />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {MESES.map((m, i) => (
            <button key={m.sigla} onClick={() => setMesIdx(i)}
              style={{
                background: i === mesIdx ? 'var(--accent)' : 'transparent',
                color: i === mesIdx ? 'white' : 'var(--text)',
                border: '1px solid ' + (i === mesIdx ? 'var(--accent)' : 'var(--border)'),
                padding: '4px 12px', fontSize: 12, fontWeight: 600,
                borderRadius: 6, cursor: 'pointer',
              }}>
              {m.sigla}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm"
          onClick={() => setMesIdx(Math.min(MESES.length - 1, mesIdx + 1))}
          disabled={mesIdx === MESES.length - 1}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* MATRIZ */}
      {iniciativas.length === 0 ? (
        <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Nenhuma iniciativa em {AREAS.find(a => a.value === area)?.label} ainda.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNovaIniciativa({ tipo: 'avulsa' })}>
              <Plus size={14} /> Nova iniciativa
            </button>
            <button className="btn btn-ghost" onClick={() => onNovaIniciativa({ tipo: 'grupo' })}
              style={{ border: '1px dashed var(--accent)', color: 'var(--accent)' }}>
              <Plus size={14} /> Novo grupo
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* CABEÇALHO */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `260px repeat(${semanasDoMes.length}, 1fr)`,
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Iniciativa
            </div>
            {semanasDoMes.map(s => {
              const ehAtual = s === semanaAtualIdx
              return (
                <div key={s} style={{
                  padding: '10px 4px', textAlign: 'center',
                  fontSize: 11, fontWeight: ehAtual ? 700 : 500,
                  color: ehAtual ? 'var(--accent)' : 'var(--text-muted)',
                  borderLeft: '1px solid var(--border)',
                }}>
                  <div>{SEMANA_LABELS[s - 1]}</div>
                  {ehAtual && <div style={{ fontSize: 9, marginTop: 2, textTransform: 'uppercase', opacity: 0.7 }}>· agora ·</div>}
                </div>
              )
            })}
          </div>
          {/* LINHAS AGRUPADAS */}
          {estrutura.map(item => {
            if (item.tipo === 'grupo') {
              const colapsado = gruposColapsados.has(item.grupo.id)
              return (
                <div key={item.grupo.id}>
                  {renderCabecalhoGrupo(item.grupo, item.filhas)}
                  {!colapsado && item.filhas.map(filha => renderLinhaIniciativa(filha, true))}
                </div>
              )
            }
            return renderLinhaIniciativa(item.iniciativa, false)
          })}
        </div>
      )}

      {/* LEGENDA */}
      {iniciativas.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_INFO).filter(([k]) => k !== 'a_fazer').map(([k, info]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: info.bg, border: `1px solid ${info.border}`, borderRadius: 2 }}></span>
              {info.label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Clique na célula para editar · clique no quadradinho para mudar status</span>
        </div>
      )}

      {iniciativas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => onNovaIniciativa({ tipo: 'avulsa' })}>
            <Plus size={12} /> Nova iniciativa avulsa
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNovaIniciativa({ tipo: 'grupo' })}
            style={{ border: '1px dashed var(--accent)', color: 'var(--accent)' }}>
            <Plus size={12} /> Novo grupo
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// VISÃO 2 — STATUS REPORT SEMANAL (apresentação)
// ═══════════════════════════════════════════════════════════
function VisaoStatusReport({
  iniciativas, semanaSel, setSemanaSel, semanaAtualIdx,
  editandoCelula, setEditandoCelula,
  onSalvarCelula,
}) {
  // Para a semana selecionada, agrupa iniciativas com células nessa semana
  const iniciativasDaSemana = iniciativas
    .map(ini => ({ ini, celula: (ini.pda_celulas || []).find(c => c.semana === semanaSel) }))
    .filter(x => x.celula && x.celula.texto)

  // Próximas 4 semanas para mini-timeline
  const proximas4 = []
  for (let i = 0; i < 4; i++) {
    const s = semanaSel + i
    if (s > 28) break
    const count = iniciativas.reduce((acc, ini) =>
      acc + ((ini.pda_celulas || []).filter(c => c.semana === s && c.texto).length), 0)
    proximas4.push({ semana: s, count })
  }

  const stats = calcularStats(iniciativas, [semanaSel])
  const statsLinha = calcularStatsPorLinha(iniciativas, [semanaSel])

  function handleExportar() {
    window.print()
  }

  // Agrupa por status (Feito → Em andamento → Atrasado → A fazer)
  const ordemStatus = ['feito', 'feito_atrasado', 'em_andamento', 'atrasado', 'a_fazer']
  const agrupado = ordemStatus.map(st => ({
    status: st,
    info: STATUS_INFO[st],
    items: iniciativasDaSemana.filter(x => (x.celula.status || 'a_fazer') === st),
  })).filter(g => g.items.length > 0)

  return (
    <div className="pda-status-report">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .pda-status-report, .pda-status-report * { visibility: visible; }
          .pda-status-report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* NAVEGAÇÃO DE SEMANA */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={semanaSel === 1} onClick={() => setSemanaSel(s => Math.max(1, s - 1))}>
            <ChevronLeft size={14} /> Anterior
          </button>
          <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
            value={semanaSel} onChange={e => setSemanaSel(parseInt(e.target.value))}>
            {SEMANA_LABELS.map((label, i) => {
              const s = i + 1
              const mes = MESES[mesDaSemana(s)]
              return (
                <option key={s} value={s}>
                  Sem {s} · {mes.sigla} · {label} {s === semanaAtualIdx ? '(atual)' : ''}
                </option>
              )
            })}
          </select>
          <button className="btn btn-ghost btn-sm" disabled={semanaSel === 28} onClick={() => setSemanaSel(s => Math.min(28, s + 1))}>
            Próxima <ChevronRight size={14} />
          </button>
          {semanaSel !== semanaAtualIdx && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSemanaSel(semanaAtualIdx)}>
              Voltar à semana atual
            </button>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleExportar}>
          <Printer size={12} /> Exportar / Imprimir
        </button>
      </div>

      {/* CABEÇALHO DO REPORT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status report</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
            Semana {semanaSel} · {MESES[mesDaSemana(semanaSel)].nome} · {SEMANA_LABELS[semanaSel - 1]}
          </div>
        </div>
      </div>

      {/* INDICADORES POR LINHA (INICIATIVA) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
          Por iniciativa <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>· status real do projeto</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <ResumoMini color="var(--green)" label="Concluídas" valor={statsLinha.feitas} icon={Check} />
          <ResumoMini color="#EF9F27" label="Fora do prazo" valor={statsLinha.feitoAtr} icon={Check} borderExtra="var(--green)" />
          <ResumoMini color="#EAB308" label="Em andamento" valor={statsLinha.em} icon={Clock} />
          <ResumoMini color="var(--red)" label="Atrasadas" valor={statsLinha.atr} icon={AlertCircle} />
          <ResumoMini color="var(--text-muted)" label="Total" valor={statsLinha.total} icon={Square} />
        </div>
      </div>

      {/* INDICADORES POR CÉLULA */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
          Por ação <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>· detalhe de cada célula</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <ResumoMini color="var(--green)" label="Feito" valor={stats.feitas} icon={Check} />
          <ResumoMini color="#EF9F27" label="Fora do prazo" valor={stats.feitoAtr} icon={Check} borderExtra="var(--green)" />
          <ResumoMini color="#EAB308" label="Em andamento" valor={stats.em} icon={Clock} />
          <ResumoMini color="var(--red)" label="Atrasado" valor={stats.atr} icon={AlertCircle} />
          <ResumoMini color="var(--text-muted)" label="Total" valor={stats.total} icon={Square} />
        </div>
      </div>

      {/* INICIATIVAS DA SEMANA */}
      {iniciativasDaSemana.length === 0 ? (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhuma ação prevista nesta semana.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Iniciativas desta semana
          </div>
          {agrupado.map(g => (
            <div key={g.status} style={{ marginBottom: 10 }}>
              {g.items.map(({ ini, celula }) => (
                <CardSemanal
                  key={ini.id}
                  ini={ini}
                  celula={celula}
                  stInfo={g.info}
                  semana={semanaSel}
                  grupo={grupoDe(ini, iniciativas)}
                  editandoCelula={editandoCelula}
                  setEditandoCelula={setEditandoCelula}
                  onSalvarCelula={onSalvarCelula}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* MINI-TIMELINE PRÓXIMAS 4 SEMANAS */}
      {proximas4.length > 1 && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Próximas semanas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${proximas4.length}, 1fr)`, gap: 8 }}>
            {proximas4.map((p, i) => {
              const ehAtual = i === 0
              return (
                <div key={p.semana}
                  onClick={() => setSemanaSel(p.semana)}
                  style={{
                    textAlign: 'center', padding: 10, borderRadius: 6,
                    background: ehAtual ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                    border: ehAtual ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SEM {p.semana} {ehAtual ? '· agora' : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{SEMANA_LABELS[p.semana - 1]}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: p.count > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                    {p.count} ação{p.count !== 1 ? 'ões' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CardSemanal({ ini, celula, stInfo, semana, grupo, editandoCelula, setEditandoCelula, onSalvarCelula }) {
  const isEdit = editandoCelula?.iniciativaId === ini.id && editandoCelula?.semana === semana

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${stInfo.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {grupo && (
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {grupo.titulo}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {ini.titulo}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ini.responsavel ? <>{ini.responsavel} · </> : null}
            esta semana:{' '}
            {isEdit ? (
              <input
                autoFocus
                value={editandoCelula.texto}
                onChange={e => setEditandoCelula(p => ({ ...p, texto: e.target.value }))}
                onBlur={async () => {
                  await onSalvarCelula(ini.id, semana, editandoCelula.texto, celula?.status || 'a_fazer')
                  setEditandoCelula(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditandoCelula(null)
                }}
                style={{ fontSize: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: stInfo.text, fontWeight: 600, width: '60%' }}
              />
            ) : (
              <span
                onClick={() => setEditandoCelula({ iniciativaId: ini.id, semana, texto: celula.texto })}
                style={{ color: stInfo.text, fontWeight: 600, cursor: 'text' }}
                title="Clique para editar">
                {celula.texto}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={async () => {
            await onSalvarCelula(ini.id, semana, celula.texto, proximoStatus(celula.status))
          }}
          title={`Status: ${stInfo.label} (clique para mudar)`}
          style={{
            background: stInfo.bg,
            color: stInfo.text,
            border: `1px solid ${stInfo.border}`,
            fontSize: 11, fontWeight: 600,
            padding: '4px 10px', borderRadius: 99,
            cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <stInfo.icon size={11} />
          {stInfo.label}
        </button>
      </div>
    </div>
  )
}

function ResumoMini({ color, label, valor, icon: Icon, borderExtra }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${borderExtra || 'var(--border)'}`,
      borderLeft: borderExtra ? `4px solid ${color}` : `1px solid var(--border)`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ color, display: 'flex' }}><Icon size={18} /></div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function PDA() {
  const [semestres, setSemestres] = useState([])
  const [semestreId, setSemestreId] = useState(null)
  const [area, setArea] = useState('geral')
  const [iniciativas, setIniciativas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(null) // null | { tipo, grupoId? }
  const [modalSemestre, setModalSemestre] = useState(false)
  const [editandoCelula, setEditandoCelula] = useState(null)
  const [editandoTitulo, setEditandoTitulo] = useState(null)
  const [visao, setVisao] = useState('matriz') // 'matriz' | 'status'
  const [toast, showToast] = useToast()

  const semanaAtualIdx = useMemo(() => semanaAtual(), [])
  const [mesIdx, setMesIdx] = useState(mesDaSemana(semanaAtualIdx))
  const [semanaSel, setSemanaSel] = useState(semanaAtualIdx)

  useEffect(() => {
    (async () => {
      try {
        const s = await getSemestres()
        setSemestres(s)
        if (s.length > 0) setSemestreId(s[0].id)
        else setLoading(false)
      } catch (e) {
        console.error(e); setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!semestreId) return
    setLoading(true)
    getIniciativas(semestreId, area)
      .then(setIniciativas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [semestreId, area])

  async function handleCriarSemestre(form) {
    const novo = await criarSemestre(form)
    setSemestres(prev => [novo, ...prev])
    setSemestreId(novo.id)
    setModalSemestre(false)
    showToast('Semestre criado!')
  }

  async function handleCriarIniciativa(form) {
    const proximaOrdem = (iniciativas[iniciativas.length - 1]?.ordem || 0) + 1
    const nova = await criarIniciativa({ semestre_id: semestreId, area, ...form, ordem: proximaOrdem })
    setIniciativas(prev => [...prev, nova])
    setModalNovo(null)
    showToast('Iniciativa criada!')
  }

  async function handleDeletarIniciativa(id) {
    await deletarIniciativa(id)
    setIniciativas(prev => prev.filter(i => i.id !== id))
    showToast('Removido.')
  }

  async function handleSalvarTitulo() {
    if (!editandoTitulo) return
    const { id, titulo, responsavel } = editandoTitulo
    const t = titulo.trim()
    if (!t) { setEditandoTitulo(null); return }
    const atual = iniciativas.find(i => i.id === id)
    if (atual && t === atual.titulo && responsavel === (atual.responsavel || '')) {
      setEditandoTitulo(null); return
    }
    const upd = await atualizarIniciativa(id, { titulo: t, responsavel: responsavel.trim() || null })
    setIniciativas(prev => prev.map(i => i.id === id ? { ...i, ...upd } : i))
    setEditandoTitulo(null)
  }

  async function handleReordenarGrupos(idArrastado, idAlvo) {
    // Reordena os grupos visualmente e propaga ordem nova para filhos também.
    // Estratégia: pega a estrutura agrupada, move o bloco arrastado para a posição do alvo,
    // depois reatribui `ordem` sequencialmente em todas as iniciativas.
    const estrutura = agruparIniciativas(iniciativas)
    const idxArr = estrutura.findIndex(it => it.tipo === 'grupo' && it.grupo.id === idArrastado)
    const idxAlvo = estrutura.findIndex(it => it.tipo === 'grupo' && it.grupo.id === idAlvo)
    if (idxArr === -1 || idxAlvo === -1) return

    // Move o bloco
    const novaEstrutura = [...estrutura]
    const [movido] = novaEstrutura.splice(idxArr, 1)
    novaEstrutura.splice(idxAlvo, 0, movido)

    // Reatribui ordem sequencialmente
    const updates = []
    let ordem = 1
    for (const item of novaEstrutura) {
      if (item.tipo === 'grupo') {
        updates.push({ id: item.grupo.id, ordem })
        ordem++
        for (const f of item.filhas) {
          updates.push({ id: f.id, ordem })
          ordem++
        }
      } else {
        updates.push({ id: item.iniciativa.id, ordem })
        ordem++
      }
    }

    // Atualiza estado local imediatamente (otimista)
    const mapOrdem = new Map(updates.map(u => [u.id, u.ordem]))
    setIniciativas(prev => prev
      .map(i => mapOrdem.has(i.id) ? { ...i, ordem: mapOrdem.get(i.id) } : i)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    )

    // Persiste no banco em paralelo
    try {
      await Promise.all(updates.map(u => atualizarIniciativa(u.id, { ordem: u.ordem })))
    } catch (e) {
      console.error('Erro ao reordenar:', e)
      showToast('Erro ao salvar nova ordem', 'error')
    }
  }

  async function handleSalvarCelula(iniciativaId, semana, novoTexto, novoStatus) {
    const ini = iniciativas.find(i => i.id === iniciativaId)
    if (!ini) return
    const celulaExistente = (ini.pda_celulas || []).find(c => c.semana === semana)
    const texto = novoTexto?.trim() || null
    const status = novoStatus || celulaExistente?.status || 'a_fazer'
    const r = await upsertCelula({ iniciativa_id: iniciativaId, semana, texto, status })
    setIniciativas(prev => prev.map(i => {
      if (i.id !== iniciativaId) return i
      const semCelula = (i.pda_celulas || []).filter(c => c.semana !== semana)
      if (!r) return { ...i, pda_celulas: semCelula }
      return { ...i, pda_celulas: [...semCelula, r] }
    }))
  }

  const statsGeraisPorLinha = useMemo(() => calcularStatsPorLinha(iniciativas), [iniciativas])
  const statsGeraisPorCelula = useMemo(() => calcularStats(iniciativas), [iniciativas])

  // ── Sem semestre cadastrado ──
  if (semestres.length === 0 && !loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Target size={22} color="var(--accent)" />
          <h1 className="page-title" style={{ margin: 0 }}>PDA — Plano de Ação</h1>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Nenhum semestre cadastrado ainda.</p>
          <button className="btn btn-primary" onClick={() => setModalSemestre(true)}>
            <Plus size={14} /> Criar primeiro semestre
          </button>
        </div>
        {modalSemestre && <ModalNovoSemestre onSave={handleCriarSemestre} onClose={() => setModalSemestre(false)} />}
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* CABEÇALHO */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>PDA — Plano de Ação</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {iniciativas.length} iniciativa{iniciativas.length !== 1 ? 's' : ''} · {statsGeraisPorLinha.feitas + statsGeraisPorLinha.feitoAtr}/{statsGeraisPorLinha.total} concluídas ({statsGeraisPorLinha.pct}%)
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
            value={semestreId || ''} onChange={e => setSemestreId(e.target.value)}>
            {semestres.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setModalSemestre(true)} title="Novo semestre">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* TOGGLE DE VISÃO */}
      <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        <button onClick={() => setVisao('matriz')}
          style={{
            background: visao === 'matriz' ? 'var(--surface)' : 'transparent',
            color: visao === 'matriz' ? 'var(--text)' : 'var(--text-muted)',
            border: 'none', padding: '8px 14px', borderRadius: 6,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <Grid3x3 size={14} /> Matriz mensal
        </button>
        <button onClick={() => setVisao('status')}
          style={{
            background: visao === 'status' ? 'var(--surface)' : 'transparent',
            color: visao === 'status' ? 'var(--text)' : 'var(--text-muted)',
            border: 'none', padding: '8px 14px', borderRadius: 6,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <FileText size={14} /> Status report semanal
        </button>
      </div>

      {/* TABS DE ÁREA */}
      <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {AREAS.map(a => (
          <button key={a.value} onClick={() => setArea(a.value)}
            style={{
              background: area === a.value ? 'var(--accent)' : 'transparent',
              color: area === a.value ? 'white' : 'var(--text)',
              border: 'none', padding: '8px 16px',
              borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
      ) : visao === 'matriz' ? (
        <VisaoMatriz
          iniciativas={iniciativas}
          mesIdx={mesIdx}
          setMesIdx={setMesIdx}
          semanaAtualIdx={semanaAtualIdx}
          editandoCelula={editandoCelula}
          setEditandoCelula={setEditandoCelula}
          editandoTitulo={editandoTitulo}
          setEditandoTitulo={setEditandoTitulo}
          onSalvarTitulo={handleSalvarTitulo}
          onSalvarCelula={handleSalvarCelula}
          onDeletarIniciativa={handleDeletarIniciativa}
          onNovaIniciativa={(preset) => setModalNovo(preset || { tipo: 'avulsa' })}
          onReordenarGrupos={handleReordenarGrupos}
          area={area}
        />
      ) : (
        <VisaoStatusReport
          iniciativas={iniciativas}
          semanaSel={semanaSel}
          setSemanaSel={setSemanaSel}
          semanaAtualIdx={semanaAtualIdx}
          editandoCelula={editandoCelula}
          setEditandoCelula={setEditandoCelula}
          onSalvarCelula={handleSalvarCelula}
        />
      )}

      {modalNovo && <ModalNovaIniciativa area={area} grupos={iniciativas.filter(i => i.eh_grupo)} preset={modalNovo} onSave={handleCriarIniciativa} onClose={() => setModalNovo(null)} />}
      {modalSemestre && <ModalNovoSemestre onSave={handleCriarSemestre} onClose={() => setModalSemestre(false)} />}

      {toast && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
