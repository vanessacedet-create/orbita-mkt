// src/components/crm/DesempenhoMensal.js
// Score de engajamento mensal dos parceiros (nota por publicações em campanhas)
// Extraído de Parceiros.js como componente independente

import { useEffect, useState, useMemo } from 'react'
import { getParceirosComPontuacao } from '../../lib/supabase'

function corNota(nota) {
  if (nota === undefined || nota === null) return { bg: 'transparent', cor: 'var(--text-muted)' }
  if (nota >= 8) return { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b' }
  if (nota >= 6) return { bg: 'rgba(148,163,184,0.15)', cor: '#94a3b8' }
  if (nota >= 4) return { bg: 'rgba(180,83,9,0.15)', cor: '#b45309' }
  if (nota > 0)  return { bg: 'rgba(239,68,68,0.12)', cor: '#ef4444' }
  return { bg: 'transparent', cor: 'var(--text-muted)' }
}

function nomeMes(mesAno) {
  const [ano, mes] = mesAno.split('-')
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${nomes[parseInt(mes)-1]}/${ano.slice(2)}`
}

function CirculoNota({ nota, size = 36 }) {
  const c = corNota(nota)
  if (nota === undefined || nota === null) {
    return <span style={{color:'var(--text-muted)',fontSize:12}}>—</span>
  }
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',justifyContent:'center',
      width:size,height:size,borderRadius:'50%',
      background:c.bg,color:c.cor,fontWeight:800,
      fontSize: size > 34 ? 13 : 12,
      border:`${size > 34 ? 2 : 1}px solid ${c.cor}40`,
    }}>
      {nota.toFixed(1)}
    </span>
  )
}

export default function DesempenhoMensal() {
  const [parceiros, setParceiros] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    getParceirosComPontuacao()
      .then(setParceiros)
      .catch(e => console.error('Erro ao carregar pontuação:', e))
      .finally(() => setLoading(false))
  }, [])

  const meses = useMemo(() => {
    const set = new Set()
    parceiros.forEach(p => {
      if (p.pontuacao?.notasMensais) {
        Object.keys(p.pontuacao.notasMensais).forEach(m => set.add(m))
      }
    })
    return [...set].sort()
  }, [parceiros])

  const comNota = useMemo(() => parceiros.filter(p =>
    p.pontuacao?.notasMensais && Object.keys(p.pontuacao.notasMensais).length > 0
  ), [parceiros])

  const filtered = comNota.filter(p => {
    if (!search) return true
    return p.nome.toLowerCase().includes(search.toLowerCase())
  })

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:13,color:'var(--text-muted)'}}>
            Score de engajamento — baseado em publicações de campanhas e lançamentos
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
            Publicou (10pts) · Agendado (6pts) · Confirmado (5pts) · Sem retorno (3pts) · Recusou (2pts)
          </div>
        </div>
        <input className="search-input" style={{width:220}} placeholder="Buscar parceiro..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {meses.length === 0
        ? <div className="empty-state"><p>Nenhuma nota mensal registrada ainda.</p></div>
        : <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth: 400 + meses.length*90}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',position:'sticky',left:0,background:'var(--surface)',zIndex:2,minWidth:200}}>
                    Parceiro
                  </th>
                  <th style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',minWidth:80}}>
                    Nota geral
                  </th>
                  {meses.map(m=>(
                    <th key={m} style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',minWidth:80}}>
                      {nomeMes(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p=>{
                  const notas = p.pontuacao?.notasMensais || {}
                  const geral = p.pontuacao?.nota
                  return (
                    <tr key={p.id} style={{borderBottom:'1px solid var(--border)'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'10px 14px',position:'sticky',left:0,background:'var(--surface)',zIndex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{p.nome}</div>
                        {p.tipo_parceria&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{p.tipo_parceria}</div>}
                      </td>
                      <td style={{padding:'10px 14px',textAlign:'center'}}>
                        <CirculoNota nota={geral} size={36} />
                      </td>
                      {meses.map(m=>(
                        <td key={m} style={{padding:'10px 14px',textAlign:'center'}}>
                          <CirculoNota nota={notas[m]} size={32} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}
