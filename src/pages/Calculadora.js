import { useState, useEffect } from 'react'
import { Calculator, Save, Pencil, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ── FAIXAS PADRÃO (baseado em FAIXAS_CREATORS) ────────────
const FAIXAS_DEFAULT = [
  { faixa: 1,  seg_min: 1000,    seg_max: 2000,    classe: 'C', comissao: 10, fixo: 0      },
  { faixa: 2,  seg_min: 2000,    seg_max: 3000,    classe: 'C', comissao: 10, fixo: 0      },
  { faixa: 3,  seg_min: 3000,    seg_max: 5000,    classe: 'C', comissao: 10, fixo: 0      },
  { faixa: 4,  seg_min: 5000,    seg_max: 7500,    classe: 'C', comissao: 10, fixo: 0      },
  { faixa: 5,  seg_min: 7500,    seg_max: 10000,   classe: 'C', comissao: 10, fixo: 0      },
  { faixa: 6,  seg_min: 10000,   seg_max: 15000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 7,  seg_min: 15000,   seg_max: 20000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 8,  seg_min: 20000,   seg_max: 30000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 9,  seg_min: 30000,   seg_max: 40000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 10, seg_min: 40000,   seg_max: 50000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 11, seg_min: 50000,   seg_max: 75000,   classe: 'B', comissao: 10, fixo: 0      },
  { faixa: 12, seg_min: 75000,   seg_max: 100000,  classe: 'B', comissao: 10, fixo: 100    },
  { faixa: 13, seg_min: 100000,  seg_max: 150000,  classe: 'A', comissao: 10, fixo: 150    },
  { faixa: 14, seg_min: 150000,  seg_max: 200000,  classe: 'A', comissao: 10, fixo: 200    },
  { faixa: 15, seg_min: 200000,  seg_max: 300000,  classe: 'A', comissao: 10, fixo: 250    },
  { faixa: 16, seg_min: 300000,  seg_max: 400000,  classe: 'A', comissao: 10, fixo: 300    },
  { faixa: 17, seg_min: 400000,  seg_max: 500000,  classe: 'A', comissao: 10, fixo: 350    },
  { faixa: 18, seg_min: 500000,  seg_max: 750000,  classe: 'A', comissao: 10, fixo: 400    },
  { faixa: 19, seg_min: 750000,  seg_max: 1000000, classe: 'A', comissao: 10, fixo: 450    },
  { faixa: 20, seg_min: 1000000, seg_max: 2000000, classe: 'A', comissao: 10, fixo: 500    },
]

// Multiplicadores por tipo de conteúdo e engajamento
const MULT_TIPO = {
  stories:      0.6,
  feed:         1.0,
  reels:        1.2,
  tiktok:       1.2,
  youtube:      1.5,
  shorts:       0.9,
  'twitter/x':  0.5,
}

const TIPOS_CONTENT = [
  { value: 'stories',   label: 'Stories' },
  { value: 'feed',      label: 'Feed' },
  { value: 'reels',     label: 'Reels' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'shorts',    label: 'Shorts' },
  { value: 'twitter/x', label: 'Twitter/X' },
]

// Multiplicador de engajamento
function multEngajamento(eng) {
  if (!eng || eng <= 0) return 1
  if (eng < 1)  return 0.8
  if (eng < 2)  return 0.9
  if (eng < 3)  return 1.0
  if (eng < 5)  return 1.1
  if (eng < 8)  return 1.2
  if (eng < 12) return 1.35
  return 1.5
}

function getFaixa(seguidores, faixas) {
  return faixas.find(f => seguidores >= f.seg_min && seguidores <= f.seg_max)
    || (seguidores > 2000000 ? faixas[faixas.length - 1] : faixas[0])
}

function calcular({ seguidores, engajamento, tipos, faixas }) {
  if (!seguidores || seguidores <= 0) return null
  const faixa = getFaixa(Number(seguidores), faixas)
  if (!faixa) return null

  const eng = Number(engajamento) || 0
  const multEng = multEngajamento(eng)

  // Valor base = comissão estimada (10% de lucro máximo teórico)
  const alcance = Number(seguidores) * 0.10
  const vendasMax = alcance * 0.01
  const lucroMax = vendasMax * 4 // R$4 de margem por venda (8% de R$50)
  const comissaoEstimada = lucroMax * (faixa.comissao / 100)

  // Proposta por tipo de conteúdo
  const propostas = tipos.map(tipo => {
    const multT = MULT_TIPO[tipo] || 1.0
    const valorBase = comissaoEstimada * multT * multEng
    const totalComFixo = valorBase + (faixa.fixo * multT)
    return {
      tipo,
      label: TIPOS_CONTENT.find(t => t.value === tipo)?.label || tipo,
      comissao: Math.round(faixa.comissao),
      fixo: Math.round(faixa.fixo * multT),
      valorTotal: Math.round(totalComFixo),
      valorMin: Math.round(totalComFixo * 0.7),
      valorMax: Math.round(totalComFixo * 1.3),
    }
  })

  return { faixa, propostas, multEng, eng }
}

// ── MODAL EDITAR FAIXAS (só admin) ────────────────────────
function ModalEditarFaixas({ faixas, onSave, onClose }) {
  const [editadas, setEditadas] = useState(faixas.map(f => ({ ...f })))

  function upd(i, field, val) {
    setEditadas(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: Number(val) } : f))
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
          <h2 className="modal-title">Editar Faixas de Creators</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '8px 0' }}>
          Premissas: Preço médio R$50 · Margem 8% (R$4/venda) · Alcance = 10% seguidores · Conversão máx = 1%
        </div>
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Seg. Mín</th>
              <th>Seg. Máx</th>
              <th>Classe</th>
              <th>Comissão %</th>
              <th>Fixo (R$)</th>
            </tr>
          </thead>
          <tbody>
            {editadas.map((f, i) => (
              <tr key={f.faixa}>
                <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{f.faixa}</td>
                <td><input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }} type="number" value={f.seg_min} onChange={e => upd(i, 'seg_min', e.target.value)} /></td>
                <td><input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }} type="number" value={f.seg_max} onChange={e => upd(i, 'seg_max', e.target.value)} /></td>
                <td>
                  <select className="form-select" style={{ padding: '4px 8px', fontSize: 11 }} value={f.classe} onChange={e => setEditadas(prev => prev.map((x, idx) => idx === i ? { ...x, classe: e.target.value } : x))}>
                    {['C', 'B', 'A'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td><input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }} type="number" value={f.comissao} onChange={e => upd(i, 'comissao', e.target.value)} /></td>
                <td><input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }} type="number" value={f.fixo} onChange={e => upd(i, 'fixo', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(editadas)}>Salvar faixas</button>
        </div>
      </div>
    </div>
  )
}


// ── ENTREGÁVEIS POR CLASSE ─────────────────────────────────
const ENTREGAVEIS = {
  C: {
    label: 'Micro creator (1k – 30k)',
    objetivo: 'Foco em volume e testes rápidos.',
    principal: {
      titulo: 'Proposta principal',
      cor: '#6366f1',
      entregas: [
        '2 vídeos verticais (15–35s) para ads',
        '5 hooks gravados (aberturas curtas, 2–4s)',
        'B-roll do livro (capa, folheando, páginas-chave)',
        'Direito de uso por 12 meses',
      ]
    },
    alternativa: {
      titulo: 'Alternativa',
      cor: '#f97316',
      entregas: [
        '1 Reel/TikTok (20–35s) com CTA',
        '3 stories no dia (com cupom) + 1 lembrete',
        'Cupom exclusivo (10% Book Time)',
        'Direito de uso por 12 meses',
      ]
    }
  },
  B: {
    label: 'Creator médio (30k – 150k)',
    objetivo: 'Qualidade + tração orgânica.',
    principal: {
      titulo: 'Proposta principal',
      cor: '#6366f1',
      entregas: [
        '2 vídeos UGC (15–35s) + 1 Reel/TikTok postado no perfil',
        '3 stories no dia (com cupom e CTA) + 1 lembrete',
        'Direito de uso por 12 meses',
      ]
    },
    alternativa: {
      titulo: 'Alternativa',
      cor: '#f97316',
      entregas: [
        '1 vídeo postado (Reel/TikTok 25–45s) com CTA',
        '3 stories + 1 story de lembrete no dia seguinte',
        'Cupom exclusivo (10% Book Time)',
      ]
    }
  },
  A: {
    label: 'Creator grande (150k+)',
    objetivo: 'Impacto e autoridade — ativação clara e objetiva.',
    principal: {
      titulo: 'Proposta principal',
      cor: '#6366f1',
      entregas: [
        '1 vídeo forte postado (45–75s) com CTA',
        '5–10 stories ao longo de 2 dias + 1 lembrete',
        'Cupom exclusivo (10% Book Time)',
      ]
    },
    alternativa: {
      titulo: 'Alternativa',
      cor: '#f97316',
      entregas: [
        '1 vídeo principal apresentando a livraria/seleção',
        '3–5 stories por semana (2 semanas) + destaque fixo',
        'Live curta opcional (15–30 min)',
      ]
    }
  }
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Calculadora() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador'

  const [faixas, setFaixas]             = useState(FAIXAS_DEFAULT)
  const [modalFaixas, setModalFaixas]   = useState(false)
  const [seguidores, setSeguidores]     = useState('')
  const [engajamento, setEngajamento]   = useState('')
  const [tipos, setTipos]               = useState(['reels'])
  const [resultado, setResultado]       = useState(null)
  const [mostrarFaixas, setMostrarFaixas] = useState(false)

  // Carrega faixas salvas do localStorage (persistência simples)
  useEffect(() => {
    try {
      const salvas = localStorage.getItem('orbita_faixas_creators')
      if (salvas) setFaixas(JSON.parse(salvas))
    } catch {}
  }, [])

  function toggleTipo(t) {
    setTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
    setResultado(null)
  }

  function calcularProposta() {
    const r = calcular({ seguidores: Number(seguidores), engajamento: Number(engajamento), tipos, faixas })
    setResultado(r)
  }

  function salvarFaixas(novasFaixas) {
    setFaixas(novasFaixas)
    localStorage.setItem('orbita_faixas_creators', JSON.stringify(novasFaixas))
    setModalFaixas(false)
  }

  const faixaAtual = seguidores ? getFaixa(Number(seguidores), faixas) : null
  const classeColors = { A: '#22c55e', B: '#f97316', C: '#6366f1' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Calculator size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Calculadora de Proposta</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Estime o valor de negociação com influencers
            </p>
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-ghost" onClick={() => setModalFaixas(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={14} /> Editar faixas
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Formulário */}
        <div className="table-card" style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Dados do influencer
          </h2>

          <div className="form-group">
            <label className="form-label">Número de seguidores *</label>
            <input className="form-input" type="number" value={seguidores}
              onChange={e => { setSeguidores(e.target.value); setResultado(null) }}
              placeholder="Ex: 150000" />
            {faixaAtual && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, background: `${classeColors[faixaAtual.classe]}20`, color: classeColors[faixaAtual.classe], border: `1px solid ${classeColors[faixaAtual.classe]}40`, borderRadius: 20, padding: '2px 10px' }}>
                  Classe {faixaAtual.classe}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Faixa {faixaAtual.faixa}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Taxa de engajamento (%)
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>opcional</span>
            </label>
            <input className="form-input" type="number" step="0.1" value={engajamento}
              onChange={e => { setEngajamento(e.target.value); setResultado(null) }}
              placeholder="Ex: 3.5" />
            {engajamento && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                Multiplicador: ×{multEngajamento(Number(engajamento)).toFixed(2)}
                {Number(engajamento) >= 5 && <span style={{ color: '#22c55e', marginLeft: 6 }}>✓ Alto engajamento</span>}
                {Number(engajamento) < 2 && Number(engajamento) > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>⚠ Engajamento baixo</span>}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Tipo(s) de conteúdo *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIPOS_CONTENT.map(t => (
                <button key={t.value} type="button" onClick={() => toggleTipo(t.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: '2px solid',
                    borderColor: tipos.includes(t.value) ? 'var(--accent)' : 'var(--border)',
                    background: tipos.includes(t.value) ? 'var(--accent-glow)' : 'transparent',
                    color: tipos.includes(t.value) ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={!seguidores || tipos.length === 0}
            onClick={calcularProposta}>
            <Calculator size={15} /> Calcular proposta
          </button>
        </div>

        {/* Resultado */}
        <div>
          {!resultado ? (
            <div className="table-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Calculator size={36} color="var(--border)" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Preencha os dados e clique em "Calcular proposta"
              </p>
            </div>
          ) : (
            <div>
              {/* Cabeçalho resultado */}
              <div className="table-card" style={{ padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Faixa {resultado.faixa.faixa}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, background: `${classeColors[resultado.faixa.classe]}20`, color: classeColors[resultado.faixa.classe], border: `1px solid ${classeColors[resultado.faixa.classe]}40`, borderRadius: 20, padding: '2px 10px' }}>
                    Classe {resultado.faixa.classe}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <div>Seguidores: <strong style={{ color: 'var(--text)' }}>{Number(seguidores).toLocaleString('pt-BR')}</strong></div>
                  <div>Engajamento: <strong style={{ color: 'var(--text)' }}>{engajamento ? `${engajamento}%` : 'Não informado'}</strong></div>
                  <div>Comissão padrão: <strong style={{ color: 'var(--text)' }}>{resultado.faixa.comissao}%</strong></div>
                  <div>Fixo base: <strong style={{ color: 'var(--text)' }}>{resultado.faixa.fixo > 0 ? `R$ ${resultado.faixa.fixo}` : '—'}</strong></div>
                </div>
              </div>

              {/* Propostas por tipo */}
              {resultado.propostas.map(p => (
                <div key={p.tipo} className="table-card" style={{ padding: '16px 20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="badge badge-indigo" style={{ fontSize: 12 }}>{p.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Comissão {p.comissao}% {p.fixo > 0 ? `+ R$ ${p.fixo} fixo` : '(sem fixo)'}
                    </span>
                  </div>

                  {/* Valor principal */}
                  <div style={{ textAlign: 'center', padding: '12px 0', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proposta sugerida</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                      R$ {p.valorTotal.toLocaleString('pt-BR')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Faixa de negociação: R$ {p.valorMin.toLocaleString('pt-BR')} – R$ {p.valorMax.toLocaleString('pt-BR')}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                    <span>🔽 Mínimo: <strong style={{ color: 'var(--text)' }}>R$ {p.valorMin.toLocaleString('pt-BR')}</strong></span>
                    <span>🎯 Sugerido: <strong style={{ color: 'var(--accent)' }}>R$ {p.valorTotal.toLocaleString('pt-BR')}</strong></span>
                    <span>🔼 Máximo: <strong style={{ color: 'var(--text)' }}>R$ {p.valorMax.toLocaleString('pt-BR')}</strong></span>
                  </div>
                </div>
              ))}

              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                * Estimativa baseada nas faixas internas. Ajuste conforme histórico e negociação.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Entregáveis por classe */}
      {resultado && (() => {
        const info = ENTREGAVEIS[resultado.faixa.classe]
        if (!info) return null
        return (
          <div className="table-card" style={{marginTop:16, padding:'20px 24px'}}>
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <h2 style={{fontSize:14,fontWeight:700,color:'var(--text)',margin:0}}>
                  📋 Entregáveis sugeridos
                </h2>
                <span style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 10px',color:'var(--text-muted)'}}>
                  {info.label}
                </span>
              </div>
              <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{info.objetivo}</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[info.principal, info.alternativa].map(op=>(
                <div key={op.titulo} style={{background:'var(--surface-2)',border:`1px solid ${op.cor}30`,borderLeft:`3px solid ${op.cor}`,borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:op.cor,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                    {op.titulo}
                  </div>
                  <ul style={{margin:0,padding:'0 0 0 16px',display:'flex',flexDirection:'column',gap:5}}>
                    {op.entregas.map((e,i)=>(
                      <li key={i} style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.5}}>{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Tabela de faixas (recolhível) */}
      <div className="table-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer' }}
          onClick={() => setMostrarFaixas(p => !p)}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Tabela de faixas ({faixas.length} faixas)</span>
          {mostrarFaixas ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
        {mostrarFaixas && (
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Faixa</th>
                <th>Seguidores</th>
                <th>Classe</th>
                <th>Comissão</th>
                <th>Fixo sugerido</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map(f => (
                <tr key={f.faixa}>
                  <td style={{ fontWeight: 700 }}>{f.faixa}</td>
                  <td className="td-muted">{f.seg_min.toLocaleString('pt-BR')} – {f.seg_max.toLocaleString('pt-BR')}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: classeColors[f.classe] }}>
                      {f.classe}
                    </span>
                  </td>
                  <td>{f.comissao}%</td>
                  <td style={{ color: f.fixo > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {f.fixo > 0 ? `R$ ${f.fixo}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalFaixas && isAdmin && (
        <ModalEditarFaixas faixas={faixas} onSave={salvarFaixas} onClose={() => setModalFaixas(false)} />
      )}
    </div>
  )
}
