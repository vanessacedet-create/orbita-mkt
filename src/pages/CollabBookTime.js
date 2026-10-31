import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, Copy, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getCollabConfig, updateCollabConfig, getEquipeCollab, getAdesoes, buscarParceirosInfluencers,
  salvarAdesao, getVideos, salvarVideo, excluirVideo, palavraEmUso, buscarLivrosCollab,
  getRecusasParceiro, registrarRecusa, sincronizarLivros,
} from '../lib/collab'
import './CollabBookTime.css'

// ── Datas (sempre strings YYYY-MM-DD no fuso local; nunca new Date('YYYY-MM-DD')) ──
const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDias = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
const hojeISO = () => iso(new Date())
const diaSemana = s => parse(s).getDay()
// Prazo de trabalho que cai no fim de semana passa para a sexta anterior
const ajustarUtil = s => { const w = diaSemana(s); return w === 6 ? addDias(s, -1) : w === 0 ? addDias(s, -2) : s }
const fmt = s => (s ? parse(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—')
const fmtLongo = s => (s ? parse(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—')

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ── Funil ─────────────────────────────────────────────────────
// etapa = última etapa concluída; a próxima é a pendência do card
const ETAPAS = [
  { k: 'livro_sugerido', label: 'Livro sugerido', dt: 'dt_livro_sugerido', prazo: null, resp: 'curadoria', acao: 'Sugerir livro' },
  { k: 'livro_aceito', label: 'Livro aceito', dt: 'dt_livro_aceito', prazo: 'prazo_livro_aceito', resp: 'producao', acao: 'Confirmar livro com o parceiro' },
  { k: 'roteiro_enviado', label: 'Roteiro enviado', dt: 'dt_roteiro_enviado', prazo: 'prazo_roteiro_enviado', resp: 'curadoria', acao: 'Escrever e enviar roteiro' },
  { k: 'roteiro_aprovado', label: 'Roteiro aprovado', dt: 'dt_roteiro_aprovado', prazo: 'prazo_roteiro_aprovado', resp: 'producao', acao: 'Aprovar roteiro com o parceiro' },
  { k: 'video_cru', label: 'Vídeo cru recebido', dt: 'dt_video_cru', prazo: 'prazo_video_cru', resp: 'producao', acao: 'Receber vídeo cru' },
  { k: 'em_edicao', label: 'Vídeo editado', dt: 'dt_edicao', prazo: 'prazo_edicao', resp: 'producao', acao: 'Editar vídeo' },
  { k: 'automacao_criada', label: 'Automação criada', dt: 'dt_automacao', prazo: 'prazo_automacao', resp: 'producao', acao: 'Criar automação de DM' },
  { k: 'post_agendado', label: 'Post agendado', dt: 'dt_agendado', prazo: 'prazo_agendado', resp: 'producao', acao: 'Agendar post em collab' },
  { k: 'postado', label: 'Postado', dt: 'dt_postado', prazo: null, resp: 'producao', acao: 'Confirmar publicação' },
]
const IDX = Object.fromEntries(ETAPAS.map((e, i) => [e.k, i]))
const ETAPA_POR_K = Object.fromEntries(ETAPAS.map(e => [e.k, e]))

const PERIODOS = { semana: 'semana', quinzena: 'quinzena', mes: 'mês' }
const DIAS_PERIODO = { semana: 7, quinzena: 14, mes: 30 }
const hora = h => (h ? String(h).slice(0, 5) : '')
const ritmoTexto = a => (a?.videos_por_semana ? `${a.videos_por_semana} por ${PERIODOS[a.ritmo_periodo || 'semana']}` : '')

const STATUS_ADESAO = { convidado: 'Convidado', aceitou: 'Aceitou', recusou: 'Recusou', pausado: 'Pausado', encerrado: 'Encerrado' }
const MOTIVOS = { livro: 'Não gostou do livro', autor: 'Autor', tema: 'Tema', outro: 'Outro' }
const PRAZOS = [
  ['prazo_livro_aceito', 'Livro aceito'], ['prazo_roteiro_enviado', 'Roteiro enviado'],
  ['prazo_roteiro_aprovado', 'Roteiro aprovado'], ['prazo_video_cru', 'Vídeo cru'],
  ['prazo_edicao', 'Edição'], ['prazo_automacao', 'Automação'], ['prazo_agendado', 'Agendamento'],
]

function prazoEfetivo(chave, cfg, adesao) {
  const p = adesao?.[chave]
  return p !== null && p !== undefined ? p : cfg?.[chave]
}

function vencimento(video, etapaK, cfg, adesao) {
  if (!video.data_postagem) return null
  if (etapaK === 'postado') return video.data_postagem
  const e = ETAPA_POR_K[etapaK]
  if (!e?.prazo) return null
  const n = prazoEfetivo(e.prazo, cfg, adesao)
  if (n === null || n === undefined) return null
  return ajustarUtil(addDias(video.data_postagem, -Number(n)))
}

// Data em que o vídeo conta para a meta: postado = data real; senão = prevista
const dataDoVideo = v => (v.etapa === 'postado' && v.dt_postado ? v.dt_postado : v.data_postagem)

function pendenciaDe(video, cfg, adesao) {
  if (video.etapa === 'cancelado') return null
  if (video.etapa === 'postado') {
    if (video.historico || video.resultado_visualizacoes !== null) return null
    const base = video.dt_postado || video.data_postagem
    if (!base) return null
    return { tipo: 'resultado', label: 'Lançar resultado', due: addDias(base, Number(cfg?.dias_medicao ?? 7)), resp: 'producao' }
  }
  if (video.historico) return null
  const prox = ETAPAS[(IDX[video.etapa] ?? -1) + 1]
  if (!prox) return null
  return { tipo: 'etapa', etapa: prox.k, label: prox.acao, due: vencimento(video, prox.k, cfg, adesao), resp: prox.resp }
}

function emRisco(video, cfg, adesao, hoje) {
  if (video.historico || video.etapa === 'cancelado') return false
  if ((IDX[video.etapa] ?? 0) >= IDX.video_cru) return false
  const due = vencimento(video, 'video_cru', cfg, adesao)
  return !!due && due < hoje
}

function contarPorDia(videos, ignorarId) {
  const m = {}
  videos.forEach(v => {
    if (v.etapa === 'cancelado' || v.id === ignorarId) return
    const d = dataDoVideo(v)
    if (d) m[d] = (m[d] || 0) + 1
  })
  return m
}

// Próxima data com vaga na meta (respeita dias preferidos do parceiro, se houver)
// e espaça os vídeos conforme o ritmo combinado (ex.: 1 por quinzena = 14 dias depois do último)
function sugerirData(aPartir, adesao, videos, meta, ignorarId) {
  const cont = contarPorDia(videos, ignorarId)
  const dias = adesao?.dias_preferidos?.length ? adesao.dias_preferidos : null
  let inicio = aPartir
  const qtd = Number(adesao?.videos_por_semana) || 0
  if (adesao && qtd > 0) {
    const intervalo = Math.max(1, Math.floor(DIAS_PERIODO[adesao.ritmo_periodo || 'semana'] / qtd))
    const ultima = videos
      .filter(v => v.parceiro_id === adesao.parceiro_id && v.id !== ignorarId && v.etapa !== 'cancelado' && dataDoVideo(v))
      .map(dataDoVideo).sort().pop()
    if (ultima && addDias(ultima, intervalo) > inicio) inicio = addDias(ultima, intervalo)
  }
  for (let i = 0; i < 120; i++) {
    const d = addDias(inicio, i)
    if (dias && !dias.includes(diaSemana(d))) continue
    if ((cont[d] || 0) < Math.max(1, Number(meta) || 1)) return d
  }
  return inicio
}

const tituloLivros = v => (v.livros || []).map(x => x.livro?.titulo).filter(Boolean).join(' + ')
const isbnDe = l => l?.isbn || l?.sku || 'sem ISBN'

async function copiar(texto, notify, ok) {
  try { await navigator.clipboard.writeText(texto || ''); notify(ok, 'success') }
  catch { notify('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error') }
}

// ═════════════════════════════════════════════════════════════
export default function CollabBookTime() {
  const { usuario } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [equipe, setEquipe] = useState([])
  const [adesoes, setAdesoes] = useState([])
  const [videos, setVideos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [aba, setAba] = useState('calendario')
  const [filtroParceiro, setFiltroParceiro] = useState('')
  const [soMinhas, setSoMinhas] = useState(false)
  const [aberto, setAberto] = useState(null)        // vídeo no painel lateral
  const [adesaoAberta, setAdesaoAberta] = useState(null)
  const [toast, setToast] = useState(null)
  const hoje = hojeISO()

  const notify = useCallback((msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga('')
    try {
      const [c, eq, ad, vs] = await Promise.all([getCollabConfig(), getEquipeCollab(), getAdesoes(), getVideos()])
      setCfg(c); setEquipe(eq); setAdesoes(ad); setVideos(vs)
    } catch (e) {
      setErroCarga(e.message || 'Erro ao carregar os dados.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const adesaoPorParceiro = useMemo(() => Object.fromEntries(adesoes.map(a => [a.parceiro_id, a])), [adesoes])
  const nomeEquipe = useMemo(() => Object.fromEntries(equipe.map(u => [u.id, (u.nome || '').split(' ')[0]])), [equipe])

  const visiveis = useMemo(() => videos.filter(v => {
    if (filtroParceiro && v.parceiro_id !== filtroParceiro) return false
    if (soMinhas && usuario?.id && v.resp_curadoria !== usuario.id && v.resp_producao !== usuario.id) return false
    return true
  }), [videos, filtroParceiro, soMinhas, usuario])

  const pendencias = useMemo(() => {
    const m = {}
    visiveis.forEach(v => { m[v.id] = pendenciaDe(v, cfg, adesaoPorParceiro[v.parceiro_id]) })
    return m
  }, [visiveis, cfg, adesaoPorParceiro])

  const meta = cfg?.meta_diaria ?? 1

  function novoVideo() {
    const aceitos = adesoes.filter(a => a.status === 'aceitou')
    if (!aceitos.length) {
      notify('Nenhum parceiro aderiu ainda. Cadastre a adesão na aba Parceiros.', 'error')
      setAba('parceiros')
      return
    }
    const naEquipe = equipe.some(u => u.id === usuario?.id)
    const producao = equipe.find(u => u.perfil === 'estagiario_influencers' || u.perfil === 'analista_influencers')
    setAberto({
      etapa: 'livro_sugerido', dt_livro_sugerido: hoje, em_ajuste: false, historico: false,
      data_confirmada: false, video_cru_whatsapp: false, livros: [],
      parceiro_id: filtroParceiro && adesaoPorParceiro[filtroParceiro]?.status === 'aceitou' ? filtroParceiro : '',
      resp_curadoria: naEquipe ? usuario.id : '', resp_producao: producao?.id || '',
    })
  }

  function aoSalvarVideo(v) {
    setVideos(lista => [...lista.filter(x => x.id !== v.id), v]
      .sort((a, b) => (a.data_postagem || '').localeCompare(b.data_postagem || '')))
    setAberto(v)
  }

  if (carregando) return <div className="loading"><div className="spinner" /></div>
  if (erroCarga) {
    return (
      <div className="cb-page">
        <div className="sem-acesso">
          <h2>Não foi possível abrir o Collab BookTime</h2>
          <p>{erroCarga}</p>
          <button className="btn btn-primary" onClick={carregar}>Tentar de novo</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cb-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Collab BookTime</h1>
          <p className="page-subtitle">Vídeos em collab com parceiros, do livro sugerido ao resultado.</p>
        </div>
        <button className="btn btn-primary" onClick={novoVideo}><Plus size={16} /> Novo vídeo</button>
      </div>

      <div className="cb-toolbar">
        <select className="form-select cb-filtro" value={filtroParceiro} onChange={e => setFiltroParceiro(e.target.value)} aria-label="Filtrar por parceiro">
          <option value="">Todos os parceiros</option>
          {adesoes.map(a => <option key={a.parceiro_id} value={a.parceiro_id}>{a.parceiro?.nome}</option>)}
        </select>
        <label className="cb-check">
          <input type="checkbox" checked={soMinhas} onChange={e => setSoMinhas(e.target.checked)} /> Só os meus vídeos
        </label>
        <MetaDiaria cfg={cfg} onSalvar={async v => {
          try { setCfg(await updateCollabConfig({ meta_diaria: v })); notify('Meta diária atualizada.') }
          catch (e) { notify('Erro ao salvar a meta: ' + e.message, 'error') }
        }} />
      </div>

      <PainelPendencias videos={visiveis} pendencias={pendencias} hoje={hoje} nomeEquipe={nomeEquipe} onAbrir={setAberto} />

      <div className="cb-tabs" role="tablist">
        {[['calendario', 'Calendário'], ['quadro', 'Quadro por etapas'], ['parceiros', 'Parceiros']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`tab-btn ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}>{l}</button>
        ))}
      </div>

      {aba === 'calendario' && (
        <Calendario videos={visiveis} pendencias={pendencias} meta={meta} hoje={hoje} nomeEquipe={nomeEquipe} onAbrir={setAberto} />
      )}
      {aba === 'quadro' && (
        <Quadro videos={visiveis} pendencias={pendencias} hoje={hoje} cfg={cfg} adesaoPorParceiro={adesaoPorParceiro} nomeEquipe={nomeEquipe} onAbrir={setAberto} />
      )}
      {aba === 'parceiros' && (
        <Parceiros adesoes={adesoes} videos={videos} cfg={cfg} onAbrir={setAdesaoAberta} onNovo={() => setAdesaoAberta({ status: 'convidado', data_convite: hoje })} />
      )}

      {aberto && (
        <PainelVideo
          key={aberto.id || 'novo'}
          inicial={aberto} cfg={cfg} equipe={equipe} adesoes={adesoes} adesaoPorParceiro={adesaoPorParceiro}
          videos={videos} hoje={hoje} usuario={usuario} notify={notify}
          onFechar={() => setAberto(null)}
          onSalvo={aoSalvarVideo}
          onExcluido={id => { setVideos(l => l.filter(x => x.id !== id)); setAberto(null) }}
        />
      )}

      {adesaoAberta && (
        <ModalAdesao
          inicial={adesaoAberta} cfg={cfg} adesoes={adesoes} notify={notify}
          onFechar={() => setAdesaoAberta(null)}
          onSalvo={a => { setAdesoes(l => [...l.filter(x => x.id !== a.id), a].sort((x, y) => (x.parceiro?.nome || '').localeCompare(y.parceiro?.nome || ''))); setAdesaoAberta(null) }}
        />
      )}

      {toast && <div className={`toast ${toast.tipo}`} role="status">{toast.msg}</div>}
    </div>
  )
}

// ── Meta diária ───────────────────────────────────────────────
function MetaDiaria({ cfg, onSalvar }) {
  const [valor, setValor] = useState(String(cfg?.meta_diaria ?? 1))
  const mudou = String(cfg?.meta_diaria ?? 1) !== valor
  return (
    <div className="cb-meta">
      <label htmlFor="cb-meta-input">Meta</label>
      <input id="cb-meta-input" className="form-input" type="number" min="0" value={valor} onChange={e => setValor(e.target.value)} />
      <span>vídeos por dia</span>
      {mudou && <button className="btn btn-primary btn-sm" onClick={() => onSalvar(Math.max(0, parseInt(valor, 10) || 0))}>Salvar</button>}
    </div>
  )
}

// ── Pendências ────────────────────────────────────────────────
function PainelPendencias({ videos, pendencias, hoje, nomeEquipe, onAbrir }) {
  const semana = addDias(hoje, 7)
  const grupos = { atrasados: [], hoje: [], semana: [], resultados: [] }
  videos.forEach(v => {
    const p = pendencias[v.id]
    if (!p || !p.due) return
    const item = { v, p }
    if (p.tipo === 'resultado') { if (p.due <= hoje) grupos.resultados.push(item); return }
    if (p.due < hoje) grupos.atrasados.push(item)
    else if (p.due === hoje) grupos.hoje.push(item)
    else if (p.due <= semana) grupos.semana.push(item)
  })
  Object.values(grupos).forEach(l => l.sort((a, b) => a.p.due.localeCompare(b.p.due)))
  const colunas = [
    ['atrasados', 'Atrasados', 'cb-col-red'], ['hoje', 'Vence hoje', 'cb-col-amber'],
    ['semana', 'Próximos 7 dias', ''], ['resultados', 'Resultados a lançar', 'cb-col-indigo'],
  ]
  return (
    <section className="cb-pend" aria-label="Pendências">
      {colunas.map(([k, titulo, cls]) => (
        <div key={k} className={`cb-pend-col ${cls}`}>
          <h2>{titulo} <span>{grupos[k].length}</span></h2>
          {grupos[k].length === 0 && <p className="cb-vazio">Nada aqui.</p>}
          <ul>
            {grupos[k].slice(0, 8).map(({ v, p }) => (
              <li key={v.id}>
                <button onClick={() => onAbrir(v)}>
                  <strong>{v.parceiro?.nome || 'Parceiro'}</strong>
                  <span>{p.label}</span>
                  <small>{fmt(p.due)}{(p.resp === 'curadoria' ? v.resp_curadoria : v.resp_producao) ? ` · ${nomeEquipe[p.resp === 'curadoria' ? v.resp_curadoria : v.resp_producao] || ''}` : ''}</small>
                </button>
              </li>
            ))}
          </ul>
          {grupos[k].length > 8 && <p className="cb-vazio">e mais {grupos[k].length - 8}</p>}
        </div>
      ))}
    </section>
  )
}

// ── Calendário ────────────────────────────────────────────────
function Calendario({ videos, pendencias, meta, hoje, nomeEquipe, onAbrir }) {
  const [visao, setVisao] = useState('mes')
  const [cursor, setCursor] = useState(hoje)
  const contagem = useMemo(() => contarPorDia(videos), [videos])

  const dias = useMemo(() => {
    const c = parse(cursor)
    if (visao === 'dia') return [cursor]
    if (visao === 'semana') { const ini = addDias(cursor, -c.getDay()); return Array.from({ length: 7 }, (_, i) => addDias(ini, i)) }
    const primeiro = iso(new Date(c.getFullYear(), c.getMonth(), 1))
    const ini = addDias(primeiro, -diaSemana(primeiro))
    const ultimo = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()
    const total = Math.ceil((diaSemana(primeiro) + ultimo) / 7) * 7
    return Array.from({ length: total }, (_, i) => addDias(ini, i))
  }, [cursor, visao])

  const mesCursor = parse(cursor).getMonth()
  function navegar(n) {
    if (visao === 'dia') setCursor(addDias(cursor, n))
    else if (visao === 'semana') setCursor(addDias(cursor, 7 * n))
    else { const c = parse(cursor); setCursor(iso(new Date(c.getFullYear(), c.getMonth() + n, 1))) }
  }
  const legenda = visao === 'mes'
    ? parse(cursor).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : visao === 'semana' ? `${fmt(dias[0])} a ${fmt(dias[6])}` : fmtLongo(cursor)

  const doDia = d => videos.filter(v => v.etapa !== 'cancelado' && dataDoVideo(v) === d)

  return (
    <section className="cb-cal">
      <div className="cb-cal-bar">
        <div className="cb-nav">
          <button className="btn btn-ghost btn-icon" onClick={() => navegar(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
          <strong className="cb-cal-legenda">{legenda}</strong>
          <button className="btn btn-ghost btn-icon" onClick={() => navegar(1)} aria-label="Próximo"><ChevronRight size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCursor(hoje)}>Hoje</button>
        </div>
        <div className="cb-seg" role="group" aria-label="Visualização">
          {[['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([k, l]) => (
            <button key={k} aria-pressed={visao === k} onClick={() => setVisao(k)}>{l}</button>
          ))}
        </div>
      </div>

      {visao === 'dia' ? (
        <div className="cb-dia">
          <MetaChip n={contagem[cursor] || 0} meta={meta} futuro={cursor >= hoje} grande />
          {doDia(cursor).length === 0 && <p className="cb-vazio">Nenhum vídeo neste dia. {cursor >= hoje ? 'Este dia está livre para receber um post.' : ''}</p>}
          {doDia(cursor).map(v => <CardVideo key={v.id} v={v} p={pendencias[v.id]} hoje={hoje} nomeEquipe={nomeEquipe} onAbrir={onAbrir} />)}
        </div>
      ) : (
        <div className={`cb-grid ${visao === 'semana' ? 'cb-grid-semana' : ''}`}>
          {SEMANA.map(d => <div key={d} className="cb-weekday">{d}</div>)}
          {dias.map(d => {
            const n = contagem[d] || 0
            const futuro = d >= hoje
            const buraco = futuro && n < meta
            const fora = visao === 'mes' && parse(d).getMonth() !== mesCursor
            return (
              <div key={d} className={`cb-day ${fora ? 'cb-fora' : ''} ${buraco ? 'cb-buraco' : ''} ${d === hoje ? 'cb-hoje' : ''}`}>
                <div className="cb-day-top">
                  <button className="cb-daynum" onClick={() => { setCursor(d); setVisao('dia') }} aria-label={`Ver o dia ${fmt(d)}`}>{parse(d).getDate()}</button>
                  <MetaChip n={n} meta={meta} futuro={futuro} />
                </div>
                {doDia(d).map(v => {
                  const p = pendencias[v.id]
                  const atrasado = p?.due && p.due < hoje
                  return (
                    <button key={v.id} className={`cb-ev cb-et-${v.etapa} ${atrasado ? 'cb-atrasado' : ''}`} onClick={() => onAbrir(v)} title={`${v.parceiro?.nome} · ${ETAPA_POR_K[v.etapa]?.label || v.etapa}`}>
                      <span>{v.parceiro?.nome}</span>
                      <small>{ETAPA_POR_K[v.etapa]?.label}</small>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      <div className="cb-legenda">
        <span><i className="cb-dot cb-dot-buraco" /> Dia abaixo da meta</span>
        <span><i className="cb-dot cb-dot-atraso" /> Etapa atrasada</span>
      </div>
    </section>
  )
}

function MetaChip({ n, meta, futuro, grande }) {
  const cls = !futuro ? 'cb-chip-neutro' : n >= meta ? 'cb-chip-ok' : 'cb-chip-falta'
  return <span className={`cb-chip ${cls} ${grande ? 'cb-chip-grande' : ''}`} title={`${n} de ${meta} vídeos`}>{n}/{meta}</span>
}

function CardVideo({ v, p, hoje, nomeEquipe, onAbrir }) {
  const atrasado = p?.due && p.due < hoje
  return (
    <button className={`cb-card ${atrasado ? 'cb-atrasado' : ''}`} onClick={() => onAbrir(v)}>
      <div className="cb-card-top">
        <strong>{v.parceiro?.nome || 'Parceiro'}</strong>
        {v.em_ajuste && <span className="badge badge-amber">Em ajuste</span>}
        {v.historico && <span className="badge badge-gray">Histórico</span>}
      </div>
      <p className="cb-card-livros">{tituloLivros(v) || 'Sem livro definido'}</p>
      <p className="cb-card-meta">
        Post {fmt(v.data_postagem)}{v.data_confirmada ? '' : ' (prevista)'} · {ETAPA_POR_K[v.etapa]?.label || 'Cancelado'}
      </p>
      {p && <p className={`cb-card-prox ${atrasado ? 'cb-txt-red' : ''}`}>{p.label} até {fmt(p.due)}{(p.resp === 'curadoria' ? v.resp_curadoria : v.resp_producao) ? ` · ${nomeEquipe[p.resp === 'curadoria' ? v.resp_curadoria : v.resp_producao] || ''}` : ''}</p>}
    </button>
  )
}

// ── Quadro por etapas ─────────────────────────────────────────
function Quadro({ videos, pendencias, hoje, cfg, adesaoPorParceiro, nomeEquipe, onAbrir }) {
  const [verPostados, setVerPostados] = useState(false)
  const limite = addDias(hoje, -14)
  return (
    <section>
      <label className="cb-check cb-quadro-opt">
        <input type="checkbox" checked={verPostados} onChange={e => setVerPostados(e.target.checked)} /> Mostrar postados há mais de 14 dias
      </label>
      <div className="cb-kanban">
        {ETAPAS.map(e => {
          const itens = videos
            .filter(v => v.etapa === e.k)
            .filter(v => verPostados || e.k !== 'postado' || (dataDoVideo(v) || '') >= limite)
          return (
            <div key={e.k} className="cb-kcol">
              <h3 className={`cb-kcol-h cb-et-${e.k}`}>{e.label} <span>{itens.length}</span></h3>
              {itens.map(v => (
                <div key={v.id}>
                  {emRisco(v, cfg, adesaoPorParceiro[v.parceiro_id], hoje) && <p className="cb-risco"><AlertTriangle size={12} /> Data em risco</p>}
                  <CardVideo v={v} p={pendencias[v.id]} hoje={hoje} nomeEquipe={nomeEquipe} onAbrir={onAbrir} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Parceiros (adesão + resumo) ───────────────────────────────
function Parceiros({ adesoes, videos, cfg, onAbrir, onNovo }) {
  const [ordem, setOrdem] = useState({ col: 'nome', dir: 'asc' })
  const linhas = adesoes.map(a => {
    const vs = videos.filter(v => v.parceiro_id === a.parceiro_id && v.etapa !== 'cancelado')
    const postados = vs.filter(v => v.etapa === 'postado')
    const comRes = postados.filter(v => v.resultado_visualizacoes !== null)
    const media = campo => (comRes.length ? Math.round(comRes.reduce((s, v) => s + (Number(v[campo]) || 0), 0) / comRes.length) : null)
    const vendas = postados.reduce((s, v) => s + (Number(v.resultado_vendas_unid) || 0), 0)
    const entregas = vs.filter(v => !v.historico && v.dt_video_cru)
    const noPrazo = entregas.filter(v => { const d = vencimento(v, 'video_cru', cfg, a); return d && v.dt_video_cru <= d }).length
    const qtd = Number(a.videos_por_semana) || 0
    return {
      a, nome: a.parceiro?.nome || '', status: STATUS_ADESAO[a.status] || '',
      ritmo: qtd ? (qtd * 30) / DIAS_PERIODO[a.ritmo_periodo || 'semana'] : null, // vídeos por mês, para ordenar
      total: vs.length, postados: postados.length, views: media('resultado_visualizacoes'), pessoas: media('resultado_pessoas_palavra'),
      vendas, prazo: entregas.length ? Math.round((noPrazo / entregas.length) * 100) : null,
    }
  })
  const ordenadas = [...linhas].sort((x, y) => {
    const a = x[ordem.col], b = y[ordem.col]
    const vazioA = a === null || a === undefined || a === '', vazioB = b === null || b === undefined || b === ''
    if (vazioA && vazioB) return x.nome.localeCompare(y.nome)
    if (vazioA) return 1 // sem valor vai sempre para o fim
    if (vazioB) return -1
    const r = typeof a === 'string' ? a.localeCompare(b, 'pt-BR') : a - b
    return (r || x.nome.localeCompare(y.nome)) * (ordem.dir === 'asc' ? 1 : -1) || 0
  })
  function ordenarPor(col) {
    setOrdem(o => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'nome' || col === 'status' ? 'asc' : 'desc' }))
  }
  const COLS = [
    ['nome', 'Parceiro'], ['status', 'Adesão'], ['ritmo', 'Ritmo'], ['total', 'Vídeos'], ['postados', 'Postados'],
    ['views', 'Média de views'], ['pessoas', 'Média de pessoas'], ['vendas', 'Vendas (un.)'], ['prazo', 'Vídeo cru no prazo'],
  ]
  return (
    <section>
      <div className="cb-parc-bar">
        <p className="page-subtitle">Médias calculadas só com os vídeos que já têm resultado lançado.</p>
        <button className="btn btn-ghost btn-sm" onClick={onNovo}><Plus size={14} /> Adicionar parceiro</button>
      </div>
      {linhas.length === 0 ? (
        <div className="empty-state"><p>Nenhum parceiro no Collab BookTime ainda. Adicione o primeiro para começar a cadastrar vídeos.</p></div>
      ) : (
        <div className="cb-tabela-wrap">
          <table className="cb-tabela">
            <thead>
              <tr>
                {COLS.map(([k, l]) => {
                  const ativa = ordem.col === k
                  return (
                    <th key={k} aria-sort={ativa ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={`cb-th-btn ${ativa ? 'cb-th-ativa' : ''}`} onClick={() => ordenarPor(k)} title="Clique para ordenar">
                        {l}<span aria-hidden="true">{ativa ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(l => (
                <tr key={l.a.id} onClick={() => onAbrir(l.a)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onAbrir(l.a) }}>
                  <td className="td-strong">{l.a.parceiro?.nome}</td>
                  <td><span className={`badge ${l.a.status === 'aceitou' ? 'badge-green' : l.a.status === 'convidado' ? 'badge-indigo' : 'badge-gray'}`}>{STATUS_ADESAO[l.a.status]}</span></td>
                  <td>{ritmoTexto(l.a) || '—'}{l.a.dias_preferidos?.length ? ` (${l.a.dias_preferidos.map(d => SEMANA[d]).join(', ')})` : ''}{l.a.horario_preferido ? ` às ${hora(l.a.horario_preferido)}` : ''}</td>
                  <td>{l.total}</td>
                  <td>{l.postados}</td>
                  <td>{l.views ?? '—'}</td>
                  <td>{l.pessoas ?? '—'}</td>
                  <td>{l.vendas}</td>
                  <td>{l.prazo === null ? '—' : `${l.prazo}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ModalAdesao({ inicial, cfg, adesoes, notify, onFechar, onSalvo }) {
  const [f, setF] = useState(inicial)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [salvando, setSalvando] = useState(false)
  const v = (k, val) => setF(x => ({ ...x, [k]: val }))

  useEffect(() => {
    if (f.id) return undefined
    let ativo = true
    const t = setTimeout(() => {
      buscarParceirosInfluencers(busca)
        .then(r => { if (ativo) setResultados(r) })
        .catch(e => { if (ativo) notify('Erro na busca: ' + e.message, 'error') })
    }, 300)
    return () => { ativo = false; clearTimeout(t) }
  }, [busca, f.id, notify])

  const jaAderiu = id => adesoes.some(a => a.parceiro_id === id)

  async function salvar() {
    if (!f.parceiro_id) return notify('Escolha o parceiro.', 'error')
    setSalvando(true)
    try { onSalvo(await salvarAdesao(f)); notify('Parceiro salvo.') }
    catch (e) { notify('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvando(false) }
  }

  function alternarDia(d) {
    const atual = f.dias_preferidos || []
    v('dias_preferidos', atual.includes(d) ? atual.filter(x => x !== d) : [...atual, d].sort())
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal cb-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Parceiro do Collab BookTime">
        <div className="modal-header">
          <h2 className="modal-title">{f.id ? f.parceiro?.nome : 'Adicionar parceiro'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="form-grid">
          {!f.id && (
            <div className="form-group">
              <label className="form-label" htmlFor="cb-busca-parc">Parceiro do CRM Influencers</label>
              {f.parceiro ? (
                <div className="cb-escolhido"><strong>{f.parceiro.nome}</strong><button className="btn btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, parceiro_id: '', parceiro: null }))}>Trocar</button></div>
              ) : (
                <>
                  <input id="cb-busca-parc" className="form-input" placeholder="Digite o nome ou @ do parceiro" value={busca} onChange={e => setBusca(e.target.value)} />
                  <ul className="cb-resultados">
                    {resultados.map(p => (
                      <li key={p.id}>
                        <button disabled={jaAderiu(p.id)} onClick={() => setF(x => ({ ...x, parceiro_id: p.id, parceiro: p }))}>
                          {p.nome}{p.username ? ` (@${String(p.username).replace(/^@/, '')})` : ''}{jaAderiu(p.id) ? ' · já cadastrado' : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cb-ad-status">Adesão</label>
              <select id="cb-ad-status" className="form-select" value={f.status} onChange={e => v('status', e.target.value)}>
                {Object.entries(STATUS_ADESAO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cb-ad-vps">Frequência combinada</label>
              <div className="cb-ritmo">
                <input id="cb-ad-vps" className="form-input" type="number" min="0" aria-label="Quantidade de vídeos" value={f.videos_por_semana ?? ''} onChange={e => v('videos_por_semana', e.target.value === '' ? null : parseInt(e.target.value, 10))} />
                <span>por</span>
                <select className="form-select" aria-label="Período" value={f.ritmo_periodo || 'semana'} onChange={e => v('ritmo_periodo', e.target.value)}>
                  {Object.entries(PERIODOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cb-ad-conv">Convite enviado em</label>
              <input id="cb-ad-conv" className="form-input" type="date" value={f.data_convite || ''} onChange={e => v('data_convite', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cb-ad-resp">Resposta em</label>
              <input id="cb-ad-resp" className="form-input" type="date" value={f.data_resposta || ''} onChange={e => v('data_resposta', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Dias preferidos de postagem</span>
            <div className="cb-dias">
              {SEMANA.map((d, i) => (
                <button key={d} type="button" aria-pressed={(f.dias_preferidos || []).includes(i)} onClick={() => alternarDia(i)}>{d}</button>
              ))}
            </div>
          </div>
          <div className="form-group cb-horario">
            <label className="form-label" htmlFor="cb-ad-hora">Horário preferido de postagem</label>
            <input id="cb-ad-hora" className="form-input" type="time" value={hora(f.horario_preferido)} onChange={e => v('horario_preferido', e.target.value || null)} />
          </div>
          <details className="cb-details">
            <summary>Prazos próprios deste parceiro (em branco = padrão)</summary>
            <div className="cb-prazos">
              {PRAZOS.map(([k, l]) => (
                <label key={k}>
                  <span>{l}</span>
                  <input className="form-input" type="number" min="0" placeholder={`D-${cfg?.[k] ?? ''}`} value={f[k] ?? ''} onChange={e => v(k, e.target.value === '' ? null : parseInt(e.target.value, 10))} />
                </label>
              ))}
            </div>
          </details>
          <div className="form-group">
            <label className="form-label" htmlFor="cb-ad-obs">Observações</label>
            <textarea id="cb-ad-obs" className="form-textarea" value={f.observacoes || ''} onChange={e => v('observacoes', e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar parceiro'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Painel do vídeo ───────────────────────────────────────────
function PainelVideo({ inicial, cfg, equipe, adesoes, adesaoPorParceiro, videos, hoje, usuario, notify, onFechar, onSalvo, onExcluido }) {
  const [f, setF] = useState(inicial)
  const [livros, setLivros] = useState((inicial.livros || []).map(x => x.livro).filter(Boolean))
  const [buscaLivro, setBuscaLivro] = useState('')
  const [achados, setAchados] = useState([])
  const [recusas, setRecusas] = useState([])
  const [avisoPalavra, setAvisoPalavra] = useState([])
  const [recusa, setRecusa] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const v = (k, val) => setF(x => ({ ...x, [k]: val }))

  const adesao = adesaoPorParceiro[f.parceiro_id]
  const parceiro = adesao?.parceiro || f.parceiro
  const proxima = ETAPAS[(IDX[f.etapa] ?? -1) + 1]
  const risco = emRisco(f, cfg, adesao, hoje)

  useEffect(() => {
    let ativo = true
    getRecusasParceiro(f.parceiro_id)
      .then(r => { if (ativo) setRecusas(r) })
      .catch(e => { if (ativo) notify('Erro ao carregar recusas: ' + e.message, 'error') })
    return () => { ativo = false }
  }, [f.parceiro_id, notify])

  useEffect(() => {
    let ativo = true
    const t = setTimeout(() => {
      buscarLivrosCollab(buscaLivro)
        .then(r => { if (ativo) setAchados(r) })
        .catch(e => { if (ativo) notify('Erro na busca de livros: ' + e.message, 'error') })
    }, 300)
    return () => { ativo = false; clearTimeout(t) }
  }, [buscaLivro, notify])

  const recusaDe = id => recusas.find(r => r.livro_id === id)

  function escolherParceiro(id) {
    const a = adesaoPorParceiro[id]
    setF(x => ({
      ...x, parceiro_id: id,
      livraria: x.livraria || a?.parceiro?.livraria || '',
      data_postagem: x.data_postagem || sugerirData(addDias(hoje, Number(prazoEfetivo('prazo_livro_aceito', cfg, a) ?? 7)), a, videos, cfg?.meta_diaria, x.id),
    }))
  }

  function adicionarLivro(l) {
    if (livros.some(x => x.id === l.id)) return
    if (livros.length >= 4) return notify('Um kit pode ter no máximo 4 livros.', 'error')
    setLivros(lst => [...lst, l])
    setBuscaLivro('')
    setAchados([])
  }

  function irParaEtapa(k) {
    setF(x => {
      const e = ETAPA_POR_K[k]
      const novo = { ...x, etapa: k }
      if (e && !novo[e.dt]) novo[e.dt] = k === 'postado' && x.historico && x.data_postagem ? x.data_postagem : hoje
      if (k !== 'cancelado' && (IDX[k] ?? -1) >= IDX.video_cru) novo.data_confirmada = true
      return novo
    })
  }

  async function verificarPalavra() {
    try { setAvisoPalavra(await palavraEmUso(f.palavra, f.id)) }
    catch { setAvisoPalavra([]) }
  }

  async function salvar() {
    if (!f.parceiro_id) return notify('Escolha o parceiro.', 'error')
    if (!f.data_postagem) return notify('Informe a data de postagem.', 'error')
    if (!livros.length) return notify('Escolha pelo menos um livro.', 'error')
    setSalvando(true)
    try {
      const salvo = await salvarVideo(f, livros.map(l => l.id), usuario?.id)
      onSalvo(salvo)
      setF(salvo)
      notify('Vídeo salvo.')
      if (f.palavra) verificarPalavra()
    } catch (e) {
      notify('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!f.id || !window.confirm('Excluir este vídeo? As recusas registradas continuam no histórico do parceiro.')) return
    try { await excluirVideo(f.id); onExcluido(f.id); notify('Vídeo excluído.') }
    catch (e) { notify('Erro ao excluir: ' + e.message, 'error') }
  }

  async function confirmarRecusa() {
    if (!recusa?.livro_id || !recusa?.motivo) return notify('Escolha o livro e o motivo.', 'error')
    try {
      await registrarRecusa({ video_id: f.id, parceiro_id: f.parceiro_id, livro_id: recusa.livro_id, motivo: recusa.motivo, observacao: recusa.observacao })
      const restantes = livros.filter(l => l.id !== recusa.livro_id)
      if (f.id) await sincronizarLivros(f.id, restantes.map(l => l.id))
      setLivros(restantes)
      setF(x => ({ ...x, etapa: 'livro_sugerido', dt_livro_aceito: null }))
      setRecusas(await getRecusasParceiro(f.parceiro_id))
      setRecusa(null)
      notify('Recusa registrada. Sugira outro livro e salve o vídeo.')
    } catch (e) {
      notify('Erro ao registrar a recusa: ' + e.message, 'error')
    }
  }

  function mensagemGrupo() {
    const nome = (parceiro?.nome || '').split(' ')[0]
    const lista = livros.map(l => `• ${l.titulo} (ISBN ${isbnDe(l)})`).join('\n')
    const prazoCru = vencimento(f, 'video_cru', cfg, adesao)
    return [
      `Olá, ${nome}! Segue o roteiro do próximo vídeo do Collab BookTime.`,
      '',
      livros.length > 1 ? `Kit:\n${lista}` : `Livro: ${livros[0] ? `${livros[0].titulo} (ISBN ${isbnDe(livros[0])})` : ''}`,
      `Postagem prevista: ${fmtLongo(f.data_postagem)}${adesao?.horario_preferido ? ` às ${hora(adesao.horario_preferido)}` : ''}`,
      prazoCru ? `Envio do vídeo gravado até: ${fmtLongo(prazoCru)}` : null,
      f.palavra ? `Palavra para o comentário: ${String(f.palavra).toUpperCase()}` : null,
      '',
      'Roteiro:',
      f.roteiro || '',
    ].filter(x => x !== null).join('\n')
  }

  const aceitos = adesoes.filter(a => a.status === 'aceitou' || a.parceiro_id === f.parceiro_id)

  return (
    <div className="modal-backdrop cb-drawer-bg" onClick={onFechar}>
      <aside className="cb-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Vídeo do Collab BookTime">
        <header className="cb-drawer-h">
          <div>
            <h2 className="modal-title">{parceiro?.nome || 'Novo vídeo'}</h2>
            <p className="page-subtitle">{tituloLivros({ livros: livros.map(l => ({ livro: l })) }) || 'Escolha o parceiro e o livro'}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="cb-drawer-body">
          {/* Etapa */}
          <section className="cb-sec">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-parc">Parceiro</label>
                <select id="cb-v-parc" className="form-select" value={f.parceiro_id || ''} onChange={e => escolherParceiro(e.target.value)}>
                  <option value="">Escolha…</option>
                  {aceitos.map(a => <option key={a.parceiro_id} value={a.parceiro_id}>{a.parceiro?.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-etapa">Etapa concluída</label>
                <select id="cb-v-etapa" className="form-select" value={f.etapa} onChange={e => irParaEtapa(e.target.value)}>
                  {ETAPAS.map(e => <option key={e.k} value={e.k}>{e.label}</option>)}
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
            {proxima && f.etapa !== 'cancelado' && (
              <button className="btn btn-primary btn-sm cb-avancar" onClick={() => irParaEtapa(proxima.k)}>Marcar como feito: {proxima.label}</button>
            )}
            <div className="cb-flags">
              <label className="cb-check"><input type="checkbox" checked={!!f.em_ajuste} onChange={e => v('em_ajuste', e.target.checked)} /> Em ajuste (parceiro pediu alteração)</label>
              <label className="cb-check"><input type="checkbox" checked={!!f.historico} onChange={e => v('historico', e.target.checked)} /> Registro de vídeo antigo (sem alertas de prazo)</label>
            </div>
          </section>

          {/* Data */}
          <section className="cb-sec">
            <h3>Postagem</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-data">Data de postagem</label>
                <input id="cb-v-data" className="form-input" type="date" value={f.data_postagem || ''} onChange={e => v('data_postagem', e.target.value)} />
              </div>
              <div className="form-group cb-data-status">
                {f.data_confirmada ? <span className="badge badge-green">Confirmada</span> : <span className="badge badge-gray">Prevista</span>}
                {risco && (
                  <button className="btn btn-ghost btn-sm" onClick={() => v('data_postagem', sugerirData(addDias(hoje, 3), adesao, videos, cfg?.meta_diaria, f.id))}>
                    <AlertTriangle size={13} /> Sugerir nova data
                  </button>
                )}
              </div>
            </div>
            {(adesao?.horario_preferido || adesao?.dias_preferidos?.length || adesao?.videos_por_semana) ? (
              <p className="cb-dica">
                Combinado com o parceiro: {[ritmoTexto(adesao), adesao?.dias_preferidos?.length ? adesao.dias_preferidos.map(d => SEMANA[d]).join(', ') : '', adesao?.horario_preferido ? `às ${hora(adesao.horario_preferido)}` : ''].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            {risco && <p className="cb-txt-red">O vídeo cru passou do prazo. A data de postagem está em risco.</p>}
            <Prazos f={f} cfg={cfg} adesao={adesao} hoje={hoje} />
          </section>

          {/* Livros */}
          <section className="cb-sec">
            <h3>Livro ou kit</h3>
            <ul className="cb-livros">
              {livros.map(l => {
                const r = recusaDe(l.id)
                return (
                  <li key={l.id}>
                    <div>
                      <strong>{l.titulo}</strong>
                      <small>{l.autor ? `${l.autor} · ` : ''}ISBN {isbnDe(l)}</small>
                      {r && <small className="cb-txt-amber"><AlertTriangle size={12} /> Este parceiro recusou este livro em {fmt(r.created_at.slice(0, 10))} ({MOTIVOS[r.motivo]}{r.observacao ? `: ${r.observacao}` : ''})</small>}
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => setLivros(lst => lst.filter(x => x.id !== l.id))} aria-label={`Remover ${l.titulo}`}><X size={14} /></button>
                  </li>
                )
              })}
            </ul>
            {livros.length < 4 && (
              <>
                <input className="form-input" placeholder="Buscar livro por título, autor ou ISBN" value={buscaLivro} onChange={e => setBuscaLivro(e.target.value)} aria-label="Buscar livro" />
                {achados.length > 0 && (
                  <ul className="cb-resultados">
                    {achados.map(l => (
                      <li key={l.id}>
                        <button onClick={() => adicionarLivro(l)}>
                          {l.titulo} <small>ISBN {isbnDe(l)}</small>{recusaDe(l.id) ? <small className="cb-txt-amber"> · já recusado por este parceiro</small> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {livros.length > 0 && f.parceiro_id && !recusa && (
              <button className="btn btn-ghost btn-sm" onClick={() => setRecusa({ livro_id: livros[0].id, motivo: 'livro', observacao: '' })}>Parceiro recusou um livro</button>
            )}
            {recusa && (
              <div className="cb-recusa">
                <div className="form-row">
                  <select className="form-select" value={recusa.livro_id} onChange={e => setRecusa(r => ({ ...r, livro_id: e.target.value }))} aria-label="Livro recusado">
                    {livros.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}
                  </select>
                  <select className="form-select" value={recusa.motivo} onChange={e => setRecusa(r => ({ ...r, motivo: e.target.value }))} aria-label="Motivo">
                    {Object.entries(MOTIVOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <input className="form-input" placeholder="Observação (opcional)" value={recusa.observacao} onChange={e => setRecusa(r => ({ ...r, observacao: e.target.value }))} aria-label="Observação da recusa" />
                <div className="form-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setRecusa(null)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={confirmarRecusa}>Registrar recusa</button>
                </div>
              </div>
            )}
            {recusas.length > 0 && (
              <details className="cb-details">
                <summary>Livros já recusados por este parceiro ({recusas.length})</summary>
                <ul className="cb-hist">
                  {recusas.map(r => <li key={r.id}>{fmt(r.created_at.slice(0, 10))} · {r.livro?.titulo} (ISBN {isbnDe(r.livro)}) · {MOTIVOS[r.motivo]}{r.observacao ? `: ${r.observacao}` : ''}</li>)}
                </ul>
              </details>
            )}
          </section>

          {/* Roteiro */}
          <section className="cb-sec">
            <h3>Roteiro e legenda</h3>
            <div className="form-group">
              <div className="cb-label-row">
                <label className="form-label" htmlFor="cb-v-rot">Roteiro</label>
                <button className="btn btn-ghost btn-sm" onClick={() => copiar(f.roteiro, notify, 'Roteiro copiado.')}><Copy size={13} /> Copiar</button>
              </div>
              <textarea id="cb-v-rot" className="form-textarea cb-textarea-alta" value={f.roteiro || ''} onChange={e => v('roteiro', e.target.value)} />
            </div>
            <div className="form-group">
              <div className="cb-label-row">
                <label className="form-label" htmlFor="cb-v-leg">Legenda do post</label>
                <button className="btn btn-ghost btn-sm" onClick={() => copiar(f.legenda, notify, 'Legenda copiada.')}><Copy size={13} /> Copiar</button>
              </div>
              <textarea id="cb-v-leg" className="form-textarea" value={f.legenda || ''} onChange={e => v('legenda', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => copiar(mensagemGrupo(), notify, 'Mensagem copiada. Cole no grupo do WhatsApp.')} disabled={!livros.length}>
              <Copy size={13} /> Copiar mensagem para o grupo
            </button>
          </section>

          {/* Automação */}
          <section className="cb-sec">
            <h3>Automação da DM</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-pal">Palavra do comentário</label>
                <input id="cb-v-pal" className="form-input" value={f.palavra || ''} onChange={e => { v('palavra', e.target.value); setAvisoPalavra([]) }} onBlur={verificarPalavra} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-livr">Livraria do parceiro</label>
                <input id="cb-v-livr" className="form-input" value={f.livraria || ''} onChange={e => v('livraria', e.target.value)} />
              </div>
            </div>
            {avisoPalavra.length > 0 && (
              <p className="cb-txt-amber"><AlertTriangle size={12} /> Palavra já usada: {avisoPalavra.map(x => `${x.parceiro?.nome || 'parceiro'} (${fmt(x.data_postagem)})`).join(', ')}. Você pode salvar mesmo assim.</p>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="cb-v-link">Link enviado na DM</label>
              <input id="cb-v-link" className="form-input" type="url" placeholder="https://" value={f.link_dm || ''} onChange={e => v('link_dm', e.target.value)} />
              {parceiro?.library_url && <small className="cb-dica">Loja do parceiro: <a href={parceiro.library_url} target="_blank" rel="noreferrer">{parceiro.library_url}</a></small>}
            </div>
          </section>

          {/* Arquivos */}
          <section className="cb-sec">
            <h3>Arquivos e links</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="cb-v-cru">Vídeo cru</label>
              <input id="cb-v-cru" className="form-input" type="url" placeholder="Link (opcional)" value={f.link_video_cru || ''} onChange={e => v('link_video_cru', e.target.value)} />
              <label className="cb-check"><input type="checkbox" checked={!!f.video_cru_whatsapp} onChange={e => v('video_cru_whatsapp', e.target.checked)} /> Recebido pelo WhatsApp</label>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-ed">Vídeo editado (Drive)</label>
                <input id="cb-v-ed" className="form-input" type="url" value={f.link_video_editado || ''} onChange={e => v('link_video_editado', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-capa">Capa (Drive)</label>
                <input id="cb-v-capa" className="form-input" type="url" value={f.link_capa || ''} onChange={e => v('link_capa', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cb-v-post">Post publicado</label>
              <input id="cb-v-post" className="form-input" type="url" value={f.link_post || ''} onChange={e => v('link_post', e.target.value)} />
            </div>
          </section>

          {/* Responsáveis */}
          <section className="cb-sec">
            <h3>Responsáveis</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-cur">Livro e roteiro</label>
                <select id="cb-v-cur" className="form-select" value={f.resp_curadoria || ''} onChange={e => v('resp_curadoria', e.target.value)}>
                  <option value="">Ninguém</option>
                  {equipe.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cb-v-prod">Mensagens, edição, automação e post</label>
                <select id="cb-v-prod" className="form-select" value={f.resp_producao || ''} onChange={e => v('resp_producao', e.target.value)}>
                  <option value="">Ninguém</option>
                  {equipe.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Resultado */}
          <section className="cb-sec">
            <h3>Resultado {f.etapa === 'postado' && (f.dt_postado || f.data_postagem) ? <small>medir em {fmt(addDias(f.dt_postado || f.data_postagem, Number(cfg?.dias_medicao ?? 7)))}</small> : null}</h3>
            <div className="cb-res">
              {[['resultado_visualizacoes', 'Visualizações'], ['resultado_pessoas_palavra', 'Pessoas que comentaram a palavra'], ['resultado_vendas_unid', 'Vendas (unidades)']].map(([k, l]) => (
                <div className="form-group" key={k}>
                  <label className="form-label" htmlFor={`cb-v-${k}`}>{l}</label>
                  <input id={`cb-v-${k}`} className="form-input" type="number" min="0" value={f[k] ?? ''}
                    onChange={e => setF(x => ({ ...x, [k]: e.target.value === '' ? null : parseInt(e.target.value, 10), dt_resultado: x.dt_resultado || hoje }))} />
                </div>
              ))}
            </div>
          </section>

          <section className="cb-sec">
            <div className="form-group">
              <label className="form-label" htmlFor="cb-v-obs">Observações</label>
              <textarea id="cb-v-obs" className="form-textarea" value={f.observacoes || ''} onChange={e => v('observacoes', e.target.value)} />
            </div>
          </section>
        </div>

        <footer className="cb-drawer-f">
          {f.id && <button className="btn btn-danger btn-sm" onClick={excluir}>Excluir</button>}
          <span className="cb-spacer" />
          <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar vídeo'}</button>
        </footer>
      </aside>
    </div>
  )
}

function Prazos({ f, cfg, adesao, hoje }) {
  if (!f.data_postagem) return null
  const atual = IDX[f.etapa] ?? -1
  return (
    <ol className="cb-prazos-lista">
      {ETAPAS.slice(1).map(e => {
        const due = vencimento(f, e.k, cfg, adesao)
        const feito = IDX[e.k] <= atual
        const atrasado = !feito && !f.historico && f.etapa !== 'cancelado' && due && due < hoje
        return (
          <li key={e.k} className={feito ? 'cb-feito' : atrasado ? 'cb-txt-red' : ''}>
            <span>{e.label}</span>
            <span>{feito ? `feito ${fmt(f[e.dt])}` : `até ${fmtLongo(due)}`}</span>
          </li>
        )
      })}
    </ol>
  )
}
