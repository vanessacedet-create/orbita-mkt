// src/pages/TarefasParceirasExtras.js
// Complementos da tela de Tarefas de Editoras Parceiras:
//  · SeletorPessoas  — escolher de quem ver as tarefas (uma, várias ou todas)
//  · PainelProjetos  — projetos com status, prazo e anexos (arquivos e links)
// Tabelas: projetos_parceiras, projetos_parceiras_anexos · Armazenamento: projetos-parceiras
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, Pencil, Trash2, Paperclip, Link2, FolderOpen, Upload, ExternalLink, Calendar, Users } from 'lucide-react'

export const STATUS_PROJETO = [
  { value: 'a_fazer',      label: 'A fazer',      cor: '#6366f1' },
  { value: 'em_andamento', label: 'Em andamento', cor: '#f59e0b' },
  { value: 'concluido',    label: 'Concluído',    cor: '#22c55e' },
]

const BUCKET = 'projetos-parceiras'

// ── Dados de projetos ──────────────────────────────────────────
export async function getProjetosParceiras() {
  const { data, error } = await supabase
    .from('projetos_parceiras')
    .select('*, criador:created_by(id, nome)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function salvarProjeto(dados, id) {
  if (id) {
    const { data, error } = await supabase.from('projetos_parceiras')
      .update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
      .select('*, criador:created_by(id, nome)').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('projetos_parceiras')
    .insert([dados]).select('*, criador:created_by(id, nome)').single()
  if (error) throw error
  return data
}

async function excluirProjeto(id) {
  const { error } = await supabase.from('projetos_parceiras').delete().eq('id', id)
  if (error) throw error
}

async function getAnexos(projetoId) {
  const { data, error } = await supabase.from('projetos_parceiras_anexos')
    .select('*, autor:criado_por(id, nome)').eq('projeto_id', projetoId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Seletor de pessoas ─────────────────────────────────────────
export function SeletorPessoas({ usuarios, selecionados, onChange }) {
  const todasMarcadas = usuarios.length > 0 && usuarios.every(u => selecionados.includes(u.id))
  function alternar(id) {
    onChange(selecionados.includes(id) ? selecionados.filter(x => x !== id) : [...selecionados, id])
  }
  const chip = (ativo) => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '2px solid', borderColor: ativo ? 'var(--accent)' : 'var(--border)',
    background: ativo ? 'var(--accent-glow)' : 'transparent',
    color: ativo ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> Ver tarefas de:</span>
      <button type="button" style={chip(todasMarcadas)} onClick={() => onChange(todasMarcadas ? [] : usuarios.map(u => u.id))}>Todas</button>
      {usuarios.map(u => (
        <button key={u.id} type="button" style={chip(selecionados.includes(u.id))} onClick={() => alternar(u.id)}>
          {u.nome.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}

// ── Painel de projetos ─────────────────────────────────────────
export function PainelProjetos({ usuario, projetos, tarefas, onRecarregar, onVerTarefas, showToast }) {
  const [modal, setModal] = useState(null) // null | 'novo' | projeto
  const [filtroStatus, setFiltroStatus] = useState('ativos')
  const ehSupervisora = usuario?.perfil === 'supervisor_parceiras'

  const lista = projetos.filter(p =>
    filtroStatus === 'todos' ? true : filtroStatus === 'ativos' ? p.status !== 'concluido' : p.status === 'concluido')

  async function mudarStatus(p, status) {
    try { await salvarProjeto({ status }, p.id); onRecarregar() }
    catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'ativos', l: 'Ativos' }, { k: 'concluidos', l: 'Concluídos' }, { k: 'todos', l: 'Todos' }].map(f => (
            <button key={f.k} onClick={() => setFiltroStatus(f.k)} className={`btn btn-sm ${filtroStatus === f.k ? 'btn-primary' : 'btn-ghost'}`}>{f.l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setModal('novo')}><Plus size={14} /> Novo projeto</button>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state"><FolderOpen size={34} strokeWidth={1} style={{ marginBottom: 10 }} /><p>Nenhum projeto aqui ainda.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {lista.map(p => {
            const st = STATUS_PROJETO.find(s => s.value === p.status) || STATUS_PROJETO[0]
            const doProjeto = tarefas.filter(t => t.projeto_id === p.id)
            const feitas = doProjeto.filter(t => t.status === 'concluido').length
            const pct = doProjeto.length ? Math.round((feitas / doProjeto.length) * 100) : 0
            const podeEditar = ehSupervisora || p.created_by === usuario?.id
            return (
              <div key={p.id} className="table-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${st.cor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.nome}</div>
                  {podeEditar && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(p)} title="Editar e anexos"><Pencil size={12} /></button>}
                </div>
                {p.descricao && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{p.descricao}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  <span>Criado por {p.criador?.nome?.split(' ')[0] || '—'}</span>
                  {p.data_prazo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {new Date(p.data_prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  <span>{feitas}/{doProjeto.length} tarefas</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: st.cor }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="form-select" value={p.status} disabled={!podeEditar} onChange={e => mudarStatus(p, e.target.value)}
                    style={{ width: 'auto', fontSize: 11, padding: '3px 8px', color: st.cor, borderColor: st.cor, fontWeight: 700 }}>
                    {STATUS_PROJETO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={() => onVerTarefas(p.id)}>Ver tarefas</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal({ ...p, _soAnexos: !podeEditar })}><Paperclip size={12} /> Materiais</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ModalProjeto
          projeto={modal === 'novo' ? null : modal}
          usuario={usuario}
          podeEditar={modal === 'novo' || !modal._soAnexos}
          onFechar={() => setModal(null)}
          onSalvo={() => { onRecarregar(); showToast('Projeto salvo!') }}
          onExcluido={() => { setModal(null); onRecarregar(); showToast('Projeto excluído!') }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function ModalProjeto({ projeto, usuario, podeEditar, onFechar, onSalvo, onExcluido, showToast }) {
  const [form, setForm] = useState({
    nome: projeto?.nome || '', descricao: projeto?.descricao || '',
    status: projeto?.status || 'a_fazer', data_prazo: projeto?.data_prazo || '',
  })
  const [atual, setAtual] = useState(projeto)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    try {
      const dados = { nome: form.nome.trim(), descricao: form.descricao.trim() || null, status: form.status, data_prazo: form.data_prazo || null }
      const salvo = await salvarProjeto(atual ? dados : { ...dados, created_by: usuario.id }, atual?.id)
      setAtual(salvo)
      onSalvo()
      if (atual) onFechar()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvando(false) }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o projeto "${atual.nome}"?\n\nAs tarefas dele continuam existindo, só ficam sem projeto.`)) return
    try { await excluirProjeto(atual.id); onExcluido() }
    catch (e) { showToast('Não foi possível excluir: ' + e.message + ' (remova os materiais antes)', 'error') }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{atual ? (podeEditar ? 'Editar projeto' : atual.nome) : 'Novo projeto'}</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {atual && podeEditar && <button className="btn btn-danger btn-sm" onClick={excluir}><Trash2 size={13} /></button>}
            <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
          </div>
        </div>

        {podeEditar && (
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Lançamentos de dezembro" /></div>
            <div className="form-group"><label className="form-label">Descrição</label>
              <textarea className="form-textarea" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_PROJETO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Prazo</label>
                <input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo: e.target.value }))} /></div>
            </div>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando || !form.nome.trim()}>
                {salvando ? 'Salvando...' : atual ? 'Salvar' : 'Criar projeto'}
              </button>
            </div>
          </div>
        )}

        {atual ? <Anexos projeto={atual} usuario={usuario} showToast={showToast} />
          : <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Depois de criar o projeto, você poderá adicionar materiais (arquivos e links).</div>}
      </div>
    </div>
  )
}

function Anexos({ projeto, usuario, showToast }) {
  const [anexos, setAnexos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [link, setLink] = useState({ nome: '', url: '' })
  const refArquivo = useRef(null)

  useEffect(() => { carregar() }, [projeto.id])

  async function carregar() {
    setCarregando(true)
    try { setAnexos(await getAnexos(projeto.id)) } catch (e) { showToast('Erro ao carregar materiais: ' + e.message, 'error') }
    setCarregando(false)
  }

  async function enviarArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { showToast('Arquivo maior que 20 MB.', 'error'); return }
    setEnviando(true)
    try {
      const limpo = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
      const caminho = `${projeto.id}/${Date.now()}_${limpo}`
      const up = await supabase.storage.from(BUCKET).upload(caminho, file)
      if (up.error) throw up.error
      const { error } = await supabase.from('projetos_parceiras_anexos')
        .insert([{ projeto_id: projeto.id, tipo: 'arquivo', nome: file.name, caminho, criado_por: usuario.id }])
      if (error) throw error
      showToast('Arquivo adicionado!')
      carregar()
    } catch (err) { showToast('Erro ao enviar: ' + err.message, 'error') }
    finally { setEnviando(false); if (refArquivo.current) refArquivo.current.value = '' }
  }

  async function adicionarLink() {
    let url = link.url.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    try {
      const { error } = await supabase.from('projetos_parceiras_anexos')
        .insert([{ projeto_id: projeto.id, tipo: 'link', nome: link.nome.trim() || url, url, criado_por: usuario.id }])
      if (error) throw error
      setLink({ nome: '', url: '' })
      carregar()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  async function abrir(a) {
    if (a.tipo === 'link') { window.open(a.url, '_blank', 'noopener'); return }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.caminho, 60 * 10)
    if (error) { showToast('Erro ao abrir: ' + error.message, 'error'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function remover(a) {
    if (!window.confirm(`Remover "${a.nome}"?`)) return
    try {
      if (a.tipo === 'arquivo' && a.caminho) await supabase.storage.from(BUCKET).remove([a.caminho])
      const { error } = await supabase.from('projetos_parceiras_anexos').delete().eq('id', a.id)
      if (error) throw error
      carregar()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Paperclip size={14} /> Materiais do projeto
      </div>
      {carregando ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {anexos.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum material ainda.</div>}
          {anexos.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
              {a.tipo === 'link' ? <Link2 size={14} color="var(--accent)" /> : <Paperclip size={14} color="var(--accent)" />}
              <button onClick={() => abrir(a)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', padding: 0 }}>
                {a.nome} <ExternalLink size={11} style={{ opacity: 0.5 }} />
              </button>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.autor?.nome?.split(' ')[0]}</span>
              <button onClick={() => remover(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }} title="Remover"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn btn-ghost btn-sm" style={{ cursor: enviando ? 'wait' : 'pointer' }}>
          <input ref={refArquivo} type="file" onChange={enviarArquivo} disabled={enviando} style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp" />
          <Upload size={12} /> {enviando ? 'Enviando...' : 'Enviar arquivo'}
        </label>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>doc, planilha, PDF ou imagem · até 20 MB</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input className="form-input" style={{ fontSize: 12, flex: 1 }} placeholder="Nome do link (opcional)" value={link.nome} onChange={e => setLink(l => ({ ...l, nome: e.target.value }))} />
        <input className="form-input" style={{ fontSize: 12, flex: 2 }} placeholder="https://..." value={link.url} onChange={e => setLink(l => ({ ...l, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && adicionarLink()} />
        <button className="btn btn-ghost btn-sm" onClick={adicionarLink} disabled={!link.url.trim()}><Plus size={12} /> Link</button>
      </div>
    </div>
  )
}
