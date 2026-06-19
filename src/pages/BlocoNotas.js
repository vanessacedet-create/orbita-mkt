import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, FileText, Plus, Trash2, Check } from 'lucide-react'

async function getNotas(usuarioId) {
  const { data, error } = await supabase
    .from('bloco_notas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('atualizado_em', { ascending: false })
  if (error) throw error
  return data || []
}

async function salvarNota(nota) {
  if (nota.id) {
    const { data, error } = await supabase
      .from('bloco_notas')
      .update({ titulo: nota.titulo, conteudo: nota.conteudo, atualizado_em: new Date().toISOString() })
      .eq('id', nota.id).select().single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('bloco_notas')
      .insert([{ usuario_id: nota.usuario_id, titulo: nota.titulo, conteudo: nota.conteudo }])
      .select().single()
    if (error) throw error
    return data
  }
}

async function deletarNota(id) {
  const { error } = await supabase.from('bloco_notas').delete().eq('id', id)
  if (error) throw error
}

export default function BlocoNotas() {
  const { usuario } = useAuth()
  const [notas, setNotas] = useState([])
  const [notaSelecionada, setNotaSelecionada] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [loading, setLoading] = useState(true)
  const autoSaveRef = useRef(null)
  const isDirty = useRef(false)

  useEffect(() => {
    if (!usuario?.id) return
    carregarNotas()
  }, [usuario?.id])

  async function carregarNotas() {
    setLoading(true)
    try {
      const data = await getNotas(usuario.id)
      setNotas(data)
      if (data.length > 0) selecionarNota(data[0])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function selecionarNota(nota) {
    if (isDirty.current) salvarAtual()
    setNotaSelecionada(nota)
    setTitulo(nota.titulo || '')
    setConteudo(nota.conteudo || '')
    isDirty.current = false
    setSalvo(false)
  }

  function novaNota() {
    if (isDirty.current) salvarAtual()
    const nova = { id: null, titulo: 'Nova nota', conteudo: '', usuario_id: usuario.id }
    setNotaSelecionada(nova)
    setTitulo('Nova nota')
    setConteudo('')
    isDirty.current = false
    setSalvo(false)
  }

  function handleChange(campo, valor) {
    if (campo === 'titulo') setTitulo(valor)
    else setConteudo(valor)
    isDirty.current = true
    setSalvo(false)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => salvarAtual(), 2000)
  }

  async function salvarAtual() {
    if (!notaSelecionada || !isDirty.current) return
    setSalvando(true)
    try {
      const tituloAtual = document.getElementById('nota-titulo')?.value || titulo
      const conteudoAtual = document.getElementById('nota-conteudo')?.value || conteudo
      const payload = { id: notaSelecionada.id, usuario_id: usuario.id, titulo: tituloAtual.trim() || 'Sem título', conteudo: conteudoAtual }
      const salva = await salvarNota(payload)
      setNotaSelecionada(salva)
      setNotas(prev => {
        const existe = prev.find(n => n.id === salva.id)
        if (existe) return prev.map(n => n.id === salva.id ? salva : n)
        return [salva, ...prev]
      })
      isDirty.current = false
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } catch (e) { console.error(e) }
    finally { setSalvando(false) }
  }

  async function excluirNota(nota, e) {
    e.stopPropagation()
    if (!nota.id) return
    if (!window.confirm('Excluir esta nota?')) return
    try {
      await deletarNota(nota.id)
      const restantes = notas.filter(n => n.id !== nota.id)
      setNotas(restantes)
      if (notaSelecionada?.id === nota.id) {
        if (restantes.length > 0) selecionarNota(restantes[0])
        else { setNotaSelecionada(null); setTitulo(''); setConteudo('') }
      }
    } catch (e) { console.error(e) }
  }

  function formatarData(str) {
    if (!str) return ''
    const d = new Date(str)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display:'flex', height:'calc(100vh - 64px)', overflow:'hidden', background:'var(--bg)', margin:'-24px', marginTop:'-24px' }}>

      {/* Lista de notas */}
      <div style={{ width:260, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--surface)', flexShrink:0 }}>
        <div style={{ padding:'14px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <FileText size={15} color="var(--accent)" />
            <span style={{ fontFamily:'Syne, sans-serif', fontSize:13, fontWeight:700, color:'var(--text)' }}>Bloco de Notas</span>
          </div>
          <button onClick={novaNota} className="btn btn-ghost btn-icon btn-sm" title="Nova nota"><Plus size={14}/></button>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:20, color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>
          ) : notas.length === 0 ? (
            <div style={{ padding:20, color:'var(--text-muted)', fontSize:13, textAlign:'center' }}>
              <p>Nenhuma nota ainda.</p>
              <button onClick={novaNota} className="btn btn-primary btn-sm" style={{ marginTop:8 }}><Plus size={12}/> Criar nota</button>
            </div>
          ) : (
            notas.map(nota => (
              <div key={nota.id || 'nova'} onClick={() => selecionarNota(nota)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background: notaSelecionada?.id === nota.id ? 'var(--accent-glow)' : 'transparent', borderLeft: notaSelecionada?.id === nota.id ? '3px solid var(--accent)' : '3px solid transparent', transition:'all 0.15s', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: notaSelecionada?.id === nota.id ? 'var(--accent)' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {nota.titulo || 'Sem título'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {nota.conteudo?.slice(0, 50) || 'Nota vazia'}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                    {formatarData(nota.atualizado_em || nota.criado_em)}
                  </div>
                </div>
                <button onClick={e => excluirNota(nota, e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, opacity:0.3, flexShrink:0, transition:'opacity 0.15s' }} onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.3'}>
                  <Trash2 size={12}/>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg)', overflow:'hidden', minWidth:0 }}>
        {!notaSelecionada ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', flexDirection:'column', gap:12 }}>
            <FileText size={40} strokeWidth={1}/>
            <p style={{ fontSize:14 }}>Selecione uma nota ou crie uma nova</p>
            <button onClick={novaNota} className="btn btn-primary"><Plus size={14}/> Nova nota</button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface)', flexShrink:0 }}>
              <input
                id="nota-titulo"
                value={titulo}
                onChange={e => handleChange('titulo', e.target.value)}
                placeholder="Título da nota"
                style={{ border:'none', background:'transparent', fontSize:16, fontWeight:700, color:'var(--text)', outline:'none', flex:1, fontFamily:'Syne, sans-serif' }}
              />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {salvo && <span style={{ fontSize:11, color:'var(--green)', display:'flex', alignItems:'center', gap:4 }}><Check size={12}/> Salvo</span>}
                {salvando && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Salvando...</span>}
                <button onClick={salvarAtual} className="btn btn-primary btn-sm" disabled={salvando}><Save size={13}/> Salvar</button>
              </div>
            </div>

            {/* Área de texto */}
            <textarea
              id="nota-conteudo"
              value={conteudo}
              onChange={e => handleChange('conteudo', e.target.value)}
              placeholder="Escreva livremente aqui..."
              style={{ flex:1, border:'none', background:'transparent', padding:'24px 28px', fontSize:14, color:'var(--text)', outline:'none', resize:'none', fontFamily:'Mulish, sans-serif', lineHeight:1.8, overflowY:'auto' }}
            />
          </>
        )}
      </div>
    </div>
  )
}
