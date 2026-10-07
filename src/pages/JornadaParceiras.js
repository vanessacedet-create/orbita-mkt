import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMembros, criarMembro, atualizarMembro, getColaboradoresRH,
  getFeriados, getDiasInativos, criarDiaInativo, deletarDiaInativo,
  getRegistros, upsertRegistro,
} from '../lib/jornada-parceiras'
import {
  Clock, ChevronLeft, ChevronRight, Users, Plus, Trash2, Pencil,
  X, Ban, Info
} from 'lucide-react'

// ── CONSTANTES ─────────────────────────────────────────────
const SITUACOES = [
  { value: 'normal',        label: 'Normal',                  cor: 'var(--text-muted)' },
  { value: 'falta',         label: 'Falta',                   cor: 'var(--red)' },
  { value: 'atestado',      label: 'Atestado',                cor: '#f97316' },
  { value: 'ferias',        label: 'Férias',                  cor: '#6366f1' },
  { value: 'folga',         label: 'Folga',                   cor: '#0ea5e9' },
  { value: 'home_office',   label: 'Home office',             cor: '#22c55e' },
  { value: 'esquecimento',  label: 'Esquecimento de marcação', cor: '#eab308' },
]

const TIPO_LABEL = { efetiva: 'Efetiva', estagiaria: 'Estagiária', supervisora: 'Supervisora' }

const TOLERANCIA_MIN = 15

const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ── HELPERS DE TEMPO ───────────────────────────────────────
function horaParaMinutos(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minutosParaHoraLegivel(min) {
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

function formatarSaldo(min) {
  if (min == null) return '—'
  const sinal = min > 0 ? '+' : min < 0 ? '−' : ''
  return `${sinal}${minutosParaHoraLegivel(min)}`
}

function corSaldo(min) {
  if (min == null) return 'var(--text-muted)'
  if (min > 0) return 'var(--green)'
  if (min < 0) return 'var(--red)'
  return 'var(--text-muted)'
}

function dataISOparaObj(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

function proximoDiaISO(iso) {
  const d = dataISOparaObj(iso)
  const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
}

function ehFimDeSemana(dataISO) {
  const d = dataISOparaObj(dataISO).getDay()
  return d === 0 || d === 6
}

function fmtDataBR(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function listarDatasDoPeriodo(inicio, fim) {
  const datas = []
  let atual = dataISOparaObj(inicio)
  const fimObj = dataISOparaObj(fim)
  while (atual <= fimObj) {
    const iso = `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(atual.getDate()).padStart(2, '0')}`
    datas.push(iso)
    atual = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + 1)
  }
  return datas
}

function primeiroEUltimoDiaDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

function objParaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hojeISO() {
  return objParaISO(new Date())
}

// ── CÁLCULO DE HORAS TRABALHADAS E SALDO ──────────────────
function calcularHorasTrabalhadas(reg, membro) {
  if (!reg) return null
  if (['falta', 'ferias', 'folga'].includes(reg.situacao)) return null
  if (reg.situacao === 'atestado' && (reg.atestado_horas == null || reg.atestado_horas === '')) return null
  if (!reg.entrada || !reg.saida_final) return null

  const entrada = horaParaMinutos(reg.entrada)
  const saidaFinal = horaParaMinutos(reg.saida_final)
  if (entrada == null || saidaFinal == null) return null

  let bruto = saidaFinal - entrada

  const ehEstagiaria = membro?.tipo === 'estagiaria'

  // Almoço:
  // - Efetivas e supervisora: desconta o almoço inteiro (fica fora da jornada).
  // - Estagiária: os campos de almoço são o intervalo dela. Até 20min (ou o limite
  //   da ficha do RH) não desconta; só o que passar disso é descontado.
  if (reg.saida_almoco && reg.retorno_almoco) {
    const saidaAlmoco = horaParaMinutos(reg.saida_almoco)
    const retornoAlmoco = horaParaMinutos(reg.retorno_almoco)
    if (saidaAlmoco != null && retornoAlmoco != null) {
      const durAlmoco = retornoAlmoco - saidaAlmoco
      if (ehEstagiaria) {
        const limite = limiteIntervaloMembro(membro)
        if (durAlmoco > limite) bruto -= (durAlmoco - limite)
      } else {
        bruto -= durAlmoco
      }
    }
  }

  // Café:
  // - Efetivas: desconta apenas o que passar de 15min (ou o limite da ficha do RH).
  // - Estagiária: não tem café (o intervalo dela é o do almoço); se houver algo
  //   lançado no café, é descontado integralmente.
  const durCafe = duracaoIntervalo(reg)
  if (durCafe != null && durCafe > 0) {
    if (ehEstagiaria) {
      bruto -= durCafe
    } else {
      const limite = limiteIntervaloMembro(membro)
      if (durCafe > limite) bruto -= (durCafe - limite)
    }
  }
  return bruto
}

// Limite do café: usa o valor da ficha do RH; se não houver, aplica a regra padrão
function limiteIntervaloMembro(membro) {
  if (membro?.intervalo_remunerado_min != null && membro.intervalo_remunerado_min !== '') {
    return Number(membro.intervalo_remunerado_min)
  }
  return membro?.tipo === 'estagiaria' ? 20 : 15
}

// Saldo do dia = horas no escritório + horas em casa/evento − jornada.
// Casa/evento entram no saldo (e portanto no banco de horas) uma única vez.
function calcularSaldoDiario(reg, membro) {
  if (!membro) return null
  const jornadaMin = (Number(membro.jornada_horas) || 0) * 60
  const extras = calcularHorasExtras(reg)
  if (reg && reg.situacao === 'atestado') {
    if (reg.atestado_horas == null || reg.atestado_horas === '') return extras // dia inteiro
    const trabalhadas = calcularHorasTrabalhadas(reg, membro) || 0
    const alvoReduzido = jornadaMin - (Number(reg.atestado_horas) * 60)
    return trabalhadas + extras - alvoReduzido
  }
  if (reg && ['ferias', 'folga'].includes(reg.situacao)) return extras
  if (reg && reg.situacao === 'falta') return -jornadaMin + extras
  const trabalhadas = calcularHorasTrabalhadas(reg, membro)
  if (trabalhadas == null) return null
  return trabalhadas + extras - jornadaMin
}

// Um dia conta como dívida quando está em branco ou incompleto e já passou
// (é anterior a hoje) e é posterior à data do saldo inicial da ficha do RH.
// O dia de hoje nunca vira dívida enquanto estiver incompleto.
function diaContaDivida(data, membro, hoje) {
  return !!membro?.saldo_inicial_data && data > membro.saldo_inicial_data && data < hoje
}

// Saldo final do dia, já aplicando a regra de dívida ("pendente de preenchimento").
function saldoDoDia(reg, membro, contaDivida) {
  const s = calcularSaldoDiario(reg, membro)
  if (s != null) return { saldo: s, pendente: false }
  if (contaDivida && membro) {
    return { saldo: -((Number(membro.jornada_horas) || 0) * 60) + calcularHorasExtras(reg), pendente: true }
  }
  return { saldo: null, pendente: false }
}

function diaBloqueado(data, membro, feriados, diasInativos) {
  if (ehFimDeSemana(data)) return true
  if (feriados.some(f => f.data === data)) return true
  if (diasInativos.some(d => d.data === data && (d.membro_id === membro.id || !d.membro_id))) return true
  return false
}

// Banco de horas TOTAL (situação real até hoje, independente do período na tela):
// saldo inicial da ficha do RH + saldo de cada dia, do dia seguinte à data do
// saldo inicial até hoje. Casa/evento lançados em fim de semana ou feriado também contam.
function calcularBancoTotal(membro, registros, feriados, diasInativos) {
  if (!membro?.saldo_inicial_data) return null
  const hoje = hojeISO()
  let total = Number(membro.saldo_inicial_minutos) || 0
  let extrasTotal = 0
  const inicio = proximoDiaISO(membro.saldo_inicial_data)
  if (inicio > hoje) return { total, extrasTotal }
  const mapa = {}
  ;(registros || []).forEach(r => { mapa[r.data] = r })
  for (const data of listarDatasDoPeriodo(inicio, hoje)) {
    const reg = mapa[data]
    const extras = calcularHorasExtras(reg)
    extrasTotal += extras
    if (diaBloqueado(data, membro, feriados, diasInativos)) { total += extras; continue }
    const { saldo } = saldoDoDia(reg, membro, diaContaDivida(data, membro, hoje))
    if (saldo != null) total += saldo
  }
  return { total, extrasTotal }
}

// Duração real do almoço (retorno - saída), em minutos
function duracaoAlmoco(reg) {
  if (!reg?.saida_almoco || !reg?.retorno_almoco) return null
  return horaParaMinutos(reg.retorno_almoco) - horaParaMinutos(reg.saida_almoco)
}

// Duração esperada do almoço, a partir da jornada padrão da pessoa (fallback 60min)
function duracaoAlmocoEsperada(membro) {
  if (membro?.tipo === 'estagiaria') return limiteIntervaloMembro(membro)
  if (membro?.almoco_inicio_padrao && membro?.almoco_fim_padrao) {
    return horaParaMinutos(membro.almoco_fim_padrao) - horaParaMinutos(membro.almoco_inicio_padrao)
  }
  return 60
}

// Duração real do intervalo remunerado (café), em minutos
function duracaoIntervalo(reg) {
  if (!reg?.intervalo_inicio || !reg?.intervalo_fim) return null
  return horaParaMinutos(reg.intervalo_fim) - horaParaMinutos(reg.intervalo_inicio)
}

// Horas em casa + evento, em minutos — entram no saldo do dia (e no banco de horas)
function calcularHorasExtras(reg) {
  return (Number(reg?.horas_casa_min) || 0) + (Number(reg?.horas_evento_min) || 0)
}

function calcularTotalGeral(reg, membro) {
  const base = calcularHorasTrabalhadas(reg, membro)
  const extras = calcularHorasExtras(reg)
  if (base == null && extras === 0) return null
  return (base || 0) + extras
}

// Contador simples (fora do React) de quantos autosaves estão "no ar" agora.
// Usado só pra decidir se mostramos o aviso do navegador ao tentar fechar a aba.
let salvamentosPendentes = 0

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3500) }
  return [t, show]
}


// ── LINHA DE UM DIA (editável) ─────────────────────────────
function CartaoDia({ data, membro, registro, bloqueio, editavel, contaDivida, onSalvarCampo, onSalvarTudo }) {
  const ehEstagiaria = membro?.tipo === 'estagiaria'
  const [entrada, setEntrada] = useState(registro?.entrada || '')
  const [saidaAlmoco, setSaidaAlmoco] = useState(registro?.saida_almoco || '')
  const [retornoAlmoco, setRetornoAlmoco] = useState(registro?.retorno_almoco || '')
  const [saidaFinal, setSaidaFinal] = useState(registro?.saida_final || '')
  const [intervaloInicio, setIntervaloInicio] = useState(registro?.intervalo_inicio || '')
  const [intervaloFim, setIntervaloFim] = useState(registro?.intervalo_fim || '')
  const [situacao, setSituacao] = useState(registro?.situacao || 'normal')
  const [atestadoDiaInteiro, setAtestadoDiaInteiro] = useState(registro?.atestado_horas == null)
  const [atestadoHoras, setAtestadoHoras] = useState(registro?.atestado_horas ?? '')
  const [observacoes, setObservacoes] = useState(registro?.observacoes || '')
  const [horasCasa, setHorasCasa] = useState(registro?.horas_casa_min ?? '')
  const [horasEvento, setHorasEvento] = useState(registro?.horas_evento_min ?? '')
  const [obsAberta, setObsAberta] = useState(false)

  const regAtual = {
    entrada, saida_almoco: saidaAlmoco, retorno_almoco: retornoAlmoco, saida_final: saidaFinal,
    intervalo_inicio: intervaloInicio, intervalo_fim: intervaloFim, situacao, observacoes,
    horas_casa_min: horasCasa, horas_evento_min: horasEvento,
    atestado_horas: (situacao === 'atestado' && !atestadoDiaInteiro && atestadoHoras !== '') ? Number(atestadoHoras) : null,
  }
  const horasTrabalhadas = calcularHorasTrabalhadas(regAtual, membro)
  const { saldo, pendente } = saldoDoDia(regAtual, membro, contaDivida)
  const extras = calcularHorasExtras(regAtual)
  const totalGeral = calcularTotalGeral(regAtual, membro)
  const durAlmoco = duracaoAlmoco(regAtual)
  const durAlmocoEsperada = duracaoAlmocoEsperada(membro)
  const durIntervalo = duracaoIntervalo(regAtual)
  // Estagiária não tem café: qualquer tempo lançado ali é descontado integralmente
  const limiteIntervalo = ehEstagiaria ? 0 : limiteIntervaloMembro(membro)
  // Para a estagiária, o campo de café só aparece se já houver algo lançado nele
  const mostrarCafe = !ehEstagiaria || !!(registro?.intervalo_inicio || registro?.intervalo_fim || intervaloInicio || intervaloFim)

  // Versão com os tipos certos pra mandar pro banco (números convertidos, vazio vira null)
  const regParaSalvar = {
    entrada: entrada || null,
    saida_almoco: saidaAlmoco || null,
    retorno_almoco: retornoAlmoco || null,
    saida_final: saidaFinal || null,
    intervalo_inicio: intervaloInicio || null,
    intervalo_fim: intervaloFim || null,
    situacao,
    atestado_horas: (situacao === 'atestado' && !atestadoDiaInteiro && atestadoHoras !== '') ? Number(atestadoHoras) : null,
    observacoes: observacoes.trim() || null,
    horas_casa_min: horasCasa !== '' ? Number(horasCasa) : null,
    horas_evento_min: horasEvento !== '' ? Number(horasEvento) : null,
  }

  // Autosave com atraso curto: além de salvar campo a campo ao sair do campo,
  // reenvia o estado inteiro do dia ~700ms depois de qualquer mudança. Isso cobre
  // o caso de a pessoa fechar a aba rápido demais para o salvamento do "onBlur"
  // terminar de chegar no banco — o dia inteiro fica sempre coberto por um envio
  // recente, não só o último campo em que ela ficou parada.
  const primeiraRenderRef = useRef(true)
  const sujoRef = useRef(false)
  const ultimoRegRef = useRef(regParaSalvar)
  ultimoRegRef.current = regParaSalvar
  // Se a janela do dia for fechada antes do autosave terminar, salva na hora
  useEffect(() => () => {
    if (sujoRef.current) onSalvarTudo(data, ultimoRegRef.current)
  }, [])
  useEffect(() => {
    if (primeiraRenderRef.current) { primeiraRenderRef.current = false; return }
    sujoRef.current = true
    let jaSalvou = false
    salvamentosPendentes++
    const timer = setTimeout(async () => {
      jaSalvou = true
      sujoRef.current = false
      try { await onSalvarTudo(data, regParaSalvar) }
      finally { salvamentosPendentes = Math.max(0, salvamentosPendentes - 1) }
    }, 700)
    return () => {
      clearTimeout(timer)
      if (!jaSalvou) salvamentosPendentes = Math.max(0, salvamentosPendentes - 1)
    }
  }, [entrada, saidaAlmoco, retornoAlmoco, saidaFinal, intervaloInicio, intervaloFim, situacao, atestadoDiaInteiro, atestadoHoras, observacoes, horasCasa, horasEvento])

  const diaSemanaIdx = dataISOparaObj(data).getDay()
  const situacaoInfo = SITUACOES.find(s => s.value === situacao) || SITUACOES[0]
  const hojeISO = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}` })()
  const ehHoje = data === hojeISO

  function salvar(campo, valor) {
    onSalvarCampo(data, campo, valor)
  }

  function avisoTolerancia() {
    if (!membro?.entrada_padrao || !entrada) return null
    const diff = horaParaMinutos(entrada) - horaParaMinutos(membro.entrada_padrao)
    if (diff > TOLERANCIA_MIN) return `chegou ${diff}min depois do combinado`
    return null
  }

  if (bloqueio) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 92, fontWeight: 600 }}>
          {DIAS_SEMANA_CURTO[diaSemanaIdx]} {fmtDataBR(data)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ban size={12} /> {bloqueio}
        </span>
      </div>
    )
  }

  const timeInputStyle = { width: 82, padding: '5px 6px', fontSize: 13, textAlign: 'center' }

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10, marginBottom: 8,
      background: 'var(--surface)', border: `1px solid ${ehHoje ? 'var(--accent)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {DIAS_SEMANA_CURTO[diaSemanaIdx]} {fmtDataBR(data)}
          </span>
          {ehHoje && <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>hoje</span>}
          {registro?.editado_por_supervisora && (
            <span title="Corrigido pela supervisora" style={{ display: 'flex', color: 'var(--accent)', opacity: 0.7 }}>
              <Pencil size={11} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="form-select" style={{ fontSize: 11, padding: '4px 8px', width: 'auto', color: situacaoInfo.cor }} value={situacao} disabled={!editavel}
            onChange={e => { setSituacao(e.target.value); salvar('situacao', e.target.value) }}>
            {SITUACOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => setObsAberta(o => !o)} title={observacoes || 'Adicionar observação'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: observacoes ? 'var(--accent)' : 'var(--text-muted)', opacity: observacoes ? 1 : 0.4, display: 'flex' }}>
            <Info size={14} />
          </button>
        </div>
      </div>

      {situacao === 'atestado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: 'rgba(249,115,22,0.06)', borderRadius: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: editavel ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={atestadoDiaInteiro} disabled={!editavel}
              onChange={e => {
                const diaInteiro = e.target.checked
                setAtestadoDiaInteiro(diaInteiro)
                salvar('atestado_horas', diaInteiro ? null : (atestadoHoras !== '' ? Number(atestadoHoras) : null))
              }}
              style={{ width: 13, height: 13, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Atestado de dia inteiro
          </label>
          {!atestadoDiaInteiro && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quantas horas?</span>
              <input type="number" min="0" step="0.5" className="form-input" style={{ width: 60, padding: '3px 6px', fontSize: 12 }}
                value={atestadoHoras} disabled={!editavel}
                onChange={e => setAtestadoHoras(e.target.value)}
                onBlur={() => salvar('atestado_horas', atestadoHoras !== '' ? Number(atestadoHoras) : null)}
                placeholder="Ex: 3" />
            </div>
          )}
        </div>
      )}

      {obsAberta && (
        <div style={{ marginBottom: 10 }}>
          <textarea className="form-input" rows={2} style={{ fontSize: 12, width: '100%' }} value={observacoes} disabled={!editavel}
            onChange={e => setObservacoes(e.target.value)}
            onBlur={() => salvar('observacoes', observacoes.trim() || null)}
            placeholder="Observação sobre o dia..." />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Entrada</label>
          <input type="time" className="form-input" style={timeInputStyle} value={entrada} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => setEntrada(e.target.value)} onBlur={() => salvar('entrada', entrada || null)} />
          {avisoTolerancia() && <div style={{ fontSize: 9, color: '#eab308', marginTop: 3, maxWidth: 90 }}>{avisoTolerancia()}</div>}
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Saída almoço</label>
          <input type="time" className="form-input" style={timeInputStyle} value={saidaAlmoco} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => setSaidaAlmoco(e.target.value)} onBlur={() => salvar('saida_almoco', saidaAlmoco || null)} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Retorno almoço</label>
          <input type="time" className="form-input" style={timeInputStyle} value={retornoAlmoco} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => setRetornoAlmoco(e.target.value)} onBlur={() => salvar('retorno_almoco', retornoAlmoco || null)} />
          {durAlmoco != null && (
            <div style={{ fontSize: 9, marginTop: 3, maxWidth: 110, color: durAlmoco > durAlmocoEsperada ? 'var(--red)' : 'var(--text-muted)' }}>
              {minutosParaHoraLegivel(durAlmoco)} de almoço{durAlmoco > durAlmocoEsperada ? ` (+${durAlmoco - durAlmocoEsperada}min)` : ''}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Saída final</label>
          <input type="time" className="form-input" style={timeInputStyle} value={saidaFinal} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => setSaidaFinal(e.target.value)} onBlur={() => salvar('saida_final', saidaFinal || null)} />
        </div>
        {mostrarCafe && <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{ehEstagiaria ? 'Café (desconta integralmente)' : 'Café (início–fim)'}</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="time" className="form-input" style={{ ...timeInputStyle, width: 74 }} value={intervaloInicio} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
              onChange={e => setIntervaloInicio(e.target.value)} onBlur={() => salvar('intervalo_inicio', intervaloInicio || null)} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>–</span>
            <input type="time" className="form-input" style={{ ...timeInputStyle, width: 74 }} value={intervaloFim} disabled={!editavel} onClick={e => e.currentTarget.showPicker?.()}
              onChange={e => setIntervaloFim(e.target.value)} onBlur={() => salvar('intervalo_fim', intervaloFim || null)} />
          </div>
          {durIntervalo != null && (
            <div style={{ fontSize: 9, marginTop: 3, maxWidth: 150, color: (durIntervalo > limiteIntervalo) ? 'var(--red)' : 'var(--text-muted)' }}>
              {minutosParaHoraLegivel(durIntervalo)} de café{(durIntervalo > limiteIntervalo) ? ` (−${durIntervalo - limiteIntervalo}min)` : ''}
            </div>
          )}
        </div>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Horas em casa (min)</label>
          <input type="number" min="0" className="form-input" style={{ width: 82, padding: '5px 6px', fontSize: 13, textAlign: 'center' }} value={horasCasa} disabled={!editavel}
            onChange={e => setHorasCasa(e.target.value)} onBlur={() => salvar('horas_casa_min', horasCasa !== '' ? Number(horasCasa) : null)} placeholder="0" />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Horas de evento (min)</label>
          <input type="number" min="0" className="form-input" style={{ width: 82, padding: '5px 6px', fontSize: 13, textAlign: 'center' }} value={horasEvento} disabled={!editavel}
            onChange={e => setHorasEvento(e.target.value)} onBlur={() => salvar('horas_evento_min', horasEvento !== '' ? Number(horasEvento) : null)} placeholder="0" />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>No escritório</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{horasTrabalhadas != null ? minutosParaHoraLegivel(horasTrabalhadas) : '—'}</div>
          </div>
          {extras > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Casa+evento</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{minutosParaHoraLegivel(extras)}</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total geral</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{totalGeral != null ? minutosParaHoraLegivel(totalGeral) : '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saldo</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: corSaldo(saldo) }}>{formatarSaldo(saldo)}</div>
            {pendente && <div style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase' }}>pendente de preenchimento</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── COLUNA DE UM DIA NA GRADE SEMANAL (resumo compacto) ───
function etiquetaStyle(cor) {
  return { fontSize: 9, fontWeight: 700, color: cor, border: `1px solid ${cor}`, borderRadius: 4, padding: '1px 4px', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.3 }
}

function fmtHora(h) {
  return h ? String(h).slice(0, 5) : ''
}

function ColunaDia({ data, membro, registro, bloqueio, foraDoPeriodo, contaDivida, ehHoje, onAbrir }) {
  const diaIdx = dataISOparaObj(data).getDay()
  const [, mes, dia] = data.split('-')
  const cabecalho = (
    <div style={{ textAlign: 'center', marginBottom: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: ehHoje ? 'var(--accent)' : 'var(--text)' }}>{dia}/{mes}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{DIAS_SEMANA_CURTO[diaIdx]}{ehHoje ? ' · hoje' : ''}</div>
    </div>
  )
  const base = { borderRadius: 8, padding: '8px 6px', border: `1px solid ${ehHoje ? 'var(--accent)' : 'var(--border)'}`, minHeight: 130, boxSizing: 'border-box' }

  if (foraDoPeriodo) return <div style={{ ...base, opacity: 0.25 }}>{cabecalho}</div>

  const extras = calcularHorasExtras(registro)

  if (bloqueio) {
    return (
      <div style={{ ...base, background: 'rgba(255,255,255,0.02)' }}>
        {cabecalho}
        {!ehFimDeSemana(data) && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>{bloqueio}</div>}
        {extras > 0 && <div style={{ textAlign: 'center', marginTop: 6 }}><span style={etiquetaStyle('#22c55e')}>+{minutosParaHoraLegivel(extras)} casa/ev.</span></div>}
      </div>
    )
  }

  const { saldo, pendente } = saldoDoDia(registro, membro, contaDivida)
  const situ = registro?.situacao && registro.situacao !== 'normal' ? SITUACOES.find(s => s.value === registro.situacao) : null
  const horarios = [registro?.entrada, registro?.saida_almoco, registro?.retorno_almoco, registro?.saida_final].filter(Boolean)
  const temCafe = registro?.intervalo_inicio && registro?.intervalo_fim

  return (
    <button type="button" onClick={onAbrir} title="Clique para ver e editar o dia"
      style={{ ...base, background: 'var(--surface)', cursor: 'pointer', textAlign: 'center', color: 'inherit', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
      {cabecalho}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
        {horarios.length > 0
          ? horarios.map((h, i) => <span key={i}>{fmtHora(h)}</span>)
          : <span style={{ opacity: 0.4 }}>—</span>}
        {temCafe && <span style={{ fontSize: 10, opacity: 0.8 }}>café {fmtHora(registro.intervalo_inicio)}–{fmtHora(registro.intervalo_fim)}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, alignItems: 'center' }}>
        {situ && <span style={etiquetaStyle(situ.cor)}>{situ.label}</span>}
        {extras > 0 && <span style={etiquetaStyle('#22c55e')}>+{minutosParaHoraLegivel(extras)} casa/ev.</span>}
        {pendente && <span style={etiquetaStyle('var(--red)')}>pendente</span>}
        {registro?.observacoes && <span style={{ fontSize: 9, color: 'var(--accent)' }}>• observação</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: corSaldo(saldo) }}>{formatarSaldo(saldo)}</div>
    </button>
  )
}

// ── TABELA DE JORNADA (resumo + grade semanal) ────────────
function TabelaJornada({ membro, registros, banco, feriados, diasInativos, dataInicio, dataFim, editavel, onSalvarCampo }) {
  const [diaAberto, setDiaAberto] = useState(null)
  const hoje = hojeISO()
  const datas = useMemo(() => listarDatasDoPeriodo(dataInicio, dataFim), [dataInicio, dataFim])
  const registrosPorData = useMemo(() => {
    const map = {}
    registros.forEach(r => { map[r.data] = r })
    return map
  }, [registros])

  function motivoBloqueio(data) {
    if (ehFimDeSemana(data)) return 'Fim de semana'
    const feriado = feriados.find(f => f.data === data)
    if (feriado) return `Feriado: ${feriado.nome}`
    const inativoIndividual = diasInativos.find(d => d.data === data && d.membro_id === membro.id)
    if (inativoIndividual) return `Dia inativo${inativoIndividual.motivo ? ': ' + inativoIndividual.motivo : ''}`
    const inativoGeral = diasInativos.find(d => d.data === data && !d.membro_id)
    if (inativoGeral) return `Dia inativo — equipe${inativoGeral.motivo ? ': ' + inativoGeral.motivo : ''}`
    return null
  }

  // Saldo e casa/evento do período selecionado
  const totais = useMemo(() => {
    let saldoTotal = 0, extras = 0
    for (const data of datas) {
      const reg = registrosPorData[data]
      const ex = calcularHorasExtras(reg)
      extras += ex
      if (motivoBloqueio(data)) { saldoTotal += ex; continue }
      const { saldo } = saldoDoDia(reg, membro, diaContaDivida(data, membro, hoje))
      if (saldo != null) saldoTotal += saldo
    }
    return { saldoTotal, extras }
  }, [datas, registrosPorData, diasInativos, feriados, membro, hoje])

  // Semanas (segunda a domingo) que cobrem o período selecionado
  const semanas = useMemo(() => {
    if (!datas.length) return []
    const primeiro = dataISOparaObj(datas[0])
    const desloc = (primeiro.getDay() + 6) % 7
    let cursor = new Date(primeiro.getFullYear(), primeiro.getMonth(), primeiro.getDate() - desloc)
    const fim = dataISOparaObj(datas[datas.length - 1])
    const lista = []
    while (cursor <= fim) {
      const dias = []
      for (let i = 0; i < 7; i++) dias.push(objParaISO(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)))
      lista.push(dias)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
    }
    return lista
  }, [datas])

  const rotulo = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }
  const notinha = { fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={rotulo}>Banco de horas total</div>
          {banco?.status === 'ok' && (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: corSaldo(banco.total) }}>{formatarSaldo(banco.total)}</div>
              <div style={notinha}>desde {fmtDataBR(membro.saldo_inicial_data)} até hoje</div>
            </>
          )}
          {banco?.status === 'carregando' && <div style={{ ...notinha, marginTop: 8 }}>Calculando...</div>}
          {banco?.status === 'sem_data' && <div style={{ ...notinha, marginTop: 8 }}>Preencha o saldo inicial e a data do saldo inicial na ficha do RH para ativar.</div>}
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={rotulo}>Saldo do período</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: corSaldo(totais.saldoTotal) }}>{formatarSaldo(totais.saldoTotal)}</div>
          <div style={notinha}>{fmtDataBR(dataInicio)} a {fmtDataBR(dataFim)}</div>
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={rotulo}>Casa / eventos no período</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{minutosParaHoraLegivel(totais.extras)}</div>
          {banco?.status === 'ok' && <div style={notinha}>Desde o início: {minutosParaHoraLegivel(banco.extrasTotal)}</div>}
          <div style={{ ...notinha, fontStyle: 'italic' }}>Já incluídas no banco de horas e nos saldos.</div>
        </div>
      </div>

      {semanas.map(sem => (
        <div key={sem[0]} className="table-card" style={{ padding: '10px 12px', marginBottom: 12, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            <strong style={{ color: 'var(--text)' }}>Semana de</strong> {fmtDataBR(sem[0])} a {fmtDataBR(sem[6])}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(96px, 1fr)) repeat(2, minmax(64px, 0.6fr))', gap: 6, minWidth: 640 }}>
            {sem.map(data => (
              <ColunaDia key={data} data={data} membro={membro} registro={registrosPorData[data]}
                bloqueio={motivoBloqueio(data)}
                foraDoPeriodo={data < dataInicio || data > dataFim}
                contaDivida={diaContaDivida(data, membro, hoje)}
                ehHoje={data === hoje}
                onAbrir={() => setDiaAberto(data)} />
            ))}
          </div>
        </div>
      ))}

      {diaAberto && (
        <div onClick={() => setDiaAberto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDiaAberto(null)}><X size={14} /> Fechar</button>
            </div>
            <CartaoDia key={diaAberto} data={diaAberto} membro={membro} registro={registrosPorData[diaAberto]}
              bloqueio={null} editavel={editavel}
              contaDivida={diaContaDivida(diaAberto, membro, hoje)}
              onSalvarCampo={(d, campo, valor) => onSalvarCampo(membro.id, d, { [campo]: valor })}
              onSalvarTudo={(d, campos) => onSalvarCampo(membro.id, d, campos)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── PAINEL: DIAS INATIVOS (só supervisora) ─────────────────
function PainelDiasInativos({ membros, diasInativos, onCriar, onDeletar, showToast }) {
  const [data, setData] = useState('')
  const [membroId, setMembroId] = useState('') // '' = toda a equipe
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCriar() {
    if (!data) return
    setSaving(true)
    try {
      await onCriar({ data, membro_id: membroId || null, motivo: motivo.trim() || null })
      setData(''); setMembroId(''); setMotivo('')
      showToast('Dia inativo registrado!')
    } finally { setSaving(false) }
  }

  const ordenados = diasInativos.slice().sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ban size={14} /> Dias inativos
      </h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Data</label>
          <input type="date" className="form-input" style={{ fontSize: 12, padding: '5px 8px' }} value={data} onChange={e => setData(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Quem</label>
          <select className="form-select" style={{ fontSize: 12, padding: '5px 8px' }} value={membroId} onChange={e => setMembroId(e.target.value)}>
            <option value="">Toda a equipe</option>
            {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Motivo</label>
          <input className="form-input" style={{ fontSize: 12, padding: '5px 8px', width: '100%' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Atestado, folga, decisão da empresa..." />
        </div>
        <button className="btn btn-primary btn-sm" disabled={!data || saving} onClick={handleCriar}>
          <Plus size={12} /> Adicionar
        </button>
      </div>

      {ordenados.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum dia inativo cadastrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordenados.map(d => {
            const membro = membros.find(m => m.id === d.membro_id)
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtDataBR(d.data)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{membro ? membro.nome : 'Toda a equipe'}</span>
                {d.motivo && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>— {d.motivo}</span>}
                <button onClick={() => onDeletar(d.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', opacity: 0.6 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────
export default function JornadaParceiras() {
  const { session, usuario } = useAuth()
  const [membros, setMembros] = useState([])
  const [colaboradoresRH, setColaboradoresRH] = useState([])
  const [feriados, setFeriados] = useState([])
  const [diasInativos, setDiasInativos] = useState([])
  const [registros, setRegistros] = useState([])
  // Registros desde a data do saldo inicial até hoje (para o banco de horas total)
  const [acumulado, setAcumulado] = useState({ membroId: null, regs: [] })
  const [bancosEquipe, setBancosEquipe] = useState({})
  const [carregandoRegistros, setCarregandoRegistros] = useState(true)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('minha') // 'minha' | 'equipe'
  const [membroSelecionadoId, setMembroSelecionadoId] = useState('')
  const [toast, showToast] = useToast()

  const hoje = new Date()
  const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const periodoInicialDoMes = primeiroEUltimoDiaDoMes(anoMesAtual)
  const [dataInicio, setDataInicio] = useState(periodoInicialDoMes.inicio)
  const [dataFim, setDataFim] = useState(periodoInicialDoMes.fim)

  const emailLogado = (session?.user?.email || '').toLowerCase()

  // Se tentar fechar a aba/navegar embora enquanto ainda tem autosave em andamento,
  // o navegador avisa — evita perder o que acabou de ser digitado.
  useEffect(() => {
    function avisarSeTiverPendente(e) {
      if (salvamentosPendentes > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', avisarSeTiverPendente)
    return () => window.removeEventListener('beforeunload', avisarSeTiverPendente)
  }, [])

  async function carregarBase() {
    const [ms, fs, dis, cols] = await Promise.all([getMembros(), getFeriados(), getDiasInativos(), getColaboradoresRH()])
    setMembros(ms); setFeriados(fs); setDiasInativos(dis); setColaboradoresRH(cols)
  }
  useEffect(() => { carregarBase().finally(() => setLoading(false)) }, [])

  const meuMembro = useMemo(
    () => membros.find(m => m.email && m.email.toLowerCase() === emailLogado),
    [membros, emailLogado]
  )
  const souSupervisora = usuario?.perfil === 'supervisor_parceiras'

  // Sincronização com o RH: a ficha do colaborador no RH Parceiras é a fonte da
  // verdade (cargo, tipo de contrato, jornada padrão, saldo inicial). Aqui a gente
  // cria (se for a primeira vez) ou atualiza o registro correspondente na Jornada,
  // pareando por e-mail — sem precisar de nenhum cadastro manual nesta página.
  const sincronizandoRef = useRef(false)
  useEffect(() => {
    if (loading || sincronizandoRef.current || colaboradoresRH.length === 0) return
    sincronizandoRef.current = true
    ;(async () => {
      const atualizacoes = []
      for (const col of colaboradoresRH) {
        if (!col.email) continue
        const emailCol = col.email.toLowerCase()
        const camposRH = {
          nome: col.nome,
          cargo: col.cargo,
          tipo: col.tipo_contrato === 'Estágio' ? 'estagiaria' : 'efetiva',
          jornada_horas: col.jornada_horas ?? 8,
          entrada_padrao: col.entrada_padrao || null,
          saida_padrao: col.saida_padrao || null,
          almoco_inicio_padrao: col.almoco_inicio_padrao || null,
          almoco_fim_padrao: col.almoco_fim_padrao || null,
          intervalo_remunerado_min: col.intervalo_remunerado_min ?? null,
          saldo_inicial_minutos: col.saldo_inicial_minutos ?? 0,
          saldo_inicial_data: col.saldo_inicial_data || null,
        }
        const existente = membros.find(m => m.email && m.email.toLowerCase() === emailCol)
        try {
          if (!existente) {
            atualizacoes.push(await criarMembro({ email: col.email, ...camposRH }))
          } else {
            const mudou = Object.keys(camposRH).some(k => String(existente[k] ?? '') !== String(camposRH[k] ?? ''))
            if (mudou) atualizacoes.push(await atualizarMembro(existente.id, camposRH))
          }
        } catch (e) { console.error(e) }
      }
      if (atualizacoes.length > 0) {
        setMembros(prev => {
          const mapa = new Map(prev.map(m => [m.id, m]))
          atualizacoes.forEach(m => mapa.set(m.id, m))
          return Array.from(mapa.values())
        })
      }
      sincronizandoRef.current = false
    })()
  }, [loading, colaboradoresRH])

  useEffect(() => {
    if (souSupervisora && membros.length > 0 && !membroSelecionadoId) {
      setMembroSelecionadoId(meuMembro?.id || membros[0].id)
    }
  }, [souSupervisora, membros, membroSelecionadoId, meuMembro])

  const membroVisivel = aba === 'equipe'
    ? membros.find(m => m.id === membroSelecionadoId)
    : meuMembro

  useEffect(() => {
    if (!membroVisivel) { setRegistros([]); setCarregandoRegistros(false); return }
    setCarregandoRegistros(true)
    getRegistros(membroVisivel.id, dataInicio, dataFim)
      .then(r => { setRegistros(r); setCarregandoRegistros(false) })
      .catch(e => { console.error(e); setCarregandoRegistros(false) })
  }, [membroVisivel?.id, dataInicio, dataFim])

  // Banco de horas total: busca os registros da data do saldo inicial até hoje,
  // independente do período escolhido na tela.
  useEffect(() => {
    const id = membroVisivel?.id
    const ini = membroVisivel?.saldo_inicial_data
    if (!id || !ini) { setAcumulado({ membroId: null, regs: [] }); return }
    const hoje = hojeISO()
    if (ini > hoje) { setAcumulado({ membroId: id, regs: [] }); return }
    let cancelado = false
    getRegistros(id, ini, hoje)
      .then(regs => { if (!cancelado) setAcumulado({ membroId: id, regs }) })
      .catch(console.error)
    return () => { cancelado = true }
  }, [membroVisivel?.id, membroVisivel?.saldo_inicial_data])

  const bancoVisivel = useMemo(() => {
    if (!membroVisivel?.saldo_inicial_data) return { status: 'sem_data' }
    if (acumulado.membroId !== membroVisivel.id) return { status: 'carregando' }
    return { status: 'ok', ...calcularBancoTotal(membroVisivel, acumulado.regs, feriados, diasInativos) }
  }, [membroVisivel, acumulado, feriados, diasInativos])

  // Visão da equipe: banco de horas total de cada pessoa
  useEffect(() => {
    if (!souSupervisora || aba !== 'equipe' || membros.length === 0) return
    let cancelado = false
    const hoje = hojeISO()
    ;(async () => {
      const res = {}
      for (const m of membros) {
        if (!m.saldo_inicial_data) continue
        try {
          const regs = m.saldo_inicial_data <= hoje ? await getRegistros(m.id, m.saldo_inicial_data, hoje) : []
          res[m.id] = calcularBancoTotal(m, regs, feriados, diasInativos)
        } catch (e) { console.error(e) }
      }
      if (!cancelado) setBancosEquipe(res)
    })()
    return () => { cancelado = true }
  }, [souSupervisora, aba, membros, feriados, diasInativos])

  function bancoDoMembro(m) {
    if (m.id === membroVisivel?.id && bancoVisivel.status === 'ok') return bancoVisivel.total
    return bancosEquipe[m.id]?.total ?? null
  }

  async function handleSalvarCampo(membroId, data, campos) {
    try {
      const editadaPorOutra = souSupervisora && meuMembro && membroId !== meuMembro.id
      const payload = editadaPorOutra ? { ...campos, editado_por_supervisora: true } : campos
      const upd = await upsertRegistro(membroId, data, payload)
      setRegistros(prev => {
        const idx = prev.findIndex(r => r.data === data)
        if (idx === -1) return [...prev, upd]
        const novo = [...prev]; novo[idx] = upd; return novo
      })
      setAcumulado(prev => {
        if (prev.membroId !== membroId) return prev
        const idx = prev.regs.findIndex(r => r.data === data)
        const regs = idx === -1 ? [...prev.regs, upd] : prev.regs.map((r, i) => (i === idx ? upd : r))
        return { ...prev, regs }
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar registro.', 'error') }
  }

  async function handleCriarDiaInativo(dados) {
    const novo = await criarDiaInativo(dados)
    setDiasInativos(prev => [...prev, novo])
  }
  async function handleDeletarDiaInativo(id) {
    await deletarDiaInativo(id)
    setDiasInativos(prev => prev.filter(d => d.id !== id))
  }

  function irParaMesAtual() {
    const p = primeiroEUltimoDiaDoMes(anoMesAtual)
    setDataInicio(p.inicio); setDataFim(p.fim)
  }
  function mudarMes(delta) {
    const [ano, mes] = dataInicio.split('-').map(Number)
    const d = new Date(ano, mes - 1 + delta, 1)
    const anoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const p = primeiroEUltimoDiaDoMes(anoMes)
    setDataInicio(p.inicio); setDataFim(p.fim)
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  if (!meuMembro && !souSupervisora) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Clock size={20} color="var(--accent)" />
          <h1 className="page-title" style={{ margin: 0 }}>Controle de Jornada — Parceiras</h1>
        </div>
        <div className="table-card" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Sua ficha ainda não foi encontrada no RH com o e-mail <strong style={{ color: 'var(--text)' }}>{session?.user?.email || '—'}</strong>.
            Peça para sua supervisora conferir sua ficha em RH → Colaboradores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Controle de Jornada — Parceiras</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {souSupervisora ? 'Visão da supervisora' : `Olá, ${meuMembro?.nome}`}
            </p>
          </div>
        </div>
      </div>

      {souSupervisora && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
          {[{ k: 'minha', l: 'Minha jornada' }, { k: 'equipe', l: 'Visão da equipe' }].map(t => (
            <button key={t.k} onClick={() => setAba(t.k)} style={{
              background: aba === t.k ? 'var(--accent)' : 'transparent',
              color: aba === t.k ? 'white' : 'var(--text)',
              border: 'none', padding: '7px 14px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t.l}</button>
          ))}
        </div>
      )}

      {aba === 'equipe' && souSupervisora && (
        <>
          <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <Users size={14} /> Equipe
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {membros.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '7px 10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 100 }}>{m.nome}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{m.cargo || '—'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{TIPO_LABEL[m.tipo] || m.tipo}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{m.jornada_horas}h/dia</span>
                  {m.saldo_inicial_data ? (
                    <>
                      <span style={{ fontWeight: 700, color: corSaldo(bancoDoMembro(m)) }}>
                        Banco atual: {bancoDoMembro(m) == null ? 'calculando...' : formatarSaldo(bancoDoMembro(m))}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        (saldo inicial {formatarSaldo(m.saldo_inicial_minutos)} em {fmtDataBR(m.saldo_inicial_data)})
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>sem saldo inicial definido</span>
                  )}
                  <span style={{ color: m.email ? 'var(--text-muted)' : 'var(--red)', fontSize: 11, marginLeft: 'auto' }}>{m.email || 'sem e-mail no RH'}</span>
                </div>
              ))}
              {membros.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum colaborador ativo encontrado no RH ainda.</p>}
            </div>
          </div>
          <PainelDiasInativos membros={membros} diasInativos={diasInativos} onCriar={handleCriarDiaInativo} onDeletar={handleDeletarDiaInativo} showToast={showToast} />

          <div className="table-card" style={{ padding: '14px 18px', marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Ver jornada de:</label>
            <select className="form-select" style={{ fontSize: 13, padding: '6px 10px', width: 'auto' }}
              value={membroSelecionadoId} onChange={e => setMembroSelecionadoId(e.target.value)}>
              {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        </>
      )}

      {/* Navegação de período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => mudarMes(-1)}><ChevronLeft size={14} /></button>
        <button className="btn btn-ghost btn-sm" onClick={irParaMesAtual}>Mês atual</button>
        <button className="btn btn-ghost btn-sm" onClick={() => mudarMes(1)}><ChevronRight size={14} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>De:</span>
          <input type="date" className="form-input" style={{ fontSize: 12, padding: '5px 8px' }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Até:</span>
          <input type="date" className="form-input" style={{ fontSize: 12, padding: '5px 8px' }} value={dataFim} onChange={e => setDataFim(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
        </div>
      </div>

      {membroVisivel ? (
        carregandoRegistros ? (
          <div className="table-card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando os registros...</p>
          </div>
        ) : (
          <TabelaJornada
            membro={membroVisivel}
            registros={registros}
            banco={bancoVisivel}
            feriados={feriados}
            diasInativos={diasInativos}
            dataInicio={dataInicio}
            dataFim={dataFim}
            editavel={true}
            onSalvarCampo={handleSalvarCampo}
          />
        )
      ) : (
        <div className="table-card" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selecione uma integrante para ver a jornada.</p>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
