import { useEffect, useState } from 'react'
import { getMonitoramento } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'

// ── UTILITÁRIOS DE DATA ────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function diaDaSemana(ano, mes, dia) {
  let a = ano, m = mes
  if (m < 3) { m += 12; a -= 1 }
  const k = a % 100
  const j = Math.floor(a / 100)
  const h = (dia + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7
  return ((h + 6) % 7)
}

function diasNoMes(ano, mes) {
  if (mes === 2) {
    const bis = (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0)
    return bis ? 29 : 28
  }
  return [0,31,28,31,30,31,30,31,31,30,31,30,31][mes]
}

function pad(n) { return String(n).padStart(2,'0') }
function toKey(a, m, d) { return `${a}-${pad(m)}-${pad(d)}` }
function hojeKey() {
  const d = new Date()
  return toKey(d.getFullYear(), d.getMonth()+1, d.getDate())
}

function gerarGrid(ano, mes) {
  const primeiroDia = diaDaSemana(ano, mes, 1)
  const total = diasNoMes(ano, mes)
  const grid = []
  if (primeiroDia > 0) {
    const ma = mes === 1 ? 12 : mes - 1
    const aa = mes === 1 ? ano - 1 : ano
    const ta = diasNoMes(aa, ma)
    for (let i = primeiroDia - 1; i >= 0; i--)
      grid.push({ key: toKey(aa, ma, ta - i), dia: ta - i, doMes: false })
  }
  for (let d = 1; d <= total; d++)
    grid.push({ key: toKey(ano, mes, d), dia: d, doMes: true })
  const resto = grid.length % 7
  if (resto > 0) {
    const mp = mes === 12 ? 1 : mes + 1
    const ap = mes === 12 ? ano + 1 : ano
    for (let d = 1; d <= 7 - resto; d++)
      grid.push({ key: toKey(ap, mp, d), dia: d, doMes: false })
  }
  return grid
}

// ── STATUS ─────────────────────────────────────────────────
const STATUS = {
  publicado:   { icon: '✅', cor: '#22c55e', label: 'Postou' },
  nao_publicou:{ icon: '❌', cor: '#ef4444', label: 'Não postou' },
  confirmado:  { icon: '🕐', cor: '#eab308', label: 'Pendente' },
  convidado:   { icon: '🕐', cor: '#eab308', label: 'Pendente' },
  sem_retorno: { icon: '💬', cor: '#6b7280', label: 'Sem retorno' },
  recusou:     { icon: '🚫', cor: '#ef4444', label: 'Recusou' },
}

function statusInfo(s) {
  return STATUS[s] || { icon: '🕐', cor: '#6b7280', label: s }
}

// ── MODAL DIA ──────────────────────────────────────────────
function ModalDia({ dataKey, entradas, onClose }) {
  const [a, m, d] = dataKey.split('-').map(Number)
  const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const titulo = `${d} de ${MESES[m-1]} de ${a}`

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:520,maxHeight:'80vh',overflowY:'auto'}}>
        <div className="modal-header">
          <h2 className="modal-title">{titulo}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:4}}>
          {entradas.map((e,i) => {
            const st = statusInfo(e.status)
            const ehCombinada = e.data_publicacao_combinada === dataKey
            return (
              <div key={i} style={{
                background:'var(--surface-2)', border:`1px solid var(--border)`,
                borderLeft:`3px solid ${st.cor}`, borderRadius:8, padding:'10px 14px'
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>
                    {e.parceiros?.nome || '—'}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                    <span>{st.icon}</span>
                    <span style={{color:st.cor,fontWeight:600}}>{st.label}</span>
                  </div>
                </div>
                <div style={{fontSize:12,color:'var(--accent)',marginBottom:2}}>
                  {e.campanhas?.nome || '—'}
                </div>
                <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                  {e.data_inicio && <span>Início: {e.data_inicio.split('-').reverse().join('/')}</span>}
                  {e.data_fim && <span>Fim: {e.data_fim.split('-').reverse().join('/')}</span>}
                  {ehCombinada && (
                    <span style={{color:'var(--amber)',fontWeight:600}}>⭐ Data combinada</span>
                  )}
                </div>
                {e.link_publicacao && (
                  <a href={e.link_publicacao} target="_blank" rel="noreferrer"
                    style={{fontSize:11,color:'var(--accent)',marginTop:4,display:'block'}}>
                    🔗 Ver publicação
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Monitoramento() {
  const agora = new Date()
  const [ano, setAno]     = useState(agora.getFullYear())
  const [mes, setMes]     = useState(agora.getMonth() + 1)
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalDia, setModalDia] = useState(null)

  async function carregar(a, m) {
    setLoading(true)
    try { setDados(await getMonitoramento({ ano: a, mes: m })) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar(ano, mes) }, [ano, mes])

  function navMes(delta) {
    let nm = mes + delta, na = ano
    if (nm > 12) { nm = 1; na++ }
    if (nm < 1)  { nm = 12; na-- }
    setMes(nm); setAno(na)
  }

  const grid = gerarGrid(ano, mes)
  const hj   = hojeKey()

  // Monta porDia: cada parceiro aparece em TODOS os dias do seu período
  const porDia = {}

  for (const cp of dados) {
    const datas = new Set()

    // Adiciona todos os dias entre data_inicio e data_fim
    if (cp.data_inicio && cp.data_fim) {
      const ini = new Date(cp.data_inicio + 'T12:00:00')
      const fim = new Date(cp.data_fim + 'T12:00:00')
      const cur = new Date(ini)
      while (cur <= fim) {
        const k = toKey(cur.getFullYear(), cur.getMonth()+1, cur.getDate())
        datas.add(k)
        cur.setDate(cur.getDate() + 1)
      }
    } else if (cp.data_inicio) {
      datas.add(cp.data_inicio)
    } else if (cp.data_fim) {
      datas.add(cp.data_fim)
    }

    // Também adiciona data_publicacao_combinada
    if (cp.data_publicacao_combinada) {
      datas.add(cp.data_publicacao_combinada)
    }

    for (const key of datas) {
      if (!porDia[key]) porDia[key] = []
      // Evita duplicata do mesmo cp no mesmo dia
      if (!porDia[key].find(x => x.id === cp.id)) {
        porDia[key].push(cp)
      }
    }
  }

  // Contagem do mês
  const diasComEntradas = Object.keys(porDia).filter(k => k.startsWith(`${ano}-${pad(mes)}`))
  const totalEntradas   = diasComEntradas.reduce((acc, k) => acc + porDia[k].length, 0)
  const totalPendentes  = dados.filter(cp => ['convidado','confirmado','sem_retorno'].includes(cp.status)).length
  const totalPostou     = dados.filter(cp => cp.status === 'publicado').length
  const totalNao        = dados.filter(cp => cp.status === 'nao_publicou').length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Eye size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>Monitoramento</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {totalEntradas} entrada{totalEntradas!==1?'s':''} em {MESES[mes-1].toLowerCase()} {ano}
            </p>
          </div>
        </div>
        {/* Resumo do mês */}
        <div style={{display:'flex',gap:16}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#22c55e'}}>{totalPostou}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase'}}>Postaram</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#eab308'}}>{totalPendentes}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase'}}>Pendentes</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#ef4444'}}>{totalNao}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase'}}>Não postaram</div>
          </div>
        </div>
      </div>

      {/* Navegação do mês */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:20,
        marginBottom:16, background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 20px'
      }}>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(-1)}><ChevronLeft size={18}/></button>
        <span style={{fontSize:18,fontWeight:700,color:'var(--text)',minWidth:220,textAlign:'center'}}>
          {MESES[mes-1]} {ano}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={()=>navMes(1)}><ChevronRight size={18}/></button>
      </div>

      {/* Legenda */}
      <div style={{display:'flex',gap:16,marginBottom:16,flexWrap:'wrap'}}>
        {Object.entries(STATUS).filter(([k])=>['publicado','nao_publicou','confirmado','sem_retorno','recusou'].includes(k)).map(([k,v])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text-muted)'}}>
            <span>{v.icon}</span><span style={{color:v.cor}}>{v.label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text-muted)'}}>
          <span style={{color:'var(--amber)'}}>⭐</span><span>Data combinada</span>
        </div>
      </div>

      {/* Calendário */}
      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',width:'100%'}}>
            {/* Header dias da semana */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(0, 1fr))',borderBottom:'1px solid var(--border)'}}>
              {DIAS_SEMANA.map((d,i)=>(
                <div key={d} style={{
                  padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:700,
                  color: i===0||i===6 ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.05em'
                }}>{d}</div>
              ))}
            </div>

            {/* Grade */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(0, 1fr))'}}>
              {grid.map(({key, dia, doMes}, i) => {
                const entradas = porDia[key] || []
                const ehHoje   = key === hj
                const col      = i % 7
                const fds      = col===0||col===6
                const ultima   = i >= grid.length - 7

                // Ordena: não postou primeiro (urgente), depois pendentes, depois postou
                const ordenadas = [...entradas].sort((a,b) => {
                  const ordem = { nao_publicou:0, sem_retorno:1, convidado:2, confirmado:3, recusou:4, publicado:5 }
                  return (ordem[a.status]??9) - (ordem[b.status]??9)
                })

                return (
                  <div key={`${key}-${i}`}
                    onClick={()=>entradas.length>0&&doMes&&setModalDia({key, entradas:ordenadas})}
                    style={{
                      minHeight:110, width:'100%', overflow:'hidden', boxSizing:'border-box',
                      padding:'6px 5px',
                      borderRight: col<6 ? '1px solid var(--border)' : 'none',
                      borderBottom: !ultima ? '1px solid var(--border)' : 'none',
                      background: ehHoje ? 'var(--accent-glow)' : fds&&doMes ? 'rgba(255,255,255,0.012)' : 'transparent',
                      opacity: doMes ? 1 : 0.3,
                      cursor: entradas.length>0&&doMes ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e=>{ if(entradas.length>0&&doMes) e.currentTarget.style.background='var(--surface-2)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background = ehHoje?'var(--accent-glow)':fds&&doMes?'rgba(255,255,255,0.012)':'transparent' }}
                  >
                    {/* Número do dia */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:24, height:24, borderRadius:'50%', fontSize:12, marginBottom:3,
                      fontWeight: ehHoje?800:500,
                      color: ehHoje?'#fff':fds?'var(--accent)':'var(--text-muted)',
                      background: ehHoje?'var(--accent)':'transparent', flexShrink:0
                    }}>{dia}</div>

                    {/* Entradas do dia */}
                    {ordenadas.slice(0,4).map((cp, idx) => {
                      const st = statusInfo(cp.status)
                      const ehCombinada = cp.data_publicacao_combinada === key
                      return (
                        <div key={`${cp.id}-${idx}`} style={{
                          marginBottom:2, padding:'2px 5px', borderRadius:3,
                          background:`${st.cor}18`, borderLeft:`3px solid ${st.cor}`,
                          overflow:'hidden', width:'100%', boxSizing:'border-box',
                          display:'flex', alignItems:'center', gap:4
                        }}>
                          <span style={{fontSize:9,flexShrink:0}}>{st.icon}</span>
                          <span style={{
                            fontSize:10, fontWeight:600, color:'var(--text)',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1
                          }}>
                            {cp.parceiros?.nome || '—'}
                          </span>
                          {ehCombinada && <span style={{fontSize:9,flexShrink:0}}>⭐</span>}
                        </div>
                      )
                    })}
                    {ordenadas.length > 4 && (
                      <div style={{fontSize:10,color:'var(--text-muted)',paddingLeft:4}}>
                        +{ordenadas.length - 4} mais
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      {modalDia && (
        <ModalDia
          dataKey={modalDia.key}
          entradas={modalDia.entradas}
          onClose={()=>setModalDia(null)}
        />
      )}
    </div>
  )
}
