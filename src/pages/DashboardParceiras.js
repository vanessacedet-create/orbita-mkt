import { useEffect, useState } from 'react'
import { useAuth, PERFIL_GRUPO } from '../context/AuthContext'
import { getTarefas, getUsuarios } from '../lib/supabase'
import { getAtribuicoes } from '../lib/banco-tarefas'
import { getEditorasParceirasAtivas, getLivrariasParceirasAtivas } from '../lib/crm-editoras-parceiras'
import { getCheckagemCriativoMes } from '../lib/monitoramento-criativo'
import { getPromocoes, getTodasCampanhasPromocao, STATUS_PROMOCAO } from '../lib/promocoes-parceiras'
import { LayoutDashboard, Building2, Library, CheckSquare, Users, Megaphone, Palette } from 'lucide-react'

const GRUPO_ALVO = 'parceiras'

const STATUS_TAREFA_LABEL = { a_fazer: 'A fazer', em_andamento: 'Em andamento', concluido: 'Concluída' }
const STATUS_TAREFA_COR   = { a_fazer: '#6366f1', em_andamento: '#f59e0b', concluido: '#22c55e' }

const STATUS_ATRIB_LABEL = { a_fazer: 'A fazer', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída', cancelada: 'Cancelada' }
const STATUS_ATRIB_COR   = { a_fazer: '#6366f1', em_andamento: '#f59e0b', pausada: '#8b5cf6', concluida: '#22c55e', cancelada: '#ef4444' }

const STATUS_CRIATIVO_LABEL = { pendente: 'Pendente', iniciado: 'Iniciado', finalizado: 'Finalizado' }
const STATUS_CRIATIVO_COR   = { pendente: '#6b7280', iniciado: '#f59e0b', finalizado: '#22c55e' }

function grupoDeUsuario(u) { return u?.grupo || PERFIL_GRUPO[u?.perfil] || null }

// Uma tarefa não guarda o grupo direto — o grupo é descoberto pelos
// responsáveis (mesma lógica usada na página de Tarefas). Isso evita o
// bug antigo de "0 tarefas" quando a coluna grupo não estava confiável.
function idsResponsaveisTarefa(t) {
  const ids = (t.tarefa_responsaveis || []).map(r => r.usuario_id).filter(Boolean)
  if (t.responsavel_id && !ids.includes(t.responsavel_id)) ids.push(t.responsavel_id)
  if (ids.length === 0 && t.created_by) ids.push(t.created_by)
  return ids
}

function idsResponsaveisAtribuicao(a) {
  return (a.responsaveis || []).map(r => r.usuario_id).filter(Boolean)
}

function contarPorGrupo(lista, idsResponsaveisFn, grupoPorUsuario, grupoAlvo) {
  return lista.filter(item => idsResponsaveisFn(item).some(id => grupoPorUsuario[id] === grupoAlvo))
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

// ── CARD DE ESTATÍSTICA ─────────────────────────────────────
function CardStat({ icone: Icone, corBorda, corIcone, titulo, valor, loading, subtitulo, breakdown }) {
  const total = breakdown ? Object.values(breakdown.valores).reduce((a, b) => a + b, 0) : 0
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderTop:`3px solid ${corBorda}`, borderRadius:10, padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>{titulo}</span>
        <Icone size={16} color={corIcone} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize:36, fontWeight:800, color:corIcone, lineHeight:1, marginBottom:8 }}>
        {loading ? '—' : valor}
      </div>
      {subtitulo && <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom: breakdown ? 12 : 0 }}>{subtitulo}</div>}
      {breakdown && total > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
          <div style={{ height:6, borderRadius:99, background:'var(--surface-2)', overflow:'hidden', display:'flex' }}>
            {Object.entries(breakdown.valores).map(([status, count]) => count > 0 && (
              <div key={status} style={{ width:`${(count/total)*100}%`, background: breakdown.cores[status] || '#888' }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.entries(breakdown.valores).filter(([,c]) => c > 0).map(([status, count]) => (
              <div key={status} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                <div style={{ width:8, height:8, borderRadius:99, background: breakdown.cores[status] || '#888', flexShrink:0 }} />
                <span style={{ color:'var(--text-muted)' }}>{breakdown.labels[status] || status}</span>
                <strong style={{ color: breakdown.cores[status] || 'var(--text)' }}>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function DashboardParceiras() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [toast, showToast] = useToast()

  const [totalEditoras, setTotalEditoras] = useState(0)
  const [totalLivrarias, setTotalLivrarias] = useState(0)

  const [tarefasPorStatus, setTarefasPorStatus] = useState({})
  const [atribPorStatus, setAtribPorStatus] = useState({})
  const [criativoPorStatus, setCriativoPorStatus] = useState({})

  const [promocoes, setPromocoes] = useState([])
  const [totalCampanhasPromocao, setTotalCampanhasPromocao] = useState(0)

  useEffect(() => { carregar() }, []) // eslint-disable-line

  async function carregar() {
    setLoading(true)
    try {
      const hoje = new Date()
      const ano = hoje.getFullYear(), mes = hoje.getMonth() + 1

      const [editoras, livrarias, tarefas, usuarios, atribuicoes, checkagemCriativo, listaPromocoes, campanhasPromocao] = await Promise.all([
        getEditorasParceirasAtivas(),
        getLivrariasParceirasAtivas(),
        getTarefas(),
        getUsuarios(),
        getAtribuicoes().catch(() => []),
        getCheckagemCriativoMes({ ano, mes }).catch(() => []),
        getPromocoes(),
        getTodasCampanhasPromocao(),
      ])

      setTotalEditoras(editoras.length)
      setTotalLivrarias(livrarias.length)

      const grupoPorUsuario = {}
      for (const u of (usuarios || [])) grupoPorUsuario[u.id] = grupoDeUsuario(u)

      const tarefasParceiras = contarPorGrupo(tarefas, idsResponsaveisTarefa, grupoPorUsuario, GRUPO_ALVO)
      const tPorStatus = {}
      for (const t of tarefasParceiras) tPorStatus[t.status] = (tPorStatus[t.status] || 0) + 1
      setTarefasPorStatus(tPorStatus)

      const atribParceiras = contarPorGrupo(atribuicoes, idsResponsaveisAtribuicao, grupoPorUsuario, GRUPO_ALVO)
      const aPorStatus = {}
      for (const a of atribParceiras) aPorStatus[a.status] = (aPorStatus[a.status] || 0) + 1
      setAtribPorStatus(aPorStatus)

      const cPorStatus = {}
      for (const c of checkagemCriativo) {
        const st = STATUS_CRIATIVO_LABEL[c.status] ? c.status : 'pendente'
        cPorStatus[st] = (cPorStatus[st] || 0) + 1
      }
      setCriativoPorStatus(cPorStatus)

      setPromocoes(listaPromocoes)
      setTotalCampanhasPromocao(campanhasPromocao.length)
    } catch (e) {
      console.error(e)
      showToast('Erro ao carregar o dashboard.', 'error')
    } finally { setLoading(false) }
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const totalTarefas = Object.values(tarefasPorStatus).reduce((a, b) => a + b, 0)
  const totalAtrib = Object.values(atribPorStatus).reduce((a, b) => a + b, 0)
  const totalCriativo = Object.values(criativoPorStatus).reduce((a, b) => a + b, 0)

  const promPorStatus = {}
  for (const p of promocoes) promPorStatus[p.status] = (promPorStatus[p.status] || 0) + 1
  const STATUS_PROMOCAO_LABEL = {}; const STATUS_PROMOCAO_COR = {}
  for (const s of STATUS_PROMOCAO) { STATUS_PROMOCAO_LABEL[s.value] = s.label; STATUS_PROMOCAO_COR[s.value] = s.cor }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LayoutDashboard size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{saudacao}, {usuario?.nome?.split(' ')[0]} 👋</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Dashboard — Editoras Parceiras</p>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, marginBottom:16 }}>
        <CardStat icone={Building2} corBorda="var(--accent)" corIcone="var(--accent)" titulo="Editoras Parceiras" valor={totalEditoras} loading={loading} subtitulo="editoras cadastradas" />
        <CardStat icone={Library} corBorda="#22c55e" corIcone="#22c55e" titulo="Livrarias" valor={totalLivrarias} loading={loading} subtitulo="livrarias cadastradas" />
        <CardStat icone={Megaphone} corBorda="#f97316" corIcone="#f97316" titulo="Promoções" valor={promocoes.length} loading={loading}
          subtitulo={`${totalCampanhasPromocao} campanha${totalCampanhasPromocao !== 1 ? 's' : ''} no total`}
          breakdown={{ valores: promPorStatus, labels: STATUS_PROMOCAO_LABEL, cores: STATUS_PROMOCAO_COR }} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16 }}>
        <CardStat icone={CheckSquare} corBorda="#6366f1" corIcone="#6366f1" titulo="Tarefas" valor={totalTarefas} loading={loading}
          subtitulo="tarefas do dia a dia"
          breakdown={{ valores: tarefasPorStatus, labels: STATUS_TAREFA_LABEL, cores: STATUS_TAREFA_COR }} />
        <CardStat icone={Users} corBorda="#8b5cf6" corIcone="#8b5cf6" titulo="Atribuições" valor={totalAtrib} loading={loading}
          subtitulo="banco de tarefas atribuídas"
          breakdown={{ valores: atribPorStatus, labels: STATUS_ATRIB_LABEL, cores: STATUS_ATRIB_COR }} />
        <CardStat icone={Palette} corBorda="#ec4899" corIcone="#ec4899" titulo="Criativo (Monitoramento)" valor={totalCriativo} loading={loading}
          subtitulo="tarefas fixas do mês atual"
          breakdown={{ valores: criativoPorStatus, labels: STATUS_CRIATIVO_LABEL, cores: STATUS_CRIATIVO_COR }} />
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
