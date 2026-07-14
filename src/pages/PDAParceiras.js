import { useEffect, useState, useMemo } from 'react'
import {
  getPilares, getIniciativas, criarIniciativa, atualizarIniciativa, deletarIniciativa,
  replanejarPrazo, getHistoricoPrazos, upsertSemana,
  criarSecao, atualizarSecao, deletarSecao, criarItem, atualizarItem, deletarItem,
} from '../lib/pda2-parceiras'
import {
  Target, Plus, Trash2, X, Check, Clock, AlertCircle, Square, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, Pencil, History, ListChecks,
  LayoutGrid, BarChart2, FileText, Download, Layers,
} from 'lucide-react'

// ── CONSTANTES ─────────────────────────────────────────────

const ANDAMENTOS = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido',    label: 'Concluído' },
]

const SITUACAO_INFO = {
  nao_iniciado: { label: 'Não iniciado', bg: 'var(--surface-2)',            text: 'var(--text-muted)', fill: 'var(--text-muted)' },
  em_andamento: { label: 'Em andamento', bg: 'rgba(74,93,83,0.15)',         text: '#5B8A8A',           fill: '#4A5D53' },
  concluido:    { label: 'Concluído',    bg: 'rgba(138,154,91,0.15)',       text: '#8FA05E',           fill: '#8A9A5B' },
  replanejado:  { label: 'Replanejado',  bg: 'rgba(217,164,65,0.15)',       text: '#D6A64B',           fill: '#D9A441' },
  atrasado:     { label: 'Atrasado',     bg: 'rgba(169,67,30,0.15)',        text: '#C17A3D',           fill: '#A9431E' },
}

const STATUS_SEMANA_INFO = {
  a_fazer:        { label: 'A fazer',      bg: 'transparent',               text: 'var(--text-muted)', border: 'var(--border)', icon: Square },
  planejada:      { label: 'Planejada',    bg: 'rgba(59,130,246,0.18)',     text: '#60A5FA',           border: '#3B82F6',       icon: Calendar },
  em_andamento:   { label: 'Em andamento', bg: 'rgba(234,179,8,0.18)',      text: '#FACC15',           border: '#EAB308',       icon: Clock },
  feito:          { label: 'Feito',        bg: 'rgba(34,197,94,0.18)',      text: '#4ADE80',           border: 'var(--green)',  icon: Check },
  feito_atrasado: { label: 'Fora do prazo', bg: 'rgba(34,197,94,0.18)',     text: '#4ADE80',           border: '#EF9F27',       icon: Check },
  atrasado:       { label: 'Atrasado',     bg: 'rgba(239,68,68,0.18)',      text: '#F87171',           border: 'var(--red)',    icon: AlertCircle },
}
const STATUS_SEMANA_CICLO = ['a_fazer', 'planejada', 'em_andamento', 'feito', 'feito_atrasado', 'atrasado']

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

function celulaAtiva(c) { return !!(c && c.status && c.status !== 'a_fazer') }

// ── HELPERS DE DATA/CÁLCULO ─────────────────────────────────
function fmtDataBR(iso) {
  if (!iso) return null
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
function hojeISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

// Situação calculada da iniciativa (nunca volta sozinha pra planejado/andamento
// depois de replanejada — só sai do "replanejado" se concluir ou atrasar de novo)
function situacaoIniciativa(ini) {
  if (ini.andamento === 'concluido') return 'concluido'
  const hoje = hojeISO()
  if (ini.prazo_final && hoje > ini.prazo_final) return 'atrasado'
  if (ini.foi_replanejada) return 'replanejado'
  if (ini.andamento === 'em_andamento') return 'em_andamento'
  return 'nao_iniciado'
}

// Progresso da barra: baseado no tempo decorrido dentro do período planejado
// (início → prazo). Concluído trava em 100%. Sem datas, não tem barra.
function progressoTemporal(ini) {
  if (ini.andamento === 'concluido') return 100
  if (!ini.data_inicio || !ini.prazo_final) return null
  const inicio = new Date(ini.data_inicio).getTime()
  const fim = new Date(ini.prazo_final).getTime()
  const hoje = Date.now()
  const total = fim - inicio
  if (total <= 0) return hoje >= fim ? 100 : 0
  const decorrido = Math.min(Math.max(hoje - inicio, 0), total)
  return Math.round((decorrido / total) * 100)
}

function progressoMeta(ini) {
  if (ini.meta_alvo == null || ini.meta_alvo === 0) return null
  return Math.min(100, Math.round(((ini.meta_atual || 0) / ini.meta_alvo) * 100))
}

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3500) }
  return [t, show]
}

function semestresDisponiveis() {
  const anoAtual = new Date().getFullYear()
  const lista = []
  for (const ano of [anoAtual - 1, anoAtual, anoAtual + 1]) {
    lista.push(`${ano}-S1`, `${ano}-S2`)
  }
  return lista
}

// ── CARD DE INICIATIVA ──────────────────────────────────────
function CardIniciativa({ ini, subIniciativas, onAbrir }) {
  const situacao = situacaoIniciativa(ini)
  const info = SITUACAO_INFO[situacao]
  const isComposta = ini.tipo === 'composta'

  let progresso = null
  let legendaProgresso = null

  if (isComposta) {
    const total = subIniciativas.length
    const concluidas = subIniciativas.filter(s => situacaoIniciativa(s) === 'concluido').length
    progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0
    legendaProgresso = `${concluidas} de ${total} concluídas`
  } else if (ini.meta_alvo != null) {
    progresso = progressoMeta(ini)
    legendaProgresso = `${ini.meta_atual || 0} de ${ini.meta_alvo}${ini.meta_unidade ? ' ' + ini.meta_unidade : ''}`
  } else {
    progresso = progressoTemporal(ini)
  }

  const dataTexto = ini.data_inicio && ini.prazo_final
    ? `${fmtDataBR(ini.data_inicio)} → ${fmtDataBR(ini.prazo_final)}`
    : ini.prazo_final ? `Prazo: ${fmtDataBR(ini.prazo_final)}`
    : ini.data_inicio ? `Início: ${fmtDataBR(ini.data_inicio)}`
    : null

  return (
    <div onClick={() => onAbrir(ini)}
      style={{ cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{ini.titulo}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: info.bg, color: info.text, whiteSpace: 'nowrap', flexShrink: 0 }}>{info.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
        {ini.responsavel && <span>{ini.responsavel}</span>}
        {isComposta && <span><Layers size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{subIniciativas.length} sub-planejamentos</span>}
      </div>
      {progresso != null && (
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progresso}%`, background: info.fill, transition: 'width 0.3s' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{dataTexto || 'Sem data definida'}</span>
        {legendaProgresso && <span>{legendaProgresso}</span>}
      </div>
    </div>
  )
}

// ── MODAL: NOVA INICIATIVA ─────────────────────────────────
function ModalNovaIniciativa2({ pilares, compostas, semestre, preset, onSave, onClose }) {
  const [pilarId, setPilarId] = useState(preset?.pilarId || pilares[0]?.id || '')
  const [tipo, setTipo] = useState(preset?.tipo || 'simples') // simples | composta | sub
  const [iniciativaPaiId, setIniciativaPaiId] = useState(preset?.paiId || '')
  const [titulo, setTitulo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [metaAlvo, setMetaAlvo] = useState('')
  const [metaUnidade, setMetaUnidade] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [prazoFinal, setPrazoFinal] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [comoFazer, setComoFazer] = useState('')
  const [saving, setSaving] = useState(false)
  const [criouAlgo, setCriouAlgo] = useState(false)

  function limparCampos() {
    setTitulo(''); setResponsavel(''); setMetaAlvo(''); setMetaUnidade('')
    setDataInicio(''); setPrazoFinal(''); setJustificativa(''); setComoFazer('')
  }

  async function save() {
    if (!titulo.trim() || !pilarId) return
    if (tipo === 'sub' && !iniciativaPaiId) return
    setSaving(true)
    try {
      const nova = await onSave({
        pilar_id: pilarId,
        iniciativa_pai_id: tipo === 'sub' ? iniciativaPaiId : null,
        semestre,
        titulo: titulo.trim(),
        tipo: tipo === 'composta' ? 'composta' : 'simples',
        responsavel: responsavel.trim() || null,
        prioridade: null,
        meta_alvo: metaAlvo !== '' ? Number(metaAlvo) : null,
        meta_atual: 0,
        meta_unidade: metaUnidade.trim() || null,
        data_inicio: dataInicio || null,
        prazo_final: prazoFinal || null,
        justificativa: justificativa.trim() || null,
        como_fazer: comoFazer.trim() || null,
      })
      setCriouAlgo(true)
      limparCampos()
      if (tipo === 'composta' && nova?.id) {
        setTipo('sub')
        setIniciativaPaiId(nova.id)
      }
    } finally { setSaving(false) }
  }

  const opcoesComposta = compostas.filter(c => c.pilar_id === pilarId)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Novo planejamento</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {criouAlgo && (
          <div style={{ fontSize: 12, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
            <Check size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Salvo! Pode continuar adicionando ou fechar quando terminar.
          </div>
        )}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Pilar *</label>
            <select className="form-select" value={pilarId} onChange={e => setPilarId(e.target.value)}>
              {pilares.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'simples', label: 'Simples' },
                { key: 'composta', label: 'Composta' },
                { key: 'sub', label: 'Dentro de uma composta', disabled: opcoesComposta.length === 0 },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={() => setTipo(opt.key)} disabled={opt.disabled}
                  style={{
                    flex: 1, padding: '8px 8px', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${tipo === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                    background: tipo === opt.key ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: tipo === opt.key ? 'var(--accent)' : 'var(--text)',
                    borderRadius: 6, cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.4 : 1,
                  }}>{opt.label}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              {tipo === 'sub'
                ? 'Cria um item completo, com responsável, meta e prazo próprios — pra algo simples de marcar como feito, use "Subtarefas" dentro do planejamento já existente.'
                : tipo === 'composta'
                ? 'Vira um planejamento "guarda-chuva", que pode ter sub-planejamentos dentro dele.'
                : ''}
            </p>
          </div>
          {tipo === 'sub' && (
            <div className="form-group">
              <label className="form-label">Composta *</label>
              <select className="form-select" value={iniciativaPaiId} onChange={e => setIniciativaPaiId(e.target.value)}>
                <option value="">Selecione...</option>
                {opcoesComposta.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          {tipo !== 'composta' && (
            <>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <input className="form-input" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Ex: Vanessa, Sarah..." />
              </div>
              <div className="form-group">
                <label className="form-label">Meta numérica (opcional)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min="0" className="form-input" style={{ width: 90 }} value={metaAlvo} onChange={e => setMetaAlvo(e.target.value)} placeholder="Ex: 10" />
                  <input className="form-input" style={{ flex: 1 }} value={metaUnidade} onChange={e => setMetaUnidade(e.target.value)} placeholder="Unidade (ex: editoras, eventos, livrarias)" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Data de início</label>
                  <input type="date" className="form-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} style={{ colorScheme: 'dark', cursor: 'pointer' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Prazo final</label>
                  <input type="date" className="form-input" value={prazoFinal} onChange={e => setPrazoFinal(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} style={{ colorScheme: 'dark', cursor: 'pointer' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Justificativa / objetivo</label>
                <input className="form-input" value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Por que fazer isso agora?" />
              </div>
              <div className="form-group">
                <label className="form-label">Como fazer</label>
                <textarea className="form-input" rows={2} value={comoFazer} onChange={e => setComoFazer(e.target.value)} style={{ resize: 'vertical', minHeight: 50, padding: 8 }} placeholder="Principais passos..." />
              </div>
            </>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>{criouAlgo ? 'Concluir' : 'Cancelar'}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !titulo.trim() || (tipo === 'sub' && !iniciativaPaiId)}>
            {saving ? 'Salvando...' : (tipo === 'composta' ? 'Criar composta' : 'Criar e adicionar outra')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CÉLULA DE STATUS SEMANAL (popover simples) ─────────────
function CelulaSemana({ celula, ehAtual, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const ativa = celulaAtiva(celula)
  const info = STATUS_SEMANA_INFO[celula?.status || 'a_fazer']
  const Icon = info.icon

  useEffect(() => { if (aberto) setTexto(celula?.texto || '') }, [aberto])

  const opcoes = [
    { key: 'planejada', ...STATUS_SEMANA_INFO.planejada },
    { key: 'em_andamento', ...STATUS_SEMANA_INFO.em_andamento },
    { key: 'feito', ...STATUS_SEMANA_INFO.feito },
    { key: 'feito_atrasado', ...STATUS_SEMANA_INFO.feito_atrasado },
    { key: 'atrasado', ...STATUS_SEMANA_INFO.atrasado },
  ]

  function escolher(status) { setAberto(false); onSave(status, texto.trim() || null) }
  function limpar() { setAberto(false); onSave('a_fazer', null) }

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setAberto(o => !o)} title={info.label}
        style={{
          minHeight: 44, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: ativa ? info.bg : (ehAtual ? 'rgba(249,115,22,0.05)' : 'transparent'),
          border: `1px solid ${ativa ? info.border : 'var(--border)'}`,
        }}>
        {ativa ? <Icon size={13} color={info.text} /> : <Plus size={12} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
      </div>
      {aberto && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 180,
        }}>
          {opcoes.map(op => {
            const Ic = op.icon
            return (
              <button key={op.key} onClick={() => escolher(op.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: op.text, fontSize: 12, width: '100%', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = op.bg} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Ic size={13} /> {op.label}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nota (opcional)..." rows={2}
            style={{ width: '100%', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', resize: 'vertical' }} />
          {ativa && (
            <button onClick={limpar} style={{ marginTop: 4, width: '100%', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 10px' }}>
              <X size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Limpar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── ABA: SEMANA A SEMANA ────────────────────────────────────
function AbaSemanaASemana({ iniciativa, onSalvarSemana }) {
  const semanaAtualIdx = useMemo(() => semanaAtual(), [])
  const [mesIdx, setMesIdx] = useState(mesDaSemana(semanaAtualIdx))
  const mes = MESES[mesIdx]
  const semanasPorId = useMemo(() => {
    const map = {}
    ;(iniciativa.pda2_parceiras_semanas || []).forEach(s => { map[s.semana] = s })
    return map
  }, [iniciativa])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMesIdx(m => Math.max(0, m - 1))} disabled={mesIdx === 0}><ChevronLeft size={13} /></button>
        <div style={{ display: 'flex', gap: 3 }}>
          {MESES.map((m, i) => (
            <button key={m.sigla} onClick={() => setMesIdx(i)}
              style={{ background: i === mesIdx ? 'var(--accent)' : 'transparent', color: i === mesIdx ? 'white' : 'var(--text)', border: `1px solid ${i === mesIdx ? 'var(--accent)' : 'var(--border)'}`, padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer' }}>
              {m.sigla}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setMesIdx(m => Math.min(MESES.length - 1, m + 1))} disabled={mesIdx === MESES.length - 1}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mes.semanas.length}, 1fr)`, gap: 6 }}>
        {mes.semanas.map(s => (
          <div key={s} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: s === semanaAtualIdx ? 'var(--accent)' : 'var(--text-muted)', fontWeight: s === semanaAtualIdx ? 700 : 400, marginBottom: 4 }}>{SEMANA_LABELS[s - 1]}</div>
            <CelulaSemana celula={semanasPorId[s]} ehAtual={s === semanaAtualIdx}
              onSave={(status, texto) => onSalvarSemana(s, status, texto)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ABA: SUBTAREFAS ──────────────────────────────────────────
function AbaSubtarefas({ iniciativa, onCriarSecao, onAtualizarSecao, onDeletarSecao, onCriarItem, onAtualizarItem, onToggleItem, onDeletarItem, onConverterEmSubPlanejamento }) {
  const [addingSecao, setAddingSecao] = useState(false)
  const [novaSecao, setNovaSecao] = useState('')
  const [addingItem, setAddingItem] = useState({})
  const [novoItem, setNovoItem] = useState({})
  const [editandoSecao, setEditandoSecao] = useState(null)
  const [editandoItem, setEditandoItem] = useState(null)

  const secoes = (iniciativa.pda2_parceiras_secoes || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0))

  function handleAddSecao() {
    if (!novaSecao.trim()) return
    onCriarSecao(iniciativa.id, novaSecao.trim(), secoes.length)
    setNovaSecao(''); setAddingSecao(false)
  }
  function handleAddItem(secaoId) {
    const texto = (novoItem[secaoId] || '').trim()
    if (!texto) return
    const secao = secoes.find(s => s.id === secaoId)
    onCriarItem(iniciativa.id, secaoId, texto, (secao?.pda2_parceiras_itens || []).length)
    setNovoItem(p => ({ ...p, [secaoId]: '' })); setAddingItem(p => ({ ...p, [secaoId]: false }))
  }
  function salvarEdicaoSecao() {
    if (!editandoSecao) return
    const t = editandoSecao.titulo.trim()
    if (t) onAtualizarSecao(editandoSecao.id, t, iniciativa.id)
    setEditandoSecao(null)
  }
  function salvarEdicaoItem() {
    if (!editandoItem) return
    const t = editandoItem.texto.trim()
    if (t) onAtualizarItem(editandoItem.id, t, editandoItem.secaoId, iniciativa.id)
    setEditandoItem(null)
  }

  return (
    <div>
      {secoes.length === 0 && !addingSecao && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 12px' }}>Nenhuma seção de subtarefas ainda.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '40vh', overflowY: 'auto', paddingRight: 4 }}>
        {secoes.map(sec => {
          const itens = (sec.pda2_parceiras_itens || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
          const concluidos = itens.filter(i => i.concluido).length
          return (
            <div key={sec.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {editandoSecao?.id === sec.id ? (
                  <input autoFocus className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
                    value={editandoSecao.titulo} onChange={e => setEditandoSecao(p => ({ ...p, titulo: e.target.value }))}
                    onBlur={salvarEdicaoSecao} onKeyDown={e => { if (e.key === 'Enter') salvarEdicaoSecao(); if (e.key === 'Escape') setEditandoSecao(null) }} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{sec.titulo}</span>
                )}
                {itens.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{concluidos}/{itens.length}</span>}
                {editandoSecao?.id !== sec.id && (
                  <button onClick={() => setEditandoSecao({ id: sec.id, titulo: sec.titulo })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 2, opacity: 0.7, display: 'flex' }}><Pencil size={11} /></button>
                )}
                <button onClick={() => { if (window.confirm(`Excluir a seção "${sec.titulo}"?`)) onDeletarSecao(sec.id, iniciativa.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, opacity: 0.5, display: 'flex' }}><Trash2 size={12} /></button>
              </div>
              {itens.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <input type="checkbox" checked={!!it.concluido} onChange={() => onToggleItem(it, sec.id, iniciativa.id)} style={{ width: 14, height: 14, accentColor: 'var(--green)', cursor: 'pointer', flexShrink: 0 }} />
                  {editandoItem?.id === it.id ? (
                    <input autoFocus className="form-input" style={{ flex: 1, padding: '3px 6px', fontSize: 12 }}
                      value={editandoItem.texto} onChange={e => setEditandoItem(p => ({ ...p, texto: e.target.value }))}
                      onBlur={salvarEdicaoItem} onKeyDown={e => { if (e.key === 'Enter') salvarEdicaoItem(); if (e.key === 'Escape') setEditandoItem(null) }} />
                  ) : (
                    <span style={{ fontSize: 12, flex: 1, color: it.concluido ? 'var(--text-muted)' : 'var(--text)', textDecoration: it.concluido ? 'line-through' : 'none' }}>{it.texto}</span>
                  )}
                  {editandoItem?.id !== it.id && (
                    <button onClick={() => setEditandoItem({ id: it.id, texto: it.texto, secaoId: sec.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 1, opacity: 0.6, display: 'flex' }}><Pencil size={11} /></button>
                  )}
                  <button onClick={() => onConverterEmSubPlanejamento(it, sec.id)} title="Converter em sub-planejamento (dá responsável, meta e prazo próprios)"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 1, opacity: 0.5, display: 'flex' }}><Layers size={11} /></button>
                  <button onClick={() => onDeletarItem(it.id, sec.id, iniciativa.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 1, opacity: 0.35, display: 'flex' }}><Trash2 size={10} /></button>
                </div>
              ))}
              {addingItem[sec.id] ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input className="form-input" style={{ padding: '3px 8px', fontSize: 12, flex: 1 }} value={novoItem[sec.id] || ''}
                    onChange={e => setNovoItem(p => ({ ...p, [sec.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddItem(sec.id); if (e.key === 'Escape') setAddingItem(p => ({ ...p, [sec.id]: false })) }}
                    placeholder="Novo item..." autoFocus />
                  <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => handleAddItem(sec.id)}>✓</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setAddingItem(p => ({ ...p, [sec.id]: false }))}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingItem(p => ({ ...p, [sec.id]: true }))}
                  style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, padding: '5px 10px' }}>
                  <Plus size={12} /> Adicionar item
                </button>
              )}
            </div>
          )
        })}
      </div>
      {addingSecao ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <input className="form-input" style={{ flex: 1 }} value={novaSecao} onChange={e => setNovaSecao(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSecao(); if (e.key === 'Escape') setAddingSecao(false) }}
            placeholder='Nome da seção' autoFocus />
          <button className="btn btn-primary btn-sm" onClick={handleAddSecao}>Salvar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingSecao(false)}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setAddingSecao(true)} style={{ width: '100%', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', marginTop: 12 }}>
          <Plus size={13} /> Nova seção
        </button>
      )}
    </div>
  )
}

// ── MODAL: REPLANEJAR PRAZO ─────────────────────────────────
function ModalReplanejar({ iniciativa, onConfirmar, onClose }) {
  const [novoPrazo, setNovoPrazo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    if (!novoPrazo) return
    setSaving(true)
    try { await onConfirmar(iniciativa.prazo_final, novoPrazo, motivo.trim() || null); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Replanejar prazo</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Prazo atual: <strong style={{ color: 'var(--text)' }}>{fmtDataBR(iniciativa.prazo_final) || 'não definido'}</strong>
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Novo prazo *</label>
            <input type="date" className="form-input" autoFocus value={novoPrazo} onChange={e => setNovoPrazo(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} style={{ colorScheme: 'dark', cursor: 'pointer' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Motivo (opcional)</label>
            <input className="form-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: aguardando retorno do jurídico" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={saving || !novoPrazo}>{saving ? 'Salvando...' : 'Confirmar replanejamento'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: DETALHE DA INICIATIVA ────────────────────────────
function ModalDetalheIniciativa2({
  iniciativa, pilares, subIniciativas, historico,
  onSalvarCampo, onReplanejar, onAbrirSub, onCriarSubDireto, onDeletar,
  onCriarSecao, onAtualizarSecao, onDeletarSecao, onCriarItem, onAtualizarItem, onToggleItem, onDeletarItem,
  onConverterEmSubPlanejamento, onConverterEmSubtarefa,
  onSalvarSemana, onClose,
}) {
  const [aba, setAba] = useState('detalhe')
  const [modalReplanejar, setModalReplanejar] = useState(false)

  const [titulo, setTitulo] = useState(iniciativa.titulo || '')
  const [responsavel, setResponsavel] = useState(iniciativa.responsavel || '')
  const [metaAlvo, setMetaAlvo] = useState(iniciativa.meta_alvo ?? '')
  const [metaAtual, setMetaAtual] = useState(iniciativa.meta_atual ?? '')
  const [metaUnidade, setMetaUnidade] = useState(iniciativa.meta_unidade || '')
  const [dataInicio, setDataInicio] = useState(iniciativa.data_inicio || '')
  const [prazoFinal, setPrazoFinal] = useState(iniciativa.prazo_final || '')
  const [andamento, setAndamento] = useState(iniciativa.andamento || 'nao_iniciado')
  const [justificativa, setJustificativa] = useState(iniciativa.justificativa || '')
  const [comoFazer, setComoFazer] = useState(iniciativa.como_fazer || '')
  const [pilarId, setPilarId] = useState(iniciativa.pilar_id || '')

  const situacao = situacaoIniciativa({ ...iniciativa, andamento, prazo_final: prazoFinal })
  const info = SITUACAO_INFO[situacao]
  const isComposta = iniciativa.tipo === 'composta'

  function salvar(campo, valor) { onSalvarCampo(iniciativa.id, campo, valor) }

  const abas = [
    { k: 'detalhe', l: 'Detalhe' },
    { k: 'semana', l: 'Semana a semana' },
    { k: 'subtarefas', l: 'Subtarefas' },
    ...(isComposta ? [{ k: 'subs', l: 'Sub-planejamentos' }] : []),
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ marginBottom: 6 }}>{iniciativa.titulo}</h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: info.bg, color: info.text }}>{info.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-ghost btn-icon" title="Excluir planejamento"
              onClick={() => { if (window.confirm(`Excluir "${iniciativa.titulo}"?\n\nEsta ação não pode ser desfeita.`)) onDeletar(iniciativa.id) }}
              style={{ color: 'var(--red)' }}>
              <Trash2 size={15} />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          {abas.map(t => (
            <button key={t.k} onClick={() => setAba(t.k)}
              style={{ padding: '8px 12px', fontSize: 13, fontWeight: aba === t.k ? 700 : 400, background: 'none', border: 'none', borderBottom: aba === t.k ? '2px solid var(--accent)' : '2px solid transparent', color: aba === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
              {t.l}
            </button>
          ))}
        </div>

        {aba === 'detalhe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {iniciativa.foi_replanejada && historico.length > 0 && (
              <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#EAB308' }}>
                <History size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                {historico.map((h, i) => (
                  <div key={h.id} style={{ marginTop: i > 0 ? 4 : 0 }}>
                    Prazo {h.prazo_anterior ? fmtDataBR(h.prazo_anterior) : '—'} → replanejado em {fmtDataBR((h.created_at || '').slice(0, 10))} para {fmtDataBR(h.prazo_novo)}{h.motivo ? ` — motivo: ${h.motivo}` : ''}
                  </div>
                ))}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={() => salvar('titulo', titulo.trim() || iniciativa.titulo)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Pilar</label>
                <select className="form-select" value={pilarId} onChange={e => { setPilarId(e.target.value); salvar('pilar_id', e.target.value) }}>
                  {pilares.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Andamento</label>
                <select className="form-select" value={andamento} onChange={e => { setAndamento(e.target.value); salvar('andamento', e.target.value) }}>
                  {ANDAMENTOS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <input className="form-input" value={responsavel} onChange={e => setResponsavel(e.target.value)} onBlur={() => salvar('responsavel', responsavel.trim() || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Meta numérica</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" className="form-input" style={{ width: 80 }} value={metaAtual} onChange={e => setMetaAtual(e.target.value)} onBlur={() => salvar('meta_atual', metaAtual !== '' ? Number(metaAtual) : null)} placeholder="Atual" />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>de</span>
                  <input type="number" className="form-input" style={{ width: 80 }} value={metaAlvo} onChange={e => setMetaAlvo(e.target.value)} onBlur={() => salvar('meta_alvo', metaAlvo !== '' ? Number(metaAlvo) : null)} placeholder="Alvo" />
                  <input className="form-input" style={{ flex: 1 }} value={metaUnidade} onChange={e => setMetaUnidade(e.target.value)} onBlur={() => salvar('meta_unidade', metaUnidade.trim() || null)} placeholder="Unidade" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Data de início</label>
                  <input type="date" className="form-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} onBlur={() => salvar('data_inicio', dataInicio || null)} onClick={e => e.currentTarget.showPicker?.()} style={{ cursor: 'pointer' }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Prazo final</label>
                  {!iniciativa.prazo_final ? (
                    <input type="date" className="form-input" value={prazoFinal} onChange={e => setPrazoFinal(e.target.value)} onBlur={() => salvar('prazo_final', prazoFinal || null)} onClick={e => e.currentTarget.showPicker?.()} style={{ cursor: 'pointer' }} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="date" className="form-input" value={prazoFinal} disabled style={{ opacity: 0.7 }} />
                      <button className="btn btn-ghost btn-sm" onClick={() => setModalReplanejar(true)} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>Replanejar</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Justificativa</label>
                <input className="form-input" value={justificativa} onChange={e => setJustificativa(e.target.value)} onBlur={() => salvar('justificativa', justificativa.trim() || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Como fazer</label>
                <textarea className="form-input" rows={3} value={comoFazer} onChange={e => setComoFazer(e.target.value)} onBlur={() => salvar('como_fazer', comoFazer.trim() || null)} style={{ resize: 'vertical' }} />
              </div>
            </>

          </div>
        )}

        {aba === 'semana' && <AbaSemanaASemana iniciativa={iniciativa} onSalvarSemana={(s, status, texto) => onSalvarSemana(iniciativa.id, s, status, texto)} />}

        {aba === 'subtarefas' && (
          <AbaSubtarefas iniciativa={iniciativa}
            onCriarSecao={onCriarSecao} onAtualizarSecao={onAtualizarSecao} onDeletarSecao={onDeletarSecao}
            onCriarItem={onCriarItem} onAtualizarItem={onAtualizarItem} onToggleItem={onToggleItem} onDeletarItem={onDeletarItem}
            onConverterEmSubPlanejamento={(item, secaoId) => onConverterEmSubPlanejamento(item, secaoId, iniciativa)} />
        )}

        {aba === 'subs' && isComposta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subIniciativas.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum sub-planejamento ainda.</p>}
            {subIniciativas.map(sub => {
              const subInfo = SITUACAO_INFO[situacaoIniciativa(sub)]
              return (
                <div key={sub.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onAbrirSub(sub)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sub.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.responsavel || '—'}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: subInfo.bg, color: subInfo.text, whiteSpace: 'nowrap' }}>{subInfo.label}</span>
                  <button onClick={() => { if (window.confirm(`Converter "${sub.titulo}" em subtarefa simples?\n\nEla perde responsável, meta e prazo próprios — vira só um item de checklist.`)) onConverterEmSubtarefa(sub, iniciativa) }}
                    title="Converter em subtarefa simples (perde responsável, meta e prazo próprios)"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, opacity: 0.6, display: 'flex', flexShrink: 0 }}>
                    <ListChecks size={13} />
                  </button>
                  <button onClick={() => onAbrirSub(sub)} title="Editar sub-planejamento"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 3, opacity: 0.8, display: 'flex', flexShrink: 0 }}>
                    <Pencil size={13} />
                  </button>
                </div>
              )
            })}
            <button className="btn btn-ghost btn-sm" onClick={() => onCriarSubDireto(iniciativa.id)} style={{ alignSelf: 'flex-start', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Novo sub-planejamento
            </button>
          </div>
        )}

        {modalReplanejar && (
          <ModalReplanejar
            iniciativa={{ ...iniciativa, prazo_final: prazoFinal }}
            onConfirmar={async (prazoAnterior, prazoNovo, motivo) => {
              await onReplanejar(iniciativa.id, prazoAnterior, prazoNovo, motivo)
              setPrazoFinal(prazoNovo)
            }}
            onClose={() => setModalReplanejar(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── VISÃO: LINHA DO TEMPO (GANTT) ───────────────────────────
function VisaoGantt2({ iniciativasTopo, pilares }) {
  const semanaAtualIdx = useMemo(() => semanaAtual(), [])
  function semanaParaPct(semana, edge) {
    let mi = MESES.findIndex(m => m.semanas.includes(semana))
    if (mi < 0) mi = 0
    const m = MESES[mi]
    const idx = m.semanas.indexOf(semana)
    return ((mi + (idx + edge) / m.semanas.length) / MESES.length) * 100
  }
  const hojePct = semanaParaPct(semanaAtualIdx, 0.5)

  function intervaloPorDatas(ini) {
    if (!ini.data_inicio || !ini.prazo_final) return null
    const anoBase = 2026
    function paraSemana(dataStr) {
      const d = new Date(dataStr)
      for (let i = SEMANA_DATA.length - 1; i >= 0; i--) {
        const [a, m, dia] = SEMANA_DATA[i]
        if (d >= new Date(a, m - 1, dia)) return i + 1
      }
      return 1
    }
    return { ini: paraSemana(ini.data_inicio), fim: paraSemana(ini.prazo_final) }
  }

  return (
    <div>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Iniciativa</div>
          <div style={{ flex: 1, display: 'flex' }}>
            {MESES.map((m, i) => (
              <div key={m.sigla} style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{m.sigla}</div>
            ))}
          </div>
        </div>
        {pilares.map(pilar => {
          const inisDoPilar = iniciativasTopo.filter(i => i.pilar_id === pilar.id)
          if (inisDoPilar.length === 0) return null
          return (
            <div key={pilar.id}>
              <div style={{ padding: '6px 12px', background: 'rgba(249,115,22,0.05)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{pilar.nome}</div>
              {inisDoPilar.map(ini => {
                const iv = intervaloPorDatas(ini)
                const situacao = situacaoIniciativa(ini)
                const cor = SITUACAO_INFO[situacao].fill
                return (
                  <div key={ini.id} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: 40 }}>
                    <div style={{ width: 260, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center' }}>{ini.titulo}</div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 2, background: 'var(--accent)', opacity: 0.5 }} />
                      {iv ? (
                        <div title={`${fmtDataBR(ini.data_inicio)} → ${fmtDataBR(ini.prazo_final)}`}
                          style={{ position: 'absolute', top: 8, height: 22, left: `${semanaParaPct(iv.ini, 0)}%`, width: `${Math.max(semanaParaPct(iv.fim, 1) - semanaParaPct(iv.ini, 0), 2)}%`, background: cor, borderRadius: 5, opacity: 0.85 }} />
                      ) : (
                        <div style={{ position: 'absolute', top: 12, left: '2%', right: '2%', height: 14, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 4 }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VISÃO: STATUS REPORT SEMANAL ────────────────────────────
function VisaoStatusReport2({ iniciativasTodas, semanaSel, setSemanaSel, semanaAtualIdx }) {
  const itens = iniciativasTodas
    .map(ini => ({ ini, celula: (ini.pda2_parceiras_semanas || []).find(c => c.semana === semanaSel) }))
    .filter(x => celulaAtiva(x.celula))

  const ordem = ['feito', 'feito_atrasado', 'em_andamento', 'planejada', 'atrasado', 'a_fazer']
  const agrupado = ordem.map(st => ({ status: st, info: STATUS_SEMANA_INFO[st], items: itens.filter(x => (x.celula.status || 'a_fazer') === st) })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" disabled={semanaSel === 1} onClick={() => setSemanaSel(s => Math.max(1, s - 1))}><ChevronLeft size={14} /> Anterior</button>
        <select className="form-select" style={{ width: 'auto', fontSize: 12 }} value={semanaSel} onChange={e => setSemanaSel(parseInt(e.target.value))}>
          {SEMANA_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>Sem {i + 1} · {label} {i + 1 === semanaAtualIdx ? '(atual)' : ''}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" disabled={semanaSel === SEMANA_LABELS.length} onClick={() => setSemanaSel(s => Math.min(SEMANA_LABELS.length, s + 1))}>Próxima <ChevronRight size={14} /></button>
      </div>
      {agrupado.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px dashed var(--border)' }}>
          <FileText size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Nenhuma atividade nesta semana.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agrupado.map(g => (
            <div key={g.status}>
              <h3 style={{ fontSize: 12, color: g.info.border, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{g.info.label}</h3>
              {g.items.map(({ ini, celula }) => (
                <div key={ini.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${g.info.border}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ini.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {ini.responsavel || 'Sem responsável'} · {celula.texto || g.info.label}
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

// ── EXPORTAÇÃO CSV ───────────────────────────────────────────
function exportarCSV(iniciativas, pilares, semestre) {
  const cabecalho = ['Pilar', 'Planejamento', 'Tipo', 'Responsável', 'Meta atual', 'Meta alvo', 'Unidade', 'Início', 'Prazo final', 'Andamento', 'Situação']
  const linhas = [cabecalho]
  for (const ini of iniciativas) {
    const pilar = pilares.find(p => p.id === ini.pilar_id)
    const situacao = SITUACAO_INFO[situacaoIniciativa(ini)]?.label || ''
    linhas.push([
      pilar?.nome || '', ini.titulo, ini.tipo === 'composta' ? 'Composta' : (ini.iniciativa_pai_id ? 'Sub-iniciativa' : 'Simples'),
      ini.responsavel || '',
      ini.meta_atual ?? '', ini.meta_alvo ?? '', ini.meta_unidade || '',
      fmtDataBR(ini.data_inicio) || '', fmtDataBR(ini.prazo_final) || '',
      ANDAMENTOS.find(a => a.value === ini.andamento)?.label || '', situacao,
    ])
  }
  const csv = linhas.map(l => l.map(c => {
    const v = c == null ? '' : String(c)
    return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `pda_${semestre}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────
export default function PDAParceiras() {
  const [pilares, setPilares] = useState([])
  const [iniciativas, setIniciativas] = useState([])
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState(() => {
    const ano = new Date().getFullYear()
    const mes = new Date().getMonth() + 1
    return `${ano}-S${mes <= 6 ? 1 : 2}`
  })
  const [visao, setVisao] = useState('cards')
  const [resumoAberto, setResumoAberto] = useState(false)
  const [modalNovo, setModalNovo] = useState(null)
  const [detalheId, setDetalheId] = useState(null)
  const [toast, showToast] = useToast()
  const semanaAtualIdx = useMemo(() => semanaAtual(), [])
  const [semanaSel, setSemanaSel] = useState(semanaAtualIdx)

  async function carregar() {
    const [ps, is] = await Promise.all([getPilares(), getIniciativas(semestre)])
    setPilares(ps); setIniciativas(is)
  }
  useEffect(() => { setLoading(true); carregar().finally(() => setLoading(false)) }, [semestre])

  const iniciativasTopo = useMemo(() => iniciativas.filter(i => !i.iniciativa_pai_id), [iniciativas])
  const detalheIniciativa = useMemo(() => iniciativas.find(i => i.id === detalheId) || null, [iniciativas, detalheId])
  const compostas = useMemo(() => iniciativas.filter(i => i.tipo === 'composta'), [iniciativas])

  function subsDe(paiId) {
    return iniciativas.filter(i => i.iniciativa_pai_id === paiId)
  }

  const resumo = useMemo(() => {
    let concluidas = 0, atrasadas = 0, andamento = 0, total = 0
    for (const ini of iniciativasTopo) {
      total++
      const s = situacaoIniciativa(ini)
      if (s === 'concluido') concluidas++
      else if (s === 'atrasado') atrasadas++
      else if (s === 'em_andamento' || s === 'replanejado') andamento++
    }
    return { pct: total ? Math.round((concluidas / total) * 100) : 0, atrasadas, andamento, total }
  }, [iniciativasTopo])

  // ── CRUD: INICIATIVAS ─────────────────────────────────────
  async function handleCriarIniciativa(form) {
    const proximaOrdem = (iniciativas[iniciativas.length - 1]?.ordem || 0) + 1
    const nova = await criarIniciativa({ ...form, ordem: proximaOrdem })
    setIniciativas(prev => [...prev, nova])
    showToast(form.tipo === 'composta' ? 'Composta criada!' : 'Iniciativa criada!')
    return nova
  }
  async function handleSalvarCampo(id, campo, valor) {
    try {
      const upd = await atualizarIniciativa(id, { [campo]: valor })
      setIniciativas(prev => prev.map(i => i.id === id ? { ...i, ...upd } : i))
    } catch (e) { console.error(e); showToast('Erro ao salvar.', 'error') }
  }
  async function handleDeletarIniciativa(id) {
    if (!window.confirm('Excluir este planejamento? Isso não pode ser desfeito.')) return
    await deletarIniciativa(id)
    setIniciativas(prev => prev.filter(i => i.id !== id && i.iniciativa_pai_id !== id))
    setDetalheId(null)
    showToast('Removido.')
  }
  async function handleReplanejar(id, prazoAnterior, prazoNovo, motivo) {
    try {
      const upd = await replanejarPrazo(id, prazoAnterior, prazoNovo, motivo)
      setIniciativas(prev => prev.map(i => i.id === id ? { ...i, ...upd } : i))
      showToast('Prazo replanejado!')
    } catch (e) { console.error(e); showToast('Erro ao replanejar.', 'error') }
  }

  // ── HISTÓRICO (carregado sob demanda ao abrir o detalhe) ──
  const [historicoPorId, setHistoricoPorId] = useState({})
  useEffect(() => {
    if (!detalheIniciativa?.foi_replanejada) return
    getHistoricoPrazos(detalheIniciativa.id).then(h => setHistoricoPorId(prev => ({ ...prev, [detalheIniciativa.id]: h })))
  }, [detalheIniciativa?.id, detalheIniciativa?.foi_replanejada])

  // ── SEMANA A SEMANA ────────────────────────────────────────
  async function handleSalvarSemana(iniciativaId, semana, status, texto) {
    try {
      const r = await upsertSemana({ iniciativa_id: iniciativaId, semana, texto, status })
      setIniciativas(prev => prev.map(i => {
        if (i.id !== iniciativaId) return i
        const semCel = (i.pda2_parceiras_semanas || []).filter(c => c.semana !== semana)
        return { ...i, pda2_parceiras_semanas: r ? [...semCel, r] : semCel }
      }))
    } catch (e) { console.error(e); showToast('Erro ao salvar semana.', 'error') }
  }

  // ── SUBTAREFAS ──────────────────────────────────────────────
  async function handleCriarSecao(iniciativaId, titulo, ordem) {
    const nova = await criarSecao(iniciativaId, titulo, ordem)
    setIniciativas(prev => prev.map(i => i.id === iniciativaId ? { ...i, pda2_parceiras_secoes: [...(i.pda2_parceiras_secoes || []), nova] } : i))
  }
  async function handleAtualizarSecao(secaoId, titulo, iniciativaId) {
    const upd = await atualizarSecao(secaoId, { titulo })
    setIniciativas(prev => prev.map(i => i.id !== iniciativaId ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id === secaoId ? { ...s, ...upd } : s) }))
  }
  async function handleDeletarSecao(secaoId, iniciativaId) {
    await deletarSecao(secaoId)
    setIniciativas(prev => prev.map(i => i.id === iniciativaId ? { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).filter(s => s.id !== secaoId) } : i))
  }
  async function handleCriarItem(iniciativaId, secaoId, texto, ordem) {
    const novo = await criarItem(secaoId, texto, ordem)
    setIniciativas(prev => prev.map(i => i.id !== iniciativaId ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoId ? s : { ...s, pda2_parceiras_itens: [...(s.pda2_parceiras_itens || []), novo] }) }))
  }
  async function handleAtualizarItem(itemId, texto, secaoId, iniciativaId) {
    const upd = await atualizarItem(itemId, { texto })
    setIniciativas(prev => prev.map(i => i.id !== iniciativaId ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoId ? s : { ...s, pda2_parceiras_itens: (s.pda2_parceiras_itens || []).map(it => it.id === upd.id ? upd : it) }) }))
  }
  async function handleToggleItem(item, secaoId, iniciativaId) {
    const upd = await atualizarItem(item.id, { concluido: !item.concluido })
    setIniciativas(prev => prev.map(i => i.id !== iniciativaId ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoId ? s : { ...s, pda2_parceiras_itens: (s.pda2_parceiras_itens || []).map(it => it.id === upd.id ? upd : it) }) }))
  }
  async function handleDeletarItem(itemId, secaoId, iniciativaId) {
    await deletarItem(itemId)
    setIniciativas(prev => prev.map(i => i.id !== iniciativaId ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoId ? s : { ...s, pda2_parceiras_itens: (s.pda2_parceiras_itens || []).filter(it => it.id !== itemId) }) }))
  }

  // ── CONVERSÃO: subtarefa ⇄ sub-planejamento (sem perder o texto) ──
  async function handleConverterEmSubPlanejamento(item, secaoId, iniciativaMae) {
    try {
      const novo = await criarIniciativa({
        pilar_id: iniciativaMae.pilar_id,
        iniciativa_pai_id: iniciativaMae.id,
        semestre: iniciativaMae.semestre,
        titulo: item.texto,
        tipo: 'simples',
        andamento: item.concluido ? 'concluido' : 'nao_iniciado',
        ordem: (iniciativas.filter(i => i.iniciativa_pai_id === iniciativaMae.id).length),
      })
      await deletarItem(item.id)
      setIniciativas(prev => [
        ...prev.map(i => i.id !== iniciativaMae.id ? i : { ...i, pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoId ? s : { ...s, pda2_parceiras_itens: (s.pda2_parceiras_itens || []).filter(it => it.id !== item.id) }) }),
        novo,
      ])
      showToast('Virou sub-planejamento — abra pra completar responsável, meta e prazo.')
    } catch (e) { console.error(e); showToast('Erro ao converter.', 'error') }
  }

  async function handleConverterEmSubtarefa(sub, iniciativaMae) {
    try {
      let secaoAlvo = (iniciativaMae.pda2_parceiras_secoes || [])[0]
      if (!secaoAlvo) {
        secaoAlvo = await criarSecao(iniciativaMae.id, 'Subtarefas', 0)
        setIniciativas(prev => prev.map(i => i.id === iniciativaMae.id ? { ...i, pda2_parceiras_secoes: [...(i.pda2_parceiras_secoes || []), secaoAlvo] } : i))
      }
      const novoItem = await criarItem(secaoAlvo.id, sub.titulo, (secaoAlvo.pda2_parceiras_itens || []).length)
      if (sub.andamento === 'concluido') await atualizarItem(novoItem.id, { concluido: true })
      await deletarIniciativa(sub.id)
      setIniciativas(prev => prev
        .filter(i => i.id !== sub.id)
        .map(i => i.id !== iniciativaMae.id ? i : {
          ...i,
          pda2_parceiras_secoes: (i.pda2_parceiras_secoes || []).map(s => s.id !== secaoAlvo.id ? s : { ...s, pda2_parceiras_itens: [...(s.pda2_parceiras_itens || []), { ...novoItem, concluido: sub.andamento === 'concluido' }] })
        })
      )
      showToast('Virou subtarefa.')
    } catch (e) { console.error(e); showToast('Erro ao converter.', 'error') }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>PDA — Plano de Ação</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Editoras Parceiras</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={semestre} onChange={e => setSemestre(e.target.value)}>
            {semestresDisponiveis().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => exportarCSV(iniciativasTopo.concat(iniciativas.filter(i => i.iniciativa_pai_id)), pilares, semestre)}>
            <Download size={14} /> Exportar
          </button>
          <button className="btn btn-primary" onClick={() => setModalNovo({ tipo: 'simples' })}><Plus size={14} /> Nova iniciativa</button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, cursor: 'pointer' }}
        onClick={() => setResumoAberto(o => !o)}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>
          <strong>{resumo.pct}%</strong> concluído · <span style={{ color: 'var(--red)' }}>{resumo.atrasadas} atrasadas</span> · <span style={{ color: 'var(--accent)' }}>{resumo.andamento} em andamento</span> · {resumo.total} planejados
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: resumoAberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {resumoAberto && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12, marginBottom: 16 }}>
          {iniciativasTopo.filter(i => situacaoIniciativa(i) === 'atrasado' || situacaoIniciativa(i) === 'replanejado').slice(0, 6).map(ini => {
            const info = SITUACAO_INFO[situacaoIniciativa(ini)]
            return (
              <div key={ini.id} onClick={() => setDetalheId(ini.id)} style={{ cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${info.fill}`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: info.text, textTransform: 'uppercase' }}>{info.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ini.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ini.responsavel} {ini.prazo_final ? `· prazo ${fmtDataBR(ini.prazo_final)}` : ''}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {[
          { k: 'cards', icon: LayoutGrid, label: 'Cards' },
          { k: 'gantt', icon: BarChart2, label: 'Linha do tempo' },
          { k: 'status', icon: FileText, label: 'Status report' },
        ].map(v => {
          const Icon = v.icon
          const ativo = visao === v.k
          return (
            <button key={v.k} onClick={() => setVisao(v.k)} style={{ background: ativo ? 'var(--surface)' : 'transparent', color: ativo ? 'var(--text)' : 'var(--text-muted)', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={14} /> {v.label}
            </button>
          )
        })}
      </div>

      {visao === 'cards' && (
        <div>
          {pilares.map(pilar => {
            const cards = iniciativasTopo.filter(i => i.pilar_id === pilar.id)
            if (cards.length === 0) return null
            return (
              <div key={pilar.id} style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>{pilar.nome}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                  {cards.map(ini => (
                    <CardIniciativa key={ini.id} ini={ini} subIniciativas={subsDe(ini.id)} onAbrir={i => setDetalheId(i.id)} />
                  ))}
                </div>
              </div>
            )
          })}
          {iniciativasTopo.length === 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px dashed var(--border)' }}>
              <Target size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Nenhum planejamento cadastrado neste semestre.</p>
            </div>
          )}
        </div>
      )}

      {visao === 'gantt' && <VisaoGantt2 iniciativasTopo={iniciativasTopo} pilares={pilares} />}
      {visao === 'status' && <VisaoStatusReport2 iniciativasTodas={iniciativas} semanaSel={semanaSel} setSemanaSel={setSemanaSel} semanaAtualIdx={semanaAtualIdx} />}

      {modalNovo && (
        <ModalNovaIniciativa2 pilares={pilares} compostas={compostas} semestre={semestre} preset={modalNovo}
          onSave={handleCriarIniciativa} onClose={() => setModalNovo(null)} />
      )}

      {detalheIniciativa && (
        <ModalDetalheIniciativa2
          iniciativa={detalheIniciativa} pilares={pilares}
          subIniciativas={subsDe(detalheIniciativa.id)}
          historico={historicoPorId[detalheIniciativa.id] || []}
          onSalvarCampo={handleSalvarCampo}
          onReplanejar={handleReplanejar}
          onAbrirSub={sub => setDetalheId(sub.id)}
          onCriarSubDireto={paiId => { setDetalheId(null); setModalNovo({ tipo: 'sub', paiId }) }}
          onDeletar={handleDeletarIniciativa}
          onConverterEmSubPlanejamento={handleConverterEmSubPlanejamento}
          onConverterEmSubtarefa={handleConverterEmSubtarefa}
          onCriarSecao={handleCriarSecao} onAtualizarSecao={handleAtualizarSecao} onDeletarSecao={handleDeletarSecao}
          onCriarItem={handleCriarItem} onAtualizarItem={handleAtualizarItem} onToggleItem={handleToggleItem} onDeletarItem={handleDeletarItem}
          onSalvarSemana={handleSalvarSemana}
          onClose={() => setDetalheId(null)}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'error' ? 'var(--red)' : 'var(--green)', color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
