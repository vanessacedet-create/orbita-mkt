// src/components/crm/TabelaAtivos.js
// Tabela de parceiros ativos por tipo de parceria (Livraria / Book Time / Institucional)
// Uso: <TabelaAtivos onOpenParceiro={fn} />

import { useEffect, useState } from 'react'
import { getParceirosComTier, getUsuarios, updateParceirosLote } from '../../lib/supabase'
import { BadgeSituacao } from './BadgeTier'
import { Search, X } from 'lucide-react'

const PLATAFORMAS = ['Instagram', 'TikTok', 'YouTube', 'Blog', 'Twitter/X', 'Pinterest', 'Kwai']

// ── TIPO DE PARCERIA (derivado do modelo) ──
const TIPOS_PARCERIA = {
  1: { label: 'Livraria',      cor: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  2: { label: 'Book Time',     cor: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  3: { label: 'Institucional', cor: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}
function tipoParceriaInfo(model) { return TIPOS_PARCERIA[Number(model)] || null }

// ── CARD DE MÉTRICA ───────────────────────────────────────
function MetricCard({ label, value, cor }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
      minWidth: 130,
      flex: '0 0 auto',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor || 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── BADGE DE TIPO ─────────────────────────────────────────
function BadgeTipo({ model }) {
  const tp = tipoParceriaInfo(model)
  if (!tp) return <span className="td-muted">—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: tp.bg, border: `1px solid ${tp.cor}55`,
      borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, color: tp.cor,
    }}>{tp.label}</span>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────
export default function TabelaAtivos({ onOpenParceiro }) {
  const [parceiros, setParceiros] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('ativo')
  const [filtroPlat, setFiltroPlat] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [acaoMassa, setAcaoMassa] = useState(null) // 'responsavel' | 'tipo' | null
  const [valorMassa, setValorMassa] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const data = await getParceirosComTier()
      setParceiros(data)
    } catch (e) {
      console.error('Erro ao carregar parceiros ativos:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    getUsuarios().then(setUsuarios).catch(console.error)
  }, [])

  // ── Filtros ──
  const filtrados = parceiros.filter(p => {
    const q = search.toLowerCase()
    if (q && !(
      (p.nome || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q)
    )) return false
    if (filtroTipo && String(p.model) !== filtroTipo) return false
    if (filtroSituacao && p.situacao !== filtroSituacao) return false
    if (filtroPlat && !(p.platforms || []).includes(filtroPlat)) return false
    if (filtroResp && p.responsavel_interno_id !== filtroResp) return false
    return true
  })

  const temFiltro = filtroTipo || filtroPlat || filtroResp || filtroSituacao !== 'ativo'

  // ── Seleção em massa ──
  const idsVisiveis = filtrados.map(p => p.id)
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.has(id))
  const algunsSelecionados = idsVisiveis.some(id => selecionados.has(id))

  function toggleSelecionado(id) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleTodos() {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (todosSelecionados) idsVisiveis.forEach(id => next.delete(id))
      else idsVisiveis.forEach(id => next.add(id))
      return next
    })
  }
  function limparSelecao() {
    setSelecionados(new Set()); setAcaoMassa(null); setValorMassa('')
  }
  function escolherAcao(acao) {
    setAcaoMassa(acao); setValorMassa('')
  }
  async function aplicarMassa() {
    const ids = [...selecionados]
    if (!ids.length || !acaoMassa || valorMassa === '') return
    const updates = acaoMassa === 'responsavel'
      ? { responsavel_interno_id: valorMassa }
      : { model: Number(valorMassa) }
    setSalvando(true)
    try {
      await updateParceirosLote(ids, updates)
      await carregar()
      limparSelecao()
    } catch (e) {
      console.error('Erro na alteração em massa:', e)
      alert('Não foi possível aplicar a alteração em massa.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Métricas ──
  const ativos = parceiros.filter(p => p.situacao === 'ativo')
  const porTipo = {
    1: ativos.filter(p => Number(p.model) === 1).length,
    2: ativos.filter(p => Number(p.model) === 2).length,
    3: ativos.filter(p => Number(p.model) === 3).length,
  }

  // ── Responsáveis únicos (para filtro) ──
  const responsaveis = [...new Map(
    parceiros
      .filter(p => p.responsavel_interno_id && p.responsavel_interno_nome)
      .map(p => [p.responsavel_interno_id, p.responsavel_interno_nome])
  ).entries()]

  return (
    <div>
      {/* Métricas resumo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <MetricCard label="Parceiros ativos" value={ativos.length} />
        <MetricCard label="Livraria" value={porTipo[1]} cor={TIPOS_PARCERIA[1].cor} />
        <MetricCard label="Book Time" value={porTipo[2]} cor={TIPOS_PARCERIA[2].cor} />
        <MetricCard label="Institucional" value={porTipo[3]} cor={TIPOS_PARCERIA[3].cor} />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="Buscar por nome ou username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="1">Livraria</option>
          <option value="2">Book Time</option>
          <option value="3">Institucional</option>
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="encerrando">Encerrando</option>
          <option value="encerrado">Encerrado</option>
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          value={filtroPlat} onChange={e => setFiltroPlat(e.target.value)}>
          <option value="">Todas as plataformas</option>
          {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        {temFiltro && (
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setFiltroTipo(''); setFiltroSituacao('ativo'); setFiltroPlat(''); setFiltroResp('')
          }}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Barra de ação em massa */}
      {selecionados.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'var(--surface-2)', border: '1px solid var(--brand, var(--border))',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
          </span>

          {!acaoMassa && (
            <>
              <button className="btn btn-sm" onClick={() => escolherAcao('responsavel')}>
                Alterar responsável
              </button>
              <button className="btn btn-sm" onClick={() => escolherAcao('tipo')}>
                Alterar tipo de parceria
              </button>
            </>
          )}

          {acaoMassa === 'responsavel' && (
            <>
              <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
                value={valorMassa} onChange={e => setValorMassa(e.target.value)}>
                <option value="">Selecione o responsável…</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!valorMassa || salvando} onClick={aplicarMassa}>
                {salvando ? 'Aplicando…' : 'Aplicar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => escolherAcao(null)}>Voltar</button>
            </>
          )}

          {acaoMassa === 'tipo' && (
            <>
              <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
                value={valorMassa} onChange={e => setValorMassa(e.target.value)}>
                <option value="">Selecione o tipo…</option>
                <option value="1">Livraria</option>
                <option value="2">Book Time</option>
                <option value="3">Institucional</option>
              </select>
              <button className="btn btn-primary btn-sm" disabled={!valorMassa || salvando} onClick={aplicarMassa}>
                {salvando ? 'Aplicando…' : 'Aplicar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => escolherAcao(null)}>Voltar</button>
            </>
          )}

          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={limparSelecao}>
            <X size={12} /> Limpar seleção
          </button>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum parceiro encontrado{temFiltro ? ' com esses filtros' : ''}.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-toolbar">
            <span className="table-title">Parceiros ativos ({filtrados.length})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    ref={el => { if (el) el.indeterminate = algunsSelecionados && !todosSelecionados }}
                    onChange={toggleTodos}
                  />
                </th>
                <th>Nome</th>
                <th>Tipo de parceria</th>
                <th>Plataformas</th>
                <th>Responsável</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenParceiro && onOpenParceiro(p)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ width: 36 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSelecionado(p.id)}
                    />
                  </td>
                  <td>
                    <div className="td-strong">{p.nome}</div>
                    {p.username && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.username}</div>
                    )}
                  </td>
                  <td>
                    <BadgeTipo model={p.model} />
                  </td>
                  <td>
                    {(p.platforms || []).length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(p.platforms || []).slice(0, 3).map(pl => (
                          <span key={pl} style={{
                            fontSize: 10,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '1px 6px',
                            color: 'var(--text-muted)',
                          }}>{pl}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="td-muted">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.responsavel_interno_nome || <span className="td-muted">—</span>}
                  </td>
                  <td>
                    <BadgeSituacao situacao={p.situacao || 'ativo'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
