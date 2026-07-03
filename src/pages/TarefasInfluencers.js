import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  TIPOS_TAREFA, DIAS_SEMANA, objetivosPorTipo,
  hojeISO, semanaDeISO, addDiasISO,
  getMetasSemanais, salvarMetasSemanais,
  gerarVagasDoDia, gerarVagasDaSemana,
  getTarefasDoDia, getTarefasDaSemana,
  preencherVaga, concluirTarefa, reabrirTarefa, esvaziarVaga,
  getParceirosAtivos, getUsuarios,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  CheckSquare, X, Search, Settings2, ChevronLeft, ChevronRight,
  CheckCircle2, RotateCcw, Eraser, UserRound, Target, CalendarDays,
} from 'lucide-react'

const PERFIS_CONFIG = ['administrador', 'gerente', 'supervisor_influencers']

const OBJETIVO_LABEL = {
  novidade: 'Novidade', promocao: 'Promoção', conteudo: 'Conteúdo', reengajamento: 'Reengajamento',
}
const OBJETIVO_COR = {
  novidade: '#3b82f6', promocao: '#f97316', conteudo: '#a855f7', reengajamento: '#eab308',
}
const TIPO_LABEL = Object.fromEntries(TIPOS_TAREFA.map(t => [t.value, t.label]))

function labelDataISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ══════════════════════════════════════════════════════════
// MODAL: PREENCHER / EDITAR VAGA
// ══════════════════════════════════════════════════════════
function ModalPreencher({ tarefa, parceiros, usuarios, onSalvar, onFechar }) {
  const ehProspeccao = tarefa.tipo_tarefa === 'prospeccao'
  const objetivos = objetivosPorTipo(tarefa.tipo_tarefa)

  const [busca, setBusca] = useState('')
  const [parceiroId, setParceiroId] = useState(tarefa.parceiro_id || '')
  const [objetivo, setObjetivo] = useState(tarefa.objetivo || '')
  const [responsavelId, setResponsavelId] = useState(tarefa.responsavel_id || '')
  const [observacao, setObservacao] = useState(tarefa.observacao || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const parceirosFiltrados = useMemo(() => {
    if (!busca) return parceiros
    const t = busca.toLowerCase()
    return parceiros.filter(p => (p.nome || '').toLowerCase().includes(t))
  }, [busca, parceiros])

  function selecionarParceiro(p) {
    setParceiroId(p.id)
    setBusca('')
    // Pré-preenche o responsável a partir do cadastro do parceiro no CRM (editável)
    if (p.responsavel_interno_id) setResponsavelId(p.responsavel_interno_id)
  }

  const parceiroSel = parceiros.find(p => p.id === parceiroId)

  async function salvar() {
    setErro('')
    if (!ehProspeccao && !parceiroId) { setErro('Selecione o parceiro.'); return }
    if (!ehProspeccao && !objetivo) { setErro('Selecione o objetivo.'); return }
    if (!responsavelId) { setErro('Selecione o responsável.'); return }
    setSalvando(true)
    try {
      await onSalvar({
        parceiroId: ehProspeccao ? null : parceiroId,
        objetivo: ehProspeccao ? null : objetivo,
        responsavelId,
        observacao: observacao || null,
      })
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div onClick={onFechar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, width:'100%', maxWidth:460, maxHeight:'85vh', overflowY:'auto', padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:16 }}>
            {TIPO_LABEL[tarefa.tipo_tarefa]} — {labelDataISO(tarefa.data)}
          </h3>
          <button onClick={onFechar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>
        </div>

        {!ehProspeccao && (
          <>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Parceiro *</label>
            {parceiroSel ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, marginBottom:12 }}>
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{parceiroSel.nome}</span>
                <button onClick={() => setParceiroId('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ marginBottom:12 }}>
                <div style={{ position:'relative' }}>
                  <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                  <input
                    autoFocus type="text" placeholder="Buscar parceiro ativo..." value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px 8px 30px', border:'1px solid var(--border)', borderRadius:8, background:'transparent', color:'var(--text)', fontSize:13, outline:'none' }}
                  />
                </div>
                {busca && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:8, marginTop:4, maxHeight:180, overflowY:'auto' }}>
                    {parceirosFiltrados.length === 0 && (
                      <div style={{ padding:10, fontSize:12, color:'var(--text-muted)' }}>Nenhum parceiro ativo encontrado</div>
                    )}
                    {parceirosFiltrados.slice(0, 30).map(p => (
                      <button key={p.id} onClick={() => selecionarParceiro(p)}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 10px', background:'none', border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer', color:'var(--text)', fontSize:13 }}>
                        {p.nome}
                        {p.responsavel_interno_nome && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>· {p.responsavel_interno_nome}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Objetivo *</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
              {objetivos.map(o => (
                <button key={o.value} onClick={() => setObjetivo(o.value)}
                  style={{
                    padding:'6px 10px', borderRadius:8, fontSize:12, cursor:'pointer',
                    border:`1px solid ${objetivo === o.value ? OBJETIVO_COR[o.value] : 'var(--border)'}`,
                    background: objetivo === o.value ? `${OBJETIVO_COR[o.value]}22` : 'transparent',
                    color: objetivo === o.value ? OBJETIVO_COR[o.value] : 'var(--text)',
                    fontWeight: objetivo === o.value ? 600 : 400,
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>
          Responsável * {!ehProspeccao && parceiroSel?.responsavel_interno_id && responsavelId === parceiroSel.responsavel_interno_id && (
            <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(puxado do CRM — pode trocar)</span>
          )}
        </label>
        <select className="form-select" value={responsavelId} onChange={e => setResponsavelId(e.target.value)} style={{ width:'100%', marginBottom:12 }}>
          <option value="">Selecione...</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>

        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Observação</label>
        <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
          placeholder={ehProspeccao ? 'Ex: focar em perfis de literatura clássica no TikTok' : 'Detalhes da ação...'}
          style={{ width:'100%', boxSizing:'border-box', padding:8, border:'1px solid var(--border)', borderRadius:8, background:'transparent', color:'var(--text)', fontSize:13, resize:'vertical', marginBottom:12 }}
        />

        {erro && <div style={{ color:'#ef4444', fontSize:12, marginBottom:10 }}>{erro}</div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onFechar} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL: CONFIGURAR META SEMANAL
// ══════════════════════════════════════════════════════════
function ModalMetaSemanal({ metas, userId, onSalvou, onFechar }) {
  // grade[dia][tipo] = quantidade
  const [grade, setGrade] = useState(() => {
    const g = {}
    for (const d of DIAS_SEMANA) {
      g[d.value] = {}
      for (const t of TIPOS_TAREFA) g[d.value][t.value] = 0
    }
    for (const m of metas) {
      if (g[m.dia_semana]) g[m.dia_semana][m.tipo_tarefa] = m.quantidade
    }
    return g
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function setQtd(dia, tipo, v) {
    const n = Math.max(0, parseInt(v, 10) || 0)
    setGrade(g => ({ ...g, [dia]: { ...g[dia], [tipo]: n } }))
  }

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      const rows = []
      for (const d of DIAS_SEMANA) for (const t of TIPOS_TAREFA) {
        rows.push({ dia_semana: d.value, tipo_tarefa: t.value, quantidade: grade[d.value][t.value] })
      }
      await salvarMetasSemanais(rows, userId)
      onSalvou()
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao salvar metas.')
    } finally {
      setSalvando(false)
    }
  }

  // Ordem de exibição: segunda → domingo
  const diasOrdenados = [...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]]

  return (
    <div onClick={onFechar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, width:'100%', maxWidth:720, maxHeight:'85vh', overflowY:'auto', padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <h3 style={{ margin:0, fontSize:16, display:'flex', alignItems:'center', gap:8 }}><Target size={16} /> Meta semanal de tarefas</h3>
          <button onClick={onFechar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 14px' }}>
          Quantidade de tarefas de cada tipo por dia da semana. As vagas do dia são criadas a partir desta grade.
        </p>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'6px 8px', color:'var(--text-muted)', fontWeight:600 }}>Dia</th>
                {TIPOS_TAREFA.map(t => (
                  <th key={t.value} style={{ textAlign:'center', padding:'6px 4px', color:'var(--text-muted)', fontWeight:600 }}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diasOrdenados.map(d => (
                <tr key={d.value} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 8px', fontWeight:500 }}>{d.label}</td>
                  {TIPOS_TAREFA.map(t => (
                    <td key={t.value} style={{ padding:'4px', textAlign:'center' }}>
                      <input
                        type="number" min={0} value={grade[d.value][t.value]}
                        onChange={e => setQtd(d.value, t.value, e.target.value)}
                        style={{ width:52, padding:'5px 4px', textAlign:'center', border:'1px solid var(--border)', borderRadius:6, background:'transparent', color:'var(--text)', fontSize:12 }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {erro && <div style={{ color:'#ef4444', fontSize:12, marginTop:10 }}>{erro}</div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
          <button onClick={onFechar} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar grade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// CARD DE TAREFA
// ══════════════════════════════════════════════════════════
function CardTarefa({ tarefa, onPreencher, onConcluir, onReabrir, onEsvaziar, mostrarData }) {
  const vaga = tarefa.status === 'vaga'
  const feita = tarefa.status === 'feita'
  return (
    <div style={{
      border:`1px solid ${vaga ? 'var(--border)' : feita ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
      borderStyle: vaga ? 'dashed' : 'solid',
      borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10,
      background: feita ? 'rgba(34,197,94,0.06)' : 'transparent', opacity: feita ? 0.85 : 1,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{TIPO_LABEL[tarefa.tipo_tarefa]}</span>
          {tarefa.objetivo && (
            <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, color:OBJETIVO_COR[tarefa.objetivo], background:`${OBJETIVO_COR[tarefa.objetivo]}1e` }}>
              {OBJETIVO_LABEL[tarefa.objetivo]}
            </span>
          )}
          {mostrarData && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{labelDataISO(tarefa.data)}</span>}
        </div>
        {vaga ? (
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Vaga aberta — clique em preencher</div>
        ) : (
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {tarefa.parceiro?.nome && <span>{tarefa.parceiro.nome}</span>}
            {tarefa.responsavel?.nome && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><UserRound size={11} />{tarefa.responsavel.nome}</span>
            )}
            {tarefa.observacao && <span style={{ fontStyle:'italic' }}>{tarefa.observacao}</span>}
            {feita && tarefa.resultado && <span style={{ color:'#22c55e' }}>✓ {tarefa.resultado}</span>}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {vaga && (
          <button onClick={() => onPreencher(tarefa)}
            style={{ padding:'6px 12px', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            Preencher
          </button>
        )}
        {!vaga && !feita && (
          <>
            <button onClick={() => onConcluir(tarefa)} title="Concluir"
              style={{ padding:6, borderRadius:8, border:'1px solid rgba(34,197,94,0.4)', background:'transparent', color:'#22c55e', cursor:'pointer', display:'flex' }}>
              <CheckCircle2 size={15} />
            </button>
            <button onClick={() => onPreencher(tarefa)} title="Editar"
              style={{ padding:6, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', display:'flex' }}>
              <Settings2 size={15} />
            </button>
            <button onClick={() => onEsvaziar(tarefa)} title="Esvaziar vaga"
              style={{ padding:6, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', display:'flex' }}>
              <Eraser size={15} />
            </button>
          </>
        )}
        {feita && (
          <button onClick={() => onReabrir(tarefa)} title="Reabrir"
            style={{ padding:6, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', display:'flex' }}>
            <RotateCcw size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// PÁGINA
// ══════════════════════════════════════════════════════════
export default function TarefasInfluencers() {
  const { usuario } = useAuth()
  const podeConfigurar = PERFIS_CONFIG.includes(usuario?.perfil)

  const [aba, setAba] = useState('equipe')          // 'equipe' | 'minhas'
  const [visao, setVisao] = useState('dia')         // 'dia' | 'semana'
  const [dataRef, setDataRef] = useState(hojeISO())

  const [tarefas, setTarefas] = useState([])
  const [metas, setMetas] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [modalVaga, setModalVaga] = useState(null)
  const [modalMeta, setModalMeta] = useState(false)

  useEffect(() => {
    getParceirosAtivos().then(setParceiros).catch(console.error)
    getUsuarios().then(setUsuarios).catch(console.error)
    getMetasSemanais().then(setMetas).catch(console.error)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      if (visao === 'dia') {
        await gerarVagasDoDia(dataRef)
        setTarefas(await getTarefasDoDia(dataRef))
      } else {
        await gerarVagasDaSemana(dataRef)
        setTarefas(await getTarefasDaSemana(dataRef))
      }
    } catch (e) {
      setErro(e.message || 'Erro ao carregar tarefas.')
    } finally {
      setLoading(false)
    }
  }, [visao, dataRef])

  useEffect(() => { carregar() }, [carregar])

  function navegar(delta) {
    setDataRef(d => addDiasISO(d, visao === 'dia' ? delta : delta * 7))
  }

  const tarefasVisiveis = useMemo(() => {
    if (aba === 'minhas') return tarefas.filter(t => t.responsavel_id === usuario?.id)
    return tarefas
  }, [tarefas, aba, usuario])

  // Agrupa por data (na visão semana) mantendo ordem
  const grupos = useMemo(() => {
    const dias = visao === 'dia' ? [dataRef] : semanaDeISO(dataRef)
    return dias.map(dia => ({ dia, itens: tarefasVisiveis.filter(t => t.data === dia) }))
  }, [tarefasVisiveis, visao, dataRef])

  const stats = useMemo(() => {
    const total = tarefasVisiveis.length
    const feitas = tarefasVisiveis.filter(t => t.status === 'feita').length
    const vagas = tarefasVisiveis.filter(t => t.status === 'vaga').length
    return { total, feitas, vagas, pendentes: total - feitas - vagas }
  }, [tarefasVisiveis])

  async function handleSalvarVaga(dados) {
    const atualizada = await preencherVaga(modalVaga.id, dados)
    setTarefas(ts => ts.map(t => (t.id === atualizada.id ? atualizada : t)))
  }

  async function handleConcluir(tarefa) {
    const resultado = window.prompt('Resultado / anotação (opcional):', tarefa.resultado || '')
    if (resultado === null) return
    try {
      const atualizada = await concluirTarefa(tarefa.id, usuario?.id, resultado || null)
      setTarefas(ts => ts.map(t => (t.id === atualizada.id ? atualizada : t)))
    } catch (e) { alert(e.message) }
  }

  async function handleReabrir(tarefa) {
    try {
      const atualizada = await reabrirTarefa(tarefa.id)
      setTarefas(ts => ts.map(t => (t.id === atualizada.id ? atualizada : t)))
    } catch (e) { alert(e.message) }
  }

  async function handleEsvaziar(tarefa) {
    if (!window.confirm('Esvaziar esta vaga? O preenchimento será perdido.')) return
    try {
      const atualizada = await esvaziarVaga(tarefa.id)
      setTarefas(ts => ts.map(t => (t.id === atualizada.id ? atualizada : t)))
    } catch (e) { alert(e.message) }
  }

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <h1 className="page-title" style={{ margin:0, display:'flex', alignItems:'center', gap:10 }}>
          <CheckSquare size={22} /> Tarefas Diárias — Influencers
        </h1>
        {podeConfigurar && (
          <button onClick={() => setModalMeta(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontSize:13 }}>
            <Target size={14} /> Meta semanal
          </button>
        )}
      </div>

      {/* Controles */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        {/* Abas */}
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          {[['equipe', 'Equipe'], ['minhas', 'Minhas tarefas']].map(([v, l]) => (
            <button key={v} onClick={() => setAba(v)}
              style={{ padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight: aba === v ? 600 : 400, background: aba === v ? 'var(--accent)' : 'transparent', color: aba === v ? '#fff' : 'var(--text)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Dia / Semana */}
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          {[['dia', 'Dia'], ['semana', 'Semana']].map(([v, l]) => (
            <button key={v} onClick={() => setVisao(v)}
              style={{ padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight: visao === v ? 600 : 400, background: visao === v ? 'var(--accent)' : 'transparent', color: visao === v ? '#fff' : 'var(--text)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Navegação de data */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={() => navegar(-1)} style={{ padding:6, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', display:'flex' }}><ChevronLeft size={15} /></button>
          <span style={{ fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <CalendarDays size={14} />
            {visao === 'dia' ? labelDataISO(dataRef) : `${labelDataISO(semanaDeISO(dataRef)[0])} → ${labelDataISO(semanaDeISO(dataRef)[6])}`}
          </span>
          <button onClick={() => navegar(1)} style={{ padding:6, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', display:'flex' }}><ChevronRight size={15} /></button>
          {dataRef !== hojeISO() && (
            <button onClick={() => setDataRef(hojeISO())} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>Hoje</button>
          )}
        </div>

        {/* Stats */}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)' }}>
          {stats.feitas}/{stats.total} feitas · {stats.vagas} vagas abertas
        </div>
      </div>

      {erro && <div style={{ color:'#ef4444', fontSize:13, marginBottom:12 }}>{erro}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        grupos.map(({ dia, itens }) => (
          <div key={dia} style={{ marginBottom:20 }}>
            {visao === 'semana' && (
              <h3 style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', textTransform:'capitalize', margin:'0 0 8px' }}>
                {labelDataISO(dia)}{dia === hojeISO() ? ' · hoje' : ''}
              </h3>
            )}
            {itens.length === 0 ? (
              <div style={{ fontSize:12, color:'var(--text-muted)', border:'1px dashed var(--border)', borderRadius:10, padding:'12px 14px' }}>
                {aba === 'minhas' ? 'Nenhuma tarefa sua neste dia.' : 'Nenhuma tarefa neste dia (meta zerada).'}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {itens.map(t => (
                  <CardTarefa
                    key={t.id} tarefa={t} mostrarData={false}
                    onPreencher={setModalVaga} onConcluir={handleConcluir}
                    onReabrir={handleReabrir} onEsvaziar={handleEsvaziar}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {modalVaga && (
        <ModalPreencher
          tarefa={modalVaga} parceiros={parceiros} usuarios={usuarios}
          onSalvar={handleSalvarVaga} onFechar={() => setModalVaga(null)}
        />
      )}
      {modalMeta && (
        <ModalMetaSemanal
          metas={metas} userId={usuario?.id}
          onSalvou={() => { getMetasSemanais().then(setMetas).catch(console.error); carregar() }}
          onFechar={() => setModalMeta(false)}
        />
      )}
    </div>
  )
}
