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

  // ── Importar planilha de produtos (mesmo
