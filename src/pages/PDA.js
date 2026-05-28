import { useEffect, useState, useMemo } from 'react'
import {
  getSemestres, criarSemestre,
  getIniciativas, criarIniciativa, atualizarIniciativa, deletarIniciativa,
  upsertCelula,
} from '../lib/pda'
import {
  Target, Plus, Trash2, X, Check, Clock, AlertCircle, Square,
  ChevronDown, ChevronRight, Maximize2, Minimize2
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
  a_fazer:      { label: 'A fazer',      bg: 'transparent',              border: 'var(--border)',  color: 'var(--text-muted)', icon: Square },
  em_andamento: { label: 'Em andamento', bg: 'rgba(234, 179, 8, 0.15)',  border: '#EAB308',        color: '#EAB308',           icon: Clock },
  feito:        { label: 'Feito',        bg: 'rgba(34, 197, 94, 0.15)',  border: 'var(--green)',   color: 'var(--green)',      icon: Check },
  atrasado:     { label: 'Atrasado',     bg: 'rgba(239, 68, 68, 0.15)',  border: 'var(--red)',     color: 'var(--red)',        icon: AlertCircle },
}
const STATUS_CICLO = ['a_fazer', 'em_andamento', 'feito', 'atrasado']

// ── SEMANAS — labels iguais à planilha original ────────────
const SEMANA_LABELS = [
  '1 a 3',   '4 a 10',  '11 a 17', '18 a 24', '25-31',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28', '29 a 4/Abr',
  '5 a 11',  '12 a 18', '19 a 25', '26 a 2/Mai',
  '3 a 9',   '10 a 16', '17 a 23', '24 a 30', '31 a 6/Jun',
  '7 a 13',  '14 a 20', '21 a 27', '28 a 4/Jul',
  '5 a 11',
]
const SEMANA_MES = [
  'Jan','Jan','Jan','Jan','Jan',
  'Fev','Fev','Fev','Fev',
  'Mar','Mar','Mar','Mar','Mar',
  'Abr','Abr','Abr','Abr',
  'Mai','Mai','Mai','Mai','Mai',
  'Jun','Jun','Jun','Jun',
  'Jul',
]
const SEMANA_DATA = [
  // [ano, mês, diaInicio] aproximados (1S 2026)
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
    const dataInicio = new Date(a, m - 1, d)
    if (hoje >= dataInicio) return i + 1
  }
  return 1
}

function ehSubItem(titulo) {
  // sub-itens começam com "Nº-" ou "Nº -" ou números
  return /^\s*\d+\s*-/.test(titulo || '')
}

function agruparIniciativas(iniciativas) {
  // Agrupa: cada iniciativa "pai" (sem prefixo numérico) recebe seus sub-itens em sequência
  const grupos = []
  let grupoAtual = null

  for (const ini of iniciativas) {
    if (!ehSubItem(ini.titulo)) {
      grupoAtual = { pai: ini, filhos: [] }
      grupos.push(grupoAtual)
    } else {
      if (grupoAtual) grupoAtual.filhos.push(ini)
      else grupos.push({ pai: ini, filhos: [] }) // sub-item órfão = vira pai sozinho
    }
  }
  return grupos
}

function calcularProgresso(iniciativas) {
  let total = 0, feitas = 0, emAndamento = 0, atrasadas = 0
  for (const ini of iniciativas) {
    for (const c of (ini.pda_celulas || [])) {
      total++
      if (c.status === 'feito') feitas++
      else if (c.status === 'em_andamento') emAndamento++
      else if (c.status === 'atrasado') atrasadas++
    }
  }
  return { total, feitas, emAndamento, atrasadas, pct: total ? Math.round(feitas / total * 100) : 0 }
}

// ── TOAST ──────────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3000) }
  return [t, show]
}

// ── MODAIS ─────────────────────────────────────────────────
function ModalNovaIniciativa({ area, onSave, onClose }) {
  const [titulo, setTitulo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!titulo.trim()) return
    setSaving(true)
    try { await onSave({ titulo: titulo.trim(), responsavel: responsavel.trim() || null }) }
    finally { setSaving(false) }
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
            <label className="form-label">Título *</label>
            <input className="form-input" autoFocus value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div className="form-group">
            <label className="form-label">Responsável</label>
            <input className="form-input" value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              placeholder="Ex: Vanessa, João Gabriel..." />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !titulo.trim()}>
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

// ── CARD DE INICIATIVA ─────────────────────────────────────
function CardIniciativa({
  grupo, semanasVisiveis, editandoCelula, setEditandoCelula,
  editandoTitulo, setEditandoTitulo,
  onSalvarTitulo, onSalvarCelula, onDeletarIniciativa, onProximoStatus,
  semanaAtualIdx,
}) {
  const { pai, filhos } = grupo
  const todasIniciativas = [pai, ...filhos]
  const progresso = calcularProgresso(todasIniciativas)
  const [expandido, setExpandido] = useState(true)

  // borda/cor do card baseada no progresso
  const corBorda = progresso.pct === 0
    ? 'var(--border)'
    : progresso.pct === 100
      ? 'var(--green)'
      : progresso.atrasadas > 0
        ? 'var(--red)'
        : 'var(--accent)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${corBorda}`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* CABEÇALHO DO CARD */}
      <div
        onClick={() => setExpandido(v => !v)}
        style={{
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer',
          background: 'var(--surface-2)',
          borderBottom: expandido ? '1px solid var(--border)' : 'none',
        }}>
        <button style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: 'var(--text-muted)' }}>
          {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editandoTitulo?.id === pai.id ? (
            <input
              autoFocus
              value={editandoTitulo.titulo}
              onChange={e => setEditandoTitulo(p => ({ ...p, titulo: e.target.value }))}
              onBlur={onSalvarTitulo}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
              style={{ width: '100%', fontSize: 14, fontWeight: 600, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text)' }}
            />
          ) : (
            <h3
              onClick={e => { e.stopPropagation(); setEditandoTitulo({ id: pai.id, titulo: pai.titulo, responsavel: pai.responsavel || '' }) }}
              style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'text' }}
              title="Clique para editar">
              {pai.titulo}
            </h3>
          )}
          {pai.responsavel && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Responsável: <strong style={{ color: 'var(--text)' }}>{pai.responsavel}</strong>
              {filhos.length > 0 && <span> · {filhos.length} sub-{filhos.length === 1 ? 'item' : 'itens'}</span>}
            </div>
          )}
        </div>
        {/* Mini stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          {progresso.total > 0 && (
            <>
              <span style={{ color: 'var(--green)', fontWeight: 600 }} title="Feitas">✓ {progresso.feitas}</span>
              {progresso.emAndamento > 0 && <span style={{ color: '#EAB308', fontWeight: 600 }} title="Em andamento">◐ {progresso.emAndamento}</span>}
              {progresso.atrasadas > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }} title="Atrasadas">! {progresso.atrasadas}</span>}
              <span style={{ color: 'var(--text-muted)' }}>/ {progresso.total}</span>
              <div style={{ width: 50, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progresso.pct}%`, background: corBorda, transition: 'width 0.3s' }} />
              </div>
              <span style={{ color: 'var(--text)', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{progresso.pct}%</span>
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); if (window.confirm(`Remover "${pai.titulo}" e seus sub-itens?`)) onDeletarIniciativa(pai.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', opacity: 0.4 }}
            title="Remover">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* CONTEÚDO EXPANDIDO */}
      {expandido && (
        <div style={{ padding: '8px 0' }}>
          {todasIniciativas.map(ini => (
            <LinhaIniciativa
              key={ini.id}
              iniciativa={ini}
              ehFilho={ini.id !== pai.id}
              semanasVisiveis={semanasVisiveis}
              editandoCelula={editandoCelula}
              setEditandoCelula={setEditandoCelula}
              editandoTitulo={editandoTitulo}
              setEditandoTitulo={setEditandoTitulo}
              onSalvarTitulo={onSalvarTitulo}
              onSalvarCelula={onSalvarCelula}
              onDeletarIniciativa={onDeletarIniciativa}
              onProximoStatus={onProximoStatus}
              semanaAtualIdx={semanaAtualIdx}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── LINHA DA INICIATIVA (pai ou filho) ─────────────────────
function LinhaIniciativa({
  iniciativa, ehFilho, semanasVisiveis,
  editandoCelula, setEditandoCelula,
  editandoTitulo, setEditandoTitulo,
  onSalvarTitulo, onSalvarCelula, onDeletarIniciativa, onProximoStatus,
  semanaAtualIdx,
}) {
  const ini = iniciativa
  function getCelula(semana) {
    return (ini.pda_celulas || []).find(c => c.semana === semana)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${ehFilho ? '24px ' : ''}260px repeat(${semanasVisiveis.length}, 1fr)`,
      alignItems: 'stretch',
      borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.04))',
      minHeight: 36,
    }}>
      {ehFilho && <div />}
      {/* TÍTULO */}
      <div style={{
        padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        background: ehFilho ? 'transparent' : 'var(--surface)',
      }}>
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
          <span
            onClick={() => setEditandoTitulo({ id: ini.id, titulo: ini.titulo, responsavel: ini.responsavel || '' })}
            title={ini.titulo}
            style={{ flex: 1, fontSize: 12, color: ehFilho ? 'var(--text-muted)' : 'var(--text)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ini.titulo}
          </span>
        )}
        {ehFilho && (
          <button
            onClick={() => { if (window.confirm(`Remover sub-item "${ini.titulo}"?`)) onDeletarIniciativa(ini.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0.3 }}
            title="Remover">
            <Trash2 size={10} />
          </button>
        )}
      </div>
      {/* CÉLULAS DAS SEMANAS */}
      {semanasVisiveis.map(semana => {
        const celula = getCelula(semana)
        const stInfo = STATUS_INFO[celula?.status || 'a_fazer']
        const isEditando = editandoCelula?.iniciativaId === ini.id && editandoCelula?.semana === semana
        const ehSemanaAtual = semana === semanaAtualIdx
        return (
          <div key={semana} style={{
            background: celula ? stInfo.bg : (ehSemanaAtual ? 'rgba(249, 115, 22, 0.04)' : 'transparent'),
            borderLeft: ehSemanaAtual && !celula ? '2px solid var(--accent)' : (celula ? `2px solid ${stInfo.border}` : '1px solid var(--border-light, rgba(255,255,255,0.03))'),
            position: 'relative',
            minHeight: 36,
          }}>
            {isEditando ? (
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
                style={{ width: '100%', height: '100%', padding: '4px 6px', fontSize: 10, background: 'var(--surface)', border: '1px solid var(--accent)', outline: 'none', color: 'var(--text)' }}
              />
            ) : (
              <div
                onClick={() => setEditandoCelula({ iniciativaId: ini.id, semana, texto: celula?.texto || '' })}
                style={{ padding: '4px 6px', fontSize: 10, color: stInfo.color, cursor: 'text', minHeight: 28, lineHeight: 1.2, fontWeight: celula?.status === 'feito' ? 600 : 400 }}>
                {celula?.texto || ''}
              </div>
            )}
            {celula && celula.texto && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  await onSalvarCelula(ini.id, semana, celula.texto, onProximoStatus(celula.status))
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

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function PDA() {
  const [semestres, setSemestres] = useState([])
  const [semestreId, setSemestreId] = useState(null)
  const [area, setArea] = useState('geral')
  const [iniciativas, setIniciativas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalSemestre, setModalSemestre] = useState(false)
  const [editandoCelula, setEditandoCelula] = useState(null)
  const [editandoTitulo, setEditandoTitulo] = useState(null)
  const [verSemestreInteiro, setVerSemestreInteiro] = useState(false)
  const [toast, showToast] = useToast()

  const semanaAtualIdx = useMemo(() => semanaAtual(), [])

  // Semanas visíveis: foco no agora (próximas 12) ou semestre inteiro
  const semanasVisiveis = useMemo(() => {
    if (verSemestreInteiro) return Array.from({ length: 28 }, (_, i) => i + 1)
    const inicio = Math.max(1, semanaAtualIdx - 1)
    const fim = Math.min(28, inicio + 11)
    return Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i)
  }, [verSemestreInteiro, semanaAtualIdx])

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
    setModalNovo(false)
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

  function proximoStatus(s) {
    const idx = STATUS_CICLO.indexOf(s || 'a_fazer')
    return STATUS_CICLO[(idx + 1) % STATUS_CICLO.length]
  }

  // ── Estatísticas ──
  const stats = useMemo(() => calcularProgresso(iniciativas), [iniciativas])
  const grupos = useMemo(() => agruparIniciativas(iniciativas), [iniciativas])

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>PDA — Plano de Ação</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {grupos.length} iniciativa{grupos.length !== 1 ? 's' : ''} · {stats.feitas}/{stats.total} ações concluídas ({stats.pct}%)
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setVerSemestreInteiro(v => !v)} title={verSemestreInteiro ? 'Voltar ao foco no agora' : 'Ver semestre inteiro'}>
            {verSemestreInteiro ? <><Minimize2 size={12} /> Focar no agora</> : <><Maximize2 size={12} /> Ver semestre inteiro</>}
          </button>
          <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
            value={semestreId || ''} onChange={e => setSemestreId(e.target.value)}>
            {semestres.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setModalSemestre(true)} title="Novo semestre">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <ResumoCard color="var(--green)" label="Feito" valor={stats.feitas} icon={Check} />
        <ResumoCard color="#EAB308" label="Em andamento" valor={stats.emAndamento} icon={Clock} />
        <ResumoCard color="var(--red)" label="Atrasado" valor={stats.atrasadas} icon={AlertCircle} />
        <ResumoCard color="var(--text-muted)" label="Total" valor={stats.total} icon={Square} />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
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

      {/* HEADER DE SEMANAS — fica fixo acima dos cards */}
      {iniciativas.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `260px repeat(${semanasVisiveis.length}, 1fr)`,
          background: 'var(--surface-2)', borderRadius: 8,
          padding: '6px 0', marginBottom: 12, fontSize: 10,
        }}>
          <div style={{ padding: '0 12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            {verSemestreInteiro ? 'Semestre inteiro' : 'Foco no agora'}
          </div>
          {semanasVisiveis.map(s => {
            const ehAtual = s === semanaAtualIdx
            return (
              <div key={s} style={{
                padding: '2px 4px', textAlign: 'center',
                color: ehAtual ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: ehAtual ? 700 : 500,
              }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.7 }}>{SEMANA_MES[s - 1]}</div>
                <div>{SEMANA_LABELS[s - 1]}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* CONTEÚDO */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
      ) : iniciativas.length === 0 ? (
        <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Nenhuma iniciativa em {AREAS.find(a => a.value === area)?.label} ainda.
          </p>
          <button className="btn btn-primary" onClick={() => setModalNovo(true)}>
            <Plus size={14} /> Nova iniciativa
          </button>
        </div>
      ) : (
        <div>
          {grupos.map(g => (
            <CardIniciativa
              key={g.pai.id}
              grupo={g}
              semanasVisiveis={semanasVisiveis}
              editandoCelula={editandoCelula}
              setEditandoCelula={setEditandoCelula}
              editandoTitulo={editandoTitulo}
              setEditandoTitulo={setEditandoTitulo}
              onSalvarTitulo={handleSalvarTitulo}
              onSalvarCelula={handleSalvarCelula}
              onDeletarIniciativa={handleDeletarIniciativa}
              onProximoStatus={proximoStatus}
              semanaAtualIdx={semanaAtualIdx}
            />
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setModalNovo(true)}>
            <Plus size={12} /> Nova iniciativa em {AREAS.find(a => a.value === area)?.label}
          </button>
        </div>
      )}

      {/* MODAIS */}
      {modalNovo && <ModalNovaIniciativa area={area} onSave={handleCriarIniciativa} onClose={() => setModalNovo(false)} />}
      {modalSemestre && <ModalNovoSemestre onSave={handleCriarSemestre} onClose={() => setModalSemestre(false)} />}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function ResumoCard({ color, label, valor, icon: Icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid var(--border)`,
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10, minWidth: 120,
    }}>
      <div style={{ color, display: 'flex' }}><Icon size={16} /></div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  )
}
