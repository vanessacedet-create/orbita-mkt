// src/components/crm/TabelaAtivos.js
// Tabela de parceiros ativos com tier, performance e alerta de promoção
// Uso: <TabelaAtivos onOpenParceiro={fn} />

import { useEffect, useState } from 'react'
import {
  getParceirosComTier, updateTier, updateSituacao,
  TIERS, TIER_ORDER, MODELOS_COM_ESCADA,
} from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import BadgeTier, { BadgeSituacao, ProgressoTier } from './BadgeTier'
import {
  Search, ArrowUp, Filter, X, Users,
  Instagram, Youtube, ChevronUp,
} from 'lucide-react'

const PLATAFORMAS = ['Instagram', 'TikTok', 'YouTube', 'Blog', 'Twitter/X', 'Pinterest', 'Kwai']

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 4000) }
  return [t, show]
}

// ── CARD DE MÉTRICA ───────────────────────────────────────
function MetricCard({ label, value, cor }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      minWidth: 100,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor || 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── MODAL DE PROMOÇÃO ─────────────────────────────────────
function ModalPromocao({ parceiro, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const promo = parceiro.pronto_para_subir
  if (!promo) return null

  const proximoTier = TIERS[promo.proximo]

  async function confirmar() {
    setSaving(true)
    try {
      await onConfirm(parceiro.id, promo.proximo, motivo || promo.motivo)
      onClose()
    } catch { /* handled by parent */ }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Promover parceiro</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            {parceiro.nome}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <BadgeTier tier={parceiro.tier} size="lg" />
            <ArrowUp size={18} color="#22c55e" />
            <BadgeTier tier={promo.proximo} size="lg" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            {promo.motivo}
          </div>
        </div>

        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 6 }}>
            Benefícios do nível {proximoTier.label}:
          </strong>
          {proximoTier.beneficios}
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Observação (opcional)</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: parceiro consistente nos últimos 2 meses..."
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={confirmar}
            disabled={saving}
            style={{ background: '#22c55e', borderColor: '#22c55e' }}
          >
            {saving ? 'Promovendo...' : `Promover para ${proximoTier.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────
export default function TabelaAtivos({ onOpenParceiro }) {
  const { usuario } = useAuth()
  const [parceiros, setParceiros] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTier, setFiltroTier] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('ativo')
  const [filtroPlat, setFiltroPlat] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [modalPromocao, setModalPromocao] = useState(null)
  const [toast, showToast] = useToast()

  async function carregar() {
    setLoading(true)
    try {
      const data = await getParceirosComTier()
      setParceiros(data)
    } catch (e) {
      console.error('Erro ao carregar parceiros com tier:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function handlePromover(parceiroId, novoTier, motivo) {
    try {
      await updateTier(parceiroId, novoTier, motivo, usuario?.id)
      showToast(`Parceiro promovido para ${TIERS[novoTier].label}!`)
      await carregar()
    } catch (e) {
      showToast('Erro ao promover', 'error')
    }
  }

  // ── Filtros ──
  const filtrados = parceiros.filter(p => {
    const q = search.toLowerCase()
    if (q && !(
      (p.nome || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q)
    )) return false
    if (filtroTier === 'livraria' && p.tier) return false
    if (filtroTier && filtroTier !== 'livraria' && p.tier !== filtroTier) return false
    if (filtroSituacao && p.situacao !== filtroSituacao) return false
    if (filtroPlat && !(p.platforms || []).includes(filtroPlat)) return false
    if (filtroResp && p.responsavel_interno_id !== filtroResp) return false
    return true
  })

  const temFiltro = filtroTier || filtroPlat || filtroResp || filtroSituacao !== 'ativo'

  // ── Métricas ──
  const ativos = parceiros.filter(p => p.situacao === 'ativo')
  const totalVendasMes = ativos.reduce((s, p) => s + (p.vendas_mes || 0), 0)
  const prontosParaSubir = ativos.filter(p => p.pronto_para_subir).length
  const porTier = {
    ouro: ativos.filter(p => p.tier === 'ouro').length,
    prata: ativos.filter(p => p.tier === 'prata').length,
    bronze: ativos.filter(p => p.tier === 'bronze').length,
    livraria: ativos.filter(p => !p.tier).length,
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
        <MetricCard label="Vendas este mês" value={totalVendasMes} cor="var(--accent)" />
        <MetricCard
          label="Prontos para subir"
          value={prontosParaSubir}
          cor={prontosParaSubir > 0 ? '#22c55e' : 'var(--text-muted)'}
        />
        <MetricCard label="Ouro" value={porTier.ouro} cor={TIERS.ouro.cor} />
        <MetricCard label="Prata" value={porTier.prata} cor={TIERS.prata.cor} />
        <MetricCard label="Bronze" value={porTier.bronze} cor={TIERS.bronze.cor} />
        <MetricCard label="Livraria" value={porTier.livraria} cor="#8b5cf6" />
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
          value={filtroTier} onChange={e => setFiltroTier(e.target.value)}>
          <option value="">Todos os tiers</option>
          {TIER_ORDER.map(t => (
            <option key={t} value={t}>{TIERS[t].label}</option>
          ))}
          <option value="livraria">Livraria</option>
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
          value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
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
            setFiltroTier(''); setFiltroSituacao('ativo'); setFiltroPlat(''); setFiltroResp('')
          }}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

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
                <th>Nome</th>
                <th>Tier</th>
                <th>Progresso</th>
                <th>Vendas/mês</th>
                <th>Vendas total</th>
                <th>Conteúdos</th>
                <th>Plataformas</th>
                <th>Responsável</th>
                <th>Situação</th>
                <th></th>
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
                  <td>
                    <div className="td-strong">{p.nome}</div>
                    {p.username && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.username}</div>
                    )}
                  </td>
                  <td>
                    {p.tier ? (
                      <BadgeTier
                        tier={p.tier}
                        prontoParaSubir={!!p.pronto_para_subir}
                      />
                    ) : (
                      <span style={{
                        display:'inline-flex',alignItems:'center',
                        background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.3)',
                        borderRadius:20,padding:'3px 12px',fontSize:12,fontWeight:700,color:'#8b5cf6',
                      }}>Livraria</span>
                    )}
                  </td>
                  <td>
                    <ProgressoTier parceiro={p} />
                  </td>
                  <td>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: (p.vendas_mes || 0) > 0 ? 'var(--text)' : 'var(--text-muted)',
                    }}>
                      {p.vendas_mes || 0}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {p.vendas_total || 0}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {p.conteudos_postados || 0}
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
                  <td>
                    {p.pronto_para_subir && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setModalPromocao(p) }}
                        style={{
                          color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.3)',
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ChevronUp size={12} /> Subir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de promoção */}
      {modalPromocao && (
        <ModalPromocao
          parceiro={modalPromocao}
          onConfirm={handlePromover}
          onClose={() => setModalPromocao(null)}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
