import { useEffect, useState, useMemo } from 'react'
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

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type = 'success') { setT({ msg, type }); setTimeout(() => setT(null), 3500) }
  return [t, show]
}

// ── LINHA DE UM DIA (editável) ─────────────────────────────
function LinhaDia({ data, membro, registro, bloqueio, editavel, onSalvarCampo }) {
  const [entrada, setEntrada] = useState(registro?.entrada || '')
  const [saidaAlmoco, setSaidaAlmoco] = useState(registro?.saida_almoco || '')
  const [retornoAlmoco, setRetornoAlmoco] = useState(registro?.retorno_almoco || '')
  const [saidaFinal, setSaidaFinal] = useState(registro?.saida_final || '')
  const [intervaloInicio, setIntervaloInicio] = useState(registro?.intervalo_inicio || '')
  const [intervaloFim, setIntervaloFim] = useState(registro?.intervalo_fim || '')
  const [situacao, setSituacao] = useState(registro?.situacao || 'normal')
  const [observacoes, setObservacoes] = useState(registro?.observacoes || '')
  const [obsAberta, setObsAberta] = useState(false)

  const regAtual = {
    entrada, saida_almoco: saidaAlmoco, retorno_almoco: retornoAlmoco, saida_final: saidaFinal,
    intervalo_inicio: intervaloInicio, intervalo_fim: intervaloFim, situacao, observacoes,
  }
  const horasTrabalhadas = calcularHorasTrabalhadas(regAtual, membro)
  const saldo = calcularSaldoDiario(regAtual, membro)

  const diaSemanaIdx = dataISOparaObj(data).getDay()
  const situacaoInfo = SITUACOES.find(s => s.value === situacao) || SITUACOES[0]

  function salvar(campo, valor) {
    onSalvarCampo(data, campo, valor || null)
  }

  // Aviso de tolerância (só informativo, não bloqueia nada)
  function avisoTolerancia() {
    if (!membro?.entrada_padrao || !entrada) return null
    const diff = horaParaMinutos(entrada) - horaParaMinutos(membro.entrada_padrao)
    if (diff > TOLERANCIA_MIN) return `chegou ${diff}min depois do combinado`
    return null
  }

  if (bloqueio) {
    return (
      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
        <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
          {DIAS_SEMANA_CURTO[diaSemanaIdx]} {fmtDataBR(data)}
        </td>
        <td colSpan={9} style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ban size={12} /> {bloqueio}
          </div>
        </td>
      </tr>
    )
  }

  const inputStyle = { width: 74, padding: '4px 6px', fontSize: 12, textAlign: 'center' }

  return (
    <tr>
      <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {DIAS_SEMANA_CURTO[diaSemanaIdx]} {fmtDataBR(data)}
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input type="time" className="form-input" style={inputStyle} value={entrada} disabled={!editavel}
          onChange={e => setEntrada(e.target.value)} onBlur={() => salvar('entrada', entrada)}
          onClick={e => e.currentTarget.showPicker?.()} />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input type="time" className="form-input" style={inputStyle} value={saidaAlmoco} disabled={!editavel}
          onChange={e => setSaidaAlmoco(e.target.value)} onBlur={() => salvar('saida_almoco', saidaAlmoco)}
          onClick={e => e.currentTarget.showPicker?.()} />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input type="time" className="form-input" style={inputStyle} value={retornoAlmoco} disabled={!editavel}
          onChange={e => setRetornoAlmoco(e.target.value)} onBlur={() => salvar('retorno_almoco', retornoAlmoco)}
          onClick={e => e.currentTarget.showPicker?.()} />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input type="time" className="form-input" style={inputStyle} value={saidaFinal} disabled={!editavel}
          onChange={e => setSaidaFinal(e.target.value)} onBlur={() => salvar('saida_final', saidaFinal)}
          onClick={e => e.currentTarget.showPicker?.()} />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <input type="time" className="form-input" style={{ ...inputStyle, width: 64 }} value={intervaloInicio} disabled={!editavel}
            onChange={e => setIntervaloInicio(e.target.value)} onBlur={() => salvar('intervalo_inicio', intervaloInicio)}
            onClick={e => e.currentTarget.showPicker?.()} title="Início do intervalo remunerado" />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>–</span>
          <input type="time" className="form-input" style={{ ...inputStyle, width: 64 }} value={intervaloFim} disabled={!editavel}
            onChange={e => setIntervaloFim(e.target.value)} onBlur={() => salvar('intervalo_fim', intervaloFim)}
            onClick={e => e.currentTarget.showPicker?.()} title="Fim do intervalo remunerado" />
        </div>
      </td>
      <td style={{ padding: '6px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select className="form-select" style={{ fontSize: 11, padding: '4px 6px', width: 'auto', color: situacaoInfo.cor }} value={situacao} disabled={!editavel}
            onChange={e => { setSituacao(e.target.value); salvar('situacao', e.target.value) }}>
            {SITUACOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {registro?.editado_por_supervisora && (
            <span title="Corrigido pela supervisora" style={{ display: 'flex', color: 'var(--accent)', opacity: 0.7 }}>
              <Pencil size={10} />
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
        <button onClick={() => setObsAberta(o => !o)} title={observacoes ? observacoes : 'Adicionar observação'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: observacoes ? 'var(--accent)' : 'var(--text-muted)', opacity: observacoes ? 1 : 0.4, display: 'inline-flex' }}>
          <Info size={13} />
        </button>
        {obsAberta && (
          <div style={{ position: 'absolute', zIndex: 30, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: 220 }}>
            <textarea className="form-input" rows={2} style={{ fontSize: 11, width: '100%' }} value={observacoes} disabled={!editavel}
              onChange={e => setObservacoes(e.target.value)}
              onBlur={() => { salvar('observacoes', observacoes); setObsAberta(false) }}
              placeholder="Observação sobre o dia..." autoFocus />
          </div>
        )}
      </td>
      <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap' }}>
        {horasTrabalhadas != null ? minutosParaHoraLegivel(horasTrabalhadas) : '—'}
      </td>
      <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: corSaldo(saldo), textAlign: 'center', whiteSpace: 'nowrap' }}>
        {formatarSaldo(saldo)}
        {avisoTolerancia() && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{avisoTolerancia()}</div>
        )}
      </td>
    </tr>
  )
}

// ── TABELA DE JORNADA (todos os dias do período + totais) ─
function TabelaJornada({ membro, registros, feriados, diasInativos, dataInicio, dataFim, editavel, onSalvarCampo }) {
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
    let horas = 0, saldoTotal = 0, diasComRegistro = 0, diasUteis = 0
    for (const data of datas) {
      if (motivoBloqueio(data)) continue
      diasUteis++
      const reg = registrosPorData[data]
      const trabalhadas = calcularHorasTrabalhadas(reg, membro)
      const saldo = calcularSaldoDiario(reg, membro)
      if (trabalhadas != null) { horas += trabalhadas; diasComRegistro++ }
      if (saldo != null) saldoTotal += saldo
    }
    return { horas, saldoTotal, diasComRegistro, diasUteis }
  }, [datas, registrosPorData, diasInativos, feriados, membro])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total trabalhado</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{minutosParaHoraLegivel(totais.horas)}</div>
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo do período</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: corSaldo(totais.saldoTotal) }}>{formatarSaldo(totais.saldoTotal)}</div>
        </div>
        <div className="table-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Dias registrados</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{totais.diasComRegistro}/{totais.diasUteis}</div>
        </div>
      </div>

      <div className="table-card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Dia', 'Entrada', 'Saída almoço', 'Retorno almoço', 'Saída final', 'Intervalo remunerado', 'Situação', '', 'Horas', 'Saldo'].map((h, i) => (
                <th key={i} style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: i >= 8 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datas.map(data => (
              <LinhaDia key={data} data={data} membro={membro} registro={registrosPorData[data]}
                bloqueio={motivoBloqueio(data)} editavel={editavel}
                onSalvarCampo={(d, campo, valor) => onSalvarCampo(membro.id, d, { [campo]: valor })}
              />
            ))}
          </tbody>
        </table>
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
              {['Nome', 'Tipo', 'Jornada (h)', 'Entrada', 'Saída', 'Almoço início', 'Almoço fim', 'Intervalo remun. (min)', ''].map((h, i) => (
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
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.entrada_padrao} onChange={e => setForm(f => ({ ...f, entrada_padrao: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.saida_padrao} onChange={e => setForm(f => ({ ...f, saida_padrao: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.almoco_inicio_padrao} onChange={e => setForm(f => ({ ...f, almoco_inicio_padrao: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} /></td>
      <td style={{ padding: '5px 4px' }}><input type="time" className="form-input" style={{ width: 74, padding: '3px 5px', fontSize: 12 }} value={form.almoco_fim_padrao} onChange={e => setForm(f => ({ ...f, almoco_fim_padrao: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} /></td>
      <td style={{ padding: '5px 4px' }}><input type="number" min="0" className="form-input" style={{ width: 56, padding: '3px 5px', fontSize: 12 }} value={form.intervalo_remunerado_min} onChange={e => setForm(f => ({ ...f, intervalo_remunerado_min: e.target.value }))} /></td>
      <td style={{ padding: '5px 4px', whiteSpace: 'nowrap' }}>
        <button onClick={() => onSalvar({
          jornada_horas: Number(form.jornada_horas) || 0,
          entrada_padrao: form.entrada_padrao || null,
          saida_padrao: form.saida_padrao || null,
          almoco_inicio_padrao: form.almoco_inicio_padrao || null,
          almoco_fim_padrao: form.almoco_fim_padrao || null,
          intervalo_remunerado_min: form.intervalo_remunerado_min !== '' ? Number(form.intervalo_remunerado_min) : null,
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
  const { session } = useAuth()
  const [membros, setMembros] = useState([])
  const [feriados, setFeriados] = useState([])
  const [diasInativos, setDiasInativos] = useState([])
  const [registros, setRegistros] = useState([])
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            O e-mail <strong style={{ color: 'var(--text)' }}>{session?.user?.email || '—'}</strong> ainda não está
            cadastrado na equipe de Controle de Jornada. Peça para sua supervisora te adicionar na aba "Equipe".
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
