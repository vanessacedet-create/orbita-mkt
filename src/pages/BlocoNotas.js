import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, FileText, Plus, Trash2, Check, RotateCcw, ArrowLeft } from 'lucide-react'

async function getNotas(usuarioId) {
  const { data, error } = await supabase
    .from('bloco_notas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .is('excluido_em', null)
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

// Exclusão "suave": a nota vai para a Lixeira e pode ser restaurada
async function deletarNota(id) {
  const { error } = await supabase.from('bloco_notas').update({ excluido_em: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function getLixeira(usuarioId) {
  const { data, error } = await supabase
    .from('bloco_notas').select('*')
    .eq('usuario_id', usuarioId)
    .not('excluido_em', 'is', null)
    .order('excluido_em', { ascending: false })
  if (error) throw error
  return data || []
}

// Exclusão definitiva (a versão final ainda fica guardada no histórico do banco)
async function excluirDefinitivoDb(ids) {
  const { error } = await supabase.from('bloco_notas').delete().in('id', ids)
  if (error) throw error
}

async function restaurarNotaDb(id) {
  const { data, error } = await supabase.from('bloco_notas').update({ excluido_em: null }).eq('id', id).select().single()
  if (error) throw error
  return data
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
  const notaAtualRef = useRef(null) // nota realmente aberta no editor (evita salvar texto na nota errada)
  const [verLixeira, setVerLixeira] = useState(false)
  const [lixeira, setLixeira] = useState([])

  useEffect(() => {
    if (!usuario?.id) return
    carregarNotas()
  }, [usuario?.id])

  // Faz o container pai ocupar toda a altura sem scroll externo
  useLayoutEffect(() => {
    // Ajusta o container pai para que position:absolute do BlocoNotas funcione
    const mainContent = document.querySelector('.main-content')
    const mainScroll = document.querySelector('.main-content > div')
    if (mainContent) mainContent.style.position = 'relative'
    if (mainScroll) {
      const prevOverflow = mainScroll.style.overflow
      const prevHeight = mainScroll.style.height
      mainScroll.style.overflow = 'hidden'
      mainScroll.style.height = '100%'
      return () => {
        if (mainContent) mainContent.style.position = ''
        mainScroll.style.overflow = prevOverflow
        mainScroll.style.height = prevHeight
      }
    }
    return () => {
      if (mainContent) mainContent.style.position = ''
    }
  }, [])

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
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    if (isDirty.current) salvarAtual()
    notaAtualRef.current = nota
    setNotaSelecionada(nota)
    setTitulo(nota.titulo || '')
    setConteudo(nota.conteudo || '')
    isDirty.current = false
    setSalvo(false)
  }

  function novaNota() {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    if (isDirty.current) salvarAtual()
    const nova = { id: null, titulo: 'Nova nota', conteudo: '', usuario_id: usuario.id }
    notaAtualRef.current = nova
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
    const notaOrigem = notaAtualRef.current
    if (!notaOrigem || !isDirty.current) return
    isDirty.current = false
    setSalvando(true)
    try {
      const tituloAtual = document.getElementById('nota-titulo')?.value ?? titulo
      const conteudoAtual = document.getElementById('nota-conteudo')?.value ?? conteudo
      const payload = { id: notaOrigem.id, usuario_id: usuario.id, titulo: tituloAtual.trim() || 'Sem título', conteudo: conteudoAtual }
      const salva = await salvarNota(payload)
      // Só atualiza o editor se o usuário ainda estiver na mesma nota
      if (notaAtualRef.current === notaOrigem) {
        notaAtualRef.current = salva
        setNotaSelecionada(salva)
      }
      setNotas(prev => {
        const existe = prev.find(n => n.id === salva.id)
        if (existe) return prev.map(n => n.id === salva.id ? salva : n)
        return [salva, ...prev]
      })
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } catch (e) { console.error(e); isDirty.current = true; alert('Não foi possível salvar. Copie seu texto antes de sair da página.') }
    finally { setSalvando(false) }
  }

  async function abrirLixeira() {
    try { setLixeira(await getLixeira(usuario.id)); setVerLixeira(true) } catch (e) { console.error(e) }
  }

  async function restaurarNota(nota) {
    try {
      const r = await restaurarNotaDb(nota.id)
      setLixeira(prev => prev.filter(n => n.id !== nota.id))
      setNotas(prev => [r, ...prev])
    } catch (e) { console.error(e) }
  }

  async function excluirDefinitivo(nota) {
    if (!window.confirm(`Excluir "${nota.titulo || 'Sem título'}" definitivamente? Ela não aparecerá mais na Lixeira.`)) return
    try {
      await excluirDefinitivoDb([nota.id])
      setLixeira(prev => prev.filter(n => n.id !== nota.id))
    } catch (e) { console.error(e); alert('Não foi possível excluir.') }
  }

  async function esvaziarLixeira() {
    if (lixeira.length === 0) return
    if (!window.confirm(`Excluir definitivamente as ${lixeira.length} nota(s) da Lixeira?`)) return
    try {
      await excluirDefinitivoDb(lixeira.map(n => n.id))
      setLixeira([])
    } catch (e) { console.error(e); alert('Não foi possível esvaziar a Lixeira.') }
  }

  async function excluirNota(nota, e) {
    e.stopPropagation()
    if (!nota.id) return
    if (!window.confirm(`Mover "${nota.titulo || 'Sem título'}" para a Lixeira?`)) return
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
    <div style={{ display:'flex', position:'absolute', inset:0, overflow:'hidden', background:'var(--bg)' }}>

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
          {verLixeira ? (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 4px' }}>
                <button onClick={() => setVerLixeira(false)} className="btn btn-ghost btn-sm"><ArrowLeft size={12}/> Voltar</button>
                {lixeira.length > 0 && (
                  <button onClick={esvaziarLixeira} className="btn btn-ghost btn-sm" style={{ color:'var(--red, #c0392b)' }}><Trash2 size={12}/> Esvaziar</button>
                )}
              </div>
              {lixeira.length === 0 ? (
                <div style={{ padding:20, color:'var(--text-muted)', fontSize:13, textAlign:'center' }}>Lixeira vazia.</div>
              ) : lixeira.map(nota => (
                <div key={nota.id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nota.titulo || 'Sem título'}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>Excluída em {formatarData(nota.excluido_em)}</div>
                  </div>
                  <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    <button onClick={() => restaurarNota(nota)} className="btn btn-ghost btn-icon btn-sm" title="Restaurar"><RotateCcw size={13}/></button>
                    <button onClick={() => excluirDefinitivo(nota)} className="btn btn-ghost btn-icon btn-sm" title="Excluir definitivamente" style={{ color:'var(--red, #c0392b)' }}><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
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
        {!verLixeira && (
          <button onClick={abrirLixeira} className="btn btn-ghost btn-sm" style={{ margin:10, justifyContent:'center' }}><Trash2 size={12}/> Lixeira</button>
        )}
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
