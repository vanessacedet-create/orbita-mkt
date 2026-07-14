import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMembros, criarMembro, atualizarMembro, deletarMembro,
  getFeriados, getDiasInativos, criarDiaInativo, deletarDiaInativo,
  getRegistros, upsertRegistro,
} from '../lib/jornada-parceiras'
import {
  Clock, ChevronLeft, ChevronRight, Users, Plus, Trash2, Pencil,
  X, Check, Settings, Ban, Info
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

// ── CÁLCULO DE HORAS TRABALHADAS E SALDO ──────────────────
function calcularHorasTrabalhadas(reg, membro) {
  if (!reg) return null
  if (['falta', 'atestado', 'ferias', 'folga'].includes(reg.situacao)) return null
  if (!reg.entrada || !reg.saida_final) return null

  const entrada = horaParaMinutos(reg.entrada)
  const saidaFinal = horaParaMinutos(reg.saida_final)
  if (entrada == null || saidaFinal == null) return null

  let bruto = saidaFinal - entrada

  // Efetivas e supervisora descontam o almoço. Estagiária não desconta (seus 20min já
  // estão "dentro" da jornada de 6h, por definição combinada com a Vivi).
  if (membro?.tipo !== 'estagiaria' && reg.saida_almoco && reg.retorno_almoco) {
    const saidaAlmoco = horaParaMinutos(reg.saida_almoco)
    const retornoAlmoco = horaParaMinutos(reg.retorno_almoco)
    if (saidaAlmoco != null && retornoAlmoco != null) {
      bruto -= (retornoAlmoco - saidaAlmoco)
    }
  }
  return bruto
}

function calcularSaldoDiario(reg, membro) {
  if (!membro) return null
  if (reg && ['atestado', 'ferias', 'folga'].includes(reg.situacao)) return 0
  if (reg && reg.situacao === 'falta') return -(membro.jornada_horas * 60)
  const trabalhadas = calcularHorasTrabalhadas(reg, membro)
  if (trabalhadas == null) return null
  return trabalhadas - (membro.jornada_horas * 60)
}

// Duração real do almoço (retorno - saída), em minutos
function duracaoAlmoco(reg) {
  if (!reg?.saida_almoco || !reg?.retorno_almoco) return null
  return horaParaMinutos(reg.retorno_almoco) - horaParaMinutos(reg.saida_almoco)
}

// Duração esperada do almoço, a partir da jornada padrão da pessoa (fallback 60min)
function duracaoAlmocoEsperada(membro) {
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

// Horas extras (casa + evento), em minutos — contabilizadas à parte do saldo
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
function CartaoDia({ data, membro, registro, bloqueio, editavel, onSalvarCampo, onSalvarTudo }) {
  const [entrada, setEntrada] = useState(registro?.entrada || '')
  const [saidaAlmoco, setSaidaAlmoco] = useState(registro?.saida_almoco || '')
  const [retornoAlmoco, setRetornoAlmoco] = useState(registro?.retorno_almoco || '')
  const [saidaFinal, setSaidaFinal] = useState(registro?.saida_final || '')
  const [intervaloInicio, setIntervaloInicio] = useState(registro?.intervalo_inicio || '')
  const [intervaloFim, setIntervaloFim] = useState(registro?.intervalo_fim || '')
  const [situacao, setSituacao] = useState(registro?.situacao || 'normal')
  const [observacoes, setObservacoes] = useState(registro?.observacoes || '')
  const [horasCasa, setHorasCasa] = useState(registro?.horas_casa_min ?? '')
  const [horasEvento, setHorasEvento] = useState(registro?.horas_evento_min ?? '')
  const [obsAberta, setObsAberta] = useState(false)

  const regAtual = {
    entrada, saida_almoco: saidaAlmoco, retorno_almoco: retornoAlmoco, saida_final: saidaFinal,
    intervalo_inicio: intervaloInicio, intervalo_fim: intervaloFim, situacao, observacoes,
    horas_casa_min: horasCasa, horas_evento_min: horasEvento,
  }
  const horasTrabalhadas = calcularHorasTrabalhadas(regAtual, membro)
  const saldo = calcularSaldoDiario(regAtual, membro)
  const extras = calcularHorasExtras(regAtual)
  const totalGeral = calcularTotalGeral(regAtual, membro)
  const durAlmoco = duracaoAlmoco(regAtual)
  const durAlmocoEsperada = duracaoAlmocoEsperada(membro)
  const durIntervalo = duracaoIntervalo(regAtual)
  const limiteIntervalo = membro?.intervalo_remunerado_min

  // Versão com os tipos certos pra mandar pro banco (números convertidos, vazio vira null)
  const regParaSalvar = {
    entrada: entrada || null,
    saida_almoco: saidaAlmoco || null,
    retorno_almoco: retornoAlmoco || null,
    saida_final: saidaFinal || null,
    intervalo_inicio: intervaloInicio || null,
    intervalo_fim: intervaloFim || null,
    situacao,
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
  useEffect(() => {
    if (primeiraRenderRef.current) { primeiraRenderRef.current = false; return }
    let jaSalvou = false
    salvamentosPendentes++
    const timer = setTimeout(async () => {
      jaSalvou = true
      try { await onSalvarTudo(data, regParaSalvar) }
      finally { salvamentosPendentes = Math.max(0, salvamentosPendentes - 1) }
    }, 700)
    return () => {
      clearTimeout(timer)
      if (!jaSalvou) salvamentosPendentes = Math.max(0, salvamentosPendentes - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, saidaAlmoco, retornoAlmoco, saidaFinal, intervaloInicio, intervaloFim, situacao, observacoes, horasCasa, horasEvento])

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
          <input type="time" className="form-input" style={timeInputStyle} value={entrada} disabled={!editavel}
            onChange={e => setEntrada(e.target.value)} onBlur={() => salvar('entrada', entrada || null)} />
          {avisoTolerancia() && <div style={{ fontSize: 9, color: '#eab308', marginTop: 3, maxWidth: 90 }}>{avisoTolerancia()}</div>}
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Saída almoço</label>
          <input type="time" className="form-input" style={timeInputStyle} value={saidaAlmoco} disabled={!editavel}
            onChange={e => setSaidaAlmoco(e.target.value)} onBlur={() => salvar('saida_almoco', saidaAlmoco || null)} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Retorno almoço</label>
          <input type="time" className="form-input" style={timeInputStyle} value={retornoAlmoco} disabled={!editavel}
            onChange={e => setRetornoAlmoco(e.target.value)} onBlur={() => salvar('retorno_almoco', retornoAlmoco || null)} />
          {durAlmoco != null && (
            <div style={{ fontSize: 9, marginTop: 3, maxWidth: 110, color: durAlmoco > durAlmocoEsperada ? 'var(--red)' : 'var(--text-muted)' }}>
              {minutosParaHoraLegivel(durAlmoco)} de almoço{durAlmoco > durAlmocoEsperada ? ` (+${durAlmoco - durAlmocoEsperada}min)` : ''}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Saída final</label>
          <input type="time" className="form-input" style={timeInputStyle} value={saidaFinal} disabled={!editavel}
            onChange={e => setSaidaFinal(e.target.value)} onBlur={() => salvar('saida_final', saidaFinal || null)} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Café (início–fim)</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="time" className="form-input" style={{ ...timeInputStyle, width: 74 }} value={intervaloInicio} disabled={!editavel}
              onChange={e => setIntervaloInicio(e.target.value)} onBlur={() => salvar('intervalo_inicio', intervaloInicio || null)} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>–</span>
            <input type="time" className="form-input" style={{ ...timeInputStyle, width: 74 }} value={intervaloFim} disabled={!editavel}
              onChange={e => setIntervaloFim(e.target.value)} onBlur={() => salvar('intervalo_fim', intervaloFim || null)} />
          </div>
          {durIntervalo != null && (
            <div style={{ fontSize: 9, marginTop: 3, maxWidth: 150, color: (limiteIntervalo && durIntervalo > limiteIntervalo) ? 'var(--red)' : 'var(--text-muted)' }}>
              {minutosParaHoraLegivel(durIntervalo)} de café{(limiteIntervalo && durIntervalo > limiteIntervalo) ? ` (+${durIntervalo - limiteIntervalo}min)` : ''}
            </div>
          )}
        </div>
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TABELA DE JORNADA (todos os dias do período + totais) ─
function TabelaJornada({ membro, registros, registrosAcumulado, feriados, diasInativos, dataInicio, dataFim, editavel, onSalvarCampo }) {
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

  const totais = useMemo(() => {
    let horas = 0, saldoTotal = 0, extras = 0, diasComRegistro = 0, diasUteis = 0
    for (const data of datas) {
      if (motivoBloqueio(data)) continue
      diasUteis++
      const reg = registrosPorData[data]
      const trabalhadas = calcularHorasTrabalhadas(reg, membro)
      const saldo = calcularSaldoDiario(reg, membro)
      if (trabalhadas != null) { horas += trabalhadas; diasComRegistro++ }
      if (saldo != null) saldoTotal += saldo
      extras += calcularHorasExtras(reg)
    }
    return { horas, saldoTotal, extras, total: horas + extras, diasComRegistro, diasUteis }
  }, [datas, registrosPorData, diasInativos, feriados, membro])

  // Saldo acumulado (banco de horas) — saldo inicial + soma dos saldos diários
  // desde a data de referência até o fim do período selecionado.
  const saldoAcumulado = useMemo(() => {
    if (!membro?.saldo_inicial_data) return null
    let total = Number(membro.saldo_inicial_minutos) || 0
    const datasAcum = listarDatasDoPeriodo(membro.saldo_inicial_data, dataFim)
    const mapAcum = {}
    ;(registrosAcumulado || []).forEach(r => { mapAcum[r.data] = r })
    for (const data of datasAcum) {
      if (ehFimDeSemana(data)) continue
      if (feriados.some(f => f.data === data)) continue
      if (diasInativos.some(d => d.data === data && (d.membro_id === membro.id || !d.membro_id))) continue
      const saldo = calcularSaldoDiario(mapAcum[data], membro)
      if (saldo != null) total += saldo
    }
    return total
  }, [membro, dataFim, registrosAcumulado, feriados, diasInativos])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${saldoAcumulado != null ? 4 : 3}, 1fr)`, gap: 12, marginBottom: 16 }}>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>No escritório</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{minutosParaHoraLegivel(totais.horas)}</div>
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total geral (+casa/evento)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{minutosParaHoraLegivel(totais.total)}</div>
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo do período</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: corSaldo(totais.saldoTotal) }}>{formatarSaldo(totais.saldoTotal)}</div>
        </div>
        {saldoAcumulado != null && (
          <div className="table-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Banco de horas acumulado</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: corSaldo(saldoAcumulado) }}>{formatarSaldo(saldoAcumulado)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>desde {fmtDataBR(membro.saldo_inicial_data)}</div>
          </div>
        )}
      </div>

      <div>
        {datas.map(data => (
          <CartaoDia key={data} data={data} membro={membro} registro={registrosPorData[data]}
            bloqueio={motivoBloqueio(data)} editavel={editavel}
            onSalvarCampo={(d, campo, valor) => onSalvarCampo(membro.id, d, { [campo]: valor })}
            onSalvarTudo={(d, campos) => onSalvarCampo(membro.id, d, campos)}
          />
        ))}
      </div>
    </div>
  )
}

// ── PAINEL: JORNADA PADRÃO DE CADA MEMBRO (só supervisora) ─
function PainelJornadaPadrao({ membros, onAtualizar, showToast }) {
  const [editando, setEditando] = useState(null) // membro.id

  return (
    <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={14} /> Jornada padrão de cada integrante
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Nome', 'Tipo', 'Jornada (h)', 'Entrada', 'Saída', 'Almoço início', 'Almoço fim', 'Intervalo remun. (min)', 'Saldo inicial (h)', 'Data ref.', ''].map((h, i) => (
                <th key={i} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membros.map(m => {
              const emEdicao = editando === m.id
              return (
                <LinhaJornadaPadrao key={m.id} membro={m} emEdicao={emEdicao}
                  onEditar={() => setEditando(m.id)}
                  onSalvar={async (campos) => { await onAtualizar(m.id, campos); setEditando(null); showToast('Jornada padrão atualizada!') }}
                  onCancelar={() => setEditando(null)} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LinhaJornadaPadrao({ membro, emEdicao, onEditar, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    jornada_horas: membro.jornada_horas, entrada_padrao: membro.entrada_padrao || '',
    saida_padrao: membro.saida_padrao || '', almoco_inicio_padrao: membro.almoco_inicio_padrao || '',
    almoco_fim_padrao: membro.almoco_fim_padrao || '', intervalo_remunerado_min: membro.intervalo_remunerado_min ?? '',
    saldo_inicial_horas: membro.saldo_inicial_minutos ? (membro.saldo_inicial_minutos / 60).toFixed(2).replace(/\.00$/, '') : '',
    saldo_inicial_data: membro.saldo_inicial_data || '',
  })

  if (!emEdicao) {
    return (
      <tr>
        <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{membro.nome}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{TIPO_LABEL[membro.tipo] || membro.tipo}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.jornada_horas}h</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.entrada_padrao || '—'}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.saida_padrao || '—'}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.almoco_inicio_padrao || '—'}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.almoco_fim_padrao || '—'}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.intervalo_remunerado_min ?? '—'}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center', color: corSaldo(membro.saldo_inicial_minutos) }}>
          {membro.saldo_inicial_minutos ? formatarSaldo(membro.saldo_inicial_minutos) : '—'}
        </td>
        <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>{membro.saldo_inicial_data ? fmtDataBR(membro.saldo_inicial_data) : '—'}</td>
        <td style={{ padding: '7px 8px', textAlign: 'center' }}>
          <button onClick={onEditar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'inline-flex' }}>
            <Pencil size={12} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ background: 'var(--surface-2)' }}>
      <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 600 }}>{membro.nome}</td>
      <td style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{TIPO_LABEL[membro.tipo] || membro.tipo}</td>
      <td style={{ padding: '5px 4px' }}><input type="number" min="0" step="0.5" className="form-input" style={{ width: 56, padding: '3px 5px', fontSize: 12 }} value={form.jornada_horas} onChange={e => setForm(f => ({ ...f, jornada_horas: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.entrada_padrao} onChange={e => setForm(f => ({ ...f, entrada_padrao: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.saida_padrao} onChange={e => setForm(f => ({ ...f, saida_padrao: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.almoco_inicio_padrao} onChange={e => setForm(f => ({ ...f, almoco_inicio_padrao: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.almoco_fim_padrao} onChange={e => setForm(f => ({ ...f, almoco_fim_padrao: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="number" min="0" className="form-input" style={{ width: 56, padding: '3px 5px', fontSize: 12 }} value={form.intervalo_remunerado_min} onChange={e => setForm(f => ({ ...f, intervalo_remunerado_min: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px' }}><input type="number" step="0.25" className="form-input" style={{ width: 62, padding: '3px 5px', fontSize: 12 }} value={form.saldo_inicial_horas} onChange={e => setForm(f => ({ ...f, saldo_inicial_horas: e.target.value }))} placeholder="0" title="Horas (use negativo se for saldo devedor)" /></td>
      <td style={{ padding: '5px 4px' }}><input type="date" className="form-input" style={{ width: 116, padding: '3px 5px', fontSize: 12 }} value={form.saldo_inicial_data} onChange={e => setForm(f => ({ ...f, saldo_inicial_data: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} /></td>
      <td style={{ padding: '5px 4px', whiteSpace: 'nowrap' }}>
        <button onClick={() => onSalvar({
          jornada_horas: Number(form.jornada_horas) || 0,
          entrada_padrao: form.entrada_padrao || null,
          saida_padrao: form.saida_padrao || null,
          almoco_inicio_padrao: form.almoco_inicio_padrao || null,
          almoco_fim_padrao: form.almoco_fim_padrao || null,
          intervalo_remunerado_min: form.intervalo_remunerado_min !== '' ? Number(form.intervalo_remunerado_min) : null,
          saldo_inicial_minutos: form.saldo_inicial_horas !== '' ? Math.round(Number(form.saldo_inicial_horas) * 60) : 0,
          saldo_inicial_data: form.saldo_inicial_data || null,
        })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'inline-flex' }}><Check size={13} /></button>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}><X size={13} /></button>
      </td>
    </tr>
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

// ── PAINEL: EQUIPE (adicionar/editar/remover membros) ─────
function PainelEquipe({ membros, onCriar, onAtualizar, onDeletar, showToast }) {
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)

  return (
    <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <Users size={14} /> Equipe
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditando(null); setModal(true) }}>
          <Plus size={12} /> Nova integrante
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {membros.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '7px 10px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 100 }}>{m.nome}</span>
            <span style={{ color: 'var(--text-muted)' }}>{m.cargo || TIPO_LABEL[m.tipo]}</span>
            <span style={{ color: m.email ? 'var(--text-muted)' : 'var(--red)', fontSize: 11 }}>{m.email || 'sem e-mail cadastrado'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => { setEditando(m); setModal(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex' }}><Pencil size={12} /></button>
              <button onClick={() => { if (window.confirm(`Remover ${m.nome} da equipe?`)) onDeletar(m.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', opacity: 0.6 }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ModalMembro membro={editando}
          onSave={async (dados) => {
            if (editando) await onAtualizar(editando.id, dados)
            else await onCriar(dados)
            setModal(false); setEditando(null)
            showToast(editando ? 'Integrante atualizada!' : 'Integrante adicionada!')
          }}
          onClose={() => { setModal(false); setEditando(null) }} />
      )}
    </div>
  )
}

function ModalMembro({ membro, onSave, onClose }) {
  const [form, setForm] = useState({
    nome: membro?.nome || '', email: membro?.email || '', cargo: membro?.cargo || '',
    tipo: membro?.tipo || 'efetiva', jornada_horas: membro?.jornada_horas ?? 8,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onSave({
        nome: form.nome.trim(), email: form.email.trim() || null, cargo: form.cargo.trim() || null,
        tipo: form.tipo, jornada_horas: Number(form.jornada_horas) || 8,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{membro ? 'Editar integrante' : 'Nova integrante'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail (usado para login)</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nome@cedet.com.br" />
          </div>
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <input className="form-input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Analista Júnior de Editoras Parceiras" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="efetiva">Efetiva</option>
                <option value="estagiaria">Estagiária</option>
                <option value="supervisora">Supervisora</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Jornada (horas/dia)</label>
              <input type="number" min="0" step="0.5" className="form-input" value={form.jornada_horas} onChange={e => setForm(f => ({ ...f, jornada_horas: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────
export default function JornadaParceiras() {
  const { session, usuario } = useAuth()
  const [membros, setMembros] = useState([])
  const [feriados, setFeriados] = useState([])
  const [diasInativos, setDiasInativos] = useState([])
  const [registros, setRegistros] = useState([])
  const [registrosAcumulado, setRegistrosAcumulado] = useState([])
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
    const [ms, fs, dis] = await Promise.all([getMembros(), getFeriados(), getDiasInativos()])
    setMembros(ms); setFeriados(fs); setDiasInativos(dis)
  }
  useEffect(() => { carregarBase().finally(() => setLoading(false)) }, [])

  const meuMembro = useMemo(
    () => membros.find(m => m.email && m.email.toLowerCase() === emailLogado),
    [membros, emailLogado]
  )
  const souSupervisora = meuMembro?.tipo === 'supervisora'

  // Auto-cadastro: quem chega nessa página já passou pelo controle de acesso do
  // sistema (só perfil de parceiras entra aqui), então não precisa de e-mail
  // digitado por ninguém — se ainda não existe um registro pra esse e-mail,
  // criamos um na hora, com jornada padrão em branco pra ela completar depois.
  const criandoMembroRef = useRef(false)
  useEffect(() => {
    if (loading || !emailLogado || meuMembro || criandoMembroRef.current) return
    criandoMembroRef.current = true
    const nomeSugerido = usuario?.nome || emailLogado.split('@')[0].split(/[._]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    criarMembro({ email: emailLogado, nome: nomeSugerido, tipo: 'efetiva', jornada_horas: 8 })
      .then(novo => setMembros(prev => prev.some(m => m.email?.toLowerCase() === emailLogado) ? prev : [...prev, novo]))
      .catch(e => console.error(e))
      .finally(() => { criandoMembroRef.current = false })
  }, [loading, emailLogado, meuMembro, usuario])

  useEffect(() => {
    if (souSupervisora && membros.length > 0 && !membroSelecionadoId) {
      setMembroSelecionadoId(meuMembro?.id || membros[0].id)
    }
  }, [souSupervisora, membros, membroSelecionadoId, meuMembro])

  const membroVisivel = aba === 'equipe'
    ? membros.find(m => m.id === membroSelecionadoId)
    : meuMembro

  useEffect(() => {
    if (!membroVisivel) { setRegistros([]); return }
    getRegistros(membroVisivel.id, dataInicio, dataFim).then(setRegistros).catch(console.error)
  }, [membroVisivel?.id, dataInicio, dataFim])

  useEffect(() => {
    if (!membroVisivel?.saldo_inicial_data) { setRegistrosAcumulado([]); return }
    const inicioAcum = membroVisivel.saldo_inicial_data < dataInicio ? membroVisivel.saldo_inicial_data : dataInicio
    getRegistros(membroVisivel.id, inicioAcum, dataFim).then(setRegistrosAcumulado).catch(console.error)
  }, [membroVisivel?.id, membroVisivel?.saldo_inicial_data, dataInicio, dataFim])

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
    } catch (e) { console.error(e); showToast('Erro ao salvar registro.', 'error') }
  }

  async function handleCriarMembro(dados) {
    const novo = await criarMembro(dados)
    setMembros(prev => [...prev, novo])
  }
  async function handleAtualizarMembro(id, dados) {
    const upd = await atualizarMembro(id, dados)
    setMembros(prev => prev.map(m => m.id === id ? upd : m))
  }
  async function handleDeletarMembro(id) {
    await deletarMembro(id)
    setMembros(prev => prev.filter(m => m.id !== id))
    if (membroSelecionadoId === id) setMembroSelecionadoId('')
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Preparando seu acesso...</p>
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
          <PainelEquipe membros={membros} onCriar={handleCriarMembro} onAtualizar={handleAtualizarMembro} onDeletar={handleDeletarMembro} showToast={showToast} />
          <PainelJornadaPadrao membros={membros} onAtualizar={handleAtualizarMembro} showToast={showToast} />
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
        <TabelaJornada
          membro={membroVisivel}
          registros={registros}
          registrosAcumulado={registrosAcumulado}
          feriados={feriados}
          diasInativos={diasInativos}
          dataInicio={dataInicio}
          dataFim={dataFim}
          editavel={true}
          onSalvarCampo={handleSalvarCampo}
        />
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
