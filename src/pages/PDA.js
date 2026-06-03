import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  getSemestres, criarSemestre,
  getIniciativas, criarIniciativa, atualizarIniciativa, deletarIniciativa,
  upsertCelula,
} from '../lib/pda'
import {
  Target, Plus, Trash2, X, Check, Clock, AlertCircle, Square,
  Grid3x3, FileText, ChevronLeft, ChevronRight, ChevronDown, Printer, GripVertical, Info, Calendar
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
  a_fazer:        { label: 'A fazer',               curto: 'A fazer',        bg: 'transparent',              text: 'var(--text-muted)',  border: 'var(--border)',  icon: Square },
  planejada:      { label: 'Planejada',             curto: 'Planejada',      bg: 'rgba(59, 130, 246, 0.18)', text: '#60A5FA',            border: '#3B82F6',        icon: Calendar },
  em_andamento:   { label: 'Em andamento',          curto: 'Em andamento',   bg: 'rgba(234, 179, 8, 0.18)',  text: '#FACC15',            border: '#EAB308',        icon: Clock },
  feito:          { label: 'Feito',                 curto: 'Feito',          bg: 'rgba(34, 197, 94, 0.18)',  text: '#4ADE80',            border: 'var(--green)',   icon: Check },
  feito_atrasado: { label: 'Concluído fora do prazo', curto: 'Fora do prazo', bg: 'rgba(34, 197, 94, 0.18)', text: '#4ADE80',           border: '#EF9F27',        icon: Check },
  atrasado:       { label: 'Atrasado',              curto: 'Atrasado',       bg: 'rgba(239, 68, 68, 0.18)',  text: '#F87171',            border: 'var(--red)',     icon: AlertCircle },
}
const STATUS_CICLO = ['a_fazer', 'planejada', 'em_andamento', 'feito', 'feito_atrasado', 'atrasado']

function celulaAtiva(c) {
  return !!(c && c.status && c.status !== 'a_fazer')
}

// ── SEMANAS ────────────────────────────────────────────────
const SEMANA_LABELS = [
  '1 a 3',   '4 a 10',  '11 a 17', '18 a 24', '25 a 31',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28', '29 a 4/Abr',
  '5 a 11',  '12 a 18', '19 a 25', '26 a 2/Mai',
  '3 a 9',   '10 a 16', '17 a 23', '24 a 30', '31 a 6/Jun',
  '7 a 13',  '14 a 20', '21 a 27', '28 a 4/Jul',
  '5 a 11',  '12 a 18', '19 a 25', '26 a 1/Ago',
  '2 a 8',   '9 a 15',  '16 a 22', '23 a 29', '30 a 5/Set',
  '6 a 12',  '13 a 19', '20 a 26', '27 a 3/Out',
  '4 a 10',  '11 a 17', '18 a 24', '25 a 31',
  '1 a 7',   '8 a 14',  '15 a 21', '22 a 28', '29 a 5/Dez',
  '6 a 12',  '13 a 19', '20 a 26', '27 a 31',
]
const MESES = [
  { nome: 'Janeiro',   sigla: 'Jan', semanas: [1, 2, 3, 4, 5] },
  { nome: 'Fevereiro', sigla: 'Fev', semanas: [6, 7, 8, 9] },
  { nome: 'Março',     sigla: 'Mar', semanas: [10, 11, 12, 13, 14] },
  { nome: 'Abril',     sigla: 'Abr', semanas: [15, 16, 17, 18] },
  { nome: 'Maio',      sigla: 'Mai', semanas: [19, 20, 21, 22, 23] },
  { nome: 'Junho',     sigla: 'Jun', semanas: [24, 25, 26, 27] },
  { nome: 'Julho',     sigla: 'Jul', semanas: [28, 29, 30, 31] },
  { nome: 'Agosto',    sigla: 'Ago', semanas: [32, 33, 34, 35, 36] },
  { nome: 'Setembro',  sigla: 'Set', semanas: [37, 38, 39, 40] },
  { nome: 'Outubro',   sigla: 'Out', semanas: [41, 42, 43, 44] },
  { nome: 'Novembro',  sigla: 'Nov', semanas: [45, 46, 47, 48, 49] },
  { nome: 'Dezembro',  sigla: 'Dez', semanas: [50, 51, 52, 53] },
]
const SEMANA_DATA = [
  [2026,1,1],[2026,1,4],[2026,1,11],[2026,1,18],[2026,1,25],
  [2026,2,1],[2026,2,8],[2026,2,15],[2026,2,22],
  [2026,3,1],[2026,3,8],[2026,3,15],[2026,3,22],[2026,3,29],
  [2026,4,5],[2026,4,12],[2026,4,19],[2026,4,26],
  [2026,5,3],[2026,5,10],[2026,5,17],[2026,5,24],[2026,5,31],
  [2026,6,7],[2026,6,14],[2026,6,21],[2026,6,28],
  [2026,7,5],[2026,7,12],[2026,7,19],[2026,7,26],
  [2026,8,2],[2026,8,9],[2026,8,16],[2026,8,23],[2026,8,30],
  [2026,9,6],[2026,9,13],[2026,9,20],[2026,9,27],
  [2026,10,4],[2026,10,11],[2026,10,18],[2026,10,25],
  [2026,11,1],[2026,11,8],[2026,11,15],[2026,11,22],[2026,11,29],
  [2026,12,6],[2026,12,13],[2026,12,20],[2026,12,27],
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
    if (ini.eh_grupo && !(ini.pda_celulas || []).some(celulaAtiva)) continue
    for (const c of (ini.pda_celulas || [])) {
      if (semanasFiltro && !semanasFiltro.includes(c.semana)) continue
      if (!celulaAtiva(c)) continue
      total++
      if (c.status === 'feito') feitas++
      else if (c.status === 'feito_atrasado') feitoAtr++
      else if (c.status === 'em_andamento') em++
      else if (c.status === 'atrasado') atr++
    }
  }
  return { total, feitas, feitoAtr, em, atr, pct: total ? Math.round(feitas / total * 100) : 0 }
}

function statusDaLinha(ini, semanasFiltro = null) {
  const celulas = (ini.pda_celulas || [])
    .filter(c => !semanasFiltro || semanasFiltro.includes(c.semana))
    .filter(c => celulaAtiva(c))
  if (celulas.length === 0) return 'nao_iniciada'
  if (celulas.some(c => c.status === 'feito')) return 'feita'
  if (celulas.some(c => c.status === 'feito_atrasado')) return 'feita_atrasado'
  if (celulas.some(c => c.status === 'atrasado')) return 'atrasada'
  if (celulas.some(c => c.status === 'em_andamento')) return 'em_andamento'
  if (celulas.some(c => c.status === 'planejada')) return 'planejada'
  return 'nao_iniciada'
}

function calcularStatsPorLinha(iniciativas, semanasFiltro = null) {
  let total = 0, feitas = 0, feitoAtr = 0, em = 0, atr = 0, planejadas = 0, naoIniciadas = 0
  for (const ini of iniciativas) {
    // Incluir grupos que têm células próprias ativas, além das iniciativas normais
    if (ini.eh_grupo) {
      const temCelulasProprias = (ini.pda_celulas || []).some(celulaAtiva)
      if (!temCelulasProprias) continue
    }
    if (semanasFiltro) {
      const temCelulaNaSemana = (ini.pda_celulas || []).some(c => semanasFiltro.includes(c.semana) && celulaAtiva(c))
      if (!temCelulaNaSemana) continue
    }
    total++
    const st = statusDaLinha(ini, semanasFiltro)
    if (st === 'feita') feitas++
    else if (st === 'feita_atrasado') feitoAtr++
    else if (st === 'em_andamento') em++
    else if (st === 'atrasada') atr++
    else if (st === 'planejada') planejadas++
    else naoIniciadas++
  }
  const concluidasTotal = feitas + feitoAtr
  return { total, feitas, feitoAtr, em, atr, planejadas, naoIniciadas, pct: total ? Math.round(concluidasTotal / total * 100) : 0 }
}

function itensDeAtencao(iniciativas, semanaAtualIdx) {
  const atrasadas = []
  const estaSemana = []
  for (const ini of iniciativas) {
    // Incluir grupos que têm células próprias
    if (ini.eh_grupo && !(ini.pda_celulas || []).some(celulaAtiva)) continue
    if (statusDaLinha(ini) === 'atrasada') atrasadas.push(ini)
    const cel = (ini.pda_celulas || []).find(c => c.semana === semanaAtualIdx && celulaAtiva(c))
    if (cel && cel.status !== 'feito' && cel.status !== 'feito_atrasado') {
      estaSemana.push({ ini, cel })
    }
  }
  return { atrasadas, estaSemana }
}

function agruparIniciativas(iniciativas) {
  const grupos = new Map()
  const ordemRender = []

  for (const ini of iniciativas) {
    if (ini.eh_grupo) {
      grupos.set(ini.id, { grupo: ini, filhas: [] })
      ordemRender.push({ tipo: 'grupo', id: ini.id })
    }
  }

  for (const ini of iniciativas) {
    if (ini.eh_grupo) continue
    if (ini.grupo_id && grupos.has(ini.grupo_id)) {
      grupos.get(ini.grupo_id).filhas.push(ini)
    } else {
      ordemRender.push({ tipo: 'avulsa', iniciativa: ini })
    }
  }

  return ordemRender.map(item => {
    if (item.tipo === 'grupo') {
      const g = grupos.get(item.id)
      return { tipo: 'grupo', grupo: g.grupo, filhas: g.filhas }
    }
    return item
  })
}

function celulasAtivasDaIniciativa(ini) {
  return (ini.pda_celulas || []).filter(celulaAtiva)
}

function ultimoStatusAtivo(ini) {
  const celulas = celulasAtivasDaIniciativa(ini)
    .sort((a, b) => a.semana - b.semana)
  if (celulas.length === 0) return null
  return celulas[celulas.length - 1].status
}

function iniciativaConcluida(ini) {
  // Grupos sem células próprias: não são considerados "concluídos" isoladamente
  if (ini.eh_grupo) {
    const temCelulasProprias = (ini.pda_celulas || []).some(celulaAtiva)
    if (!temCelulasProprias) return false
  }
  const ultimoStatus = ultimoStatusAtivo(ini)
  return ultimoStatus === 'feito' || ultimoStatus === 'feito_atrasado'
}

function grupoConcluido(grupo, filhas) {
  if (!grupo?.eh_grupo) return false
  const grupoTemCelulas = (grupo.pda_celulas || []).some(celulaAtiva)
  const filhasConcluidas = filhas && filhas.length > 0 && filhas.every(iniciativaConcluida)
  
  // Grupo com filhas: concluído se todas filhas concluídas E grupo próprio concluído (se tiver células)
  if (filhas && filhas.length > 0) {
    if (!filhasConcluidas) return false
    if (grupoTemCelulas) return iniciativaConcluida(grupo)
    return true
  }
  
  // Grupo sem filhas: concluído se suas próprias células estão concluídas
  if (grupoTemCelulas) return iniciativaConcluida(grupo)
  
  return false
}

function separarPdaPorSituacao(iniciativas) {
  const estrutura = agruparIniciativas(iniciativas)
  const ativos = []
  const concluidos = []

  for (const item of estrutura) {
    if (item.tipo === 'grupo') {
      if (grupoConcluido(item.grupo, item.filhas)) {
        concluidos.push(item.grupo, ...item.filhas)
      } else {
        ativos.push(item.grupo, ...item.filhas)
      }
      continue
    }
    if (iniciativaConcluida(item.iniciativa)) concluidos.push(item.iniciativa)
    else ativos.push(item.iniciativa)
  }
  return { ativos, concluidos }
}

function contarProjetosEAvulsas(iniciativasFiltradas) {
  const estrutura = agruparIniciativas(iniciativasFiltradas)
  return estrutura.length
}

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3000) }
  return [t, show]
}

// ── COMPONENTE DE LINHA COM HOVER ──────────────────────────
function HoverRow({ children, style, ...props }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.15s',
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// ── CÉLULA DE STATUS NA MATRIZ (MELHORADA) ─────────────────
function StatusCelula({ celula, ehSemAtual, onClick }) {
  const [hovered, setHovered] = useState(false)
  const ativa = celulaAtiva(celula)
  const stInfo = STATUS_INFO[celula?.status || 'a_fazer']
  const Icon = stInfo.icon

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        background: ativa
          ? stInfo.bg
          : ehSemAtual
            ? 'rgba(249, 115, 22, 0.04)'
            : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      <div
        onClick={onClick}
        title={ativa ? `${stInfo.label} — clique para mudar` : 'Clique para definir status'}
        style={{
          width: '100%', minHeight: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          cursor: 'pointer', padding: '6px 4px',
          textAlign: 'center',
        }}
      >
        {ativa ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6,
            border: `1px solid ${stInfo.border}`,
            background: stInfo.bg,
          }}>
            <Icon size={11} color={stInfo.text} strokeWidth={2.5} />
            <span style={{ fontSize: 10, fontWeight: 700, color: stInfo.text, whiteSpace: 'nowrap' }}>
              {stInfo.curto}
            </span>
          </div>
        ) : hovered ? (
          <Plus size={14} color="var(--text-muted)" style={{ opacity: 0.3 }} />
        ) : null}
      </div>
    </div>
  )
}

// ── VISÃO GERAL ────────────────────────────────────────────
function PdaVisaoGeral({ stats }) {
  const concluidas = stats.feitas + stats.feitoAtr
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>
          Progresso geral
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)' }}>{stats.pct}%</span>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{concluidas} de {stats.total} iniciativas concluídas</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stats.pct}%`, background: 'var(--accent)', borderRadius: 5, transition: 'width .9s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>
          Por situação
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SituacaoCelula cor="var(--green)" n={concluidas} t="Concluídas" />
          <SituacaoCelula cor="#EAB308" n={stats.em} t="Em andamento" />
          <SituacaoCelula cor="#3B82F6" n={stats.planejadas} t="Planejadas" />
          <SituacaoCelula cor="var(--text-muted)" n={stats.naoIniciadas} t="Não iniciadas" />
          <SituacaoCelula cor="var(--red)" n={stats.atr} t="Atrasadas" />
        </div>
      </div>
    </div>
  )
}

function SituacaoCelula({ cor, n, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0 }} />
      <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t}</span>
    </div>
  )
}

// ── FAIXA "PRECISA DE ATENÇÃO" ─────────────────────────────
function PdaAtencao({ iniciativas, semanaAtualIdx, onVerDetalhes }) {
  const { atrasadas, estaSemana } = itensDeAtencao(iniciativas, semanaAtualIdx)
  if (atrasadas.length === 0 && estaSemana.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)', borderRadius: 10, padding: '12px 15px', marginBottom: 22, fontSize: 13, color: 'var(--text-muted)' }}>
        ✓ Nada atrasado e nenhuma ação aberta para esta semana.
      </div>
    )
  }
  const cards = []
  atrasadas.slice(0, 3).forEach(ini =>
    cards.push({ tom: 'red', tag: '● Atrasada', ini, nome: ini.titulo, meta: `👤 ${ini.responsavel || 'Sem dono'} ${ini.justificativa ? `| 🎯 ${ini.justificativa}` : ''}` }))
  estaSemana.slice(0, 3 - cards.length).forEach(({ ini, cel }) =>
    cards.push({ tom: 'orange', tag: '● Vence esta semana', ini, nome: ini.titulo, meta: `👤 ${ini.responsavel || 'Sem dono'} | 📝 ${cel.texto || 'Ação s/ descrição'}` }))

  const corDe = { red: 'var(--red)', orange: 'var(--accent)' }
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertCircle size={16} color="var(--red)" />
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Precisa de atenção</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, 1fr)`, gap: 12 }}>
        {cards.map((c, i) => (
          <div key={i}
               onClick={() => onVerDetalhes(c.ini)}
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${corDe[c.tom]}`, borderRadius: 10, padding: '13px 15px', cursor: 'pointer', transition: 'transform 0.1s' }}
               title="Clique para ver o Raio-X 5W2H">
            <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600, color: corDe[c.tom], marginBottom: 6 }}>{c.tag}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.meta}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MODAL DETALHES 5W2H ────────────────────────────────────
function ModalDetalhes5W2H({ iniciativa, onClose }) {
  if (!iniciativa) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, padding: 22 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <h2 className="modal-title" style={{ fontSize: 16, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={18} /> Raio-X da Iniciativa (5W2H)
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>O que fazer (What)</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{iniciativa.titulo}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quem (Who)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text)' }}>👤 {iniciativa.responsavel || 'Não atribuído'}</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Por que (Why)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text)' }}>🎯 {iniciativa.justificativa || 'Não preenchido'}</p>
            </div>
          </div>
          <div>
            <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Como fazer (How) — Roteiro de Etapas</strong>
            <p style={{
              margin: '6px 0 0 0', fontSize: 13, whiteSpace: 'pre-line',
              background: 'var(--surface-2)', padding: 12, borderRadius: 8,
              border: '1px solid var(--border)', color: 'var(--text)', lineHeight: 1.4
            }}>
              {iniciativa.como_fazer || 'Nenhum passo a passo detalhado cadastrado.'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Onde (Where)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Plataforma Órbita MKT</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quando / Prazo Final (When)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                📅 {iniciativa.prazo_final
                  ? new Date(iniciativa.prazo_final).toLocaleDateString('pt-BR', {timeZone: 'UTC'})
                  : 'Sem prazo macro definido'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MODAL NOVA INICIATIVA ──────────────────────────────────
function ModalNovaIniciativa({ area, grupos, preset, onSave, onClose }) {
  const [titulo, setTitulo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [comoFazer, setComoFazer] = useState('')
  const [prazoFinal, setPrazoFinal] = useState('')
  const [tipo, setTipo] = useState(preset?.tipo || 'avulsa')
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
        justificativa: justificativa.trim() || null,
        como_fazer: comoFazer.trim() || null,
        prazo_final: prazoFinal || null,
        eh_grupo: tipo === 'grupo',
        grupo_id: tipo === 'em_grupo' ? grupoId : null,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nova iniciativa — {AREAS.find(a => a.value === area)?.label}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'avulsa', label: 'Iniciativa avulsa' },
                { key: 'grupo', label: 'Novo grupo' },
                { key: 'em_grupo', label: 'Dentro de grupo', disabled: !grupos || grupos.length === 0 },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={() => setTipo(opt.key)} disabled={opt.disabled}
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${tipo === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                    background: tipo === opt.key ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                    color: tipo === opt.key ? 'var(--accent)' : 'var(--text)',
                    borderRadius: 6, cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    opacity: opt.disabled ? 0.4 : 1,
                  }}>{opt.label}</button>
              ))}
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
            <label className="form-label">Título da Iniciativa (What) *</label>
            <input className="form-input" autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          {tipo !== 'grupo' && (
            <>
              <div className="form-group">
                <label className="form-label">Responsável (Who)</label>
                <input className="form-input" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Ex: Vanessa, João..." />
              </div>
              <div className="form-group">
                <label className="form-label">Justificativa / Objetivo (Why)</label>
                <input className="form-input" value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Por que fazer isso agora?" />
              </div>
              <div className="form-group">
                <label className="form-label">Como fazer (How) — Principais Passos</label>
                <textarea className="form-input" rows={2} value={comoFazer} onChange={e => setComoFazer(e.target.value)}
                          placeholder="Ex: 1. Alinhamento; 2. Desenvolvimento" style={{ resize: 'vertical', minHeight: 50, padding: 8 }} />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Prazo Final de Conclusão (When)</label>
                <input type="date" className="form-input" value={prazoFinal} onChange={e => setPrazoFinal(e.target.value)} style={{ colorScheme: 'dark' }} />
              </div>
            </>
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
            <input className="form-input" autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: 2S2026" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Início *</label>
              <input className="form-input" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fim *</label>
              <input className="form-input" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
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

// ── LARGURAS DAS COLUNAS ───────────────────────────────────
// Melhoria: coluna de nomes mais larga para evitar quebra excessiva
const NOME_COL_MATRIZ = 320
const NOME_COL_GANTT = 300

// ── VISÃO 1 — MATRIZ MENSAL (MELHORADA)
function VisaoMatriz({
  iniciativas, mesIdx, setMesIdx, semanaAtualIdx,
  editandoCelula, setEditandoCelula,
  editandoTitulo, setEditandoTitulo,
  onSalvarTitulo, onSalvarCelula, onDeletarIniciativa, onNovaIniciativa, onReordenarGrupos, onVerDetalhes, area,
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
    e.dataTransfer.setData('text/plain', grupoId)
  }

  function handleDragOver(e, grupoId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (grupoId !== draggingId) setDragOverId(grupoId)
  }

  function handleDrop(e, alvoId) {
    e.preventDefault()
    if (!draggingId || draggingId === alvoId) {
      setDraggingId(null); setDragOverId(null); return
    }
    onReordenarGrupos(draggingId, alvoId)
    setDraggingId(null); setDragOverId(null)
  }

  const estrutura = useMemo(() => agruparIniciativas(iniciativas), [iniciativas])

  function getCelula(ini, semana) {
    return (ini.pda_celulas || []).find(c => c.semana === semana)
  }

  // ── Contagem de células ativas por linha (para mostrar no lugar de "0 sub-ações")
  function celulasAtivasCount(ini) {
    return (ini.pda_celulas || []).filter(celulaAtiva).length
  }

  function renderLinhaIniciativa(ini, ehFilha = false) {
    const numCelulasAtivas = celulasAtivasCount(ini)
    const stLinha = statusDaLinha(ini)
    const corLinha = stLinha !== 'nao_iniciada' ? STATUS_INFO[stLinha === 'feita' ? 'feito' : stLinha === 'feita_atrasado' ? 'feito_atrasado' : stLinha === 'atrasada' ? 'atrasado' : stLinha === 'em_andamento' ? 'em_andamento' : stLinha === 'planejada' ? 'planejada' : 'a_fazer'] : null

    return (
      <HoverRow key={ini.id} style={{
        display: 'grid',
        gridTemplateColumns: `${NOME_COL_MATRIZ}px repeat(${semanasDoMes.length}, 1fr)`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        minHeight: 48,
      }}>
        {/* TÍTULO */}
        <div style={{
          padding: '8px 14px',
          paddingLeft: ehFilha ? 36 : 14,
          display: 'flex', alignItems: 'center', gap: 8,
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Indicador lateral de status da linha */}
          {corLinha && (
            <span style={{
              width: 3, alignSelf: 'stretch', borderRadius: 2,
              background: corLinha.border, flexShrink: 0, opacity: 0.6,
            }} />
          )}

          {editandoTitulo?.id === ini.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, background: 'var(--surface-2)', padding: '6px', borderRadius: '6px', border: '1px solid var(--accent)' }}>
              <input
                autoFocus
                value={editandoTitulo.titulo}
                onChange={e => setEditandoTitulo(p => ({ ...p, titulo: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
                placeholder="Título (What)"
                style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', outline: 'none', color: 'var(--text)', padding: '4px 6px', borderRadius: '4px' }}
              />
              <input
                value={editandoTitulo.responsavel || ''}
                onChange={e => setEditandoTitulo(p => ({ ...p, responsavel: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
                placeholder="Responsável (Who)"
                style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', outline: 'none', color: 'var(--text)', padding: '4px 6px', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between', marginTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Prazo:</span>
                  <input
                    type="date"
                    value={editandoTitulo.prazo_final ? editandoTitulo.prazo_final.split('T')[0] : ''}
                    onChange={e => setEditandoTitulo(p => ({ ...p, prazo_final: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') onSalvarTitulo(); if (e.key === 'Escape') setEditandoTitulo(null) }}
                    style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', outline: 'none', colorScheme: 'dark', padding: '2px 4px', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditandoTitulo(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }} title="Cancelar">
                    <X size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSalvarTitulo(); }} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', padding: 2 }} title="Salvar">
                    <Check size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', gap: 6 }}>
              <div
                onClick={() => setEditandoTitulo({ id: ini.id, titulo: ini.titulo, responsavel: ini.responsavel || '', justificativa: ini.justificativa || '', como_fazer: ini.como_fazer || '', prazo_final: ini.prazo_final || '' })}
                style={{ flex: 1, cursor: 'text', overflow: 'hidden' }}
                title={`${ini.titulo}\nClique para editar`}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ini.titulo}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                  {ini.responsavel && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      👤 {ini.responsavel}
                    </span>
                  )}
                  {ini.prazo_final && (
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      📅 {new Date(ini.prazo_final).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                    </span>
                  )}
                  {numCelulasAtivas === 0 && !ini.responsavel && !ini.prazo_final && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, fontStyle: 'italic' }}>
                      Sem atividade
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => onVerDetalhes(ini)}
                  title="Ver Raio-X 5W2H"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, display: 'flex', opacity: 0.6 }}>
                  <Info size={14} />
                </button>
                <button onClick={() => { if (window.confirm(`Excluir a iniciativa "${ini.titulo}"?\n\nEsta ação não pode ser desfeita.`)) onDeletarIniciativa(ini.id) }}
                  title="Excluir iniciativa"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, display: 'flex', opacity: 0.4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CÉLULAS DA MATRIZ — componente melhorado com badges */}
        {semanasDoMes.map(semana => {
          const celula = getCelula(ini, semana)
          return (
            <StatusCelula
              key={semana}
              celula={celula}
              ehSemAtual={semana === semanaAtualIdx}
              onClick={async () => {
                await onSalvarCelula(ini.id, semana, null, proximoStatus(celula?.status))
              }}
            />
          )
        })}
      </HoverRow>
    )
  }

  function renderCabecalhoGrupo(grupo, filhas) {
    const colapsado = gruposColapsados.has(grupo.id)
    const stats = calcularStatsPorLinha(filhas)
    const corBarra = stats.atr > 0 ? 'var(--red)' : (stats.pct === 100 && stats.total > 0 ? 'var(--green)' : 'var(--accent)')
    const temFilhas = filhas.length > 0

    return (
      <div key={grupo.id}
        draggable
        onDragStart={e => handleDragStart(e, grupo.id)}
        onDragOver={e => handleDragOver(e, grupo.id)}
        onDrop={e => handleDrop(e, grupo.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: `${NOME_COL_MATRIZ}px repeat(${semanasDoMes.length}, 1fr)`,
          background: draggingId === grupo.id ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.05)',
          borderTop: dragOverId === grupo.id ? '2px solid var(--accent)' : '1px solid rgba(249, 115, 22, 0.3)',
          borderBottom: '1px solid var(--border)',
          opacity: draggingId === grupo.id ? 0.5 : 1,
          transition: 'background 0.15s',
        }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', opacity: 0.4 }}>
            <GripVertical size={14} />
          </div>
          {temFilhas && (
            <button onClick={() => toggleGrupo(grupo.id)}
              style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--accent)' }}>
              {colapsado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
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
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                onClick={() => setEditandoTitulo({ id: grupo.id, titulo: grupo.titulo, responsavel: '' })}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'text', lineHeight: 1.25, textTransform: 'uppercase', letterSpacing: 0.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {grupo.titulo}
              </div>
              {/* Resumo compacto das filhas, se houver */}
              {temFilhas && stats.total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{filhas.length} sub</span>
                  <span style={{ color: 'var(--green)' }}>✓{stats.feitas}</span>
                  {stats.atr > 0 && <span style={{ color: 'var(--red)' }}>!{stats.atr}</span>}
                  <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stats.pct}%`, background: corBarra }} />
                  </div>
                  <span style={{ fontWeight: 700 }}>{stats.pct}%</span>
                </div>
              )}
            </div>
          )}
          <button onClick={() => onNovaIniciativa({ tipo: 'em_grupo', grupoId: grupo.id })}
            title={`Adicionar iniciativa a "${grupo.titulo}"`}
            style={{ background: 'none', color: 'var(--accent)', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', opacity: 0.6, flexShrink: 0 }}>
            <Plus size={14} />
          </button>
          <button onClick={() => { if (window.confirm(`Excluir o grupo "${grupo.titulo}"?\n\nAs iniciativas dentro dele NÃO serão apagadas — apenas sairão do grupo e voltarão a ser avulsas.`)) onDeletarIniciativa(grupo.id) }}
            title="Excluir grupo"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0.4, flexShrink: 0 }}>
            <Trash2 size={12} />
          </button>
        </div>

        {/* CÉLULAS DE STATUS DO GRUPO — mesma mecânica das iniciativas */}
        {semanasDoMes.map(semana => {
          const celula = getCelula(grupo, semana)
          return (
            <StatusCelula
              key={semana}
              celula={celula}
              ehSemAtual={semana === semanaAtualIdx}
              onClick={async () => {
                await onSalvarCelula(grupo.id, semana, null, proximoStatus(celula?.status))
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {/* NAVEGAÇÃO DE MÊS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMesIdx(Math.max(0, mesIdx - 1))} disabled={mesIdx === 0}>
          <ChevronLeft size={14} />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {MESES.map((m, i) => (
            <button key={m.sigla} onClick={() => setMesIdx(i)}
              style={{
                background: i === mesIdx ? 'var(--accent)' : 'transparent',
                color: i === mesIdx ? 'white' : 'var(--text)',
                border: '1px solid ' + (i === mesIdx ? 'var(--accent)' : 'var(--border)'),
                padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {m.sigla}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setMesIdx(Math.min(MESES.length - 1, mesIdx + 1))} disabled={mesIdx === MESES.length - 1}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* MATRIZ */}
      {iniciativas.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px dashed var(--border)' }}>
          <Target size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>Nenhuma iniciativa cadastrada.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.6 }}>Crie uma iniciativa avulsa ou um grupo para começar.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          {/* CABEÇALHO STICKY */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${NOME_COL_MATRIZ}px repeat(${semanasDoMes.length}, 1fr)`,
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}>
            <div style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Iniciativa (What)
            </div>
            {semanasDoMes.map(s => {
              const ehAtual = s === semanaAtualIdx
              return (
                <div key={s} style={{
                  padding: '10px 4px', textAlign: 'center', fontSize: 11,
                  fontWeight: ehAtual ? 700 : 500,
                  color: ehAtual ? 'var(--accent)' : 'var(--text-muted)',
                  borderLeft: '1px solid rgba(255,255,255,0.04)',
                  background: ehAtual ? 'rgba(249, 115, 22, 0.06)' : 'transparent',
                }}>
                  <div>{SEMANA_LABELS[s - 1]}</div>
                  {ehAtual && <div style={{ fontSize: 9, marginTop: 2, textTransform: 'uppercase', opacity: 0.7, letterSpacing: 0.5 }}>· agora ·</div>}
                </div>
              )
            })}
          </div>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => onNovaIniciativa({ tipo: 'avulsa' })}><Plus size={12} /> Nova iniciativa avulsa</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onNovaIniciativa({ tipo: 'grupo' })} style={{ border: '1px dashed var(--accent)', color: 'var(--accent)' }}><Plus size={12} /> Novo grupo</button>
      </div>
    </div>
  )
}

// ── VISÃO 3 — LINHA DO TEMPO (GANTT) — MELHORADA
function VisaoGantt({ iniciativas, semanaAtualIdx, onVerDetalhes }) {
  const estrutura = useMemo(() => agruparIniciativas(iniciativas), [iniciativas])
  const corDe = {
    feita: 'var(--green)',
    feita_atrasado: '#EF9F27',
    atrasada: 'var(--red)',
    em_andamento: '#EAB308',
    planejada: '#3B82F6',
    nao_iniciada: 'var(--text-muted)',
  }

  function semanaParaPct(semana, edge) {
    let mi = MESES.findIndex(m => m.semanas.includes(semana))
    if (mi < 0) mi = 0
    const m = MESES[mi]
    const idx = m.semanas.indexOf(semana)
    const dentroDoMes = (idx + edge) / m.semanas.length
    return ((mi + dentroDoMes) / MESES.length) * 100
  }

  const hojePct = semanaParaPct(semanaAtualIdx, 0.5)

  function intervalo(ini) {
    const ws = (ini.pda_celulas || []).filter(c => celulaAtiva(c)).map(c => c.semana)
    if (!ws.length) return null
    return { ini: Math.min(...ws), fim: Math.max(...ws) }
  }

  function Faixas() {
    return (
      <>
        {MESES.map((m, i) => (
          <div key={m.sigla} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / MESES.length) * 100}%`, width: `${(1 / MESES.length) * 100}%`, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} />
        ))}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 2, marginLeft: -1, background: 'var(--accent)', opacity: 0.5, zIndex: 2 }} />
      </>
    )
  }

  function Linha({ ini, ehFilha }) {
    const [hovered, setHovered] = useState(false)
    const iv = intervalo(ini)
    const stLinha = statusDaLinha(ini)
    const cor = corDe[stLinha] || 'var(--text-muted)'
    const left = iv ? semanaParaPct(iv.ini, 0) : 0
    const width = iv ? semanaParaPct(iv.fim, 1) - left : 0

    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          minHeight: 42,
          background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
          transition: 'background 0.15s',
        }}>
        <div style={{
          width: NOME_COL_GANTT, flexShrink: 0,
          padding: ehFilha ? '8px 12px 8px 32px' : '8px 14px',
          borderRight: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{
              fontSize: 12, color: 'var(--text)', fontWeight: 500,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              lineHeight: 1.3,
            }} title={ini.titulo}>
              {ini.titulo}
            </span>
            {ini.responsavel && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>👤 {ini.responsavel}</div>
            )}
          </div>
          <button onClick={() => onVerDetalhes(ini)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: hovered ? 0.8 : 0.4, display: 'flex', flexShrink: 0, padding: 2, transition: 'opacity 0.15s' }} title="Ver Raio-X 5W2H">
            <Info size={13} />
          </button>
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          <Faixas />
          {iv ? (
            <div
              onClick={() => onVerDetalhes(ini)}
              title={`${ini.titulo} · semanas ${iv.ini} a ${iv.fim}`}
              style={{
                position: 'absolute', top: 8, height: 24,
                left: `${left}%`, width: `${width}%`, minWidth: 8,
                background: cor, opacity: hovered ? 1 : 0.8,
                borderRadius: 6, cursor: 'pointer',
                transition: 'opacity 0.15s, box-shadow 0.15s',
                boxShadow: hovered ? `0 0 8px ${cor}44` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
              {/* Label dentro da barra se houver espaço */}
              {width > 6 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.6)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  padding: '0 6px',
                }}>
                  {stLinha === 'feita' ? '✓' : stLinha === 'feita_atrasado' ? '⚑' : ''}
                </span>
              )}
            </div>
          ) : (
            /* Placeholder tracejado para iniciativas sem células */
            <div style={{
              position: 'absolute', top: 12, left: '2%', right: '2%', height: 16,
              border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.4 }}>
                sem período definido
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        {/* CABEÇALHO */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: NOME_COL_GANTT, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Iniciativa
          </div>
          <div style={{ flex: 1, display: 'flex' }}>
            {MESES.map((m, i) => {
              const mesTemSemAtual = m.semanas.includes(semanaAtualIdx)
              return (
                <div key={m.sigla} style={{
                  flex: 1, padding: '10px 0', textAlign: 'center',
                  fontSize: 11, fontWeight: mesTemSemAtual ? 700 : 600,
                  color: mesTemSemAtual ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  {m.sigla}
                </div>
              )
            })}
          </div>
        </div>

        {/* LINHAS */}
        {iniciativas.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Target size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Nenhuma iniciativa cadastrada.</p>
          </div>
        ) : (
          estrutura.map(item => {
            if (item.tipo === 'grupo') {
              const grupoTemCelulas = (item.grupo.pda_celulas || []).some(celulaAtiva)
              const iv = grupoTemCelulas ? (() => {
                const ws = (item.grupo.pda_celulas || []).filter(c => celulaAtiva(c)).map(c => c.semana)
                return ws.length ? { ini: Math.min(...ws), fim: Math.max(...ws) } : null
              })() : null
              const stGrupo = statusDaLinha(item.grupo)
              const corGrupo = corDe[stGrupo] || 'var(--text-muted)'

              return (
                <div key={item.grupo.id}>
                  <div style={{ display: 'flex', background: 'rgba(249, 115, 22, 0.05)', borderTop: '1px solid rgba(249, 115, 22, 0.3)', borderBottom: '1px solid var(--border)', minHeight: 42 }}>
                    <div style={{
                      width: NOME_COL_GANTT, flexShrink: 0,
                      padding: '10px 14px',
                      borderRight: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--text)',
                        textTransform: 'uppercase', letterSpacing: 0.3,
                        lineHeight: 1.25, flex: 1,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {item.grupo.titulo}
                      </span>
                      {item.filhas.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {item.filhas.length}
                        </span>
                      )}
                      <button onClick={() => onVerDetalhes(item.grupo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: 0.5, display: 'flex', flexShrink: 0, padding: 0 }} title="Ver detalhes">
                        <Info size={12} />
                      </button>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Faixas />
                      {iv ? (
                        <div
                          onClick={() => onVerDetalhes(item.grupo)}
                          title={`${item.grupo.titulo} · semanas ${iv.ini} a ${iv.fim}`}
                          style={{
                            position: 'absolute', top: 8, height: 24,
                            left: `${semanaParaPct(iv.ini, 0)}%`,
                            width: `${semanaParaPct(iv.fim, 1) - semanaParaPct(iv.ini, 0)}%`,
                            minWidth: 8, background: corGrupo, opacity: 0.8,
                            borderRadius: 6, cursor: 'pointer',
                            border: '1px solid rgba(249, 115, 22, 0.4)',
                          }}
                        />
                      ) : !grupoTemCelulas && (
                        <div style={{
                          position: 'absolute', top: 12, left: '2%', right: '2%', height: 16,
                          border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.4 }}>
                            sem período definido
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {item.filhas.map(filha => <Linha key={filha.id} ini={filha} ehFilha={true} />)}
                </div>
              )
            }
            return <Linha key={item.iniciativa.id} ini={item.iniciativa} ehFilha={false} />
          })
        )}
      </div>

      {/* LEGENDA */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { cor: 'var(--green)', label: 'Concluída' },
          { cor: '#EF9F27', label: 'Fora do prazo' },
          { cor: '#EAB308', label: 'Em andamento' },
          { cor: '#3B82F6', label: 'Planejada' },
          { cor: 'var(--red)', label: 'Atrasada' },
        ].map(item => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 10, borderRadius: 3, background: item.cor }} />
            {item.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', opacity: 0.6 }}>
          Clique na barra para ver detalhes
        </span>
      </div>
    </div>
  )
}

// ── VISÃO 2 — STATUS REPORT SEMANAL
function VisaoStatusReport({ iniciativas, semanaSel, setSemanaSel, semanaAtualIdx, editandoCelula, setEditandoCelula, onSalvarCelula }) {
  const iniciativasDaSemana = iniciativas
    .map(ini => ({ ini, celula: (ini.pda_celulas || []).find(c => c.semana === semanaSel) }))
    .filter(x => celulaAtiva(x.celula))

  const ordemStatus = ['feito', 'feito_atrasado', 'em_andamento', 'planejada', 'atrasado', 'a_fazer']
  const agrupado = ordemStatus.map(st => ({
    status: st,
    info: STATUS_INFO[st],
    items: iniciativasDaSemana.filter(x => (x.celula.status || 'a_fazer') === st),
  })).filter(g => g.items.length > 0)

  return (
    <div className="pda-status-report">
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" disabled={semanaSel === 1} onClick={() => setSemanaSel(s => Math.max(1, s - 1))}><ChevronLeft size={14} /> Anterior</button>
        <select className="form-select" style={{ width: 'auto', fontSize: 12 }} value={semanaSel} onChange={e => setSemanaSel(parseInt(e.target.value))}>
          {SEMANA_LABELS.map((label, i) => (
            <option key={i+1} value={i+1}>Sem {i+1} · {label} {i+1 === semanaAtualIdx ? '(atual)' : ''}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" disabled={semanaSel === SEMANA_LABELS.length} onClick={() => setSemanaSel(s => Math.min(SEMANA_LABELS.length, s + 1))}>Próxima <ChevronRight size={14} /></button>
      </div>

      {agrupado.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px dashed var(--border)' }}>
          <FileText size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>Nenhuma atividade nesta semana.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.6 }}>
            Defina status nas células da Matriz mensal para ver o report.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agrupado.map(g => (
            <div key={g.status}>
              <h3 style={{ fontSize: 12, color: g.info.border, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5, fontWeight: 700 }}>{g.info.label}</h3>
              {g.items.map(({ ini, celula }) => (
                <div key={ini.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${g.info.border}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ini.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    👤 {ini.responsavel || 'Sem responsável'} | Situação: <span style={{ color: g.info.text, fontWeight: 600 }}>{celula.texto || g.info.label}</span>
                    {ini.prazo_final && ` | 📅 Prazo: ${new Date(ini.prazo_final).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
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
  const [modalNovo, setModalNovo] = useState(null)
  const [modalSemestre, setModalSemestre] = useState(false)
  const [detalhe5W2H, setDetalhe5W2H] = useState(null)
  const [editandoCelula, setEditandoCelula] = useState(null)
  const [editandoTitulo, setEditandoTitulo] = useState(null)
  const [visao, setVisao] = useState('matriz')
  const [pdaSituacao, setPdaSituacao] = useState('ativos')
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
      } catch (e) { console.error(e); setLoading(false) }
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
    const { id, titulo, responsavel, justificativa, como_fazer, prazo_final } = editandoTitulo
    const t = titulo.trim()
    if (!t) { setEditandoTitulo(null); return }

    try {
      const upd = await atualizarIniciativa(id, {
        titulo: t,
        responsavel: responsavel?.trim() || null,
        justificativa: justificativa?.trim() || null,
        como_fazer: como_fazer?.trim() || null,
        prazo_final: prazo_final || null
      })
      setIniciativas(prev => prev.map(i => i.id === id ? { ...i, ...upd } : i))
      showToast('Iniciativa atualizada!')
    } catch(e) {
      console.error(e)
      showToast('Erro ao atualizar.', 'error')
    } finally {
      setEditandoTitulo(null)
    }
  }

  async function handleReordenarGrupos(idArrastado, idAlvo) {
    const estrutura = agruparIniciativas(iniciativas)
    const idxArr = estrutura.findIndex(it => it.tipo === 'grupo' && it.grupo.id === idArrastado)
    const idxAlvo = estrutura.findIndex(it => it.tipo === 'grupo' && it.grupo.id === idAlvo)
    if (idxArr === -1 || idxAlvo === -1) return

    const novaEstrutura = [...estrutura]
    const [movido] = novaEstrutura.splice(idxArr, 1)
    novaEstrutura.splice(idxAlvo, 0, movido)

    const updates = []
    let ordem = 1
    for (const item of novaEstrutura) {
      if (item.tipo === 'grupo') {
        updates.push({ id: item.grupo.id, ordem })
        ordem++
        for (const f of item.filhas) { updates.push({ id: f.id, ordem }); ordem++ }
      } else { updates.push({ id: item.iniciativa.id, ordem }); ordem++ }
    }

    const mapOrdem = new Map(updates.map(u => [u.id, u.ordem]))
    setIniciativas(prev => prev
      .map(i => mapOrdem.has(i.id) ? { ...i, ordem: mapOrdem.get(i.id) } : i)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    )

    try { await Promise.all(updates.map(u => atualizarIniciativa(u.id, { ordem: u.ordem }))) }
    catch (e) { console.error(e) }
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
      return { ...i, pda_celulas: r ? [...semCelula, r] : semCelula }
    }))
  }

  const pdaPorSituacao = useMemo(() => separarPdaPorSituacao(iniciativas), [iniciativas])
  const iniciativasVisiveis = pdaSituacao === 'concluidos' ? pdaPorSituacao.concluidos : pdaPorSituacao.ativos
  const statsGeraisPorLinha = useMemo(() => calcularStatsPorLinha(iniciativasVisiveis), [iniciativasVisiveis])
  const totalAtivos = useMemo(() => contarProjetosEAvulsas(pdaPorSituacao.ativos), [pdaPorSituacao])
  const totalConcluidos = useMemo(() => contarProjetosEAvulsas(pdaPorSituacao.concluidos), [pdaPorSituacao])

  if (semestres.length === 0 && !loading) {
    return (
      <div style={{ padding: 32 }}>
        <button className="btn btn-primary" onClick={() => setModalSemestre(true)}>Criar primeiro semestre</button>
        {modalSemestre && <ModalNovoSemestre onSave={handleCriarSemestre} onClose={() => setModalSemestre(false)} />}
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>PDA — Plano de Ação</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {pdaSituacao === 'ativos' ? 'PDA ativos' : 'PDA concluídos'} · {statsGeraisPorLinha.feitas + statsGeraisPorLinha.feitoAtr}/{statsGeraisPorLinha.total} iniciativas concluídas ({statsGeraisPorLinha.pct}%)
            </p>
          </div>
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={semestreId || ''} onChange={e => setSemestreId(e.target.value)}>
          {semestres.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      {/* DASHBOARDS */}
      {!loading && iniciativasVisiveis.length > 0 && (
        <div className="no-print">
          <PdaVisaoGeral stats={statsGeraisPorLinha} />
          {pdaSituacao === 'ativos' && (
            <PdaAtencao iniciativas={iniciativasVisiveis} semanaAtualIdx={semanaAtualIdx} onVerDetalhes={(ini) => setDetalhe5W2H(ini)} />
          )}
        </div>
      )}

      {/* FILTRO ATIVOS / CONCLUÍDOS */}
      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--surface-2)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        <button
          onClick={() => setPdaSituacao('ativos')}
          style={{
            background: pdaSituacao === 'ativos' ? 'var(--accent)' : 'transparent',
            color: pdaSituacao === 'ativos' ? 'white' : 'var(--text)',
            border: 'none', padding: '8px 14px', borderRadius: 7,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
          PDA ativos ({totalAtivos})
        </button>
        <button
          onClick={() => setPdaSituacao('concluidos')}
          style={{
            background: pdaSituacao === 'concluidos' ? 'var(--green)' : 'transparent',
            color: pdaSituacao === 'concluidos' ? 'white' : 'var(--text)',
            border: 'none', padding: '8px 14px', borderRadius: 7,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
          PDA concluídos ({totalConcluidos})
        </button>
      </div>

      {/* VIEWS TOGGLE */}
      <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {[
          { key: 'matriz', icon: Grid3x3, label: 'Matriz mensal' },
          { key: 'gantt', icon: ChevronRight, label: 'Linha do tempo' },
          { key: 'status', icon: FileText, label: 'Status report' },
        ].map(v => {
          const Icon = v.icon
          const ativo = visao === v.key
          return (
            <button key={v.key} onClick={() => setVisao(v.key)} style={{
              background: ativo ? 'var(--surface)' : 'transparent',
              color: ativo ? 'var(--text)' : 'var(--text-muted)',
              border: 'none', padding: '8px 14px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {v.label}
            </button>
          )
        })}
      </div>

      {/* FILTROS DE ÁREA */}
      <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {AREAS.map(a => (
          <button key={a.value} onClick={() => setArea(a.value)} style={{
            background: area === a.value ? 'var(--accent)' : 'transparent',
            color: area === a.value ? 'white' : 'var(--text)',
            border: 'none', padding: '8px 16px',
            borderRadius: '8px 8px 0 0',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
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
          iniciativas={iniciativasVisiveis} mesIdx={mesIdx} setMesIdx={setMesIdx} semanaAtualIdx={semanaAtualIdx}
          editandoCelula={editandoCelula} setEditandoCelula={setEditandoCelula}
          editandoTitulo={editandoTitulo} setEditandoTitulo={setEditandoTitulo}
          onSalvarTitulo={handleSalvarTitulo} onSalvarCelula={handleSalvarCelula}
          onDeletarIniciativa={handleDeletarIniciativa} onReordenarGrupos={handleReordenarGrupos}
          onNovaIniciativa={(preset) => setModalNovo(preset || { tipo: 'avulsa' })}
          onVerDetalhes={(ini) => setDetalhe5W2H(ini)} area={area}
        />
      ) : visao === 'gantt' ? (
        <VisaoGantt
          iniciativas={iniciativasVisiveis} semanaAtualIdx={semanaAtualIdx}
          onVerDetalhes={(ini) => setDetalhe5W2H(ini)}
        />
      ) : (
        <VisaoStatusReport
          iniciativas={iniciativasVisiveis} semanaSel={semanaSel} setSemanaSel={setSemanaSel} semanaAtualIdx={semanaAtualIdx}
          editandoCelula={editandoCelula} setEditandoCelula={setEditandoCelula} onSalvarCelula={handleSalvarCelula}
        />
      )}

      {/* MODAIS */}
      {modalNovo && <ModalNovaIniciativa area={area} grupos={iniciativas.filter(i => i.eh_grupo)} preset={modalNovo} onSave={handleCriarIniciativa} onClose={() => setModalNovo(null)} />}
      {modalSemestre && <ModalNovoSemestre onSave={handleCriarSemestre} onClose={() => setModalSemestre(false)} />}
      {detalhe5W2H && <ModalDetalhes5W2H iniciativa={detalhe5W2H} onClose={() => setDetalhe5W2H(null)} />}

      {toast && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
