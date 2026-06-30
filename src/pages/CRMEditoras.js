import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasParaCRM, getIndicadoresEditora, upsertIndicador, deleteIndicador,
  calcularClasse, getMesesDisponiveis, mesAnoLabel, MESES_LABEL, getAllIndicadoresMes,
} from '../lib/crm-editoras'
import { Building2, Plus, X, Pencil, Trash2, ChevronDown, BarChart2 } from 'lucide-react'

// ── CORES DAS CLASSES ──────────────────────────────────────
const CLASSE_COR = {
  A: { cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  B: { cor: '#84cc16', bg: 'rgba(132,204,22,0.12)'  },
  C: { cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  D: { cor: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  E: { cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  F: { cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}

function BadgeClasse({ classe }) {
  if (!classe) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
  const c = CLASSE_COR[classe] || CLASSE_COR.F
  return (
    <span style={{
      fontWeight: 800, fontSize: 13, color: c.cor,
      background: c.bg, border: `1px solid ${c.cor}40`,
      borderRadius: 6, padding: '2px 10px', display: 'inline-block',
    }}>{classe}</span>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

// ── FAIXA DE VENDAS ────────────────────────────────────────
const FAIXAS = [
  { label: '> 100',        min: 101, max: 9999, valor: 110 },
  { label: '80 a 99',     min: 80,  max: 99,   valor: 89  },
  { label: '60 a 79',     min: 60,  max: 79,   valor: 69  },
  { label: '40 a 59',     min: 40,  max: 59,   valor: 49  },
  { label: '20 a 39',     min: 20,  max: 39,   valor: 29  },
  { label: '0 a 19',      min: 0,   max: 19,   valor: 9   },
]

// ── MODAL REGISTRAR INDICADOR ──────────────────────────────
function ModalIndicador({ editora, indicador, onSave, onClose }) {
  const hoje = new Date()
  const [mes, setMes] = useState(indicador?.mes || hoje.getMonth() + 1)
  const [ano, setAno] = useState(indicador?.ano || hoje.getFullYear())
  const [faixaIdx, setFaixaIdx] = useState(() => {
    if (!indicador) return 0
    const v = indicador.vendas_livraria || 0
    return FAIXAS.findIndex(f => v >= f.min && v <= f.max) ?? 0
  })
  const [whatsapp, setWhatsapp] = useState(indicador?.whatsapp_corresponde ?? true)
  const [observacao, setObservacao] = useState(indicador?.observacao || '')
  const [saving, setSaving] = useState(false)

  const vendas = FAIXAS[faixaIdx]?.valor || 0
  const classePreview = calcularClasse(vendas, whatsapp)
  const cor = CLASSE_COR[classePreview] || CLASSE_COR.F

  const mesesOpcoes = getMesesDisponiveis(24)

  async function salvar() {
    setSaving(true)
    try {
      await onSave({ editora_id: editora.id, ano, mes, vendas_livraria: vendas, whatsapp_corresponde: whatsapp, observacao })
      onClose()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Registrar indicadores</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{editora.nome}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-grid">

          {/* Mês/Ano */}
          <div className="form-group">
            <label className="form-label">Mês de referência</label>
            <select className="form-select" value={`${ano}-${mes}`}
              onChange={e => { const [a, m] = e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)) }}>
              {mesesOpcoes.map(({ mes: m, ano: a }) => (
                <option key={`${a}-${m}`} value={`${a}-${m}`}>{mesAnoLabel(m, a)}</option>
              ))}
            </select>
          </div>

          {/* Vendas — faixas */}
          <div className="form-group">
            <label className="form-label">Vendas da livraria no mês</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FAIXAS.map((f, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: `2px solid ${faixaIdx === i ? 'var(--accent)' : 'var(--border)'}`, background: faixaIdx === i ? 'var(--accent-glow)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="radio" name="faixa" checked={faixaIdx === i} onChange={() => setFaixaIdx(i)} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: faixaIdx === i ? 'var(--accent)' : 'var(--text)' }}>{f.label} unidades</span>
                </label>
              ))}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="form-group">
            <label className="form-label">Comunicação via WhatsApp</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ v: true, l: '✓ Corresponde' }, { v: false, l: '✗ Não corresponde' }].map(({ v, l }) => (
                <button key={String(v)} type="button" onClick={() => setWhatsapp(v)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid', transition: 'all 0.15s',
                    borderColor: whatsapp === v ? 'var(--accent)' : 'var(--border)',
                    background: whatsapp === v ? 'var(--accent-glow)' : 'transparent',
                    color: whatsapp === v ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Preview da classe */}
          <div style={{ padding: '14px 16px', background: cor.bg, border: `1px solid ${cor.cor}40`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: cor.cor }}>{classePreview}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cor.cor }}>Classe calculada</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {FAIXAS[faixaIdx]?.label} unidades · {whatsapp ? 'Corresponde' : 'Não corresponde'}
              </div>
            </div>
          </div>

          {/* Observação */}
          <div className="form-group">
            <label className="form-label">Observação <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea className="form-textarea" rows={2} value={observacao}
              onChange={e => setObservacao(e.target.value)} placeholder="Notas sobre este mês..." />
          </div>

        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar indicadores'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL HISTÓRICO DA EDITORA ─────────────────────────────
function ModalHistorico({ editora, onClose, onNovoIndicador }) {
  const [indicadores, setIndicadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    getIndicadoresEditora(editora.id).then(setIndicadores).finally(() => setLoading(false))
  }, [editora.id])

  async function salvar(dados) {
    const upd = await upsertIndicador(dados)
    setIndicadores(prev => {
      const exists = prev.find(i => i.ano === upd.ano && i.mes === upd.mes)
      if (exists) return prev.map(i => (i.ano === upd.ano && i.mes === upd.mes) ? upd : i)
      return [upd, ...prev]
    })
    onNovoIndicador(editora.id, upd.classe)
    showToast('Indicadores salvos!')
    setEditando(null)
  }

  async function excluir(ind) {
    if (!window.confirm('Excluir este registro?')) return
    await deleteIndicador(ind.id)
    setIndicadores(prev => prev.filter(i => i.id !== ind.id))
    showToast('Removido!')
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div>
            <h2 className="modal-title">{editora.nome}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Classificação atual:</span>
              <BadgeClasse classe={editora.classificacao} />
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setEditando('new')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Registrar mês
          </button>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> :
          indicadores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum indicador registrado ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {indicadores.map(ind => {
                const cor = CLASSE_COR[ind.classe] || CLASSE_COR.F
                return (
                  <div key={ind.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `4px solid ${cor.cor}`, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: cor.cor }}>{ind.classe}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{mesAnoLabel(ind.mes, ind.ano)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {FAIXAS.find(f => ind.vendas_livraria >= f.min && ind.vendas_livraria <= f.max)?.label || ind.vendas_livraria} un. · {ind.whatsapp_corresponde ? '✓ Corresponde' : '✗ Não corresponde'}
                          </div>
                          {ind.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ind.observacao}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditando(ind)}><Pencil size={12} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluir(ind)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>

      {editando && (
        <ModalIndicador
          editora={editora}
          indicador={editando === 'new' ? null : editando}
          onSave={salvar}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// ── ABA RANKING ────────────────────────────────────────────
function AbaRanking({ editoras, onAbrirHistorico, onNovoIndicador }) {
  const [busca, setBusca] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')
  const [modalNovo, setModalNovo] = useState(null)
  const [toast, showToast] = useToast()

  async function salvarRapido(dados) {
    const upd = await upsertIndicador(dados)
    onNovoIndicador(dados.editora_id, upd.classe)
    showToast('Indicadores salvos!')
    setModalNovo(null)
  }

  const lista = editoras.filter(e => {
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroClasse && e.classificacao !== filtroClasse) return false
    return true
  })

  const contadores = { A: 0, B: 0, C: 0, C: 0, D: 0, E: 0, F: 0 }
  for (const e of editoras) { if (e.classificacao) contadores[e.classificacao] = (contadores[e.classificacao] || 0) + 1 }
  const semClasse = editoras.filter(e => !e.classificacao).length

  return (
    <div>
      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 20 }}>
        {['A','B','C','D','E','F'].map(cl => {
          const c = CLASSE_COR[cl]
          return (
            <div key={cl} onClick={() => setFiltroClasse(filtroClasse === cl ? '' : cl)}
              style={{ background: filtroClasse === cl ? c.bg : 'var(--surface)', border: `2px solid ${filtroClasse === cl ? c.cor : 'var(--border)'}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: c.cor }}>{cl}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{contadores[cl] || 0}</div>
            </div>
          )
        })}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>S/ classe</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>{semClasse}</div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar editora..."
          style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
        {(busca || filtroClasse) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroClasse('') }}>
            <X size={12} /> Limpar
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{lista.length} editoras</span>
      </div>

      {/* Tabela */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)', width: 70 }}>Classe</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)' }}>Editora</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)', width: 100 }}>Status</th>
              <th style={{ padding: '10px 14px', borderBottom: '2px solid var(--border)', width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Nenhuma editora encontrada.</td></tr>
            ) : lista.map((e, i) => (
              <tr key={e.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={el => el.currentTarget.style.background = 'var(--accent-glow)'}
                onMouseLeave={el => el.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)'}>
                <td style={{ padding: '10px 14px' }}>
                  <BadgeClasse classe={e.classificacao} />
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>{e.nome}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, color: e.status_parceria === 'ativa' ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                    {e.status_parceria || 'ativa'}
                  </span>
                </td>
                <td style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModalNovo(e)}
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={11} /> Registrar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => onAbrirHistorico(e)}
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BarChart2 size={11} /> Histórico
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNovo && (
        <ModalIndicador editora={modalNovo} indicador={null} onSave={salvarRapido} onClose={() => setModalNovo(null)} />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── ABA MENSAL ─────────────────────────────────────────────
function AbaMensal({ editoras, onNovoIndicador }) {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalNovo, setModalNovo] = useState(null)
  const [toast, showToast] = useToast()

  const mesesOpcoes = getMesesDisponiveis(24)

  useEffect(() => {
    setLoading(true)
    getAllIndicadoresMes(ano, mes).then(setDados).finally(() => setLoading(false))
  }, [mes, ano])

  async function salvar(dados) {
    const upd = await upsertIndicador(dados)
    setDados(prev => {
      const exists = prev.find(d => d.editora_id === upd.editora_id)
      if (exists) return prev.map(d => d.editora_id === upd.editora_id ? upd : d)
      return [...prev, upd]
    })
    onNovoIndicador(dados.editora_id, upd.classe)
    showToast('Indicadores salvos!')
    setModalNovo(null)
  }

  // Editoras sem registro neste mês
  const registradas = new Set(dados.map(d => d.editora_id))
  const semRegistro = editoras.filter(e => !registradas.has(e.id))

  return (
    <div>
      {/* Seletor de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Mês de referência:</span>
        <select className="form-select" style={{ width: 'auto' }} value={`${ano}-${mes}`}
          onChange={e => { const [a, m] = e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)) }}>
          {mesesOpcoes.map(({ mes: m, ano: a }) => (
            <option key={`${a}-${m}`} value={`${a}-${m}`}>{mesAnoLabel(m, a)}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dados.length} registros · {semRegistro.length} pendentes</span>
      </div>

      {/* Registradas */}
      {dados.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Registradas ({dados.length})
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)', width: 70 }}>Classe</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)' }}>Editora</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)' }}>Vendas</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', borderBottom: '2px solid var(--border)' }}>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {dados.sort((a, b) => {
                  const ord = ['A','B','C','D','E','F']
                  return (ord.indexOf(a.classe) - ord.indexOf(b.classe)) || (a.editoras_parceiras?.nome || '').localeCompare(b.editoras_parceiras?.nome || '', 'pt-BR')
                }).map((d, i) => (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px' }}><BadgeClasse classe={d.classe} /></td>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--text)' }}>{d.editoras_parceiras?.nome || '—'}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {FAIXAS.find(f => d.vendas_livraria >= f.min && d.vendas_livraria <= f.max)?.label || d.vendas_livraria} un.
                    </td>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>
                      <span style={{ color: d.whatsapp_corresponde ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {d.whatsapp_corresponde ? '✓ Corresponde' : '✗ Não corresponde'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pendentes */}
      {semRegistro.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Aguardando registro ({semRegistro.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {semRegistro.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BadgeClasse classe={e.classificacao} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.nome}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setModalNovo(e)}
                  style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={11} /> Registrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="loading"><div className="spinner" /></div>}

      {modalNovo && (
        <ModalIndicador editora={modalNovo} indicador={null} onSave={salvar} onClose={() => setModalNovo(null)} />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function CRMEditoras() {
  const { usuario } = useAuth()
  const [editoras, setEditoras] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('ranking')
  const [historico, setHistorico] = useState(null)

  useEffect(() => {
    getEditorasParaCRM().then(setEditoras).finally(() => setLoading(false))
  }, [])

  function onNovoIndicador(editora_id, novaClasse) {
    setEditoras(prev => {
      const updated = prev.map(e => e.id === editora_id ? { ...e, classificacao: novaClasse } : e)
      const ordem = ['A','B','C','D','E','F']
      return [...updated].sort((a, b) => {
        const ia = a.classificacao ? ordem.indexOf(a.classificacao) : 99
        const ib = b.classificacao ? ordem.indexOf(b.classificacao) : 99
        if (ia !== ib) return ia - ib
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })
    })
  }

  function tabStyle(ativa) {
    return {
      padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      border: 'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent',
      background: 'transparent', color: ativa ? 'var(--accent)' : 'var(--text-muted)',
      transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <Building2 size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Classificação — Editoras Parceiras</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {editoras.filter(e => e.classificacao).length} classificadas · {editoras.filter(e => !e.classificacao).length} sem classe
          </p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <button style={tabStyle(aba === 'ranking')} onClick={() => setAba('ranking')}>
          <BarChart2 size={14} /> Ranking
        </button>
        <button style={tabStyle(aba === 'mensal')} onClick={() => setAba('mensal')}>
          Registro mensal
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {aba === 'ranking' && (
            <AbaRanking
              editoras={editoras}
              onAbrirHistorico={setHistorico}
              onNovoIndicador={onNovoIndicador}
            />
          )}
          {aba === 'mensal' && (
            <AbaMensal
              editoras={editoras}
              onNovoIndicador={onNovoIndicador}
            />
          )}
        </>
      )}

      {historico && (
        <ModalHistorico
          editora={historico}
          onClose={() => setHistorico(null)}
          onNovoIndicador={onNovoIndicador}
        />
      )}
    </div>
  )
}
