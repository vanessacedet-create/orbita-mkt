import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, CheckSquare, Users, Clock, GripVertical } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUsuarios } from '../lib/supabase'
import {
  getBancoTarefasInf,
  createBancoTarefaInf,
  updateBancoTarefaInf,
  desativarBancoTarefaInf,
  setResponsaveisBancoInf,
  setChecklistPadraoInf,
} from '../lib/tarefas-influencers'

const PERFIS_INFLUENCERS = ['supervisor_influencers', 'analista_influencers', 'estagiario_influencers']
const PERIODICIDADES = [
  ['avulsa', 'Avulsa'],
  ['diaria', 'Diária'],
  ['semanal', 'Semanal'],
  ['quinzenal', 'Quinzenal'],
  ['mensal', 'Mensal'],
  ['anual', 'Anual'],
]

const FORM_VAZIO = {
  nome: '',
  descricao: '',
  periodicidade: 'avulsa',
  responsaveis_ids: [],
  tempo_medio_minutos: '',
  checklist: [],
}

export default function ModelosTarefasInfluencers() {
  const { usuario } = useAuth()
  const [modelos, setModelos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [novoItem, setNovoItem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [itemArrastado, setItemArrastado] = useState(null)
  const [itemSobre, setItemSobre] = useState(null)

  async function carregar() {
    setLoading(true)
    try {
      const [m, u] = await Promise.all([getBancoTarefasInf(), getUsuarios()])
      setModelos(m || [])
      setUsuarios((u || []).filter(x => PERFIS_INFLUENCERS.includes(x.perfil)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setNovoItem('')
    setItemArrastado(null)
    setItemSobre(null)
    setModal(true)
  }

  function abrirEditar(modelo) {
    setEditando(modelo)
    setForm({
      nome: modelo.nome || '',
      descricao: modelo.descricao || '',
      periodicidade: modelo.periodicidade || 'avulsa',
      responsaveis_ids: (modelo.responsaveis_padrao || []).map(r => r.usuario_id),
      tempo_medio_minutos: modelo.tempo_medio_minutos || '',
      checklist: (modelo.checklist_padrao || []).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(c => c.texto),
    })
    setNovoItem('')
    setItemArrastado(null)
    setItemSobre(null)
    setModal(true)
  }

  function toggleResponsavel(id) {
    setForm(f => ({
      ...f,
      responsaveis_ids: f.responsaveis_ids.includes(id)
        ? f.responsaveis_ids.filter(x => x !== id)
        : [...f.responsaveis_ids, id],
    }))
  }

  function adicionarChecklist() {
    const texto = novoItem.trim()
    if (!texto) return
    setForm(f => ({ ...f, checklist: [...f.checklist, texto] }))
    setNovoItem('')
  }

  function iniciarArrasteChecklist(e, indice) {
    setItemArrastado(indice)
    setItemSobre(indice)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(indice))
  }

  function passarSobreChecklist(e, indice) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setItemSobre(indice)
  }

  function soltarChecklist(e, indiceDestino) {
    e.preventDefault()
    if (itemArrastado === null || itemArrastado === indiceDestino) {
      setItemArrastado(null)
      setItemSobre(null)
      return
    }

    setForm(f => {
      const checklist = [...f.checklist]
      const [movido] = checklist.splice(itemArrastado, 1)
      checklist.splice(indiceDestino, 0, movido)
      return { ...f, checklist }
    })
    setItemArrastado(null)
    setItemSobre(null)
  }

  function encerrarArrasteChecklist() {
    setItemArrastado(null)
    setItemSobre(null)
  }

  async function salvar() {
    if (!form.nome.trim()) return alert('Informe o nome do modelo.')
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        periodicidade: form.periodicidade,
        responsavel_id: form.responsaveis_ids[0] || null,
        tempo_medio_minutos: form.tempo_medio_minutos ? Number(form.tempo_medio_minutos) : null,
        created_by: usuario.id,
      }
      const salvo = editando
        ? await updateBancoTarefaInf(editando.id, payload)
        : await createBancoTarefaInf(payload)

      await setResponsaveisBancoInf(salvo.id, form.responsaveis_ids)
      await setChecklistPadraoInf(salvo.id, form.checklist)
      setModal(false)
      await carregar()
    } catch (e) {
      alert('Erro ao salvar modelo: ' + (e.message || 'erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id) {
    if (!window.confirm('Desativar este modelo? As tarefas já criadas continuarão existindo.')) return
    await desativarBancoTarefaInf(id)
    setModelos(prev => prev.filter(m => m.id !== id))
  }

  const idsUsuariosVisiveis = new Set(usuarios.map(u => u.id))
  const responsaveisInativos = (editando?.responsaveis_padrao || [])
    .filter(r => form.responsaveis_ids.includes(r.usuario_id) && !idsUsuariosVisiveis.has(r.usuario_id))

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, color:'var(--text)' }}>Biblioteca de modelos</h2>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-muted)' }}>Defina os tipos de tarefa reutilizáveis para a equipe de Influencers.</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14}/> Novo modelo</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/></div>
      ) : modelos.length === 0 ? (
        <div className="empty-state"><p>Nenhum modelo cadastrado.</p></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
          {modelos.map(modelo => {
            const checklist = modelo.checklist_padrao || []
            const responsaveis = (modelo.responsaveis_padrao || []).map(r => r.usuario?.nome).filter(Boolean)
            return (
              <div key={modelo.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{modelo.nome}</div>
                    {modelo.descricao && <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.45, margin:'7px 0 0' }}>{modelo.descricao}</p>}
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditar(modelo)} title="Editar"><Pencil size={12}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => remover(modelo.id)} title="Desativar"><Trash2 size={12}/></button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:12, fontSize:11, color:'var(--text-muted)' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Clock size={11}/>{PERIODICIDADES.find(x => x[0] === modelo.periodicidade)?.[1] || 'Avulsa'}</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><CheckSquare size={11}/>{checklist.length} etapa(s)</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Users size={11}/>{responsaveis.length ? responsaveis.join(', ') : 'Sem responsável padrão'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth:620, maxHeight:'92vh', overflowY:'auto' }}>
            <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:5 }}>
              <h2 className="modal-title">{editando ? 'Editar modelo' : 'Novo modelo'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(false)}><X size={16}/></button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nome do modelo *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome:e.target.value }))} placeholder="Ex.: Carrossel para livraria"/>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição e instruções</label>
                <textarea className="form-textarea" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao:e.target.value }))} placeholder="Orientações que serão reutilizadas ao criar a tarefa..."/>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Periodicidade</label>
                  <select className="form-select" value={form.periodicidade} onChange={e => setForm(f => ({ ...f, periodicidade:e.target.value }))}>
                    {PERIODICIDADES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tempo médio em minutos</label>
                  <input className="form-input" type="number" min="1" value={form.tempo_medio_minutos} onChange={e => setForm(f => ({ ...f, tempo_medio_minutos:e.target.value }))} placeholder="Ex.: 60"/>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Responsável padrão</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {responsaveisInativos.map(r => (
                    <button key={r.usuario_id} type="button" onClick={() => toggleResponsavel(r.usuario_id)} title="Clique para remover este vínculo antigo" style={{ padding:'5px 12px', borderRadius:20, border:'1px solid #ef4444', background:'rgba(239,68,68,.12)', color:'#ef4444', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      {r.usuario?.nome?.split(' ')[0] || 'Usuário inativo'} · remover
                    </button>
                  ))}
                  {usuarios.map(u => {
                    const ativo = form.responsaveis_ids.includes(u.id)
                    return <button key={u.id} type="button" onClick={() => toggleResponsavel(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer', fontSize:12, fontWeight:600 }}>{u.nome.split(' ')[0]}</button>
                  })}
                </div>
                {responsaveisInativos.length > 0 && <div style={{ marginTop:7, fontSize:11, color:'var(--text-muted)' }}>O nome em vermelho é um vínculo antigo. Clique nele para remover e deixe apenas Yasmin selecionada.</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Checklist padrão</label>
                {form.checklist.length > 1 && <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:7 }}>Arraste pelo ícone à esquerda para alterar a ordem das etapas.</div>}
                {form.checklist.map((item, i) => (
                  <div
                    key={`${item}-${i}`}
                    onDragOver={e => passarSobreChecklist(e, i)}
                    onDrop={e => soltarChecklist(e, i)}
                    style={{
                      display:'flex', gap:7, alignItems:'center', marginBottom:6,
                      padding:'5px 6px', borderRadius:8,
                      border:`1px solid ${itemSobre === i && itemArrastado !== i ? 'var(--accent)' : 'transparent'}`,
                      background:itemArrastado === i ? 'var(--surface-2)' : 'transparent',
                      opacity:itemArrastado === i ? 0.55 : 1,
                      transition:'border-color .12s, background .12s, opacity .12s',
                    }}
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={e => iniciarArrasteChecklist(e, i)}
                      onDragEnd={encerrarArrasteChecklist}
                      title="Arrastar para reordenar"
                      aria-label={`Mover etapa ${i + 1}`}
                      style={{
                        width:26, height:34, display:'flex', alignItems:'center', justifyContent:'center',
                        background:'transparent', border:'none', color:'var(--text-muted)', cursor:'grab',
                        padding:0, flexShrink:0,
                      }}
                    >
                      <GripVertical size={16}/>
                    </button>
                    <span style={{ width:20, textAlign:'right', fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>{i+1}.</span>
                    <input className="form-input" value={item} onChange={e => setForm(f => ({ ...f, checklist:f.checklist.map((x,idx) => idx === i ? e.target.value : x) }))}/>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm(f => ({ ...f, checklist:f.checklist.filter((_,idx) => idx !== i) }))}><Trash2 size={12}/></button>
                  </div>
                ))}
                <div style={{ display:'flex', gap:7 }}>
                  <input className="form-input" value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarChecklist() } }} placeholder="Adicionar etapa..."/>
                  <button className="btn btn-ghost" type="button" onClick={adicionarChecklist}><Plus size={13}/> Adicionar</button>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar modelo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}