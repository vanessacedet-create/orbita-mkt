import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  TrendingUp, Upload, Plus, Pencil, Trash2, X, ChevronDown,
  BarChart3, DollarSign, Users, AlertTriangle, FileSpreadsheet,
  Check, Info, ArrowUpRight, ArrowDownRight, Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  listarTodosPedidos, listarGastos, listarLojas, listarImportacoes,
  inserirGasto, editarGasto, excluirGasto, excluirLoteImportacao,
  importarPedidos, getNumeroPedidosExistentes,
  mapearColunas, processarLinhas,
  identificarLeitores, leitoresNovosPeriodo,
  calcularCACBlended, calcularLTV, calcularCACPorCupom, calcularEvolucaoMensal,
} from '../lib/cac-ltv'

// ── Helpers ──────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

function fmtBRL(val) {
  if (val == null) return '—'
  return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtRatio(val) {
  if (val == null) return '—'
  return val.toFixed(1) + ':1'
}

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function fmtDateTime(str) {
  if (!str) return '—'
  const d = new Date(str)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtMesAno(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return meses[d.getMonth()] + '/' + d.getFullYear()
}

// ── Período helpers ──────────────────────────────────────────
function getHoje() { return new Date() }

function getPeriodo(tipo) {
  const h = getHoje()
  const y = h.getFullYear()
  const m = h.getMonth()

  switch (tipo) {
    case 'mes_atual':
      return { inicio: new Date(y, m, 1), fim: new Date(y, m + 1, 0) }
    case 'mes_anterior':
      return { inicio: new Date(y, m - 1, 1), fim: new Date(y, m, 0) }
    case 'trimestre_atual': {
      const qi = Math.floor(m / 3) * 3
      return { inicio: new Date(y, qi, 1), fim: new Date(y, qi + 3, 0) }
    }
    case 'trimestre_anterior': {
      const qi = Math.floor(m / 3) * 3 - 3
      return { inicio: new Date(y, qi, 1), fim: new Date(y, qi + 3, 0) }
    }
    case 'semestre_atual': {
      const si = m < 6 ? 0 : 6
      return { inicio: new Date(y, si, 1), fim: new Date(y, si + 6, 0) }
    }
    case 'semestre_anterior': {
      const si = m < 6 ? -6 : 0
      return { inicio: new Date(y, si, 1), fim: new Date(y, si + 6, 0) }
    }
    case 'ano_atual':
      return { inicio: new Date(y, 0, 1), fim: new Date(y, 12, 0) }
    case 'ano_anterior':
      return { inicio: new Date(y - 1, 0, 1), fim: new Date(y - 1, 12, 0) }
    default:
      return { inicio: new Date(y, m, 1), fim: new Date(y, m + 1, 0) }
  }
}

function toISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// ── Categorias de gastos ─────────────────────────────────────
const CATEGORIAS_GASTO = [
  { value: 'anuncio', label: 'Anúncio pago' },
  { value: 'agencia', label: 'Agência / freelancer' },
  { value: 'influenciador', label: 'Influenciador' },
]

const PERIODOS = [
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'trimestre_atual', label: 'Trimestre atual' },
  { value: 'trimestre_anterior', label: 'Trimestre anterior' },
  { value: 'semestre_atual', label: 'Semestre atual' },
  { value: 'semestre_anterior', label: 'Semestre anterior' },
  { value: 'ano_atual', label: 'Ano atual' },
  { value: 'ano_anterior', label: 'Ano anterior' },
  { value: 'personalizado', label: 'Personalizado' },
]

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function CacLtv() {
  const [toast, showToast] = useToast()
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Dados
  const [todosPedidos, setTodosPedidos] = useState([])
  const [gastos, setGastos] = useState([])
  const [lojas, setLojas] = useState([])
  const [importacoes, setImportacoes] = useState([])

  // Filtros
  const [lojaFiltro, setLojaFiltro] = useState('')
  const [periodoTipo, setPeriodoTipo] = useState('mes_atual')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')

  // Período calculado
  const periodo = useMemo(() => {
    if (periodoTipo === 'personalizado') {
      return {
        inicio: customInicio ? new Date(customInicio + 'T00:00:00') : new Date(),
        fim: customFim ? new Date(customFim + 'T23:59:59') : new Date(),
      }
    }
    return getPeriodo(periodoTipo)
  }, [periodoTipo, customInicio, customFim])

  const dataInicio = toISODate(periodo.inicio)
  const dataFim = toISODate(periodo.fim)

  // ── Carregamento inicial ───────────────────────────────────
  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [p, g, l, i] = await Promise.all([
        listarTodosPedidos(),
        listarGastos(),
        listarLojas(),
        listarImportacoes(),
      ])
      setTodosPedidos(p)
      setGastos(g)
      setLojas(l)
      setImportacoes(i)
    } catch (err) {
      showToast('Erro ao carregar dados: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ── Cálculos memoizados ────────────────────────────────────
  const leitoresMap = useMemo(() =>
    identificarLeitores(todosPedidos), [todosPedidos])

  const leitoresNovos = useMemo(() =>
    leitoresNovosPeriodo(leitoresMap, lojaFiltro || null, dataInicio, dataFim),
    [leitoresMap, lojaFiltro, dataInicio, dataFim])

  const gastosFiltrados = useMemo(() => {
    return gastos.filter(g => {
      if (lojaFiltro && g.loja !== lojaFiltro) return false
      const gd = new Date(g.mes_referencia + 'T12:00:00')
      return gd >= periodo.inicio && gd <= periodo.fim
    })
  }, [gastos, lojaFiltro, periodo])

  const cacBlended = useMemo(() =>
    calcularCACBlended(gastosFiltrados, leitoresNovos),
    [gastosFiltrados, leitoresNovos])

  const ltv = useMemo(() =>
    calcularLTV(leitoresNovos, todosPedidos),
    [leitoresNovos, todosPedidos])

  const ltvCacRatio = useMemo(() => {
    if (!ltv.ltv || !cacBlended.cac) return null
    return ltv.ltv / cacBlended.cac
  }, [ltv, cacBlended])

  const cacCupom = useMemo(() =>
    calcularCACPorCupom(leitoresNovos, gastosFiltrados),
    [leitoresNovos, gastosFiltrados])

  const evolucao = useMemo(() =>
    calcularEvolucaoMensal(todosPedidos, gastos, lojaFiltro || null),
    [todosPedidos, gastos, lojaFiltro])

  // Período anterior (para variação)
  const periodoAnterior = useMemo(() => {
    const diff = periodo.fim.getTime() - periodo.inicio.getTime()
    return {
      inicio: new Date(periodo.inicio.getTime() - diff - 86400000),
      fim: new Date(periodo.inicio.getTime() - 86400000),
    }
  }, [periodo])

  const leitoresNovosAnterior = useMemo(() =>
    leitoresNovosPeriodo(leitoresMap, lojaFiltro || null, toISODate(periodoAnterior.inicio), toISODate(periodoAnterior.fim)),
    [leitoresMap, lojaFiltro, periodoAnterior])

  const gastosAnterior = useMemo(() => {
    return gastos.filter(g => {
      if (lojaFiltro && g.loja !== lojaFiltro) return false
      const gd = new Date(g.mes_referencia + 'T12:00:00')
      return gd >= periodoAnterior.inicio && gd <= periodoAnterior.fim
    })
  }, [gastos, lojaFiltro, periodoAnterior])

  const cacAnterior = useMemo(() =>
    calcularCACBlended(gastosAnterior, leitoresNovosAnterior),
    [gastosAnterior, leitoresNovosAnterior])

  // Tabela por loja (quando filtro = Todas)
  const tabelaLojas = useMemo(() => {
    if (lojaFiltro) return []
    return lojas.map(loja => {
      const ln = leitoresNovosPeriodo(leitoresMap, loja, dataInicio, dataFim)
      const gf = gastosFiltrados.filter(g => g.loja === loja)
      const cac = calcularCACBlended(gf, ln)
      const ltvLoja = calcularLTV(ln, todosPedidos)
      const ratio = ltvLoja.ltv && cac.cac ? ltvLoja.ltv / cac.cac : null
      return { loja, leitoresNovos: ln.length, gastoTotal: cac.totalGastos, cac: cac.cac, ltv: ltvLoja.ltv, ratio }
    })
  }, [lojaFiltro, lojas, leitoresMap, dataInicio, dataFim, gastosFiltrados, todosPedidos])

  // Resumo dos dados importados
  const resumoImportacao = useMemo(() => {
    if (!todosPedidos.length) return null
    const hashesUnicos = new Set(todosPedidos.map(p => p.hash_email))
    const datas = todosPedidos.map(p => new Date(p.data_pedido)).filter(d => !isNaN(d.getTime()))
    const min = datas.length ? new Date(Math.min(...datas)) : null
    const max = datas.length ? new Date(Math.max(...datas)) : null
    return {
      totalPedidos: todosPedidos.length,
      leitoresUnicos: hashesUnicos.size,
      dataMin: min ? toISODate(min) : null,
      dataMax: max ? toISODate(max) : null,
    }
  }, [todosPedidos])

  // ══════════════════════════════════════════════════════════════
  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">CAC / LTV</h1>
          <p className="page-subtitle">Custo de Aquisição × Valor do Leitor</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', gap: 0 }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'gastos', label: 'Gastos', icon: DollarSign },
          { id: 'importacao', label: 'Importação', icon: Upload },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div className="form-group" style={{ minWidth: 160 }}>
          <label className="form-label">Loja</label>
          <select className="form-select" value={lojaFiltro} onChange={e => setLojaFiltro(e.target.value)}>
            <option value="">Todas</option>
            {lojas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 180 }}>
          <label className="form-label">Período</label>
          <select className="form-select" value={periodoTipo} onChange={e => setPeriodoTipo(e.target.value)}>
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {periodoTipo === 'personalizado' && (
          <>
            <div className="form-group" style={{ minWidth: 140 }}>
              <label className="form-label">Início</label>
              <input type="date" className="form-input" value={customInicio}
                onChange={e => setCustomInicio(e.target.value)} />
            </div>
            <div className="form-group" style={{ minWidth: 140 }}>
              <label className="form-label">Fim</label>
              <input type="date" className="form-input" value={customFim}
                onChange={e => setCustomFim(e.target.value)} />
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', paddingBottom: 4 }}>
          {fmtDate(dataInicio)} — {fmtDate(dataFim)}
        </div>
      </div>

      {/* Conteúdo das tabs */}
      {tab === 'dashboard' && (
        <TabDashboard
          cacBlended={cacBlended}
          cacAnterior={cacAnterior}
          ltv={ltv}
          ltvCacRatio={ltvCacRatio}
          leitoresNovos={leitoresNovos}
          gastosFiltrados={gastosFiltrados}
          cacCupom={cacCupom}
          evolucao={evolucao}
          tabelaLojas={tabelaLojas}
          lojaFiltro={lojaFiltro}
        />
      )}

      {tab === 'gastos' && (
        <TabGastos
          gastos={gastos}
          gastosFiltrados={gastosFiltrados}
          lojas={lojas}
          lojaFiltro={lojaFiltro}
          periodo={periodo}
          onRefresh={carregarDados}
          showToast={showToast}
        />
      )}

      {tab === 'importacao' && (
        <TabImportacao
          importacoes={importacoes}
          resumo={resumoImportacao}
          lojas={lojas}
          onRefresh={carregarDados}
          showToast={showToast}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ══════════════════════════════════════════════════════════════
function TabDashboard({ cacBlended, cacAnterior, ltv, ltvCacRatio, leitoresNovos, gastosFiltrados, cacCupom, evolucao, tabelaLojas, lojaFiltro }) {

  const [chartSeries, setChartSeries] = useState({ cac: true, ltv: true, leitores: false })

  // Variação CAC
  const cacVar = cacBlended.cac != null && cacAnterior.cac != null
    ? ((cacBlended.cac - cacAnterior.cac) / cacAnterior.cac * 100) : null

  // Razão color
  const ratioColor = ltvCacRatio == null ? 'var(--text-muted)' :
    ltvCacRatio < 1 ? 'var(--red)' :
    ltvCacRatio < 3 ? 'var(--amber)' : 'var(--green)'

  const ratioBadge = ltvCacRatio == null ? 'badge-gray' :
    ltvCacRatio < 1 ? 'badge-red' :
    ltvCacRatio < 3 ? 'badge-amber' : 'badge-green'

  const ratioLabel = ltvCacRatio == null ? 'Sem dados' :
    ltvCacRatio < 1 ? 'Prejuízo de mídia' :
    ltvCacRatio < 3 ? 'Zona de atenção' : 'Saudável'

  return (
    <div>
      {/* Cards KPI */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card accent">
          <div className="stat-label">CAC blended</div>
          <div className="stat-value" style={{ fontSize: 26 }}>{fmtBRL(cacBlended.cac)}</div>
          {cacVar != null && (
            <div style={{ marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              color: cacVar <= 0 ? 'var(--green)' : 'var(--red)' }}>
              {cacVar <= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              {Math.abs(cacVar).toFixed(1)}% vs. anterior
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">LTV médio</div>
          <div className="stat-value" style={{ fontSize: 26, color: 'var(--indigo)' }}>{fmtBRL(ltv.ltv)}</div>
          {ltv.imaturos > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} />
              {ltv.pctMaturos}% completaram 12 meses
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">LTV : CAC</div>
          <div className="stat-value" style={{ fontSize: 26, color: ratioColor }}>{fmtRatio(ltvCacRatio)}</div>
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${ratioBadge}`} style={{ fontSize: 10 }}>{ratioLabel}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Leitores novos</div>
          <div className="stat-value" style={{ fontSize: 26, color: 'var(--green)' }}>{leitoresNovos.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Gasto total</div>
          <div className="stat-value" style={{ fontSize: 26 }}>{fmtBRL(cacBlended.totalGastos)}</div>
        </div>
      </div>

      {/* Nota LTV */}
      {ltv.ltv != null && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
          fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            LTV baseado em receita (não margem de contribuição).
            {ltv.imaturos > 0 && ` ${ltv.pctMaturos}% dos leitores já completaram a janela de 12 meses — o valor tende a subir.`}
            {ltvCacRatio != null && ' A razão LTV:CAC mede eficiência de mídia (CAC não inclui salários internos). Referência saudável: ≥ 3:1.'}
          </div>
        </div>
      )}

      {/* Gráfico de evolução mensal */}
      {evolucao.length > 0 && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-toolbar">
            <span className="table-title">Evolução mensal</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'cac', label: 'CAC', color: 'var(--accent)' },
                { key: 'ltv', label: 'LTV', color: 'var(--indigo)' },
                { key: 'leitores', label: 'Leitores', color: 'var(--green)' },
              ].map(s => (
                <button key={s.key}
                  className={`btn btn-sm ${chartSeries[s.key] ? '' : 'btn-ghost'}`}
                  style={chartSeries[s.key] ? { background: s.color, color: '#fff', border: 'none' } : {}}
                  onClick={() => setChartSeries(prev => ({ ...prev, [s.key]: !prev[s.key] }))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 20, minHeight: 200 }}>
            <MiniChart data={evolucao} series={chartSeries} />
          </div>
        </div>
      )}

      {/* Tabela por loja */}
      {!lojaFiltro && tabelaLojas.length > 0 && (
        <TabelaLojas data={tabelaLojas} />
      )}

      {/* CAC por cupom */}
      {cacCupom.length > 0 && (
        <TabelaCupom data={cacCupom} />
      )}
    </div>
  )
}

// ── Gráfico de barras simples (SVG) ─────────────────────────
function MiniChart({ data, series }) {
  if (!data.length) return <div className="empty-state"><p>Sem dados para o gráfico</p></div>

  const W = 700, H = 180, PAD = 40, PADR = 20, PADT = 10, PADB = 30
  const chartW = W - PAD - PADR
  const chartH = H - PADT - PADB

  // Coletar valores para escalar
  const allVals = []
  if (series.cac) data.forEach(d => { if (d.cac != null) allVals.push(d.cac) })
  if (series.ltv) data.forEach(d => { if (d.ltv != null) allVals.push(d.ltv) })
  if (series.leitores) data.forEach(d => allVals.push(d.leitoresNovos))

  const maxVal = Math.max(...allVals, 1)
  const barW = Math.max(4, Math.min(24, chartW / data.length - 4))

  function yScale(v) { return PADT + chartH - (v / maxVal) * chartH }

  // Linhas para CAC e LTV
  function makeLine(key, color) {
    const pts = data
      .map((d, i) => ({ x: PAD + (i + 0.5) * (chartW / data.length), y: d[key] }))
      .filter(p => p.y != null)
    if (pts.length < 2) return null
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${yScale(p.y)}`).join(' ')
    return <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PAD} x2={W - PADR} y1={yScale(maxVal * pct)} y2={yScale(maxVal * pct)}
          stroke="var(--border)" strokeWidth={0.5} />
      ))}
      <line x1={PAD} x2={W - PADR} y1={yScale(0)} y2={yScale(0)} stroke="var(--border)" strokeWidth={0.5} />

      {/* Y axis labels */}
      {[0, 0.5, 1].map(pct => (
        <text key={pct} x={PAD - 6} y={yScale(maxVal * pct) + 4}
          fill="var(--text-muted)" fontSize={9} textAnchor="end">
          {series.leitores && !series.cac && !series.ltv
            ? Math.round(maxVal * pct)
            : (maxVal * pct).toFixed(0)}
        </text>
      ))}

      {/* Barras para leitores */}
      {series.leitores && data.map((d, i) => {
        const x = PAD + (i + 0.5) * (chartW / data.length) - barW / 2
        const h = (d.leitoresNovos / maxVal) * chartH
        return <rect key={i} x={x} y={yScale(d.leitoresNovos)} width={barW} height={Math.max(h, 0)}
          rx={2} fill="var(--green)" opacity={0.3} />
      })}

      {/* Linhas */}
      {series.cac && makeLine('cac', 'var(--accent)')}
      {series.ltv && makeLine('ltv', 'var(--indigo)')}

      {/* Dots */}
      {series.cac && data.map((d, i) => d.cac != null && (
        <circle key={'cac' + i} cx={PAD + (i + 0.5) * (chartW / data.length)} cy={yScale(d.cac)}
          r={3} fill="var(--accent)" />
      ))}
      {series.ltv && data.map((d, i) => d.ltv != null && (
        <circle key={'ltv' + i} cx={PAD + (i + 0.5) * (chartW / data.length)} cy={yScale(d.ltv)}
          r={3} fill="var(--indigo)" />
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={PAD + (i + 0.5) * (chartW / data.length)} y={H - 4}
          fill="var(--text-muted)" fontSize={9} textAnchor="middle">
          {d.mesLabel}
        </text>
      ))}
    </svg>
  )
}

// ── Tabela por loja ──────────────────────────────────────────
function TabelaLojas({ data }) {
  const [sortKey, setSortKey] = useState('loja')
  const [sortAsc, setSortAsc] = useState(true)

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortAsc ? va - vb : vb - va
  })

  const th = (key, label) => (
    <th onClick={() => toggleSort(key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="table-card" style={{ marginBottom: 24 }}>
      <div className="table-toolbar">
        <span className="table-title">Resumo por loja</span>
      </div>
      <table>
        <thead>
          <tr>
            {th('loja', 'Loja')}
            {th('leitoresNovos', 'Leitores novos')}
            {th('gastoTotal', 'Gasto total')}
            {th('cac', 'CAC blended')}
            {th('ltv', 'LTV médio')}
            {th('ratio', 'LTV:CAC')}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const rc = r.ratio == null ? 'var(--text-muted)' :
              r.ratio < 1 ? 'var(--red)' : r.ratio < 3 ? 'var(--amber)' : 'var(--green)'
            return (
              <tr key={r.loja}>
                <td className="td-strong">{r.loja}</td>
                <td>{r.leitoresNovos}</td>
                <td>{fmtBRL(r.gastoTotal)}</td>
                <td>{fmtBRL(r.cac)}</td>
                <td>{fmtBRL(r.ltv)}</td>
                <td style={{ color: rc, fontWeight: 600 }}>{fmtRatio(r.ratio)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabela CAC por cupom ─────────────────────────────────────
function TabelaCupom({ data }) {
  return (
    <div className="table-card" style={{ marginBottom: 24 }}>
      <div className="table-toolbar">
        <span className="table-title">CAC por campanha (cupom)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cupom</th>
            <th>Leitores novos</th>
            <th>Gasto da campanha</th>
            <th>CAC campanha</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.cupom}>
              <td className="td-strong">{r.cupom}</td>
              <td>{r.leitores}</td>
              <td>{r.gasto > 0 ? fmtBRL(r.gasto) : <span className="td-muted">Sem gasto vinculado</span>}</td>
              <td>{fmtBRL(r.cac)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{
        padding: '10px 20px', fontSize: 11, color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start',
      }}>
        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        CAC por campanha via cupom é um teto conservador — leitores que vieram pela campanha sem usar cupom não são contados aqui.
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: GASTOS
// ══════════════════════════════════════════════════════════════
function TabGastos({ gastos, gastosFiltrados, lojas, lojaFiltro, periodo, onRefresh, showToast }) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ loja: '', mes_referencia: '', categoria: 'anuncio', descricao: '', valor: '' })

  function abrirNovo() {
    setEditando(null)
    setForm({
      loja: lojaFiltro || (lojas[0] || ''),
      mes_referencia: toISODate(periodo.inicio).slice(0, 7), // yyyy-mm
      categoria: 'anuncio',
      descricao: '',
      valor: '',
    })
    setShowModal(true)
  }

  function abrirEditar(g) {
    setEditando(g)
    setForm({
      loja: g.loja,
      mes_referencia: g.mes_referencia?.slice(0, 7) || '',
      categoria: g.categoria,
      descricao: g.descricao || '',
      valor: String(g.valor),
    })
    setShowModal(true)
  }

  async function salvar() {
    if (!form.loja || !form.mes_referencia || !form.valor) {
      showToast('Preencha loja, mês e valor', 'error'); return
    }
    setSaving(true)
    try {
      const payload = {
        loja: form.loja,
        mes_referencia: form.mes_referencia + '-01',
        categoria: form.categoria,
        descricao: form.descricao || null,
        valor: parseFloat(form.valor.replace(',', '.')),
      }
      if (editando) {
        await editarGasto(editando.id, payload)
        showToast('Gasto atualizado')
      } else {
        await inserirGasto(payload)
        showToast('Gasto adicionado')
      }
      setShowModal(false)
      await onRefresh()
    } catch (err) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir() {
    if (!confirmExcluir) return
    try {
      await excluirGasto(confirmExcluir.id)
      showToast('Gasto excluído')
      setConfirmExcluir(null)
      await onRefresh()
    } catch (err) {
      showToast('Erro: ' + err.message, 'error')
    }
  }

  return (
    <div>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Gastos de aquisição</span>
          <button className="btn btn-primary btn-sm" onClick={abrirNovo}>
            <Plus size={14} /> Novo gasto
          </button>
        </div>

        {gastosFiltrados.length === 0 ? (
          <div className="empty-state"><p>Nenhum gasto encontrado no período selecionado</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Mês ref.</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(g => (
                <tr key={g.id}>
                  <td className="td-strong">{g.loja}</td>
                  <td>{fmtMesAno(g.mes_referencia)}</td>
                  <td>
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>
                      {(CATEGORIAS_GASTO.find(c => c.value === g.categoria) || { label: g.categoria }).label}
                    </span>
                  </td>
                  <td className="td-muted">{g.descricao || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtBRL(g.valor)}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-ghost btn-icon" onClick={() => abrirEditar(g)} title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => setConfirmExcluir(g)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal novo/editar gasto */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar gasto' : 'Novo gasto'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Loja</label>
                <select className="form-select" value={form.loja} onChange={e => setForm({ ...form, loja: e.target.value })}>
                  <option value="">Selecione</option>
                  {lojas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mês referência</label>
                  <input type="month" className="form-input" value={form.mes_referencia}
                    onChange={e => setForm({ ...form, mes_referencia: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select className="form-select" value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIAS_GASTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input type="text" className="form-input" placeholder="Ex: Meta Ads junho"
                  value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input type="text" className="form-input" placeholder="0,00"
                  value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                  {saving ? 'Salvando...' : (editando ? 'Salvar' : 'Adicionar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmExcluir && (
        <div className="modal-backdrop" onClick={() => setConfirmExcluir(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 className="modal-title">Excluir gasto?</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--text-soft)', fontSize: 13.5, marginBottom: 20 }}>
              {confirmExcluir.descricao || CATEGORIAS_GASTO.find(c => c.value === confirmExcluir.categoria)?.label} — {fmtBRL(confirmExcluir.valor)}
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--red)' }} onClick={handleExcluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: IMPORTAÇÃO
// ══════════════════════════════════════════════════════════════
function TabImportacao({ importacoes, resumo, lojas, onRefresh, showToast }) {
  const [showUpload, setShowUpload] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  async function handleExcluirLote() {
    if (!confirmExcluir) return
    setExcluindo(true)
    try {
      await excluirLoteImportacao(confirmExcluir.id)
      showToast('Lote excluído com sucesso')
      setConfirmExcluir(null)
      await onRefresh()
    } catch (err) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div>
      {/* Resumo */}
      {resumo && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total de pedidos</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{resumo.totalPedidos.toLocaleString('pt-BR')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Leitores únicos</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{resumo.leitoresUnicos.toLocaleString('pt-BR')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Período coberto</div>
            <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 8, fontWeight: 600 }}>
              {fmtDate(resumo.dataMin)} — {fmtDate(resumo.dataMax)}
            </div>
          </div>
        </div>
      )}

      {/* Botão importar */}
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          <Upload size={15} /> Importar pedidos
        </button>
      </div>

      {/* Histórico de importações */}
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Histórico de importações</span>
        </div>

        {importacoes.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={32} strokeWidth={1.2} />
            <p style={{ marginTop: 8 }}>Nenhuma importação realizada</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Arquivo</th>
                <th>Loja</th>
                <th>Pedidos</th>
                <th>Leitores novos</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {importacoes.map(imp => (
                <tr key={imp.id}>
                  <td>{fmtDateTime(imp.importado_em)}</td>
                  <td className="td-strong">{imp.nome_arquivo || '—'}</td>
                  <td>{imp.loja || 'Várias'}</td>
                  <td>{imp.total_pedidos}</td>
                  <td>{imp.total_novos}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmExcluir(imp)}>
                        <Trash2 size={13} /> Excluir lote
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal upload */}
      {showUpload && (
        <ModalUpload
          lojas={lojas}
          onClose={() => setShowUpload(false)}
          onSuccess={async () => { setShowUpload(false); await onRefresh() }}
          showToast={showToast}
        />
      )}

      {/* Confirmação exclusão lote */}
      {confirmExcluir && (
        <div className="modal-backdrop" onClick={() => setConfirmExcluir(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">Excluir lote de importação?</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirmExcluir(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--text-soft)', fontSize: 13.5, marginBottom: 8 }}>
              Todos os <strong>{confirmExcluir.total_pedidos} pedidos</strong> do arquivo "{confirmExcluir.nome_arquivo}" serão removidos permanentemente.
            </p>
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--red)' }} onClick={handleExcluirLote} disabled={excluindo}>
                {excluindo ? 'Excluindo...' : 'Excluir lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODAL DE UPLOAD / IMPORTAÇÃO
// ══════════════════════════════════════════════════════════════
function ModalUpload({ lojas, onClose, onSuccess, showToast }) {
  const fileRef = useRef()
  const [step, setStep] = useState('select') // select → preview → importing → done
  const [fileName, setFileName] = useState('')
  const [lojaSelecionada, setLojaSelecionada] = useState('')
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [colMap, setColMap] = useState({})
  const [resultado, setResultado] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progresso, setProgresso] = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setProgresso('Lendo arquivo...')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (json.length < 2) {
          showToast('Planilha vazia ou sem dados', 'error')
          return
        }

        const hdrs = json[0].map(h => String(h).trim())
        const dataRows = json.slice(1).filter(r => r.some(cell => cell !== ''))

        setHeaders(hdrs)
        setRows(dataRows)

        const map = mapearColunas(hdrs)
        setColMap(map)

        // Validar colunas obrigatórias
        const missing = []
        if (map.numero_pedido == null) missing.push('Número do pedido')
        if (map.email == null) missing.push('E-mail')
        if (map.data_pedido == null) missing.push('Data do pedido')
        if (map.valor == null) missing.push('Valor')
        if (map.loja == null && !lojaSelecionada) missing.push('Loja (selecione no campo acima ou inclua na planilha)')

        if (missing.length) {
          showToast('Colunas não encontradas: ' + missing.join(', '), 'error')
          return
        }

        setStep('preview')
        setProgresso('')
      } catch (err) {
        showToast('Erro ao ler arquivo: ' + err.message, 'error')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function processarEImportar() {
    setStep('importing')
    setImporting(true)
    setProgresso('Verificando duplicados...')

    try {
      // Pegar números de pedido existentes
      const numeros = rows.map(r => String(r[colMap.numero_pedido] || '').trim()).filter(Boolean)
      const existentes = await getNumeroPedidosExistentes(numeros)

      setProgresso('Processando linhas e gerando hashes...')
      const result = await processarLinhas(rows, colMap, existentes, lojaSelecionada)

      if (result.pedidos.length === 0) {
        setResultado({ ...result, importados: 0 })
        setStep('done')
        return
      }

      setProgresso(`Importando ${result.pedidos.length} pedidos...`)
      const { inseridos, totalNovos } = await importarPedidos(
        result.pedidos, result.loteId, fileName, lojaSelecionada || null
      )

      setResultado({ ...result, importados: inseridos, totalNovosReal: totalNovos })
      setStep('done')
    } catch (err) {
      showToast('Erro na importação: ' + err.message, 'error')
      setStep('preview')
    } finally {
      setImporting(false)
    }
  }

  const previewRows = rows.slice(0, 5)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {step === 'select' && 'Importar pedidos'}
            {step === 'preview' && 'Pré-visualização'}
            {step === 'importing' && 'Importando...'}
            {step === 'done' && 'Importação concluída'}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* STEP: SELECT */}
        {step === 'select' && (
          <div>
            <p style={{ color: 'var(--text-soft)', fontSize: 13.5, marginBottom: 16 }}>
              Selecione o arquivo .xlsx ou .csv exportado do ERP. A planilha será processada
              no navegador — nenhum dado pessoal é enviado ao servidor.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Loja (se todos os pedidos forem da mesma loja)</label>
              <input
                type="text"
                className="form-input"
                list="lojas-import-select"
                placeholder="Deixe vazio para usar coluna da planilha"
                value={lojaSelecionada}
                onChange={e => setLojaSelecionada(e.target.value)}
              />
              <datalist id="lojas-import-select">
                {(lojas || []).map(l => <option key={l} value={l} />)}
              </datalist>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Se a planilha já tiver coluna "Livraria" ou "Loja", pode deixar em branco.
              </span>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--surface-2)', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <FileSpreadsheet size={32} strokeWidth={1.2} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p style={{ color: 'var(--text-soft)', fontSize: 13.5 }}>Clique para selecionar um arquivo</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>.xlsx ou .csv</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: 'none' }}
              onChange={handleFile} />
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div>
            <div style={{
              background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: 'var(--text-soft)',
            }}>
              <strong>{fileName}</strong> — {rows.length} linhas encontradas
              {lojaSelecionada && (
                <span style={{ marginLeft: 8 }}>
                  <span className="badge badge-accent" style={{ fontSize: 10 }}>Loja: {lojaSelecionada}</span>
                </span>
              )}
            </div>

            {/* Loja override no preview também */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Loja</label>
              <input
                type="text"
                className="form-input"
                list="lojas-import-preview"
                placeholder="Deixe vazio para usar coluna da planilha"
                value={lojaSelecionada}
                onChange={e => setLojaSelecionada(e.target.value)}
              />
              <datalist id="lojas-import-preview">
                {(lojas || []).map(l => <option key={l} value={l} />)}
              </datalist>
            </div>

            {/* Mapeamento de colunas */}
            <div style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Mapeamento de colunas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(colMap).map(([campo, idx]) => (
                  <span key={campo} className="badge badge-green" style={{ fontSize: 10 }}>
                    <Check size={10} /> {campo} → "{headers[idx]}"
                  </span>
                ))}
                {['cupom', 'cidade_estado', 'metodo_pagamento'].filter(c => colMap[c] == null).map(c => (
                  <span key={c} className="badge badge-gray" style={{ fontSize: 10 }}>
                    {c} (não encontrado)
                  </span>
                ))}
              </div>
            </div>

            {/* Preview tabela */}
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} style={{
                        fontSize: 10, padding: '6px 10px', whiteSpace: 'nowrap',
                        background: Object.values(colMap).includes(i) ? 'var(--accent-glow)' : 'var(--surface-2)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, ri) => (
                    <tr key={ri}>
                      {headers.map((_, ci) => (
                        <td key={ci} style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                          {ci === colMap.email ? '••••@••••' : String(r[ci] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{
              background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: 'var(--green)', display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <Info size={14} />
              Os e-mails serão convertidos em hash SHA-256 antes do envio. Nome do cliente será descartado.
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => { setStep('select'); setRows([]); setHeaders([]) }}>Voltar</button>
              <button className="btn btn-primary" onClick={processarEImportar}>
                Processar e importar
              </button>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-soft)', fontSize: 13.5 }}>{progresso}</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && resultado && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Check size={40} style={{ color: 'var(--green)', marginBottom: 8 }} />
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-label">Importados</div>
                <div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{resultado.importados || resultado.pedidos?.length || 0}</div>
              </div>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-label">Duplicados (ignorados)</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{resultado.duplicados?.length || 0}</div>
              </div>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-label">Leitores novos</div>
                <div className="stat-value" style={{ fontSize: 22, color: 'var(--indigo)' }}>{resultado.leitoresNovos || 0}</div>
              </div>
            </div>

            {resultado.erros?.length > 0 && (
              <div style={{
                background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--red)',
              }}>
                <strong>{resultado.erros.length} linhas com erro</strong> (puladas):
                <div style={{ marginTop: 6, maxHeight: 100, overflowY: 'auto' }}>
                  {resultado.erros.slice(0, 10).map((e, i) => (
                    <div key={i}>Linha {e.linha}: {e.motivo}</div>
                  ))}
                  {resultado.erros.length > 10 && <div>... e mais {resultado.erros.length - 10}</div>}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={onSuccess}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
