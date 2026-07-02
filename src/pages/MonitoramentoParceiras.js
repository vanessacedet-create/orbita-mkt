import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasParceiras, createEditoraParceira, updateEditoraParceira,
  desativarEditoraParceira, importarEditorasPlanilha,
  getCheckagemMes, upsertCheckagemDia, deleteCheckagemDia,
  gerarPendentesSemana,
  getObservacoesEditora, createObservacao, deleteObservacao,
} from '../lib/monitoramento-editoras'
import { getCheckagemCriativoMes, upsertCheckagemCriativoDia, deleteCheckagemCriativoDia } from '../lib/monitoramento-criativo'
import { getLivrarias, getObsFormatoLote, upsertObsFormato, getConfigEquipe, setConfigEquipe } from '../lib/editoras-livrarias'
import {
  Eye, X, Upload, ChevronLeft, ChevronRight,
  Pencil, Trash2, MessageSquare, LayoutGrid, List,
  Instagram, FileSpreadsheet, Users, BookOpen, SlidersHorizontal,
} from 'lucide-react'
import * as XLSX from 'xlsx'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['D','S','T','Q','Q','S','S']

const FERIADOS_FIXOS = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25']
const FERIADOS_MOVEIS = {
  2026: ['2026-02-16','2026-02-17','2026-04-03','2026-06-04'],
  2025: ['2025-03-03','2025-03-04','2025-04-18','2025-06-19'],
  2027: ['2027-02-08','2027-02-09','2027-03-26','2027-05-27'],
}

function isFeriado(ano, mes, dia) {
  const mmdd = `${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
  if (FERIADOS_FIXOS.includes(mmdd)) return true
  const key = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
  return (FERIADOS_MOVEIS[ano] || []).includes(key)
}

function isDiaNaoUtil(ano, mes, dia) {
  const d = new Date(ano, mes - 1, dia)
  const ds = d.getDay()
  if (ds === 0 || ds === 6) return true
  if (isFeriado(ano, mes, dia)) return true
  return false
}

// ── HELPERS DE SEMANA ──────────────────────────────────────
function semanaDeData(dateKey) {
  const [a, m, d] = dateKey.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  const diaSemana = data.getDay()
  const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana
  const seg = new Date(data); seg.setDate(data.getDate() + diffSeg)
  const sex = new Date(seg); sex.setDate(seg.getDate() + 4)
  return { seg, sex }
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function diasUteisSemana(dateKey) {
  const { seg } = semanaDeData(dateKey)
  const dias = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(seg); d.setDate(seg.getDate() + i)
    const ano = d.getFullYear(), mes = d.getMonth() + 1, dia = d.getDate()
    if (!isFeriado(ano, mes, dia)) dias.push(toKey(d))
  }
  return dias
}

function hojeKey() { return toKey(new Date()) }

function diasDoMes(ano, mes) {
  const total = new Date(ano, mes, 0).getDate()
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(ano, mes - 1, i + 1)
    return { dia: i + 1, key: toKey(d), diaSemana: d.getDay(), naoUtil: isDiaNaoUtil(ano, mes, i + 1) }
  })
}

function isSuspensaOuPromocional(obsFixa) {
  if (!obsFixa) return false
  const upper = obsFixa.toUpperCase().trim()
  return upper === 'SUSPENSA' || upper === 'PROMOCIONAL'
}

// Formato automático por dia da semana (aba Equipe Cedet)
// 1=seg→email_mkt, 2=ter→story, 3=qua→feed, 4=qui→email_mkt, 5=sex→story
const FORMATO_POR_DIA = { 1: 'email_mkt', 2: 'story', 3: 'feed', 4: 'email_mkt', 5: 'story' }

const FREQ_SEMANAL = { story: 2, feed: 1, reels: 0 }

const FORMATOS_PARCEIRAS = [
  { value: 'story', label: 'Story' },
  { value: 'feed',  label: 'Feed' },
  { value: 'reels', label: 'Reels' },
]

const FORMATOS_CRIATIVO_COMPARTILHADOS = ['story','feed','reels_roteiro','reels_edicao']
const FORMATOS_CRIATIVO = [
  { value: 'story',         label: 'Story' },
  { value: 'feed',          label: 'Feed' },
  { value: 'reels_roteiro', label: 'Reels (Roteiro/Gravação)' },
  { value: 'reels_edicao',  label: 'Reels (Edição)' },
  { value: 'email_mkt',     label: 'E-mail Marketing' },
  { value: 'email_revenda', label: 'E-mail Revendas' },
]

// Formatos do Cedet que geram pendente automático (têm dia fixo)
const FORMATOS_CEDET_COM_DIA = ['story','feed','email_mkt']

const STATUS_PARCEIRAS = [
  { value: 'pendente',   label: 'Pendente',   cor: '#6b7280' },
  { value: 'postou',     label: 'Postou',     cor: '#22c55e' },
  { value: 'nao_postou', label: 'Não postou', cor: '#ef4444' },
]

const STATUS_CRIATIVO = [
  { value: 'pendente',   label: 'Pendente',   cor: '#6b7280' },
  { value: 'iniciado',   label: 'Iniciado',   cor: '#f59e0b' },
  { value: 'finalizado', label: 'Finalizado', cor: '#22c55e' },
]

const EQUIPE = ['Viviane', 'Sarah', 'Vanessa', 'Gabriela']
const CATEGORIAS_OBS = ['Comportamento', 'Resposta às mensagens', 'Vendas na livraria', 'Qualidade das postagens', 'Relacionamento', 'Outro']

function pad(n) { return String(n).padStart(2, '0') }

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

function BotaoFormato({ label, ativo, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid var(--accent)', background: ativo ? 'var(--accent)' : 'transparent', color: ativo ? '#fff' : 'var(--accent)', transition: 'all 0.15s' }}>
      {label}
    </button>
  )
}

// ── SELETOR DE DIAS COM RETÂNGULO DE SEMANA ────────────────
function SeletorDiasCompacto({ dias, mes, ano, dataSel, onSelect, indicadores }) {
  const hoje = hojeKey()
  const { seg: segSel, sex: sexSel } = dataSel ? semanaDeData(dataSel) : { seg: null, sex: null }
  const segKey = segSel ? toKey(segSel) : null
  const sexKey = sexSel ? toKey(sexSel) : null

  // Agrupar dias em semanas para desenhar retângulo por semana
  const semanas = []
  let semanaAtual = []
  for (const d of dias) {
    if (semanaAtual.length === 0) {
      semanaAtual.push(d)
    } else {
      const prev = semanaAtual[semanaAtual.length - 1]
      const prevDate = new Date(prev.key)
      const curDate = new Date(d.key)
      const diff = (curDate - prevDate) / (1000 * 60 * 60 * 24)
      // Nova semana se segunda-feira ou gap > 1 dia
      if (d.diaSemana === 1 || diff > 3) {
        semanas.push(semanaAtual)
        semanaAtual = [d]
      } else {
        semanaAtual.push(d)
      }
    }
  }
  if (semanaAtual.length) semanas.push(semanaAtual)

  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', alignItems: 'center' }}>
      {semanas.map((semana, si) => {
        const estaeSemanaAtual = segKey && semana.some(d => d.key === segKey)
        return (
          <div key={si} style={{
            display: 'flex', gap: 2, padding: '3px 4px', borderRadius: 8, flexShrink: 0,
            border: estaeSemanaAtual ? '2px solid var(--accent)' : '2px solid transparent',
            background: estaeSemanaAtual ? 'rgba(99,102,241,0.06)' : 'transparent',
          }}>
            {semana.map(d => {
              const sel = dataSel === d.key
              const isHoje = d.key === hoje
              const ind = indicadores?.[d.key] || {}
              return (
                <button key={d.key} onClick={() => !d.naoUtil && onSelect(d.key)} disabled={d.naoUtil}
                  title={`${d.dia}/${mes}`}
                  style={{
                    width: 30, minWidth: 30, padding: '4px 0', borderRadius: 6,
                    cursor: d.naoUtil ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: d.naoUtil ? 'transparent'
                      : sel ? 'var(--accent)'
                      : isHoje && estaeSemanaAtual ? 'rgba(99,102,241,0.25)'
                      : isHoje ? 'rgba(99,102,241,0.12)'
                      : 'transparent',
                    color: d.naoUtil ? 'var(--text-muted)'
                      : sel ? '#fff'
                      : 'var(--text)',
                    opacity: d.naoUtil ? 0.3 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                    transition: 'all 0.1s',
                    fontWeight: sel || isHoje ? 700 : 400,
                  }}>
                  <span style={{ fontSize: 12 }}>{d.dia}</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>{DIAS_SEMANA[d.diaSemana]}</span>
                  {ind.total > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
                      {ind.ok > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', display: 'block' }} />}
                      {ind.nok > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', display: 'block' }} />}
                      {ind.ini > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', display: 'block' }} />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function ModalSeletorLivrarias({ livrarias, selecionadas, titulo, onConfirm, onClose }) {
  const [sel, setSel] = useState(new Set(selecionadas))
  function toggle(id) { setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { if (sel.size === livrarias.length) setSel(new Set()); else setSel(new Set(livrarias.map(l => l.id))) }
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 className="modal-title">{titulo || 'Selecionar livrarias'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={sel.size === livrarias.length} onChange={toggleAll} style={{ accentColor: 'var(--accent)' }} />
            Selecionar todas ({livrarias.length})
          </label>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {livrarias.map(l => (
            <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ color: 'var(--text)' }}>{l.nome}</span>
              {l.instagram && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.instagram}</span>}
            </label>
          ))}
        </div>
        <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sel.size} selecionada{sel.size !== 1 ? 's' : ''}</span>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onConfirm([...sel]); onClose() }}>Aplicar</button>
        </div>
      </div>
    </div>
  )
}

function PainelEditora({ editora, checkagemMes, ano, mes, usuario, onClose }) {
  const [obs, setObs] = useState([])
  const [loadingObs, setLoadingObs] = useState(true)
  const [novaObs, setNovaObs] = useState({ categoria: 'Comportamento', texto: '' })
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    setLoadingObs(true)
    getObservacoesEditora(editora.id).then(setObs).finally(() => setLoadingObs(false))
  }, [editora.id])

  const registros = checkagemMes.filter(r => r.editora_id === editora.id)
  const postou = registros.filter(r => r.status === 'postou').length
  const naoPostou = registros.filter(r => r.status === 'nao_postou').length
  const pendente = registros.filter(r => r.status === 'pendente').length
  const total = registros.length
  const pct = total > 0 ? Math.round((postou / total) * 100) : 0
  const corSaude = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

  async function salvarObs() {
    if (!novaObs.texto.trim()) return
    setSalvandoObs(true)
    try {
      const nova = await createObservacao({ ...novaObs, editora_id: editora.id, criado_por: usuario?.id })
      setObs(prev => [nova, ...prev])
      setNovaObs(f => ({ ...f, texto: '' }))
    } catch (e) { console.error(e) } finally { setSalvandoObs(false) }
  }

  async function excluirObs(id) {
    if (!window.confirm('Excluir observação?')) return
    await deleteObservacao(id)
    setObs(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{editora.nome}</div>
          {editora.instagram && <a href={`https://instagram.com/${editora.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Instagram size={11} /> {editora.instagram}</a>}
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{MESES[mes - 1]} {ano}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {[{ n: postou, l: 'Postou', c: '#22c55e' }, { n: naoPostou, l: 'Não postou', c: '#ef4444' }, { n: pendente, l: 'Pendente', c: '#6b7280' }].map(({ n, l, c }) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Taxa de postagem</span><span style={{ color: corSaude, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: corSaude, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Observações</div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <select className="form-select" value={novaObs.categoria} onChange={e => setNovaObs(f => ({ ...f, categoria: e.target.value }))} style={{ marginBottom: 8, fontSize: 12 }}>
              {CATEGORIAS_OBS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea className="form-textarea" rows={2} value={novaObs.texto} onChange={e => setNovaObs(f => ({ ...f, texto: e.target.value }))} placeholder="Escreva uma observação..." style={{ marginBottom: 8, fontSize: 12 }} />
            <button className="btn btn-primary btn-sm" onClick={salvarObs} disabled={salvandoObs || !novaObs.texto.trim()}><MessageSquare size={12} /> Registrar</button>
          </div>
          {loadingObs ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
          : obs.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Nenhuma observação registrada.</div>
          : obs.map(o => (
            <div key={o.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{o.categoria}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(o.criado_em).toLocaleDateString('pt-BR')}</span>
                  <button onClick={() => excluirObs(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, opacity: 0.5, display: 'flex' }}><Trash2 size={11} /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>{o.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── CHECKLIST — LIVRARIAS PARCEIRAS ───────────────────────
function ViewChecklistParceiras({ livrarias, checkagemMes, formato, dataSel, diasSemana, obsFormato, onMarcar, onSalvarObsFixa }) {
  const [obsFixaAberta, setObsFixaAberta] = useState(null)
  const [textoObsFixa, setTextoObsFixa] = useState('')
  const [notaAberta, setNotaAberta] = useState(null)
  const [textoNota, setTextoNota] = useState('')

  const regsSemana = checkagemMes.filter(r => r.formato === formato && diasSemana.includes(r.data_esperada))
  const freq = FREQ_SEMANAL[formato] || 0

  function postoSemana(livrariaId) {
    return regsSemana.filter(r => r.editora_id === livrariaId && r.status === 'postou').length
  }
  function statusDia(livrariaId) {
    const reg = checkagemMes.find(r => r.editora_id === livrariaId && r.formato === formato && r.data_esperada === dataSel)
    return reg?.status || null
  }
  function notaDia(livrariaId) {
    const reg = checkagemMes.find(r => r.editora_id === livrariaId && r.formato === formato && r.data_esperada === dataSel)
    return reg?.observacao || ''
  }

  if (livrarias.length === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma livraria cadastrada ainda.</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 110px 110px 1fr 1fr auto', gap: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', marginBottom: 4 }}>
        <span>Livraria</span><span>Instagram</span><span>Instagram 2</span><span>Observações</span><span>Nota do dia</span><span style={{ minWidth: 280 }}>Status — semana / dia selecionado</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {livrarias.map(livraria => {
          const chaveId = livraria.editora_id
          const postou = postoSemana(chaveId)
          const status = statusDia(chaveId)
          const nota = notaDia(chaveId)
          const obsFixa = obsFormato?.[livraria.id] || ''
          const editandoObsFixa = obsFixaAberta === livraria.id
          const editandoNota = notaAberta === livraria.id
          return (
            <div key={livraria.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 110px 110px 1fr 1fr auto', gap: 8, alignItems: 'center', padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: (editandoObsFixa || editandoNota) ? '8px 8px 0 0' : 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={livraria.nome}>{livraria.nome}</div>
                <div style={{ fontSize: 12 }}>{livraria.instagram ? <a href={`https://instagram.com/${livraria.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}><Instagram size={10}/>{livraria.instagram}</a> : <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>}</div>
                <div style={{ fontSize: 12 }}>{livraria.instagram2 ? <a href={`https://instagram.com/${livraria.instagram2.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}><Instagram size={10}/>{livraria.instagram2}</a> : <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>}</div>
                <div style={{ fontSize: 12, color: obsFixa ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { setObsFixaAberta(editandoObsFixa ? null : livraria.id); setTextoObsFixa(obsFixa); setNotaAberta(null) }}>
                  {obsFixa || <span style={{ fontSize: 11, fontStyle: 'italic' }}>Adicionar...</span>}
                </div>
                <div style={{ fontSize: 12, color: nota ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { setNotaAberta(editandoNota ? null : livraria.id); setTextoNota(nota); setObsFixaAberta(null) }}>
                  {nota || <span style={{ fontSize: 11, fontStyle: 'italic' }}>Adicionar...</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {freq > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: postou >= freq ? '#22c55e' : 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {postou}/{freq}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 5 }}>
                    {STATUS_PARCEIRAS.map(s => (
                      <button key={s.value}
                        onClick={() => onMarcar({ editora: { id: chaveId }, formato, dataKey: dataSel, status: status === s.value ? null : s.value, observacao: nota })}
                        style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {editandoObsFixa && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Observação fixa:</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 12 }} value={textoObsFixa} onChange={e => setTextoObsFixa(e.target.value)} placeholder="Ex: SUSPENSA, PROMOCIONAL..." autoFocus onKeyDown={e => { if (e.key === 'Enter') { onSalvarObsFixa(livraria.id, textoObsFixa); setObsFixaAberta(null) } if (e.key === 'Escape') setObsFixaAberta(null) }} />
                  <button className="btn btn-primary btn-sm" onClick={() => { onSalvarObsFixa(livraria.id, textoObsFixa); setObsFixaAberta(null) }}>Salvar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setObsFixaAberta(null)}>Cancelar</button>
                </div>
              )}
              {editandoNota && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>Nota do dia {dataSel?.split('-').reverse().join('/')}:</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 12 }} value={textoNota} onChange={e => setTextoNota(e.target.value)} placeholder="O que aconteceu hoje..." autoFocus onKeyDown={e => { if (e.key === 'Enter') { onMarcar({ editora: { id: chaveId }, formato, dataKey: dataSel, status: status || 'pendente', observacao: textoNota }); setNotaAberta(null) } if (e.key === 'Escape') setNotaAberta(null) }} />
                  <button className="btn btn-primary btn-sm" onClick={() => { onMarcar({ editora: { id: chaveId }, formato, dataKey: dataSel, status: status || 'pendente', observacao: textoNota }); setNotaAberta(null) }}>Salvar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setNotaAberta(null)}>Cancelar</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CHECKLIST — EQUIPE CEDET ───────────────────────────────
function ViewChecklistCriativo({ livrarias, checkagemCriativo, formato, dataKey, onMarcar, onSalvarObsFixa, obsFormato }) {
  const registrosDoDia = checkagemCriativo.filter(r => r.formato === formato && r.data_esperada === dataKey)
  const mapa = {}
  for (const r of registrosDoDia) mapa[r.editora_id] = r
  const [obsFixaAberta, setObsFixaAberta] = useState(null)
  const [textoObsFixa, setTextoObsFixa] = useState('')
  const [notaAberta, setNotaAberta] = useState(null)
  const [textoNota, setTextoNota] = useState('')

  if (livrarias.length === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma livraria cadastrada ainda.</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 110px 110px 1fr 1fr 130px auto', gap: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', marginBottom: 4 }}>
        <span>Livraria</span><span>Instagram</span><span>Instagram 2</span><span>Observações</span><span>Notas</span><span>Responsável</span><span style={{ minWidth: 240 }}>Status</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {livrarias.map(livraria => {
          const chaveId = livraria.editora_id
          const reg = mapa[chaveId]
          const status = reg?.status || null
          const responsavel = reg?.responsavel || ''
          const nota = reg?.observacao || ''
          const obsFixa = obsFormato?.[livraria.id] || ''
          const editandoObsFixa = obsFixaAberta === livraria.id
          const editandoNota = notaAberta === livraria.id
          return (
            <div key={livraria.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 110px 110px 1fr 1fr 130px auto', gap: 8, alignItems: 'center', padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: (editandoObsFixa || editandoNota) ? '8px 8px 0 0' : 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={livraria.nome}>{livraria.nome}</div>
                <div style={{ fontSize: 12 }}>{livraria.instagram ? <a href={`https://instagram.com/${livraria.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}><Instagram size={10}/>{livraria.instagram}</a> : <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>}</div>
                <div style={{ fontSize: 12 }}>{livraria.instagram2 ? <a href={`https://instagram.com/${livraria.instagram2.replace('@','')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}><Instagram size={10}/>{livraria.instagram2}</a> : <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>}</div>
                <div style={{ fontSize: 12, color: obsFixa ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { setObsFixaAberta(editandoObsFixa ? null : livraria.id); setTextoObsFixa(obsFixa); setNotaAberta(null) }}>
                  {obsFixa || <span style={{ fontSize: 11, fontStyle: 'italic' }}>Adicionar...</span>}
                </div>
                <div style={{ fontSize: 12, color: nota ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { setNotaAberta(editandoNota ? null : livraria.id); setTextoNota(nota); setObsFixaAberta(null) }}>
                  {nota || <span style={{ fontSize: 11, fontStyle: 'italic' }}>Adicionar...</span>}
                </div>
                <select value={responsavel} onChange={e => onMarcar({ editora: { id: chaveId }, formato, dataKey, status: status || 'pendente', responsavel: e.target.value })}
                  style={{ padding: '4px 8px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', background: responsavel ? 'var(--accent-glow)' : 'var(--surface-2)', color: responsavel ? 'var(--accent)' : 'var(--text-muted)', fontWeight: responsavel ? 700 : 400, cursor: 'pointer' }}>
                  <option value="">Responsável...</option>
                  {EQUIPE.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 5 }}>
                  {STATUS_CRIATIVO.map(s => (
                    <button key={s.value} onClick={() => onMarcar({ editora: { id: chaveId }, formato, dataKey, status: status === s.value ? null : s.value, responsavel })}
                      style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>{s.label}</button>
                  ))}
                </div>
              </div>
              {editandoObsFixa && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Observação fixa:</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 12 }} value={textoObsFixa} onChange={e => setTextoObsFixa(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { onSalvarObsFixa(livraria.id, textoObsFixa); setObsFixaAberta(null) } if (e.key === 'Escape') setObsFixaAberta(null) }} />
                  <button className="btn btn-primary btn-sm" onClick={() => { onSalvarObsFixa(livraria.id, textoObsFixa); setObsFixaAberta(null) }}>Salvar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setObsFixaAberta(null)}>Cancelar</button>
                </div>
              )}
              {editandoNota && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>Nota do dia:</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 12 }} value={textoNota} onChange={e => setTextoNota(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { onMarcar({ editora: { id: chaveId }, formato, dataKey, status: status || 'pendente', responsavel, observacao: textoNota }); setNotaAberta(null) } if (e.key === 'Escape') setNotaAberta(null) }} />
                  <button className="btn btn-primary btn-sm" onClick={() => { onMarcar({ editora: { id: chaveId }, formato, dataKey, status: status || 'pendente', responsavel, observacao: textoNota }); setNotaAberta(null) }}>Salvar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setNotaAberta(null)}>Cancelar</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ViewEmailRevenda({ dataKey }) {
  const storageKey = `email_revenda_${dataKey}`
  const [status, setStatus] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s).status : null } catch { return null } })
  const [responsavel, setResponsavel] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s).responsavel : '' } catch { return '' } })
  function salvar(novoStatus, novoResponsavel) {
    try { localStorage.setItem(storageKey, JSON.stringify({ status: novoStatus, responsavel: novoResponsavel })) } catch {}
    setStatus(novoStatus); setResponsavel(novoResponsavel)
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', marginBottom: 4 }}>
        <span>Destino</span><span>Responsável</span><span style={{ minWidth: 240 }}>Status</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>E-mail Revendas</div>
        <select value={responsavel} onChange={e => salvar(status, e.target.value)}
          style={{ padding: '4px 8px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', background: responsavel ? 'var(--accent-glow)' : 'var(--surface-2)', color: responsavel ? 'var(--accent)' : 'var(--text-muted)', fontWeight: responsavel ? 700 : 400, cursor: 'pointer' }}>
          <option value="">Responsável...</option>
          {EQUIPE.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 5 }}>
          {STATUS_CRIATIVO.map(s => (
            <button key={s.value} onClick={() => salvar(status === s.value ? null : s.value, responsavel)}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewDashboard({ livrarias, checkagemMes }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
      {livrarias.map(livraria => {
        const id = livraria.editora_id || livraria.id
        const regs = checkagemMes.filter(r => r.editora_id === id)
        const postou = regs.filter(r => r.status === 'postou').length
        const naoPostou = regs.filter(r => r.status === 'nao_postou').length
        const pendente = regs.filter(r => r.status === 'pendente').length
        const total = regs.length
        const pct = total > 0 ? Math.round((postou / total) * 100) : null
        const corSaude = pct === null ? '#6b7280' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
        const labelSaude = pct === null ? 'Sem dados' : pct >= 70 ? 'Boa' : pct >= 40 ? 'Regular' : 'Crítica'
        return (
          <div key={livraria.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', borderTop: `3px solid ${corSaude}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{livraria.nome}</div>
                {livraria.instagram && <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Instagram size={10}/>{livraria.instagram}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: corSaude, background: corSaude + '18', padding: '2px 8px', borderRadius: 20 }}>{labelSaude}</span>
            </div>
            {total > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✅ {postou}</span>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>❌ {naoPostou}</span>
                  {pendente > 0 && <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>🕐 {pendente}</span>}
                </div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: corSaude, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{pct}% de postagem</div>
              </>
            ) : <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem checagens neste mês.</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function MonitoramentoParceiras() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente' || usuario?.perfil === 'supervisor_parceiras'
  const agora = new Date()

  function primeiroDiaUtilDoMes(a, m) {
    const total = new Date(a, m, 0).getDate()
    for (let d = 1; d <= total; d++) {
      if (!isDiaNaoUtil(a, m, d)) return toKey(new Date(a, m - 1, d))
    }
    return toKey(new Date(a, m - 1, 1))
  }

  // ── NAVEGAÇÃO PERSISTENTE ──────────────────────────────
  function lerNav() {
    try { return JSON.parse(localStorage.getItem('monitor_nav') || '{}') } catch { return {} }
  }
  function salvarNav(patch) {
    try {
      const atual = lerNav()
      const novo = { ...atual, ...patch }
      if (novo.ano) novo.ano = Number(novo.ano)
      if (novo.mes) novo.mes = Number(novo.mes)
      localStorage.setItem('monitor_nav', JSON.stringify(novo))
    } catch {}
  }

  const nav = lerNav()
  const [ano, setAno] = useState(() => (nav.ano && !isNaN(nav.ano)) ? Number(nav.ano) : agora.getFullYear())
  const [mes, setMes] = useState(() => (nav.mes && !isNaN(nav.mes)) ? Number(nav.mes) : agora.getMonth() + 1)

  // Aba principal — ao trocar de aba, reseta a data para hoje
  const [abaMonitor, setAbaMonitorRaw] = useState(() => nav.aba || 'parceiras')
  function setAbaMonitor(v) {
    setAbaMonitorRaw(v)
    salvarNav({ aba: v })
    // Ao entrar na aba, vai para hoje
    const hoje = hojeKey()
    const hojeDate = new Date()
    const anoHoje = hojeDate.getFullYear()
    const mesHoje = hojeDate.getMonth() + 1
    if (v === 'parceiras') {
      setDataSel(hoje); setAno(anoHoje); setMes(mesHoje)
      salvarNav({ dataSel: hoje, ano: anoHoje, mes: mesHoje })
    } else {
      setDataCriativoSel(hoje); setAno(anoHoje); setMes(mesHoje)
      // Formato automático para hoje
      const diaSemana = hojeDate.getDay()
      const fmtAuto = FORMATO_POR_DIA[diaSemana] || 'story'
      setFormatoCriativoSel(fmtAuto)
      salvarNav({ dataCriativo: hoje, ano: anoHoje, mes: mesHoje, formatoCriativo: fmtAuto })
    }
  }

  // View (checklist/dashboard) por aba
  const [abaViewParceiras, setAbaViewParceirasRaw] = useState(() => nav.viewParceiras || 'checklist')
  const [abaViewCriativo, setAbaViewCriativoRaw] = useState(() => nav.viewCriativo || 'checklist')
  function setAbaViewParceiras(v) { setAbaViewParceirasRaw(v); salvarNav({ viewParceiras: v }) }
  function setAbaViewCriativo(v) { setAbaViewCriativoRaw(v); salvarNav({ viewCriativo: v }) }

  // Formato e data — parceiras
  const [formatoSel, setFormatoSelRaw] = useState(() => nav.formatoSel || 'story')
  const [dataSel, setDataSelRaw] = useState(() => nav.dataSel || hojeKey())
  function setFormatoSel(v) { setFormatoSelRaw(v); salvarNav({ formatoSel: v }) }
  function setDataSel(v) { setDataSelRaw(v); salvarNav({ dataSel: v }) }

  // Formato e data — criativo
  const [formatoCriativoSel, setFormatoCriativoSelRaw] = useState(() => nav.formatoCriativo || 'story')
  const [dataCriativoSel, setDataCriativoSelRaw] = useState(() => nav.dataCriativo || hojeKey())
  function setFormatoCriativoSel(v) { setFormatoCriativoSelRaw(v); salvarNav({ formatoCriativo: v }) }
  function setDataCriativoSel(v) { setDataCriativoSelRaw(v); salvarNav({ dataCriativo: v }) }

  // Ao clicar num dia no Cedet → formato automático
  function handleSelectDiaCriativo(key) {
    setDataCriativoSel(key)
    const diaSemana = new Date(key + 'T12:00:00').getDay()
    const fmtAuto = FORMATO_POR_DIA[diaSemana]
    if (fmtAuto) setFormatoCriativoSel(fmtAuto)
  }

  function setAnoNav(v) { setAno(v); salvarNav({ ano: v }) }
  function setMesNav(v) { setMes(v); salvarNav({ mes: v }) }

  const [todasLivrarias, setTodasLivrarias] = useState([])
  const [selParceiras, setSelParceiras] = useState({})
  const [selCriativo, setSelCriativo] = useState({})
  const [showSeletorLiv, setShowSeletorLiv] = useState(false)
  const [obsFormatoParceiras, setObsFormatoParceiras] = useState({})
  const [obsFormatoCriativo, setObsFormatoCriativo] = useState({})
  const [checkagemMes, setCheckagemMes] = useState([])
  const [checkagemCriativo, setCheckagemCriativo] = useState([])
  const [loading, setLoading] = useState(true)
  const [painelEditora, setPainelEditora] = useState(null)
  const [showTooltipPendentes, setShowTooltipPendentes] = useState(false)
  const [toast, showToast] = useToast()

  const dias = diasDoMes(ano, mes)
  const diasSemanaAtual = dataSel ? diasUteisSemana(dataSel) : []
  const diasSemanaCriativo = dataCriativoSel ? diasUteisSemana(dataCriativoSel) : []

  function getSelecionadasParceiras(formato) { return selParceiras[formato] ?? null }
  function getSelecionadasCriativo(formato) { return selCriativo[formato] ?? null }

  async function salvarSelParceiras(formato, ids) {
    const novo = { ...selParceiras, [formato]: ids }
    setSelParceiras(novo)
    try { await setConfigEquipe('sel_parceiras', novo) } catch (e) { console.error(e) }
  }
  async function salvarSelCriativo(formato, ids) {
    const novo = { ...selCriativo, [formato]: ids }
    setSelCriativo(novo)
    try { await setConfigEquipe('sel_criativo', novo) } catch (e) { console.error(e) }
  }

  const selAtualParceiras = getSelecionadasParceiras(formatoSel)
  const livrarias = selAtualParceiras === null ? todasLivrarias : todasLivrarias.filter(l => selAtualParceiras.includes(l.id))

  const MAPA_FORMATO_PARCEIRAS = { 'story': 'story', 'feed': 'feed', 'reels_roteiro': 'reels', 'reels_edicao': 'reels' }
  const isFormatoCompartilhado = FORMATOS_CRIATIVO_COMPARTILHADOS.includes(formatoCriativoSel)
  const formatoParceirasCorrespondente = MAPA_FORMATO_PARCEIRAS[formatoCriativoSel]
  const selAtualCriativo = getSelecionadasCriativo(formatoCriativoSel)
  const livrariasCriativo = isFormatoCompartilhado
    ? (() => { const sel = getSelecionadasParceiras(formatoParceirasCorrespondente); return sel === null ? todasLivrarias : todasLivrarias.filter(l => sel.includes(l.id)) })()
    : formatoCriativoSel === 'email_revenda' ? []
    : selAtualCriativo === null ? todasLivrarias : todasLivrarias.filter(l => selAtualCriativo.includes(l.id))

  useEffect(() => { carregarDados() }, [])
  useEffect(() => { carregarCheckagemMes() }, [ano, mes])
  useEffect(() => { carregarCheckagemCriativo() }, [ano, mes])
  useEffect(() => { getObsFormatoLote(formatoSel).then(setObsFormatoParceiras).catch(console.error) }, [formatoSel])
  useEffect(() => {
    const fmt = FORMATOS_CRIATIVO_COMPARTILHADOS.includes(formatoCriativoSel) ? MAPA_FORMATO_PARCEIRAS[formatoCriativoSel] : formatoCriativoSel
    getObsFormatoLote(fmt).then(setObsFormatoCriativo).catch(console.error)
  }, [formatoCriativoSel])

  // Gera pendentes para Equipe Cedet quando semana ou formato mudam
  useEffect(() => {
    if (!FORMATOS_CEDET_COM_DIA.includes(formatoCriativoSel)) return
    if (!livrariasCriativo.length || !diasSemanaCriativo.length) return
    // Filtra apenas os dias da semana compatíveis com o formato
    const diasDoFormato = diasSemanaCriativo.filter(key => {
      const diaSemana = new Date(key + 'T12:00:00').getDay()
      return FORMATO_POR_DIA[diaSemana] === formatoCriativoSel
    })
    if (!diasDoFormato.length) return
    gerarPendentesSemana({ livrariasAtivas: livrariasCriativo, formato: formatoCriativoSel, diasSemana: diasDoFormato })
      .then(novos => {
        if (novos.length > 0) {
          setCheckagemCriativo(prev => {
            const mapa = {}
            for (const r of prev) mapa[`${r.editora_id}|${r.formato}|${r.data_esperada}`] = r
            for (const r of novos) mapa[`${r.editora_id}|${r.formato}|${r.data_esperada}`] = r
            return Object.values(mapa)
          })
        }
      })
      .catch(console.error)
  }, [dataCriativoSel, formatoCriativoSel, livrariasCriativo.length])

  // Atualização silenciosa a cada 30s
  const silentRefMes = useRef(null)
  const silentRefCriativo = useRef(null)
  useEffect(() => {
    silentRefMes.current = async () => { try { setCheckagemMes(await getCheckagemMes({ ano, mes })) } catch {} }
    silentRefCriativo.current = async () => { try { setCheckagemCriativo(await getCheckagemCriativoMes({ ano, mes })) } catch {} }
  }, [ano, mes])
  useEffect(() => {
    const intervalo = setInterval(() => { silentRefMes.current?.(); silentRefCriativo.current?.() }, 30000)
    return () => clearInterval(intervalo)
  }, [])

  async function carregarDados() {
    try {
      const [livs, confParceiras, confCriativo] = await Promise.all([
        getLivrarias(), getConfigEquipe('sel_parceiras'), getConfigEquipe('sel_criativo'),
      ])
      setTodasLivrarias(livs.filter(l => l.editora_id))
      if (confParceiras) setSelParceiras(confParceiras)
      if (confCriativo) setSelCriativo(confCriativo)
    } catch (e) { console.error(e) }
  }

  async function carregarCheckagemMes() {
    setLoading(true)
    try { setCheckagemMes(await getCheckagemMes({ ano, mes })) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function carregarCheckagemCriativo() {
    try { setCheckagemCriativo(await getCheckagemCriativoMes({ ano, mes })) }
    catch (e) { console.error(e) }
  }

  function navMes(d) {
    let nm = mes + d, na = ano
    if (nm > 12) { nm = 1; na++ }
    if (nm < 1) { nm = 12; na-- }
    const novaData = (na === agora.getFullYear() && nm === agora.getMonth() + 1)
      ? hojeKey() : primeiroDiaUtilDoMes(na, nm)
    setMesNav(nm); setAnoNav(na)
    setDataSel(novaData); setDataCriativoSel(novaData)
  }

  function indicadoresParceiras(formato) {
    const ind = {}
    for (const d of dias) {
      const regs = checkagemMes.filter(r => r.formato === formato && r.data_esperada === d.key)
      if (regs.length > 0) ind[d.key] = { total: regs.length, ok: regs.filter(r => r.status === 'postou').length, nok: regs.filter(r => r.status === 'nao_postou').length, ini: 0 }
    }
    return ind
  }

  function indicadoresCriativo(formato) {
    const ind = {}
    for (const d of dias) {
      const regs = checkagemCriativo.filter(r => r.formato === formato && r.data_esperada === d.key)
      if (regs.length > 0) ind[d.key] = { total: regs.length, ok: regs.filter(r => r.status === 'finalizado').length, nok: 0, ini: regs.filter(r => r.status === 'iniciado').length }
    }
    return ind
  }

  async function handleMarcarParceira({ editora, formato, dataKey, status, observacao }) {
    try {
      if (status === null) {
        await deleteCheckagemDia({ editora_id: editora.id, formato, data_esperada: dataKey })
        setCheckagemMes(prev => prev.filter(r => !(r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)))
        return
      }
      const reg = await upsertCheckagemDia({ editora_id: editora.id, formato, data_esperada: dataKey, status, observacao })
      setCheckagemMes(prev => {
        const idx = prev.findIndex(r => r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)
        if (idx >= 0) { const n = [...prev]; n[idx] = reg; return n }
        return [...prev, reg]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
  }

  async function handleSalvarObsFixa(livrariaId, observacao, formato, aba) {
    try {
      await upsertObsFormato(livrariaId, formato, observacao)
      if (aba === 'parceiras') setObsFormatoParceiras(prev => ({ ...prev, [livrariaId]: observacao }))
      else setObsFormatoCriativo(prev => ({ ...prev, [livrariaId]: observacao }))
    } catch (e) { console.error(e); showToast('Erro ao salvar observação', 'error') }
  }

  async function handleMarcarCriativo({ editora, formato, dataKey, status, responsavel }) {
    try {
      if (status === null) {
        await deleteCheckagemCriativoDia({ editora_id: editora.id, formato, data_esperada: dataKey })
        setCheckagemCriativo(prev => prev.filter(r => !(r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)))
        return
      }
      const reg = await upsertCheckagemCriativoDia({ editora_id: editora.id, formato, data_esperada: dataKey, status, responsavel })
      setCheckagemCriativo(prev => {
        const idx = prev.findIndex(r => r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)
        if (idx >= 0) { const n = [...prev]; n[idx] = reg; return n }
        return [...prev, reg]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
  }

  // ── CONTADORES DO CABEÇALHO ────────────────────────────
  const livrariasNaContagemHeader = livrarias.filter(l => !isSuspensaOuPromocional(obsFormatoParceiras[l.id]))
  const freqHeader = FREQ_SEMANAL[formatoSel] || 0
  const esperadoSemanaHeader = livrariasNaContagemHeader.length * freqHeader
  const realizadoSemanaHeader = checkagemMes.filter(r =>
    r.status === 'postou' && r.formato === formatoSel && diasSemanaAtual.includes(r.data_esperada)
  ).length
  const totalPostou = realizadoSemanaHeader
  const totalNao = checkagemMes.filter(r => r.status === 'nao_postou' && r.formato === formatoSel && diasSemanaAtual.includes(r.data_esperada)).length
  const livrariasComAcao = new Set(
    checkagemMes.filter(r => (r.status === 'postou' || r.status === 'nao_postou') && r.formato === formatoSel && diasSemanaAtual.includes(r.data_esperada)).map(r => r.editora_id)
  )
  const livrariasPendentes = livrariasNaContagemHeader.filter(l => !livrariasComAcao.has(l.editora_id))
  const totalPend = livrariasPendentes.length

  const totalFinalizado = checkagemCriativo.filter(r => r.status === 'finalizado' && r.formato === formatoCriativoSel && r.data_esperada === dataCriativoSel).length
  const totalIniciado   = checkagemCriativo.filter(r => r.status === 'iniciado' && r.formato === formatoCriativoSel && r.data_esperada === dataCriativoSel).length
  const totalPendCriat  = checkagemCriativo.filter(r => r.status === 'pendente' && r.formato === formatoCriativoSel && r.data_esperada === dataCriativoSel).length

  function tabStyle(ativa) {
    return { padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: ativa ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }
  }

  function viewTabStyle(ativa) {
    return { padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: ativa ? 'var(--accent)' : 'transparent', color: ativa ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }
  }

  return (
    <div>
      {/* ── CABEÇALHO ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Eye size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Monitoramento</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{todasLivrarias.length} livrarias · {MESES[mes - 1]} {ano}</p>
          </div>
        </div>

        {/* Contadores + Checklist/Dashboard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {abaMonitor === 'parceiras' ? (
            <>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{totalPostou}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Postaram</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1, fontWeight: 600 }}>{FORMATOS_PARCEIRAS.find(f => f.value === formatoSel)?.label}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>{totalNao}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Não postaram</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1, fontWeight: 600 }}>{FORMATOS_PARCEIRAS.find(f => f.value === formatoSel)?.label}</div>
                </div>
                <div style={{ textAlign: 'center', position: 'relative', cursor: totalPend > 0 ? 'pointer' : 'default' }}
                  onMouseEnter={() => totalPend > 0 && setShowTooltipPendentes(true)}
                  onMouseLeave={() => setShowTooltipPendentes(false)}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#6b7280', lineHeight: 1 }}>{totalPend}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Pendentes</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1, fontWeight: 600 }}>{FORMATOS_PARCEIRAS.find(f => f.value === formatoSel)?.label}</div>
                  {showTooltipPendentes && livrariasPendentes.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', zIndex: 200, minWidth: 200, maxWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', textAlign: 'left' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Faltam conferir</div>
                      {livrariasPendentes.map(l => (
                        <div key={l.id} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</div>
                      ))}
                    </div>
                  )}
                </div>
                {freqHeader > 0 && (
                  <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 14 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: realizadoSemanaHeader >= esperadoSemanaHeader ? '#22c55e' : '#f59e0b', lineHeight: 1 }}>{realizadoSemanaHeader}/{esperadoSemanaHeader}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Semana</div>
                    <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1, fontWeight: 600 }}>{FORMATOS_PARCEIRAS.find(f => f.value === formatoSel)?.label}</div>
                  </div>
                )}
              </div>
              {/* Checklist / Dashboard — parceiras */}
              <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button onClick={() => setAbaViewParceiras('checklist')} style={viewTabStyle(abaViewParceiras === 'checklist')}><List size={13} /> Checklist</button>
                <button onClick={() => setAbaViewParceiras('dashboard')} style={viewTabStyle(abaViewParceiras === 'dashboard')}><LayoutGrid size={13} /> Dashboard</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ n: totalFinalizado, l: 'Finalizados', c: '#22c55e' }, { n: totalIniciado, l: 'Iniciados', c: '#f59e0b' }, { n: totalPendCriat, l: 'Pendentes', c: '#6b7280' }].map(({ n, l, c }) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                    <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1, fontWeight: 600 }}>{FORMATOS_CRIATIVO.find(f => f.value === formatoCriativoSel)?.label}</div>
                  </div>
                ))}
              </div>
              {/* Checklist / Dashboard — criativo */}
              <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button onClick={() => setAbaViewCriativo('checklist')} style={viewTabStyle(abaViewCriativo === 'checklist')}><List size={13} /> Checklist</button>
                <button onClick={() => setAbaViewCriativo('dashboard')} style={viewTabStyle(abaViewCriativo === 'dashboard')}><LayoutGrid size={13} /> Dashboard</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ABAS PRINCIPAIS ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <button style={tabStyle(abaMonitor === 'parceiras')} onClick={() => setAbaMonitor('parceiras')}><BookOpen size={14} /> Livrarias de ed. parceiras</button>
        <button style={tabStyle(abaMonitor === 'criativo')} onClick={() => setAbaMonitor('criativo')}><Users size={14} /> Equipe Cedet</button>
      </div>

      {/* ── NAVEGAÇÃO DE MÊS + DIAS ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(-1)} style={{ flexShrink: 0 }}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flexShrink: 0, minWidth: 110, textAlign: 'center' }}>{MESES[mes - 1]} {ano}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(1)} style={{ flexShrink: 0 }}><ChevronRight size={18} /></button>
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <SeletorDiasCompacto
            dias={dias} mes={mes} ano={ano}
            dataSel={abaMonitor === 'parceiras' ? dataSel : dataCriativoSel}
            onSelect={abaMonitor === 'parceiras' ? setDataSel : handleSelectDiaCriativo}
            indicadores={abaMonitor === 'parceiras' ? indicadoresParceiras(formatoSel) : indicadoresCriativo(formatoCriativoSel)}
          />
        </div>
      </div>

      {/* ── ABA PARCEIRAS ── */}
      {abaMonitor === 'parceiras' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {FORMATOS_PARCEIRAS.map(fmt => <BotaoFormato key={fmt.value} label={fmt.label} ativo={formatoSel === fmt.value} onClick={() => setFormatoSel(fmt.value)} />)}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSeletorLiv('parceiras')} style={{ marginLeft: 'auto' }}>
              <SlidersHorizontal size={13} /> {FORMATOS_PARCEIRAS.find(f=>f.value===formatoSel)?.label} ({livrarias.length}/{todasLivrarias.length})
            </button>
          </div>
          {abaViewParceiras === 'checklist' && (
            loading ? <div className="loading"><div className="spinner" /></div>
            : <ViewChecklistParceiras livrarias={livrarias} checkagemMes={checkagemMes} formato={formatoSel} dataSel={dataSel} diasSemana={diasSemanaAtual} obsFormato={obsFormatoParceiras} onMarcar={handleMarcarParceira} onSalvarObsFixa={(id, obs) => handleSalvarObsFixa(id, obs, formatoSel, 'parceiras')} />
          )}
          {abaViewParceiras === 'dashboard' && (
            loading ? <div className="loading"><div className="spinner" /></div>
            : <ViewDashboard livrarias={livrarias} checkagemMes={checkagemMes} />
          )}
        </>
      )}

      {/* ── ABA CEDET ── */}
      {abaMonitor === 'criativo' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {FORMATOS_CRIATIVO.map(fmt => <BotaoFormato key={fmt.value} label={fmt.label} ativo={formatoCriativoSel === fmt.value} onClick={() => setFormatoCriativoSel(fmt.value)} />)}
            {formatoCriativoSel !== 'email_revenda' && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSeletorLiv('criativo')} style={{ marginLeft: 'auto' }}>
                <SlidersHorizontal size={13} /> {FORMATOS_CRIATIVO.find(f=>f.value===formatoCriativoSel)?.label} ({livrariasCriativo.length}/{todasLivrarias.length})
              </button>
            )}
          </div>
          {abaViewCriativo === 'checklist' && (
            formatoCriativoSel === 'email_revenda'
              ? <ViewEmailRevenda dataKey={dataCriativoSel} />
              : <ViewChecklistCriativo livrarias={livrariasCriativo} checkagemCriativo={checkagemCriativo} formato={formatoCriativoSel} dataKey={dataCriativoSel} onMarcar={handleMarcarCriativo}
                  onSalvarObsFixa={(id, obs) => handleSalvarObsFixa(id, obs, isFormatoCompartilhado ? formatoParceirasCorrespondente : formatoCriativoSel, isFormatoCompartilhado ? 'parceiras' : 'criativo')}
                  obsFormato={isFormatoCompartilhado ? obsFormatoParceiras : obsFormatoCriativo} />
          )}
          {abaViewCriativo === 'dashboard' && (
            <ViewDashboard livrarias={livrariasCriativo} checkagemMes={checkagemCriativo} />
          )}
        </div>
      )}

      {/* ── MODAIS ── */}
      {showSeletorLiv === 'parceiras' && <ModalSeletorLivrarias livrarias={todasLivrarias} selecionadas={getSelecionadasParceiras(formatoSel) ?? todasLivrarias.map(l => l.id)} titulo={`Livrarias — ${FORMATOS_PARCEIRAS.find(f=>f.value===formatoSel)?.label}`} onConfirm={ids => salvarSelParceiras(formatoSel, ids)} onClose={() => setShowSeletorLiv(false)} />}
      {showSeletorLiv === 'criativo' && <ModalSeletorLivrarias livrarias={todasLivrarias} selecionadas={isFormatoCompartilhado ? (getSelecionadasParceiras(formatoCriativoSel) ?? todasLivrarias.map(l => l.id)) : (getSelecionadasCriativo(formatoCriativoSel) ?? todasLivrarias.map(l => l.id))} titulo={`Livrarias — ${FORMATOS_CRIATIVO.find(f=>f.value===formatoCriativoSel)?.label}`} onConfirm={ids => isFormatoCompartilhado ? salvarSelParceiras(formatoCriativoSel, ids) : salvarSelCriativo(formatoCriativoSel, ids)} onClose={() => setShowSeletorLiv(false)} />}
      {painelEditora && <><div onClick={() => setPainelEditora(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} /><PainelEditora editora={painelEditora} checkagemMes={checkagemMes} ano={ano} mes={mes} usuario={usuario} onClose={() => setPainelEditora(null)} /></>}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
