import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Store, BookOpen, ClipboardList, Link2, Plus, Search, Upload, Package, Edit2, Trash2,
  Eye, EyeOff, Star, StarOff, X, Save, Check, Copy, ExternalLink, Lock, AlertCircle,
  Loader2, CalendarDays, UserRound,
} from 'lucide-react'

/* ============================================
   VITRINE EDITORAS PARCEIRAS — Painel interno
   Abas: Livros · Pedidos · Seleções
   Tabelas: vp_livros, vp_pedidos, vp_pedido_itens, vp_selecoes, vp_selecao_livros
   Influencers: vp_influencers (cadastro no menu "Influencers")
   Pedido marcado como "Concluído" → o banco cria a cortesia sozinho
   (menu "Cortesias").
   ============================================ */

const STATUS_PEDIDO = {
  novo:      { label: 'Novo',      cor: '#f59e0b' },
  visto:     { label: 'Visto',     cor: '#3b82f6' },
  aprovado:  { label: 'Aprovado',  cor: '#8b5cf6' },
  concluido: { label: 'Concluído', cor: '#22c55e' },
  cancelado: { label: 'Cancelado', cor: '#6b7280' },
}

const STATUS_SELECAO = {
  aberta:     { label: 'Aguardando escolha', cor: '#f59e0b' },
  respondida: { label: 'Respondida',         cor: '#22c55e' },
  encerrada:  { label: 'Encerrada',          cor: '#6b7280' },
}

function fmtData(d) {
  if (!d) return '—'
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

function fmtPreco(v) {
  if (v == null || v === '') return '—'
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}

export default function VitrineParceirasAdmin() {
  const [aba, setAba] = useState('livros')
  const [livros, setLivros] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [influencers, setInfluencers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [l, p, i] = await Promise.all([
      supabase.from('vp_livros').select('*').order('created_at', { ascending: false }),
      supabase.from('vp_pedidos').select('*, vp_pedido_itens(*)').order('created_at', { ascending: false }),
      supabase.from('vp_influencers').select('id, nome, email, ativo').order('nome'),
    ])
    if (l.error || p.error) mostrarToast('Erro ao carregar dados: ' + (l.error || p.error).message, 'erro')
    setLivros(l.data || [])
    setPedidos(p.data || [])
    setInfluencers(i.data || [])
    setLoading(false)
  }

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4500)
  }

  const pedidosNovos = pedidos.filter(p => p.status === 'novo').length
  const livrosAtivos = livros.filter(l => l.ativo).length
  const livrosComEstoque = livros.filter(l => l.ativo && Number(l.estoque_disponivel) > 0).length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Store size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Vitrine Editoras Parceiras</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Livros que os influencers da área escolhem para divulgar · página pública:{' '}
              <a href="/vitrine-parceiras" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>/vitrine-parceiras</a>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Kpi valor={livrosAtivos} label="Livros ativos" />
          <Kpi valor={livrosComEstoque} label="Visíveis (com estoque)" />
          <Kpi valor={pedidosNovos} label="Pedidos novos" destaque={pedidosNovos > 0} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        {[
          { k: 'livros', l: 'Livros', icon: BookOpen },
          { k: 'pedidos', l: 'Pedidos', icon: ClipboardList, badge: pedidosNovos },
          { k: 'selecoes', l: 'Seleções', icon: Link2 },
        ].map(t => (
          <button key={t.k} onClick={() => setAba(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: aba === t.k ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${aba === t.k ? 'var(--accent)' : 'transparent'}`, marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <t.icon size={15} /> {t.l}
            {t.badge > 0 && <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '0 7px', fontSize: 11 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {aba === 'livros' && <AbaLivros livros={livros} setLivros={setLivros} recarregar={carregar} toast={mostrarToast} />}
          {aba === 'pedidos' && <AbaPedidos pedidos={pedidos} setPedidos={setPedidos} toast={mostrarToast} />}
          {aba === 'selecoes' && <AbaSelecoes livros={livros} influencers={influencers} toast={mostrarToast} />}
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 460,
          background: toast.tipo === 'erro' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function Kpi({ valor, label, destaque }) {
  return (
    <div className="table-card" style={{ padding: '8px 14px', textAlign: 'center', minWidth: 90, borderColor: destaque ? 'var(--accent)' : undefined }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: destaque ? 'var(--accent)' : 'var(--text)' }}>{valor}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ABA LIVROS
// ════════════════════════════════════════════════════════════════
function AbaLivros({ livros, setLivros, recarregar, toast }) {
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(null) // null | 'novo' | livro
  const [importando, setImportando] = useState(false)
  const [atualizandoEstoque, setAtualizandoEstoque] = useState(false)
  const [msg, setMsg] = useState(null)
  const refPlanilha = useRef(null)
  const refEstoque = useRef(null)

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return livros
    return livros.filter(l =>
      (l.titulo || '').toLowerCase().includes(t) || (l.autor || '').toLowerCase().includes(t) ||
      (l.editora || '').toLowerCase().includes(t) || (l.ean || '').includes(t))
  }, [livros, busca])

  async function alternar(livro, campo) {
    const { error } = await supabase.from('vp_livros').update({ [campo]: !livro[campo] }).eq('id', livro.id)
    if (error) { toast('Erro: ' + error.message, 'erro'); return }
    setLivros(prev => prev.map(l => l.id === livro.id ? { ...l, [campo]: !l[campo] } : l))
  }

  async function excluir(livro) {
    if (!window.confirm(`Excluir "${livro.titulo}" da vitrine?\n\nPedidos e cortesias antigos com este livro continuam no histórico.`)) return
    const { error } = await supabase.from('vp_livros').delete().eq('id', livro.id)
    if (error) { toast('Erro: ' + error.message, 'erro'); return }
    setLivros(prev => prev.filter(l => l.id !== livro.id))
  }

  async function salvarLivro(dados, id) {
    if (id) {
      const { data, error } = await supabase.from('vp_livros').update(dados).eq('id', id).select().single()
      if (error) throw error
      setLivros(prev => prev.map(l => l.id === id ? data : l))
    } else {
      const { data, error } = await supabase.from('vp_livros').insert(dados).select().single()
      if (error) throw error
      setLivros(prev => [data, ...prev])
    }
    toast('Livro salvo!')
  }

  // ── Importar planilha de produtos (mesmo modelo da planilha CEDET) ──
  // EAN já cadastrado → atualiza os dados do livro (mantém ativo e destaque).
  // EAN novo → cadastra o livro.
  // Se a planilha tiver a coluna "Estoque", o estoque também é gravado.
  async function importarPlanilha(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setMsg(null)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      let rows = XLSX.utils.sheet_to_json(ws)
      if (rows.length > 0 && !rows[0]['Nome produto']) rows = XLSX.utils.sheet_to_json(ws, { range: 1 })

      const agoraImport = new Date().toISOString()
      const lidos = rows.filter(r => r['Nome produto']).map(r => {
        const qtdBruta = r['Estoque'] ?? r['estoque'] ?? r['ESTOQUE']
        const temEstoque = qtdBruta !== undefined && qtdBruta !== null && String(qtdBruta).trim() !== ''
        return {
        titulo: String(r['Nome produto']).trim(),
        autor: r['Autor(es)'] || null,
        editora: r['Fabricante'] || null,
        preco: r['Preço de capa'] !== undefined && r['Preço de capa'] !== '' ? Number(r['Preço de capa']) || null : null,
        descricao: r['Descrição'] || null,
        imagem_url: r['Link Imagem'] || null,
        ean: r['EAN'] ? String(r['EAN']).replace(/\D/g, '') : null,
        encadernacao: r['Encadernação'] || null,
        data_lancamento: r['Data de lançamento'] instanceof Date
          ? r['Data de lançamento'].toISOString().slice(0, 10)
          : (r['Data de lançamento'] || null),
        ...(temEstoque ? {
          estoque_disponivel: Math.max(0, Math.floor(Number(String(qtdBruta).replace(',', '.')) || 0)),
          estoque_atualizado_em: agoraImport,
        } : {}),
      }})
      if (lidos.length === 0) throw new Error('Nenhum livro encontrado. A planilha precisa da coluna "Nome produto".')

      const existentesPorEan = new Map(livros.filter(l => l.ean).map(l => [String(l.ean), l]))
      const novos = []
      const atualizar = []
      for (const l of lidos) {
        const existente = l.ean ? existentesPorEan.get(l.ean) : null
        if (existente) atualizar.push({ id: existente.id, dados: l })
        else novos.push({ ...l, ativo: true, destaque: false })
      }

      for (let i = 0; i < novos.length; i += 100) {
        const { error } = await supabase.from('vp_livros').insert(novos.slice(i, i + 100))
        if (error) throw error
      }
      for (let i = 0; i < atualizar.length; i += 40) {
        const res = await Promise.all(atualizar.slice(i, i + 40).map(a => supabase.from('vp_livros').update(a.dados).eq('id', a.id)))
        const falha = res.find(r => r.error)
        if (falha) throw falha.error
      }

      const comEstoque = lidos.filter(l => l.estoque_disponivel !== undefined).length
      setMsg({ tipo: 'ok', texto: `${novos.length} livro(s) novo(s) cadastrado(s) e ${atualizar.length} atualizado(s).` + (comEstoque ? ` Estoque gravado para ${comEstoque} livro(s).` : ' A planilha não tinha a coluna "Estoque": livros sem estoque não aparecem para os influencers.') })
      await recarregar()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: 'Erro na importação: ' + err.message })
    } finally {
      setImportando(false)
      if (refPlanilha.current) refPlanilha.current.value = ''
    }
  }

  // ── Atualizar estoque por planilha (colunas EAN/ISBN + Quantidade/Estoque) ──
  // A planilha é tratada como retrato completo: livro ausente fica com estoque 0.
  async function atualizarEstoque(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAtualizandoEstoque(true)
    setMsg(null)
    const so_digitos = v => String(v ?? '').replace(/\D/g, '')
    const coluna = (row, nomes) => {
      const k = Object.keys(row || {}).find(k => nomes.includes(String(k).trim().toLowerCase()))
      return k ? row[k] : undefined
    }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      let rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const nomesEan = ['ean', 'isbn', 'isbn/ean', 'ean/isbn']
      if (rows.length > 0 && !Object.keys(rows[0]).some(k => nomesEan.includes(k.trim().toLowerCase()))) {
        rows = XLSX.utils.sheet_to_json(ws, { range: 1, defval: '' })
      }
      const estoque = new Map()
      for (const r of rows) {
        const ean = so_digitos(coluna(r, nomesEan))
        const qtd = coluna(r, ['quantidade', 'qtd', 'estoque', 'quantidade disponível', 'quantidade disponivel', 'saldo'])
        if (!ean || qtd === undefined || qtd === '') continue
        estoque.set(ean, Math.max(0, Math.floor(Number(String(qtd).replace(',', '.')) || 0)))
      }
      if (estoque.size === 0) throw new Error('A planilha precisa ter uma coluna EAN/ISBN e uma coluna Quantidade/Estoque.')

      const agora = new Date().toISOString()
      const alvos = livros.filter(l => l.ean).map(l => ({ id: l.id, qtd: estoque.get(so_digitos(l.ean)) ?? 0 }))
      for (let i = 0; i < alvos.length; i += 40) {
        const res = await Promise.all(alvos.slice(i, i + 40).map(a =>
          supabase.from('vp_livros').update({ estoque_disponivel: a.qtd, estoque_atualizado_em: agora }).eq('id', a.id)))
        const falha = res.find(r => r.error)
        if (falha) throw falha.error
      }
      const encontrados = alvos.filter(a => a.qtd > 0).length
      const eansVitrine = new Set(livros.filter(l => l.ean).map(l => so_digitos(l.ean)))
      const foraDaVitrine = [...estoque.keys()].filter(e => !eansVitrine.has(e)).length
      setMsg({ tipo: 'ok', texto: `Estoque atualizado: ${encontrados} livro(s) com estoque. Os demais ficaram com 0.${foraDaVitrine ? ` ${foraDaVitrine} ISBN(s) da planilha não estão na vitrine.` : ''}` })
      await recarregar()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: 'Erro ao atualizar estoque: ' + err.message })
    } finally {
      setAtualizandoEstoque(false)
      if (refEstoque.current) refEstoque.current.value = ''
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título, autor, editora ou ISBN..." style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <button className="btn btn-primary" onClick={() => setForm('novo')}><Plus size={14} /> Adicionar livro</button>
        <label className="btn btn-ghost" style={{ cursor: importando ? 'wait' : 'pointer' }} title="Planilha de produtos: Nome produto, Autor(es), Fabricante, Preço de capa, EAN, Estoque...">
          <input ref={refPlanilha} type="file" accept=".xlsx,.xls" onChange={importarPlanilha} disabled={importando} style={{ display: 'none' }} />
          {importando ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Importar planilha
        </label>
        <label className="btn btn-ghost" style={{ cursor: atualizandoEstoque ? 'wait' : 'pointer' }} title="Planilha com colunas EAN/ISBN e Quantidade/Estoque">
          <input ref={refEstoque} type="file" accept=".xlsx,.xls" onChange={atualizarEstoque} disabled={atualizandoEstoque} style={{ display: 'none' }} />
          {atualizandoEstoque ? <Loader2 size={14} className="spin" /> : <Package size={14} />} Atualizar estoque
        </label>
      </div>

      {msg && <Mensagem msg={msg} onFechar={() => setMsg(null)} />}

      {filtrados.length === 0 ? (
        <Vazio icon={BookOpen} texto={livros.length === 0 ? 'Nenhum livro na vitrine ainda. Importe a planilha ou adicione manualmente.' : 'Nenhum livro encontrado.'} />
      ) : (
        <div className="table-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={th}>Capa</th>
                <th style={th}>Título / Autor</th>
                <th style={th}>Editora</th>
                <th style={th}>ISBN</th>
                <th style={thC}>Preço</th>
                <th style={thC}>Estoque</th>
                <th style={thC}>Status</th>
                <th style={thC}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', opacity: l.ativo ? 1 : 0.5 }}>
                  <td style={{ ...td, width: 50 }}>
                    {l.imagem_url
                      ? <img src={l.imagem_url} alt="" style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                      : <div style={{ width: 36, height: 48, borderRadius: 4, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}><BookOpen size={13} /></div>}
                  </td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {l.destaque && <Star size={12} fill="#f2b705" color="#f2b705" />} {l.titulo}
                    </div>
                    <div style={{ fontSize: 11 }}>{l.autor || '—'}</div>
                  </td>
                  <td style={td}>{l.editora || '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{l.ean || '—'}</td>
                  <td style={tdC}>{fmtPreco(l.preco)}</td>
                  <td style={{ ...tdC, fontWeight: 700, color: Number(l.estoque_disponivel) > 0 ? 'var(--green)' : 'var(--red)' }}
                    title={l.estoque_atualizado_em ? `Atualizado em ${new Date(l.estoque_atualizado_em).toLocaleString('pt-BR')}` : 'Estoque ainda não importado'}>
                    {Number(l.estoque_disponivel || 0)}
                  </td>
                  <td style={tdC}>{l.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td style={{ ...tdC, whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" title={l.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternar(l, 'ativo')}>{l.ativo ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button className="btn btn-ghost btn-sm" title={l.destaque ? 'Tirar destaque' : 'Destacar'} onClick={() => alternar(l, 'destaque')}>{l.destaque ? <StarOff size={13} /> : <Star size={13} />}</button>
                    <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setForm(l)}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-sm" title="Excluir" onClick={() => excluir(l)} style={{ color: 'var(--red)' }}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <ModalLivro livro={form === 'novo' ? null : form} onSalvar={salvarLivro} onFechar={() => setForm(null)} />}
    </>
  )
}

function ModalLivro({ livro, onSalvar, onFechar }) {
  const [f, setF] = useState({
    titulo: livro?.titulo || '', autor: livro?.autor || '', editora: livro?.editora || '',
    preco: livro?.preco ?? '', ean: livro?.ean || '', encadernacao: livro?.encadernacao || '',
    categoria: livro?.categoria || '', data_lancamento: livro?.data_lancamento || '',
    imagem_url: livro?.imagem_url || '', descricao: livro?.descricao || '',
    estoque_disponivel: livro?.estoque_disponivel ?? 0,
    ativo: livro?.ativo ?? true, destaque: livro?.destaque ?? false,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!f.titulo.trim()) { setErro('O título é obrigatório.'); return }
    setSalvando(true)
    try {
      await onSalvar({
        titulo: f.titulo.trim(),
        autor: f.autor.trim() || null,
        editora: f.editora.trim() || null,
        preco: f.preco === '' ? null : Number(f.preco),
        ean: f.ean ? String(f.ean).replace(/\D/g, '') : null,
        encadernacao: f.encadernacao.trim() || null,
        categoria: f.categoria.trim() || null,
        data_lancamento: f.data_lancamento || null,
        imagem_url: f.imagem_url.trim() || null,
        descricao: f.descricao.trim() || null,
        estoque_disponivel: Math.max(0, Math.floor(Number(f.estoque_disponivel) || 0)),
        ativo: f.ativo,
        destaque: f.destaque,
      }, livro?.id)
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  const campo = (label, chave, props = {}) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" value={f[chave]} onChange={e => setF({ ...f, [chave]: e.target.value })} {...props} />
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{livro ? 'Editar livro' : 'Adicionar livro'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
        </div>
        <div className="form-grid">
          {campo('Título *', 'titulo')}
          {campo('Autor(es)', 'autor')}
          <div className="form-row">{campo('Editora', 'editora')}{campo('Preço de capa (R$)', 'preco', { type: 'number', step: '0.01' })}</div>
          <div className="form-row">{campo('ISBN / EAN', 'ean')}{campo('Encadernação', 'encadernacao')}</div>
          <div className="form-row">{campo('Categoria', 'categoria')}{campo('Data de lançamento', 'data_lancamento', { type: 'date' })}</div>
          <div className="form-row">{campo('URL da imagem', 'imagem_url')}{campo('Estoque disponível', 'estoque_disponivel', { type: 'number', min: 0 })}</div>
          <div className="form-group">
            <label className="form-label">Descrição / sinopse</label>
            <textarea className="form-textarea" rows={4} value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} /> Ativo na vitrine
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.destaque} onChange={e => setF({ ...f, destaque: e.target.checked })} /> Destaque
            </label>
          </div>
          {erro && <Aviso texto={erro} />}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}><Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ABA PEDIDOS
// ════════════════════════════════════════════════════════════════
function AbaPedidos({ pedidos, setPedidos, toast }) {
  const [sub, setSub] = useState('andamento')
  const [busca, setBusca] = useState('')

  const finalizados = s => s === 'concluido' || s === 'cancelado'
  const andamento = pedidos.filter(p => !finalizados(p.status))
  const encerrados = pedidos.filter(p => finalizados(p.status))
  const base = sub === 'andamento' ? andamento : encerrados
  const lista = base.filter(p => !busca.trim() || (p.nome_influencer || '').toLowerCase().includes(busca.trim().toLowerCase()))

  async function mudarStatus(pedido, novo) {
    if (novo === pedido.status) return
    if (novo === 'concluido' && !window.confirm(`Concluir o pedido #${pedido.id}?\n\nUma cortesia será criada automaticamente no menu "Cortesias" com os livros deste pedido.`)) return
    const { error } = await supabase.from('vp_pedidos').update({ status: novo }).eq('id', pedido.id)
    if (error) { toast('Erro ao mudar o status: ' + error.message, 'erro'); return }
    setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, status: novo } : p))
    if (novo === 'concluido') toast(`Pedido #${pedido.id} concluído. A cortesia já está no menu "Cortesias".`)
  }

  if (pedidos.length === 0) {
    return <Vazio icon={ClipboardList} texto="Nenhum pedido ainda. Quando os influencers escolherem livros na vitrine, os pedidos aparecem aqui." />
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ k: 'andamento', l: `Em andamento (${andamento.length})` }, { k: 'encerrados', l: `Concluídos / cancelados (${encerrados.length})` }].map(s => (
          <button key={s.k} onClick={() => setSub(s.k)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${sub === s.k ? 'var(--accent)' : 'var(--border)'}`,
            background: sub === s.k ? 'var(--surface-2)' : 'transparent',
            color: sub === s.k ? 'var(--accent)' : 'var(--text-muted)',
          }}>{s.l}</button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar influencer..." style={{ paddingLeft: 30, width: '100%' }} />
        </div>
      </div>

      {lista.length === 0 ? <Vazio icon={ClipboardList} texto="Nenhum pedido nesta lista." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(p => {
            const st = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.novo
            const itens = p.vp_pedido_itens || []
            return (
              <div key={p.id} className="table-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${st.cor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15, color: 'var(--text)' }}>{p.nome_influencer || 'Influencer'}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pedido #{p.id} · {new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {p.selecao_id && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px' }}>SELEÇÃO PERSONALIZADA</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {p.email && <span>✉️ {p.email}</span>}
                      {p.contato && <span>📱 {p.contato}</span>}
                      {p.cpf && <span>CPF: {p.cpf}</span>}
                      {p.data_divulgacao && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>📅 Divulgação prevista: {fmtData(p.data_divulgacao)}</span>}
                    </div>
                    {(p.endereco || p.cep) && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📍 {p.endereco || ''}{p.cep ? ` — CEP ${p.cep}` : ''}</div>}
                    {p.observacoes && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 6 }}>"{p.observacoes}"</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {itens.map(it => (
                        <span key={it.id} style={{ fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '4px 9px', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <BookOpen size={11} /> {it.titulo_livro}{it.quantidade > 1 ? ` ×${it.quantidade}` : ''}
                          {it.ean_livro && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>· {it.ean_livro}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <select className="form-select" value={p.status} onChange={e => mudarStatus(p, e.target.value)}
                    style={{ width: 'auto', fontWeight: 700, color: st.cor, borderColor: st.cor }}>
                    {Object.entries(STATUS_PEDIDO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════
// ABA SELEÇÕES PERSONALIZADAS
// ════════════════════════════════════════════════════════════════
function AbaSelecoes({ livros, influencers, toast }) {
  const [selecoes, setSelecoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nova' | selecao
  const [copiado, setCopiado] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('vp_selecoes')
      .select('*, influencer:influencer_id(id, nome), vp_selecao_livros(livro_id)')
      .order('created_at', { ascending: false })
    if (error) toast('Erro ao carregar seleções: ' + error.message, 'erro')
    setSelecoes(data || [])
    setCarregando(false)
  }

  const link = s => `${window.location.origin}/vitrine-parceiras/selecao/${s.token}`
  const tituloLivro = id => livros.find(l => String(l.id) === String(id))?.titulo || `Livro #${id}`

  async function copiar(s) {
    try {
      await navigator.clipboard.writeText(link(s))
      setCopiado(s.id)
      setTimeout(() => setCopiado(null), 1800)
    } catch {
      window.prompt('Copie o link:', link(s))
    }
  }

  async function encerrar(s) {
    if (!window.confirm('Encerrar este link? O influencer não poderá mais responder.')) return
    const { error } = await supabase.from('vp_selecoes').update({ status: 'encerrada' }).eq('id', s.id)
    if (error) { toast('Erro: ' + error.message, 'erro'); return }
    carregar()
  }

  async function salvar({ influencer_id, nome, quantidade_titulos, expira_em, livrosIds }, selecao) {
    let sel
    if (selecao) {
      const { data, error } = await supabase.from('vp_selecoes')
        .update({ influencer_id, nome, quantidade_titulos, expira_em })
        .eq('id', selecao.id).eq('status', 'aberta').select().single()
      if (error) throw error
      sel = data
      const { error: errDel } = await supabase.from('vp_selecao_livros').delete().eq('selecao_id', sel.id)
      if (errDel) throw errDel
    } else {
      const { data, error } = await supabase.from('vp_selecoes')
        .insert({ influencer_id, nome, quantidade_titulos, expira_em, status: 'aberta' }).select().single()
      if (error) throw error
      sel = data
    }
    const { error: errItens } = await supabase.from('vp_selecao_livros').insert(livrosIds.map(livro_id => ({ selecao_id: sel.id, livro_id })))
    if (errItens) throw errItens
    toast(selecao ? 'Seleção atualizada!' : 'Seleção criada! Copie o link e envie ao influencer.')
    await carregar()
  }

  if (carregando) return <div className="loading"><div className="spinner" /></div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Monte uma curadoria exclusiva e defina quantos títulos o influencer deve escolher. Respostas de seleções não contam no limite mensal.
        </p>
        <button className="btn btn-primary" onClick={() => setModal('nova')}><Plus size={14} /> Nova seleção</button>
      </div>

      {selecoes.length === 0 ? <Vazio icon={Link2} texto="Nenhuma seleção criada ainda." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selecoes.map(s => {
            const st = STATUS_SELECAO[s.status] || STATUS_SELECAO.encerrada
            return (
              <div key={s.id} className="table-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text)' }}>{s.nome}</strong>
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.cor, border: `1px solid ${st.cor}`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><UserRound size={12} /> {s.influencer?.nome || '—'}</span>
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><BookOpen size={12} /> escolhe {s.quantidade_titulos} de {s.vp_selecao_livros?.length || 0}</span>
                      {s.expira_em && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><CalendarDays size={12} /> até {new Date(s.expira_em).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {s.status === 'respondida' && (s.resposta_livros || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {s.resposta_livros.map(id => <span key={id} style={{ fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '3px 8px', color: 'var(--text)' }}>✓ {tituloLivro(id)}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => copiar(s)}>{copiado === s.id ? <Check size={13} /> : <Copy size={13} />} {copiado === s.id ? 'Copiado' : 'Copiar link'}</button>
                    <a className="btn btn-ghost btn-sm" href={link(s)} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
                    {s.status === 'aberta' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}><Edit2 size={13} /> Editar</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => encerrar(s)}><Lock size={13} /> Encerrar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ModalSelecao
          selecao={modal === 'nova' ? null : modal}
          livros={livros.filter(l => l.ativo && Number(l.estoque_disponivel) > 0)}
          influencers={influencers.filter(i => i.ativo)}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
        />
      )}
    </>
  )
}

function ModalSelecao({ selecao, livros, influencers, onSalvar, onFechar }) {
  const [influencerId, setInfluencerId] = useState(selecao ? String(selecao.influencer_id) : '')
  const [nome, setNome] = useState(selecao?.nome || '')
  const [quantidade, setQuantidade] = useState(selecao?.quantidade_titulos || 3)
  const [expira, setExpira] = useState(selecao?.expira_em ? String(selecao.expira_em).slice(0, 10) : '')
  const [marcados, setMarcados] = useState((selecao?.vp_selecao_livros || []).map(x => x.livro_id))
  const [busca, setBusca] = useState('')
  const [editora, setEditora] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const editoras = useMemo(() => [...new Set(livros.map(l => l.editora).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [livros])
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return livros.filter(l =>
      (!editora || l.editora === editora) &&
      (!t || (l.titulo || '').toLowerCase().includes(t) || (l.autor || '').toLowerCase().includes(t) || (l.editora || '').toLowerCase().includes(t)))
  }, [livros, busca, editora])

  function alternar(id) {
    setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function salvar() {
    const qtd = Number(quantidade)
    if (!influencerId || !nome.trim()) { setErro('Selecione o influencer e dê um nome à ação.'); return }
    if (!Number.isInteger(qtd) || qtd < 1) { setErro('Informe uma quantidade válida de títulos.'); return }
    if (marcados.length < qtd) { setErro(`A curadoria precisa ter pelo menos ${qtd} livro(s).`); return }
    setErro('')
    setSalvando(true)
    try {
      await onSalvar({
        influencer_id: Number(influencerId),
        nome: nome.trim(),
        quantidade_titulos: qtd,
        expira_em: expira ? new Date(expira + 'T23:59:59').toISOString() : null,
        livrosIds: marcados,
      }, selecao)
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{selecao ? 'Editar seleção' : 'Nova seleção personalizada'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Influencer *</label>
              <select className="form-select" value={influencerId} onChange={e => setInfluencerId(e.target.value)}>
                <option value="">Selecione...</option>
                {influencers.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nome da ação *</label>
              <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Lançamentos de novembro" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Títulos a escolher</label>
              <input className="form-input" type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Validade do link (opcional)</label>
              <input className="form-input" type="date" value={expira} onChange={e => setExpira(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Livros da curadoria · {marcados.length} marcado(s)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar título, autor ou editora..." style={{ flex: 1, minWidth: 200 }} />
              <select className="form-select" value={editora} onChange={e => setEditora(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Todas as editoras</option>
                {editoras.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {visiveis.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Nenhum livro com estoque encontrado.</div>}
              {visiveis.map(l => {
                const ok = marcados.includes(l.id)
                return (
                  <button key={l.id} type="button" onClick={() => alternar(l.id)} style={{
                    width: '100%', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '8px 12px',
                    border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: ok ? 'var(--surface-2)' : 'transparent', color: 'var(--text)',
                  }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${ok ? 'var(--accent)' : 'var(--border)'}`, background: ok ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                      {ok && <Check size={11} color="white" />}
                    </span>
                    <span>
                      <span style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{l.titulo}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{[l.autor, l.editora].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Só aparecem livros ativos e com estoque.</div>
          </div>
          {erro && <Aviso texto={erro} />}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />} {selecao ? 'Salvar alterações' : 'Criar e gerar link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────────
function Vazio({ icon: Icone, texto }) {
  return (
    <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <Icone size={34} style={{ opacity: 0.3, marginBottom: 10 }} />
      <p style={{ margin: 0, fontSize: 14 }}>{texto}</p>
    </div>
  )
}

function Mensagem({ msg, onFechar }) {
  const erro = msg.tipo === 'erro'
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
      background: erro ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
      border: `1px solid ${erro ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
      color: erro ? 'var(--red)' : 'var(--green)',
    }}>
      {erro ? <AlertCircle size={15} /> : <Check size={15} />} <span style={{ flex: 1 }}>{msg.texto}</span>
      <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}><X size={14} /></button>
    </div>
  )
}

function Aviso({ texto }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)' }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} /> {texto}
    </div>
  )
}

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.4 }
const thC = { ...th, textAlign: 'center' }
const td = { padding: '8px 12px', color: 'var(--text-muted)', verticalAlign: 'middle' }
const tdC = { ...td, textAlign: 'center' }
