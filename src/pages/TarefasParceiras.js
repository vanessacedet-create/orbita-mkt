import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getBancoTarefas, createBancoTarefa, updateBancoTarefa, desativarBancoTarefa,
  getAtribuicoes, getMinhasAtribuicoes, atribuirTarefa, updateAtribuicao, deleteAtribuicao,
} from '../lib/banco-tarefas'
import { getUsuarios } from '../lib/supabase'

const PERIODICIDADES = [
  { value: 'diaria',     label: 'Diária' },
  { value: 'semanal',    label: 'Semanal' },
  { value: 'quinzenal',  label: 'Quinzenal' },
  { value: 'mensal',     label: 'Mensal' },
  { value: 'anual',      label: 'Anual' },
  { value: 'avulsa',     label: 'Avulsa' },
]

const STATUS_LABEL = {
  a_fazer:      { label: 'A fazer',      cor: '#6b7280' },
  em_andamento: { label: 'Em andamento', cor: '#f59e0b' },
  concluida:    { label: 'Concluída',    cor: '#10b981' },
  cancelada:    { label: 'Cancelada',    cor: '#ef4444' },
}

export default function TarefasParceiras() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'

  const [aba, setAba] = useState('atribuicoes') // 'atribuicoes' | 'banco'

  // Dados
  const [banco, setBanco] = useState([])
  const [atribuicoes, setAtribuicoes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros (aba atribuições)
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // Modal: Banco de Tarefas
  const [modalBanco, setModalBanco] = useState(false)
  const [editandoBanco, setEditandoBanco] = useState(null)
  const [formBanco, setFormBanco] = useState({ nome: '', descricao: '', periodicidade: 'avulsa', responsavel_id: '' })

  // Modal: Atribuir Tarefa
  const [modalAtribuir, setModalAtribuir] = useState(false)
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null)
  const [formAtribuir, setFormAtribuir] = useState({ responsavel_id: '', data_prazo: '', especificidade: '' })

  // Modal: Editar Atribuição
  const [modalEditarAtrib, setModalEditarAtrib] = useState(false)
  const [atribuicaoEditando, setAtribuicaoEditando] = useState(null)
  const [formEditarAtrib, setFormEditarAtrib] = useState({})

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const [bancoData, atribData, usersData] = await Promise.all([
        getBancoTarefas(),
        isAdmin ? getAtribuicoes() : getMinhasAtribuicoes(usuario.id),
        isAdmin ? getUsuarios() : Promise.resolve([]),
      ])
      setBanco(bancoData)
      setAtribuicoes(atribData)
      setUsuarios(usersData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Banco de Tarefas ────────────────────────────────────────────────────────

  function abrirModalBanco(tarefa = null) {
    setEditandoBanco(tarefa)
    setFormBanco(tarefa
      ? { nome: tarefa.nome, descricao: tarefa.descricao || '', periodicidade: tarefa.periodicidade, responsavel_id: tarefa.responsavel_id || '' }
      : { nome: '', descricao: '', periodicidade: 'avulsa', responsavel_id: '' }
    )
    setModalBanco(true)
  }

  async function salvarBanco() {
    const payload = {
      ...formBanco,
      responsavel_id: formBanco.responsavel_id || null,
      created_by: usuario.id,
    }
    try {
      if (editandoBanco) {
        const atualizada = await updateBancoTarefa(editandoBanco.id, payload)
        setBanco(b => b.map(t => t.id === atualizada.id ? atualizada : t))
      } else {
        const nova = await createBancoTarefa(payload)
        setBanco(b => [nova, ...b])
      }
      setModalBanco(false)
    } catch (e) { alert('Erro ao salvar: ' + e.message) }
  }

  async function desativar(id) {
    if (!window.confirm('Desativar esta tarefa do banco?')) return
    await desativarBancoTarefa(id)
    setBanco(b => b.filter(t => t.id !== id))
  }

  // ── Atribuições ────────────────────────────────────────────────────────────

  function abrirAtribuir(tarefa) {
    setTarefaSelecionada(tarefa)
    setFormAtribuir({
      responsavel_id: tarefa.responsavel_id || '',
      data_prazo: '',
      especificidade: '',
    })
    setModalAtribuir(true)
  }

  async function confirmarAtribuicao() {
    if (!formAtribuir.responsavel_id) return alert('Selecione um responsável.')
    try {
      const nova = await atribuirTarefa({
        bancoTarefaId:  tarefaSelecionada.id,
        responsavelId:  formAtribuir.responsavel_id,
        dataPrazo:      formAtribuir.data_prazo || null,
        especificidade: formAtribuir.especificidade || null,
        atribuidaPor:   usuario.id,
      })
      setAtribuicoes(a => [nova, ...a])
      setModalAtribuir(false)
    } catch (e) { alert('Erro ao atribuir: ' + e.message) }
  }

  function abrirEditarAtrib(atrib) {
    setAtribuicaoEditando(atrib)
    setFormEditarAtrib({
      responsavel_id: atrib.responsavel_id,
      data_prazo: atrib.data_prazo || '',
      especificidade: atrib.especificidade || '',
      status: atrib.status,
    })
    setModalEditarAtrib(true)
  }

  async function salvarEdicaoAtrib() {
    try {
      const atualizada = await updateAtribuicao(atribuicaoEditando.id, {
        ...formEditarAtrib,
        responsavel_id: formEditarAtrib.responsavel_id || null,
        data_prazo: formEditarAtrib.data_prazo || null,
      })
      setAtribuicoes(a => a.map(x => x.id === atualizada.id ? atualizada : x))
      setModalEditarAtrib(false)
    } catch (e) { alert('Erro ao salvar: ' + e.message) }
  }

  async function removerAtribuicao(id) {
    if (!window.confirm('Remover esta atribuição?')) return
    await deleteAtribuicao(id)
    setAtribuicoes(a => a.filter(x => x.id !== id))
  }

  // ── Filtros ────────────────────────────────────────────────────────────────

  const atribuicoesFiltradas = atribuicoes.filter(a => {
    if (filtroResponsavel && a.responsavel_id !== filtroResponsavel) return false
    if (filtroStatus && a.status !== filtroStatus) return false
    return true
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.loading}>Carregando...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.titulo}>Tarefas da Área</h1>
        <div style={s.abas}>
          <button style={aba === 'atribuicoes' ? s.abaAtiva : s.aba} onClick={() => setAba('atribuicoes')}>
            Atribuições
          </button>
          {isAdmin && (
            <button style={aba === 'banco' ? s.abaAtiva : s.aba} onClick={() => setAba('banco')}>
              Banco de Tarefas
            </button>
          )}
        </div>
      </div>

      {/* ── ABA: ATRIBUIÇÕES ── */}
      {aba === 'atribuicoes' && (
        <div>
          {/* Filtros (só admin vê) */}
          {isAdmin && (
            <div style={s.filtros}>
              <select style={s.select} value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}>
                <option value=''>Todos os responsáveis</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <select style={s.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                <option value=''>Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <button style={s.btnSecundario} onClick={() => { setFiltroResponsavel(''); setFiltroStatus('') }}>
                Limpar filtros
              </button>
            </div>
          )}

          {atribuicoesFiltradas.length === 0 ? (
            <div style={s.vazio}>
              {isAdmin
                ? 'Nenhuma atribuição encontrada. Vá ao Banco de Tarefas e clique em "Atribuir".'
                : 'Você não tem tarefas atribuídas no momento.'}
            </div>
          ) : (
            <div style={s.lista}>
              {atribuicoesFiltradas.map(a => {
                const statusInfo = STATUS_LABEL[a.status] || STATUS_LABEL.a_fazer
                return (
                  <div key={a.id} style={s.card}>
                    <div style={s.cardTopo}>
                      <div>
                        <span style={s.nomeTarefa}>{a.banco_tarefa?.nome}</span>
                        <span style={{ ...s.badge, background: statusInfo.cor }}>{statusInfo.label}</span>
                        <span style={s.badgePeriodo}>{a.banco_tarefa?.periodicidade}</span>
                      </div>
                      {isAdmin && (
                        <div style={s.acoes}>
                          <button style={s.btnIcone} onClick={() => abrirEditarAtrib(a)} title='Editar'>✏️</button>
                          <button style={s.btnIcone} onClick={() => removerAtribuicao(a.id)} title='Remover'>🗑️</button>
                        </div>
                      )}
                    </div>

                    <div style={s.cardInfo}>
                      <span>👤 {a.responsavel?.nome || '—'}</span>
                      {a.data_prazo && <span>📅 Prazo: {new Date(a.data_prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                      {a.especificidade && <span style={s.especificidade}>💬 {a.especificidade}</span>}
                    </div>

                    {/* Membro pode marcar como concluída */}
                    {!isAdmin && a.status === 'a_fazer' && (
                      <button
                        style={s.btnConcluir}
                        onClick={() => updateAtribuicao(a.id, { status: 'em_andamento' }).then(carregarDados)}
                      >
                        Iniciar
                      </button>
                    )}
                    {!isAdmin && a.status === 'em_andamento' && (
                      <button
                        style={{ ...s.btnConcluir, background: '#10b981' }}
                        onClick={() => updateAtribuicao(a.id, { status: 'concluida' }).then(carregarDados)}
                      >
                        Marcar como concluída
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: BANCO DE TAREFAS ── */}
      {aba === 'banco' && isAdmin && (
        <div>
          <div style={s.barraoAcao}>
            <button style={s.btnPrimario} onClick={() => abrirModalBanco()}>+ Nova tarefa no banco</button>
          </div>

          {banco.length === 0 ? (
            <div style={s.vazio}>Nenhuma tarefa cadastrada ainda. Crie a primeira!</div>
          ) : (
            <div style={s.lista}>
              {banco.map(t => (
                <div key={t.id} style={s.card}>
                  <div style={s.cardTopo}>
                    <div>
                      <span style={s.nomeTarefa}>{t.nome}</span>
                      <span style={s.badgePeriodo}>{t.periodicidade}</span>
                    </div>
                    <div style={s.acoes}>
                      <button style={s.btnAtribuir} onClick={() => abrirAtribuir(t)}>Atribuir</button>
                      <button style={s.btnIcone} onClick={() => abrirModalBanco(t)} title='Editar'>✏️</button>
                      <button style={s.btnIcone} onClick={() => desativar(t.id)} title='Desativar'>🗑️</button>
                    </div>
                  </div>
                  {t.descricao && <p style={s.descricao}>{t.descricao}</p>}
                  {t.responsavel && <span style={s.responsavelPadrao}>👤 Padrão: {t.responsavel.nome}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: BANCO DE TAREFAS ── */}
      {modalBanco && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitulo}>{editandoBanco ? 'Editar tarefa' : 'Nova tarefa no banco'}</h2>

            <label style={s.label}>Nome *</label>
            <input style={s.input} value={formBanco.nome}
              onChange={e => setFormBanco(f => ({ ...f, nome: e.target.value }))}
              placeholder='Ex: Relatório semanal de parceiros' />

            <label style={s.label}>Descrição</label>
            <textarea style={s.textarea} value={formBanco.descricao}
              onChange={e => setFormBanco(f => ({ ...f, descricao: e.target.value }))}
              placeholder='Detalhes, instruções, links relevantes...' rows={3} />

            <label style={s.label}>Periodicidade *</label>
            <select style={s.select} value={formBanco.periodicidade}
              onChange={e => setFormBanco(f => ({ ...f, periodicidade: e.target.value }))}>
              {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            <label style={s.label}>Responsável padrão (opcional)</label>
            <select style={s.select} value={formBanco.responsavel_id}
              onChange={e => setFormBanco(f => ({ ...f, responsavel_id: e.target.value }))}>
              <option value=''>Sem responsável padrão</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>

            <div style={s.modalBotoes}>
              <button style={s.btnSecundario} onClick={() => setModalBanco(false)}>Cancelar</button>
              <button style={s.btnPrimario} onClick={salvarBanco}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ATRIBUIR TAREFA ── */}
      {modalAtribuir && tarefaSelecionada && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitulo}>Atribuir tarefa</h2>
            <p style={s.modalSubtitulo}>📋 <strong>{tarefaSelecionada.nome}</strong></p>

            <label style={s.label}>Responsável *</label>
            <select style={s.select} value={formAtribuir.responsavel_id}
              onChange={e => setFormAtribuir(f => ({ ...f, responsavel_id: e.target.value }))}>
              <option value=''>Selecione...</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>

            <label style={s.label}>Prazo (opcional)</label>
            <input style={s.input} type='date' value={formAtribuir.data_prazo}
              onChange={e => setFormAtribuir(f => ({ ...f, data_prazo: e.target.value }))} />

            <label style={s.label}>Observação pontual (opcional)</label>
            <textarea style={s.textarea} value={formAtribuir.especificidade}
              onChange={e => setFormAtribuir(f => ({ ...f, especificidade: e.target.value }))}
              placeholder='Algo específico desta ocorrência...' rows={2} />

            <div style={s.modalBotoes}>
              <button style={s.btnSecundario} onClick={() => setModalAtribuir(false)}>Cancelar</button>
              <button style={s.btnPrimario} onClick={confirmarAtribuicao}>Atribuir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR ATRIBUIÇÃO ── */}
      {modalEditarAtrib && atribuicaoEditando && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitulo}>Editar atribuição</h2>
            <p style={s.modalSubtitulo}>📋 <strong>{atribuicaoEditando.banco_tarefa?.nome}</strong></p>

            <label style={s.label}>Responsável</label>
            <select style={s.select} value={formEditarAtrib.responsavel_id}
              onChange={e => setFormEditarAtrib(f => ({ ...f, responsavel_id: e.target.value }))}>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>

            <label style={s.label}>Status</label>
            <select style={s.select} value={formEditarAtrib.status}
              onChange={e => setFormEditarAtrib(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(STATUS_LABEL).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>

            <label style={s.label}>Prazo</label>
            <input style={s.input} type='date' value={formEditarAtrib.data_prazo}
              onChange={e => setFormEditarAtrib(f => ({ ...f, data_prazo: e.target.value }))} />

            <label style={s.label}>Observação pontual</label>
            <textarea style={s.textarea} value={formEditarAtrib.especificidade}
              onChange={e => setFormEditarAtrib(f => ({ ...f, especificidade: e.target.value }))}
              rows={2} />

            <div style={s.modalBotoes}>
              <button style={s.btnSecundario} onClick={() => setModalEditarAtrib(false)}>Cancelar</button>
              <button style={s.btnPrimario} onClick={salvarEdicaoAtrib}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page:        { maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' },
  loading:     { textAlign: 'center', padding: 48, color: '#6b7280' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  titulo:      { fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' },
  abas:        { display: 'flex', gap: 8 },
  aba:         { padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#6b7280' },
  abaAtiva:    { padding: '8px 18px', borderRadius: 8, border: '1px solid #4f46e5', background: '#4f46e5', cursor: 'pointer', fontWeight: 600, color: '#fff' },
  filtros:     { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  barraoAcao:  { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  lista:       { display: 'flex', flexDirection: 'column', gap: 12 },
  card:        { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' },
  cardTopo:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardInfo:    { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#6b7280', marginTop: 6 },
  nomeTarefa:  { fontWeight: 600, fontSize: 15, color: '#111827', marginRight: 8 },
  badge:       { display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: '#fff', marginRight: 6 },
  badgePeriodo:{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: '#ede9fe', color: '#6d28d9' },
  acoes:       { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  descricao:   { margin: '6px 0 0', fontSize: 13, color: '#6b7280' },
  responsavelPadrao: { fontSize: 12, color: '#9ca3af' },
  especificidade:    { fontStyle: 'italic' },
  vazio:       { textAlign: 'center', color: '#9ca3af', padding: '48px 0', fontSize: 14 },
  btnPrimario: { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnSecundario:{ padding: '9px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: 14 },
  btnAtribuir: { padding: '6px 14px', borderRadius: 8, border: 'none', background: '#ede9fe', color: '#6d28d9', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  btnIcone:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 4px' },
  btnConcluir: { marginTop: 10, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  select:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff', color: '#111827' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  modalSubtitulo: { margin: 0, fontSize: 14, color: '#6b7280' },
  modalBotoes: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  label:       { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 2 },
  input:       { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  textarea:    { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: '100%', boxSizing: 'border-box', resize: 'vertical' },
}
