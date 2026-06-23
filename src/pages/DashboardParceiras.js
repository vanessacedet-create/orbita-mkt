import { useEffect, useState } from 'react'
import { getDashboardStatsParceiras } from '../lib/campanhas'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Building2, CheckSquare, Megaphone, ChevronDown } from 'lucide-react'

const STATUS_TAREFA_LABEL = {
  pendente:     'Pendente',
  em_andamento: 'Em andamento',
  concluida:    'Concluída',
  cancelada:    'Cancelada',
}

const STATUS_CAMPANHA_LABEL = {
  planejamento:  'Planejada',
  em_andamento:  'Em andamento',
  concluida:     'Concluída',
  cancelada:     'Cancelada',
}

const STATUS_TAREFA_COR = {
  pendente:     '#f97316',
  em_andamento: '#6366f1',
  concluida:    '#22c55e',
  cancelada:    '#ef4444',
}

function FiltroDropdown({ label, valor, opcoes, onChange }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function fechar() { setOpen(false) }
    if (open) document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [open])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          fontWeight: 600, cursor: 'pointer',
          background: valor ? 'var(--accent-glow)' : 'var(--surface-2)',
          border: `1px solid ${valor ? 'rgba(224,96,48,0.4)' : 'var(--border)'}`,
          color: valor ? 'var(--accent)' : 'var(--text-muted)',
          borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
        }}>
        {valor ? (opcoes.find(o => o.v === valor)?.l || valor) : label}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 160, overflow: 'hidden',
        }}>
          <div
            onClick={() => { onChange(''); setOpen(false) }}
            style={{
              padding: '8px 12px', fontSize: 12, cursor: 'pointer',
              color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
              background: !valor ? 'var(--surface-2)' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = !valor ? 'var(--surface-2)' : 'transparent'}>
            Todos
          </div>
          {opcoes.map(o => (
            <div key={o.v} onClick={() => { onChange(o.v); setOpen(false) }}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                color: valor === o.v ? 'var(--accent)' : 'var(--text)',
                background: valor === o.v ? 'var(--accent-glow)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}
              onMouseEnter={e => { if (valor !== o.v) e.currentTarget.style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = valor === o.v ? 'var(--accent-glow)' : 'transparent' }}>
              <span>{o.l}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{o.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardParceiras() {
  const { usuario } = useAuth()
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim]       = useState('')
  const [filtroTarefaStatus, setFiltroTarefaStatus] = useState('')
  const [filtroCampStatus,   setFiltroCampStatus]   = useState('')
  const [filtroCampTipo,     setFiltroCampTipo]     = useState('')

  useEffect(() => {
    setLoading(true)
    getDashboardStatsParceiras({
      dataInicio: dataInicio || undefined,
      dataFim:    dataFim    || undefined,
    })
      .then(s => setStats(s))
      .finally(() => setLoading(false))
  }, [dataInicio, dataFim])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const totalTarefasFiltradas = (() => {
    if (!stats) return 0
    if (filtroTarefaStatus) return stats.tarefasPorStatus?.[filtroTarefaStatus] ?? 0
    return stats.totalTarefas
  })()

  const totalCampanhasFiltradas = (() => {
    if (!stats) return 0
    if (filtroCampStatus) return stats.campanhasPorStatus?.[filtroCampStatus] ?? 0
    if (filtroCampTipo)   return stats.campanhasPorTipo?.[filtroCampTipo]     ?? 0
    return stats.totalCampanhas
  })()

  const opcoesTarefaStatus = Object.entries(stats?.tarefasPorStatus || {}).map(([v, count]) => ({
    v, l: STATUS_TAREFA_LABEL[v] || v, count,
  }))
  const opcoesCampStatus = Object.entries(stats?.campanhasPorStatus || {}).map(([v, count]) => ({
    v, l: STATUS_CAMPANHA_LABEL[v] || v, count,
  }))
  const opcoesCampTipo = Object.entries(stats?.campanhasPorTipo || {}).map(([v, count]) => ({
    v, l: v, count,
  }))

  const totalT       = stats?.totalTarefas || 0
  const concluidasT  = stats?.tarefasPorStatus?.concluida || 0
  const pctConcluidas = totalT > 0 ? Math.round((concluidasT / totalT) * 100) : 0

  return (
    <div>

      {/* Cabeçalho */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LayoutDashboard size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {saudacao}, {usuario?.nome?.split(' ')[0]} 👋
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Dashboard — Editoras Parceiras
            </p>
          </div>
        </div>
      </div>

      {/* Filtro de período */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          📅 Período
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>De</label>
            <input
              type="date" className="form-input"
              style={{ padding: '5px 10px', fontSize: 12, width: 140 }}
              value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Até</label>
            <input
              type="date" className="form-input"
              style={{ padding: '5px 10px', fontSize: 12, width: 140 }}
              value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          {(dataInicio || dataFim) && (
            <button
              onClick={() => { setDataInicio(''); setDataFim('') }}
              style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Limpar período
            </button>
          )}
        </div>
        {(dataInicio || dataFim) && (
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
            {dataInicio && dataFim
              ? `${dataInicio.split('-').reverse().join('/')} → ${dataFim.split('-').reverse().join('/')}`
              : dataInicio
                ? `A partir de ${dataInicio.split('-').reverse().join('/')}`
                : `Até ${dataFim.split('-').reverse().join('/')}`}
          </span>
        )}
      </div>

      {/* 3 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>

        {/* EDITORAS PARCEIRAS */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderTop: '3px solid var(--accent)', borderRadius: 10, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Editoras Parceiras
            </span>
            <Building2 size={16} color="var(--accent)" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', lineHeight: 1, marginBottom: 8 }}>
            {loading ? '—' : stats?.totalEditoras ?? 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            editoras cadastradas
          </div>
        </div>

        {/* TAREFAS */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderTop: '3px solid #6366f1', borderRadius: 10, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Tarefas
            </span>
            <CheckSquare size={16} color="#6366f1" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#6366f1', lineHeight: 1, marginBottom: 14 }}>
            {loading ? '—' : totalTarefasFiltradas}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FiltroDropdown
              label="Status"
              valor={filtroTarefaStatus}
              opcoes={opcoesTarefaStatus}
              onChange={v => setFiltroTarefaStatus(v)} />
          </div>
          {filtroTarefaStatus && (
            <button
              onClick={() => setFiltroTarefaStatus('')}
              style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Limpar filtro
            </button>
          )}
        </div>

        {/* CAMPANHAS */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderTop: '3px solid #f97316', borderRadius: 10, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Campanhas
            </span>
            <Megaphone size={16} color="#f97316" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#f97316', lineHeight: 1, marginBottom: 14 }}>
            {loading ? '—' : totalCampanhasFiltradas}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FiltroDropdown
              label="Status"
              valor={filtroCampStatus}
              opcoes={opcoesCampStatus}
              onChange={v => { setFiltroCampStatus(v); setFiltroCampTipo('') }} />
            <FiltroDropdown
              label="Tipo"
              valor={filtroCampTipo}
              opcoes={opcoesCampTipo}
              onChange={v => { setFiltroCampTipo(v); setFiltroCampStatus('') }} />
          </div>
          {(filtroCampStatus || filtroCampTipo) && (
            <button
              onClick={() => { setFiltroCampStatus(''); setFiltroCampTipo('') }}
              style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Limpar filtro
            </button>
          )}
        </div>

      </div>

      {/* Barra de progresso de tarefas */}
      {stats && stats.totalTarefas > 0 && (
        <div className="table-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Progresso das Tarefas
            </span>
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
              {pctConcluidas}% concluídas
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${pctConcluidas}%`, height: '100%', background: '#22c55e', transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(stats.tarefasPorStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: STATUS_TAREFA_COR[status] || '#888', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)' }}>{STATUS_TAREFA_LABEL[status] || status}</span>
                <strong style={{ color: STATUS_TAREFA_COR[status] || 'var(--text)' }}>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
