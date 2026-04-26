import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Users, Plus, Pencil, Trash2, X, ChevronDown,
  UserCheck, AlertCircle, Clock, Target, Star,
  TrendingUp, CheckCircle, BarChart2, Award,
  BookOpen, GraduationCap, Link, ExternalLink,
  Download, FileSpreadsheet, FileText
} from 'lucide-react'

// ── UTILITÁRIOS ────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}
function fmtData(d) {
  if (!d) return '—'
  const [a,m,dia] = d.split('-')
  return `${dia}/${m}/${a}`
}
function diffDias(ini, fim) {
  if (!ini || !fim) return 0
  return Math.round((new Date(fim) - new Date(ini)) / 86400000) + 1
}
function pct(atual, inicial, alvo) {
  if (alvo === inicial) return atual >= alvo ? 100 : 0
  const p = ((atual - inicial) / (alvo - inicial)) * 100
  return Math.min(100, Math.max(0, Math.round(p)))
}
function corProgresso(p) {
  if (p >= 70) return '#22c55e'
  if (p >= 40) return '#eab308'
  return '#ef4444'
}
function notaCor(n) {
  if (n >= 8) return '#22c55e'
  if (n >= 6) return '#eab308'
  return '#ef4444'
}

const TIPO_CONTRATO   = ['CLT','PJ','Freelancer','Estágio']
const STATUS_COLAB    = [
  {v:'ativo',     l:'Ativo',     cls:'badge-green'},
  {v:'inativo',   l:'Inativo',   cls:'badge-amber'},
  {v:'desligado', l:'Desligado', cls:'badge-red'},
]
const TIPO_AUSENCIA = [
  {v:'ferias',     l:'Férias'},
  {v:'folga',      l:'Folga'},
  {v:'falta',      l:'Falta'},
  {v:'home_office',l:'Home Office'},
  {v:'atestado',   l:'Atestado'},
  {v:'licenca',    l:'Licença'},
]
const STATUS_AUSENCIA = [
  {v:'nao_planejado', l:'Não planejado', cls:'badge-red'},
  {v:'planejado',    l:'Planejado',     cls:'badge-indigo'},
  {v:'aprovado',     l:'Aprovado',      cls:'badge-amber'},
  {v:'concluido',    l:'Concluído',     cls:'badge-green'},
]
const TIPO_FEEDBACK = [
  {v:'positivo',    l:'Positivo',    cor:'#22c55e'},
  {v:'construtivo', l:'Construtivo', cor:'#f97316'},
  {v:'alerta',      l:'Alerta',      cor:'#ef4444'},
]
const TIPO_PERIODO = ['mensal','trimestral','semestral','anual']
const STATUS_OKR = [
  {v:'ativo',     l:'Ativo',     cls:'badge-indigo'},
  {v:'concluido', l:'Concluído', cls:'badge-green'},
  {v:'atrasado',  l:'Atrasado',  cls:'badge-red'},
  {v:'cancelado', l:'Cancelado', cls:'badge-amber'},
]
const CRITERIOS_PADRAO = [
  'Qualidade das entregas',
  'Cumprimento de prazos',
  'Proatividade',
  'Comunicação',
  'Trabalho em equipe',
  'Pensamento estratégico',
]

// ── SUPABASE HELPERS ───────────────────────────────────────
const getGrupos        = async () => (await supabase.from('rh_grupos').select('*').order('nome')).data || []
const getColaboradores = async () => (await supabase.from('rh_colaboradores').select('*, rh_grupos(id,nome)').order('nome')).data || []
const getTodasAusencias= async () => (await supabase.from('rh_ausencias').select('*, rh_colaboradores(id,nome,rh_grupos(nome))').order('data_inicio')).data || []
const getAusencias     = async (id) => (await supabase.from('rh_ausencias').select('*').eq('colaborador_id',id).order('data_inicio',{ascending:false})).data || []
const getFeedbacks     = async (id) => (await supabase.from('rh_feedbacks').select('*').eq('colaborador_id',id).order('data',{ascending:false})).data || []

async function saveGrupo(g) {
  const p = {nome:g.nome,descricao:g.descricao,responsavel:g.responsavel}
  if (g.id) return (await supabase.from('rh_grupos').update(p).eq('id',g.id).select().single()).data
  return (await supabase.from('rh_grupos').insert([p]).select().single()).data
}
async function deleteGrupo(id) { await supabase.from('rh_grupos').delete().eq('id',id) }

async function saveColaborador(c) {
  const p = {nome:c.nome,cargo:c.cargo,grupo_id:c.grupo_id||null,data_entrada:c.data_entrada,
    tipo_contrato:c.tipo_contrato,status:c.status,email:c.email||null,telefone:c.telefone||null,
    data_nascimento:c.data_nascimento||null,endereco:c.endereco||null,
    gestor_direto:c.gestor_direto||null,observacoes:c.observacoes||null}
  if (c.id) return (await supabase.from('rh_colaboradores').update(p).eq('id',c.id).select('*,rh_grupos(id,nome)').single()).data
  return (await supabase.from('rh_colaboradores').insert([p]).select('*,rh_grupos(id,nome)').single()).data
}
async function deleteColaborador(id) { await supabase.from('rh_colaboradores').delete().eq('id',id) }

async function saveAusencia(a) {
  const p = {colaborador_id:a.colaborador_id,tipo:a.tipo,data_inicio:a.data_inicio,data_fim:a.data_fim,status:a.status,observacoes:a.observacoes||null}
  if (a.id) return (await supabase.from('rh_ausencias').update(p).eq('id',a.id).select().single()).data
  return (await supabase.from('rh_ausencias').insert([p]).select().single()).data
}
async function deleteAusencia(id) { await supabase.from('rh_ausencias').delete().eq('id',id) }

async function saveFeedback(f) {
  const p = {colaborador_id:f.colaborador_id,tipo:f.tipo,descricao:f.descricao,data:f.data,relacionado_a:f.relacionado_a||null}
  if (f.id) return (await supabase.from('rh_feedbacks').update(p).eq('id',f.id).select().single()).data
  return (await supabase.from('rh_feedbacks').insert([p]).select().single()).data
}
async function deleteFeedback(id) { await supabase.from('rh_feedbacks').delete().eq('id',id) }

// Avaliações
async function getAvaliacoes(colaborador_id) {
  const { data } = await supabase.from('rh_avaliacoes')
    .select('*, rh_criterios_avaliacao(*)')
    .eq('colaborador_id', colaborador_id)
    .order('created_at', {ascending:false})
  return data || []
}
async function getTodasAvaliacoes() {
  const { data } = await supabase.from('rh_avaliacoes')
    .select('*, rh_colaboradores(id,nome,rh_grupos(nome)), rh_criterios_avaliacao(*)')
    .order('created_at', {ascending:false})
  return data || []
}
async function saveAvaliacao(av, criterios) {
  // Calcula nota geral (média ponderada)
  const totalPeso = criterios.reduce((s,c)=>s+(Number(c.peso)||1),0)
  const notaGeral = totalPeso>0
    ? criterios.reduce((s,c)=>s+(Number(c.nota)*((Number(c.peso)||1)/totalPeso)),0)
    : 0
  const payload = {colaborador_id:av.colaborador_id,periodo:av.periodo,tipo_periodo:av.tipo_periodo,
    nota_geral:Math.round(notaGeral*100)/100,comentarios:av.comentarios||null,avaliador:av.avaliador||null}
  let avId = av.id
  if (avId) {
    await supabase.from('rh_avaliacoes').update(payload).eq('id',avId)
  } else {
    const { data } = await supabase.from('rh_avaliacoes').insert([payload]).select().single()
    avId = data.id
  }
  // Salva critérios: remove todos e reinsere
  await supabase.from('rh_criterios_avaliacao').delete().eq('avaliacao_id',avId)
  if (criterios.length>0) {
    await supabase.from('rh_criterios_avaliacao').insert(
      criterios.map(c=>({avaliacao_id:avId,nome:c.nome,nota:Number(c.nota),peso:Number(c.peso)||1}))
    )
  }
  const { data } = await supabase.from('rh_avaliacoes').select('*,rh_criterios_avaliacao(*)').eq('id',avId).single()
  return data
}
async function deleteAvaliacao(id) {
  // Arquiva em vez de excluir (spec: avaliações não podem ser apagadas)
  await supabase.from('rh_avaliacoes').update({comentarios:'[ARQUIVADA] '}).eq('id',id)
}

// OKRs
async function getOKRs() {
  const { data } = await supabase.from('rh_okrs')
    .select('*, rh_colaboradores(id,nome), rh_grupos(id,nome), rh_key_results(*)')
    .order('created_at',{ascending:false})
  return data || []
}
async function saveOKR(okr) {
  const p = {titulo:okr.titulo,descricao:okr.descricao||null,periodo:okr.periodo,
    tipo:okr.tipo,responsavel_id:okr.responsavel_id||null,grupo_id:okr.grupo_id||null,status:okr.status}
  if (okr.id) return (await supabase.from('rh_okrs').update(p).eq('id',okr.id).select('*, rh_colaboradores(id,nome), rh_grupos(id,nome), rh_key_results(*)').single()).data
  return (await supabase.from('rh_okrs').insert([p]).select('*, rh_colaboradores(id,nome), rh_grupos(id,nome), rh_key_results(*)').single()).data
}
async function deleteOKR(id) { await supabase.from('rh_okrs').delete().eq('id',id) }

async function saveKR(kr) {
  const p = {okr_id:kr.okr_id,descricao:kr.descricao,valor_inicial:Number(kr.valor_inicial)||0,
    valor_alvo:Number(kr.valor_alvo),valor_atual:Number(kr.valor_atual)||0,unidade:kr.unidade||''}
  if (kr.id) return (await supabase.from('rh_key_results').update(p).eq('id',kr.id).select().single()).data
  return (await supabase.from('rh_key_results').insert([p]).select().single()).data
}
async function deleteKR(id) { await supabase.from('rh_key_results').delete().eq('id',id) }
async function updateKRProgresso(id, valor_atual) {
  return (await supabase.from('rh_key_results').update({valor_atual:Number(valor_atual)}).eq('id',id).select().single()).data
}


// ── SUPABASE HELPERS — FASE 3 ─────────────────────────────
async function getTreinamentos() {
  const { data } = await supabase.from('rh_treinamentos').select('*, rh_grupos(id,nome)').order('titulo')
  return data || []
}
async function saveTreinamento(t) {
  const p = {titulo:t.titulo,descricao:t.descricao||null,tipo:t.tipo,link:t.link||null,obrigatorio:t.obrigatorio||false,grupo_id:t.grupo_id||null}
  if (t.id) return (await supabase.from('rh_treinamentos').update(p).eq('id',t.id).select('*,rh_grupos(id,nome)').single()).data
  return (await supabase.from('rh_treinamentos').insert([p]).select('*,rh_grupos(id,nome)').single()).data
}
async function deleteTreinamento(id) { await supabase.from('rh_treinamentos').delete().eq('id',id) }

async function getProgressoColab(colaborador_id) {
  const { data } = await supabase.from('rh_progresso_treinamento')
    .select('*, rh_treinamentos(*)')
    .eq('colaborador_id', colaborador_id)
  return data || []
}
async function getProgressoTreinamento(treinamento_id) {
  const { data } = await supabase.from('rh_progresso_treinamento')
    .select('*, rh_colaboradores(id,nome)')
    .eq('treinamento_id', treinamento_id)
  return data || []
}
async function upsertProgresso(colaborador_id, treinamento_id, status, data_conclusao) {
  const p = {colaborador_id,treinamento_id,status,data_conclusao:data_conclusao||null}
  const { data } = await supabase.from('rh_progresso_treinamento')
    .upsert(p, {onConflict:'colaborador_id,treinamento_id'})
    .select('*,rh_treinamentos(*)').single()
  return data
}

async function getProcessos(colaborador_id) {
  const { data } = await supabase.from('rh_processos')
    .select('*, rh_checklist_itens(*)').eq('colaborador_id', colaborador_id).order('created_at',{ascending:false})
  return data || []
}
async function createProcesso(colaborador_id, tipo, responsavel) {
  const ONBOARDING = ['Cadastro completo no sistema','Acesso aos sistemas concedido','Treinamentos iniciais concluídos','Primeira meta definida','Integração com a equipe realizada']
  const OFFBOARDING = ['Entrevista de saída realizada','Transferência de responsabilidades concluída','Acessos revogados','Motivo de saída registrado']
  const itens = tipo==='onboarding' ? ONBOARDING : OFFBOARDING
  const { data: proc } = await supabase.from('rh_processos')
    .insert([{colaborador_id,tipo,responsavel:responsavel||null,data_inicio:new Date().toISOString().slice(0,10)}])
    .select().single()
  if (itens.length) {
    await supabase.from('rh_checklist_itens').insert(
      itens.map((desc,i)=>({processo_id:proc.id,descricao:desc,concluido:false,ordem:i}))
    )
  }
  const { data } = await supabase.from('rh_processos').select('*,rh_checklist_itens(*)').eq('id',proc.id).single()
  return data
}
async function toggleChecklistItem(id, concluido) {
  const { data } = await supabase.from('rh_checklist_itens').update({concluido}).eq('id',id).select().single()
  return data
}
async function addChecklistItem(processo_id, descricao) {
  const { data } = await supabase.from('rh_checklist_itens').insert([{processo_id,descricao,concluido:false,ordem:999}]).select().single()
  return data
}
async function deleteChecklistItem(id) { await supabase.from('rh_checklist_itens').delete().eq('id',id) }
async function concludeProcesso(id) {
  await supabase.from('rh_processos').update({data_conclusao:new Date().toISOString().slice(0,10)}).eq('id',id)
}

// ── BUSCA AGREGADA DE PROGRESSO DE TREINAMENTOS ──────────
async function getTodosProgressosTreinamento() {
  const { data } = await supabase.from('rh_progresso_treinamento')
    .select('*, rh_colaboradores(id,nome,cargo,rh_grupos(nome)), rh_treinamentos(id,titulo,tipo,obrigatorio)')
    .order('data_conclusao',{ascending:false})
  return data || []
}

// ── HELPERS DE EXPORTAÇÃO ────────────────────────────────
const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function nomeArquivo(base, mes) {
  const hoje = new Date()
  if (mes) {
    const [a,m] = mes.split('-')
    return `${base}_${a}-${m}`
  }
  return `${base}_${hoje.toISOString().slice(0,10)}`
}

function downloadCSV(linhas, nome) {
  const csv = linhas.map(linha =>
    linha.map(celula => {
      const v = celula == null ? '' : String(celula)
      return /[",;\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v
    }).join(';')
  ).join('\n')
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${nome}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function downloadXLSX(linhas, nome, aba='Relatório', colWidths) {
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  if (colWidths) ws['!cols'] = colWidths.map(w=>({wch:w}))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0,31))
  XLSX.writeFile(wb, `${nome}.xlsx`)
}

function imprimirPDF(titulo, subtitulo, linhas) {
  const [cabecalho, ...corpo] = linhas
  const tbHead = `<thead><tr>${cabecalho.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`
  const tbBody = `<tbody>${corpo.map(l=>`<tr>${l.map(c=>`<td>${c==null?'':String(c).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join('')}</tr>`).join('')}</tbody>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;padding:24px;font-size:11px}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#666;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th{background:#f3f4f6;text-align:left;padding:6px 8px;border-bottom:2px solid #d1d5db;font-weight:600}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#fafafa}
      @media print { body{padding:0} }
    </style></head><body>
    <h1>${titulo}</h1>
    <div class="sub">${subtitulo} · Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
    <table>${tbHead}${tbBody}</table>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return }
  w.document.write(html); w.document.close()
}

function exportar(formato, dados, config) {
  const { titulo, subtitulo, nomeBase, mes, colWidths, abaXlsx } = config
  const nome = nomeArquivo(nomeBase, mes)
  if (formato === 'csv')   return downloadCSV(dados, nome)
  if (formato === 'xlsx')  return downloadXLSX(dados, nome, abaXlsx || 'Relatório', colWidths)
  if (formato === 'pdf')   return imprimirPDF(titulo, subtitulo, dados)
}

// ── BOTÃO DE EXPORTAÇÃO COM DROPDOWN ─────────────────────
function BotaoExportar({ onExportar, disabled }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(()=>{
    function fechar(e) { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    if (aberto) document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  },[aberto])

  function escolher(formato) {
    setAberto(false)
    onExportar(formato)
  }

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button className="btn btn-ghost" disabled={disabled} onClick={()=>setAberto(a=>!a)}
        style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,opacity:disabled?0.5:1}}>
        <Download size={14}/> Exportar <ChevronDown size={12}/>
      </button>
      {aberto && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',zIndex:10,minWidth:160,overflow:'hidden'}}>
          <button onClick={()=>escolher('xlsx')} className="dropdown-item" style={dropItem}>
            <FileSpreadsheet size={13}/> Excel (.xlsx)
          </button>
          <button onClick={()=>escolher('csv')} className="dropdown-item" style={dropItem}>
            <FileText size={13}/> CSV
          </button>
          <button onClick={()=>escolher('pdf')} className="dropdown-item" style={dropItem}>
            <FileText size={13}/> PDF (impressão)
          </button>
        </div>
      )}
    </div>
  )
}
const dropItem = {
  display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 12px',
  fontSize:12,background:'none',border:'none',cursor:'pointer',color:'var(--text)',textAlign:'left'
}

// ─────────────────────────────────────────────────────────
// MODAIS
// ─────────────────────────────────────────────────────────

function ModalGrupo({ grupo, onSave, onClose }) {
  const [form, setForm] = useState({nome:grupo?.nome||'',descricao:grupo?.descricao||'',responsavel:grupo?.responsavel||''})
  const [saving, setSaving] = useState(false)
  async function save() { if(!form.nome.trim())return; setSaving(true); try{await onSave({...form,id:grupo?.id})}finally{setSaving(false)} }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header"><h2 className="modal-title">{grupo?'Editar Grupo':'Novo Grupo'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Responsável</label><input className="form-input" value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" rows={2} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/></div>
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

function ModalColaborador({ colab, grupos, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState(colab ? {
    nome:colab.nome,cargo:colab.cargo,grupo_id:colab.grupo_id||'',data_entrada:colab.data_entrada||hoje,
    tipo_contrato:colab.tipo_contrato||'CLT',status:colab.status||'ativo',email:colab.email||'',
    telefone:colab.telefone||'',data_nascimento:colab.data_nascimento||'',endereco:colab.endereco||'',
    gestor_direto:colab.gestor_direto||'',observacoes:colab.observacoes||'',
  } : {nome:'',cargo:'',grupo_id:'',data_entrada:hoje,tipo_contrato:'CLT',status:'ativo',email:'',telefone:'',data_nascimento:'',endereco:'',gestor_direto:'',observacoes:''})
  const [saving, setSaving] = useState(false)
  const [aba, setAba] = useState('basico')
  async function save() { if(!form.nome.trim()||!form.cargo.trim())return; setSaving(true); try{await onSave({...form,id:colab?.id})}finally{setSaving(false)} }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:580,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">{colab?'Editar Colaborador':'Novo Colaborador'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {[{k:'basico',l:'Dados básicos'},{k:'contato',l:'Contato'},{k:'extra',l:'Adicional'}].map(({k,l})=>(
            <button key={k} onClick={()=>setAba(k)} style={{padding:'8px 16px',fontSize:12,fontWeight:aba===k?700:400,cursor:'pointer',background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',color:aba===k?'var(--accent)':'var(--text-muted)'}}>{l}</button>
          ))}
        </div>
        {aba==='basico'&&<div className="form-grid">
          <div className="form-group"><label className="form-label">Nome completo *</label><input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Cargo *</label><input className="form-input" value={form.cargo} onChange={e=>setForm(f=>({...f,cargo:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Grupo</label><select className="form-select" value={form.grupo_id} onChange={e=>setForm(f=>({...f,grupo_id:e.target.value}))}><option value="">Sem grupo</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data de entrada *</label><input className="form-input" type="date" value={form.data_entrada} onChange={e=>setForm(f=>({...f,data_entrada:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Contrato *</label><select className="form-select" value={form.tipo_contrato} onChange={e=>setForm(f=>({...f,tipo_contrato:e.target.value}))}>{TIPO_CONTRATO.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUS_COLAB.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
        </div>}
        {aba==='contato'&&<div className="form-grid">
          <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Endereço</label><input className="form-input" value={form.endereco} onChange={e=>setForm(f=>({...f,endereco:e.target.value}))}/></div>
        </div>}
        {aba==='extra'&&<div className="form-grid">
          <div className="form-group"><label className="form-label">Data de nascimento</label><input className="form-input" type="date" value={form.data_nascimento} onChange={e=>setForm(f=>({...f,data_nascimento:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Gestor direto</label><input className="form-input" value={form.gestor_direto} onChange={e=>setForm(f=>({...f,gestor_direto:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" rows={3} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/></div>
        </div>}
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.nome.trim()||!form.cargo.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

function ModalAusencia({ ausencia, colaborador_id, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({tipo:ausencia?.tipo||'ferias',data_inicio:ausencia?.data_inicio||hoje,data_fim:ausencia?.data_fim||hoje,status:ausencia?.status||'planejado',observacoes:ausencia?.observacoes||''})
  const [saving, setSaving] = useState(false)
  const dias = diffDias(form.data_inicio, form.data_fim)
  async function save() { setSaving(true); try{await onSave({...form,id:ausencia?.id,colaborador_id})}finally{setSaving(false)} }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header"><h2 className="modal-title">{ausencia?'Editar Ausência':'Nova Ausência'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>{TIPO_AUSENCIA.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUS_AUSENCIA.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Fim</label><input className="form-input" type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))}/></div>
          </div>
          {dias>0&&<div style={{fontSize:12,color:'var(--accent)',textAlign:'center',marginTop:-8}}>{dias} dia{dias!==1?'s':''}</div>}
          <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" rows={2} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/></div>
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

function ModalFeedback({ feedback, colaborador_id, onSave, onClose }) {
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({tipo:feedback?.tipo||'positivo',descricao:feedback?.descricao||'',data:feedback?.data||hoje,relacionado_a:feedback?.relacionado_a||''})
  const [saving, setSaving] = useState(false)
  async function save() { if(!form.descricao.trim())return; setSaving(true); try{await onSave({...form,id:feedback?.id,colaborador_id})}finally{setSaving(false)} }
  const tipoCor = TIPO_FEEDBACK.find(t=>t.v===form.tipo)?.cor
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header" style={{borderBottom:`3px solid ${tipoCor}`}}><h2 className="modal-title">{feedback?'Editar Feedback':'Novo Feedback'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Tipo</label>
            <div style={{display:'flex',gap:6}}>{TIPO_FEEDBACK.map(t=>(<button key={t.v} type="button" onClick={()=>setForm(f=>({...f,tipo:t.v}))} style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:`2px solid ${form.tipo===t.v?t.cor:'var(--border)'}`,background:form.tipo===t.v?`${t.cor}18`:'transparent',color:form.tipo===t.v?t.cor:'var(--text-muted)'}}>{t.l}</button>))}</div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Relacionado a</label><input className="form-input" value={form.relacionado_a} onChange={e=>setForm(f=>({...f,relacionado_a:e.target.value}))} placeholder="Projeto, campanha..."/></div>
          </div>
          <div className="form-group"><label className="form-label">Descrição *</label><textarea className="form-textarea" rows={4} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/></div>
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.descricao.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

// ── MODAL AVALIAÇÃO ────────────────────────────────────────
function ModalAvaliacao({ avaliacao, colaborador_id, onSave, onClose }) {
  const [form, setForm] = useState({
    periodo: avaliacao?.periodo || '',
    tipo_periodo: avaliacao?.tipo_periodo || 'mensal',
    comentarios: avaliacao?.comentarios || '',
    avaliador: avaliacao?.avaliador || '',
  })
  const [criterios, setCriterios] = useState(
    avaliacao?.rh_criterios_avaliacao?.length
      ? avaliacao.rh_criterios_avaliacao.map(c=>({...c,nota:String(c.nota),peso:String(c.peso)}))
      : CRITERIOS_PADRAO.map(nome=>({nome, nota:'7', peso:'1', id:null}))
  )
  const [saving, setSaving] = useState(false)

  const notaMedia = useMemo(()=>{
    const total = criterios.reduce((s,c)=>s+(Number(c.peso)||1),0)
    if (!total) return 0
    return criterios.reduce((s,c)=>s+(Number(c.nota)*(Number(c.peso)||1)/total),0)
  },[criterios])

  function updCriterio(i,field,val) { setCriterios(prev=>prev.map((c,idx)=>idx===i?{...c,[field]:val}:c)) }
  function addCriterio() { setCriterios(prev=>[...prev,{nome:'',nota:'7',peso:'1',id:null}]) }
  function removeCriterio(i) { setCriterios(prev=>prev.filter((_,idx)=>idx!==i)) }

  async function save() {
    if (!form.periodo.trim()) return
    setSaving(true)
    try { await onSave({...form,id:avaliacao?.id,colaborador_id}, criterios.filter(c=>c.nome.trim())) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:580,maxHeight:'92vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">{avaliacao?'Editar Avaliação':'Nova Avaliação'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Período *</label>
              <input className="form-input" value={form.periodo} onChange={e=>setForm(f=>({...f,periodo:e.target.value}))} placeholder="Ex: Março 2026, Q1 2026"/>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo_periodo} onChange={e=>setForm(f=>({...f,tipo_periodo:e.target.value}))}>
                {TIPO_PERIODO.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Avaliador</label>
            <input className="form-input" value={form.avaliador} onChange={e=>setForm(f=>({...f,avaliador:e.target.value}))} placeholder="Nome do avaliador"/>
          </div>
        </div>

        {/* Critérios */}
        <div style={{borderTop:'1px solid var(--border)',marginTop:8,paddingTop:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Critérios</span>
              <span style={{fontSize:20,fontWeight:800,color:notaCor(notaMedia)}}>{notaMedia.toFixed(1)}</span>
              <span style={{fontSize:11,color:'var(--text-muted)'}}>nota geral</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addCriterio} style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}><Plus size={12}/>Critério</button>
          </div>

          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:12}}>
              <thead><tr><th>Critério</th><th style={{width:80}}>Nota (0–10)</th><th style={{width:60}}>Peso</th><th style={{width:32}}></th></tr></thead>
              <tbody>
                {criterios.map((c,i)=>(
                  <tr key={i}>
                    <td><input className="form-input" style={{padding:'4px 8px',fontSize:12}} value={c.nome} onChange={e=>updCriterio(i,'nome',e.target.value)} placeholder="Nome do critério"/></td>
                    <td>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <input type="range" min="0" max="10" step="0.5" value={c.nota}
                          onChange={e=>updCriterio(i,'nota',e.target.value)}
                          style={{width:'100%',accentColor:notaCor(Number(c.nota))}}/>
                        <span style={{fontSize:11,fontWeight:700,color:notaCor(Number(c.nota)),textAlign:'center'}}>{Number(c.nota).toFixed(1)}</span>
                      </div>
                    </td>
                    <td><input className="form-input" style={{padding:'4px 8px',fontSize:12,width:50}} type="number" min="0.1" max="5" step="0.1" value={c.peso} onChange={e=>updCriterio(i,'peso',e.target.value)}/></td>
                    <td><button onClick={()=>removeCriterio(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',padding:4}}><Trash2 size={12}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-group" style={{marginTop:16}}>
          <label className="form-label">Comentários gerais</label>
          <textarea className="form-textarea" rows={3} value={form.comentarios} onChange={e=>setForm(f=>({...f,comentarios:e.target.value}))} placeholder="Pontos de destaque, áreas de melhoria..."/>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.periodo.trim()}>{saving?'Salvando...':'Salvar avaliação'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL OKR ──────────────────────────────────────────────
function ModalOKR({ okr, colaboradores, grupos, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo:okr?.titulo||'', descricao:okr?.descricao||'', periodo:okr?.periodo||'',
    tipo:okr?.tipo||'individual', responsavel_id:okr?.responsavel_id||'',
    grupo_id:okr?.grupo_id||'', status:okr?.status||'ativo',
  })
  const [saving, setSaving] = useState(false)
  async function save() { if(!form.titulo.trim()||!form.periodo.trim())return; setSaving(true); try{await onSave({...form,id:okr?.id})}finally{setSaving(false)} }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:520}}>
        <div className="modal-header"><h2 className="modal-title">{okr?'Editar OKR':'Novo OKR'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Aumentar engajamento nas campanhas"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Período *</label><input className="form-input" value={form.periodo} onChange={e=>setForm(f=>({...f,periodo:e.target.value}))} placeholder="Ex: Q1 2026"/></div>
            <div className="form-group"><label className="form-label">Tipo</label>
              <div style={{display:'flex',gap:8}}>
                {[{v:'individual',l:'Individual'},{v:'grupo',l:'Grupo'}].map(({v,l})=>(
                  <button key={v} type="button" onClick={()=>setForm(f=>({...f,tipo:v}))}
                    style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                      borderColor:form.tipo===v?'var(--accent)':'var(--border)',
                      background:form.tipo===v?'var(--accent-glow)':'transparent',
                      color:form.tipo===v?'var(--accent)':'var(--text-muted)'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.tipo==='individual'
            ? <div className="form-group"><label className="form-label">Responsável</label><select className="form-select" value={form.responsavel_id} onChange={e=>setForm(f=>({...f,responsavel_id:e.target.value}))}><option value="">Selecionar...</option>{colaboradores.filter(c=>c.status==='ativo').map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            : <div className="form-group"><label className="form-label">Grupo</label><select className="form-select" value={form.grupo_id} onChange={e=>setForm(f=>({...f,grupo_id:e.target.value}))}><option value="">Selecionar...</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></div>
          }
          <div className="form-row">
            <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUS_OKR.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" rows={2} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/></div>
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.titulo.trim()||!form.periodo.trim()}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

// ── MODAL KEY RESULT ───────────────────────────────────────
function ModalKR({ kr, okr_id, onSave, onClose }) {
  const [form, setForm] = useState({
    descricao:kr?.descricao||'', valor_inicial:kr?.valor_inicial??0,
    valor_alvo:kr?.valor_alvo||'', valor_atual:kr?.valor_atual??0, unidade:kr?.unidade||'',
  })
  const [saving, setSaving] = useState(false)
  const progresso = pct(Number(form.valor_atual),Number(form.valor_inicial),Number(form.valor_alvo))
  async function save() { if(!form.descricao.trim()||!form.valor_alvo)return; setSaving(true); try{await onSave({...form,id:kr?.id,okr_id})}finally{setSaving(false)} }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-header"><h2 className="modal-title">{kr?'Editar Key Result':'Novo Key Result'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Descrição *</label><input className="form-input" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Atingir 80% de aproveitamento nas campanhas"/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Valor inicial</label><input className="form-input" type="number" value={form.valor_inicial} onChange={e=>setForm(f=>({...f,valor_inicial:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Valor alvo *</label><input className="form-input" type="number" value={form.valor_alvo} onChange={e=>setForm(f=>({...f,valor_alvo:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Valor atual</label><input className="form-input" type="number" value={form.valor_atual} onChange={e=>setForm(f=>({...f,valor_atual:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Unidade</label><input className="form-input" value={form.unidade} onChange={e=>setForm(f=>({...f,unidade:e.target.value}))} placeholder="%, R$, un..."/></div>
          </div>
          {form.valor_alvo&&<div style={{padding:'10px 0'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:4}}>
              <span>Progresso</span><span style={{fontWeight:700,color:corProgresso(progresso)}}>{progresso}%</span>
            </div>
            <div style={{height:6,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${progresso}%`,background:corProgresso(progresso),transition:'width 0.3s'}}/>
            </div>
          </div>}
        </div>
        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving||!form.descricao.trim()||!form.valor_alvo}>{saving?'Salvando...':'Salvar'}</button></div>
      </div>
    </div>
  )
}

// ── PERFIL DO COLABORADOR ──────────────────────────────────
function PerfilColaborador({ colab, grupos, colaboradores, onEdit, onBack, showToast }) {
  const [ausencias,   setAusencias]   = useState([])
  const [feedbacks,   setFeedbacks]   = useState([])
  const [avaliacoes,  setAvaliacoes]  = useState([])
  const [abaColab,    setAbaColab]    = useState('avaliacoes')
  const [processos,   setProcessos]   = useState([])
  const [modalAus,    setModalAus]    = useState(false)
  const [editAus,     setEditAus]     = useState(null)
  const [modalFeed,   setModalFeed]   = useState(false)
  const [editFeed,    setEditFeed]    = useState(null)
  const [modalAval,   setModalAval]   = useState(false)
  const [editAval,    setEditAval]    = useState(null)
  const [expandAval,  setExpandAval]  = useState({})

  useEffect(()=>{
    getAusencias(colab.id).then(setAusencias)
    getFeedbacks(colab.id).then(setFeedbacks)
    getAvaliacoes(colab.id).then(setAvaliacoes)
    getProcessos(colab.id).then(setProcessos)
  },[colab.id])

  async function handleSaveAus(a) { const s=await saveAusencia(a); if(a.id)setAusencias(p=>p.map(x=>x.id===a.id?s:x)); else setAusencias(p=>[s,...p]); setModalAus(false);setEditAus(null);showToast('Salvo!') }
  async function handleDelAus(id) { if(!window.confirm('Excluir?'))return; await deleteAusencia(id); setAusencias(p=>p.filter(x=>x.id!==id));showToast('Removida!') }
  async function handleSaveFeed(f) { const s=await saveFeedback(f); if(f.id)setFeedbacks(p=>p.map(x=>x.id===f.id?s:x)); else setFeedbacks(p=>[s,...p]); setModalFeed(false);setEditFeed(null);showToast('Salvo!') }
  async function handleDelFeed(id) { if(!window.confirm('Excluir?'))return; await deleteFeedback(id); setFeedbacks(p=>p.filter(x=>x.id!==id));showToast('Removido!') }
  async function handleSaveAval(av, crit) { const s=await saveAvaliacao(av,crit); if(av.id)setAvaliacoes(p=>p.map(x=>x.id===av.id?s:x)); else setAvaliacoes(p=>[s,...p]); setModalAval(false);setEditAval(null);showToast('Avaliação salva!') }

  const sc = STATUS_COLAB.find(s=>s.v===colab.status)||STATUS_COLAB[0]
  const grupo = grupos.find(g=>g.id===colab.grupo_id)
  const ultimaAval = avaliacoes[0]

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronDown size={18} style={{transform:'rotate(90deg)'}}/></button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h1 className="page-title" style={{margin:0}}>{colab.nome}</h1>
            <span className={`badge ${sc.cls}`}>{sc.l}</span>
            {ultimaAval && <span style={{fontSize:13,fontWeight:800,color:notaCor(ultimaAval.nota_geral)}}>{Number(ultimaAval.nota_geral).toFixed(1)} ★</span>}
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
            {colab.cargo}{grupo&&<span style={{marginLeft:8,color:'var(--accent)'}}>· {grupo.nome}</span>}{colab.tipo_contrato&&<span style={{marginLeft:8}}>· {colab.tipo_contrato}</span>}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={()=>onEdit(colab)}><Pencil size={14}/> Editar</button>
      </div>

      {/* Abas perfil */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:16}}>
        {[{k:'avaliacoes',l:`Avaliações (${avaliacoes.length})`},{k:'ausencias',l:`Ausências (${ausencias.length})`},{k:'feedbacks',l:`Feedbacks (${feedbacks.length})`},{k:'treinamentos',l:'Treinamentos'},{k:'processos',l:`Processos (${processos.length})`}].map(({k,l})=>(
          <button key={k} onClick={()=>setAbaColab(k)} style={{padding:'8px 16px',fontSize:13,fontWeight:abaColab===k?700:400,cursor:'pointer',background:'none',border:'none',borderBottom:abaColab===k?'2px solid var(--accent)':'2px solid transparent',color:abaColab===k?'var(--accent)':'var(--text-muted)'}}>{l}</button>
        ))}
      </div>

      {/* AVALIAÇÕES */}
      {abaColab==='avaliacoes'&&(
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalAval(true)}><Plus size={14}/> Nova avaliação</button>
          </div>
          {avaliacoes.length===0
            ? <div className="empty-state"><p>Nenhuma avaliação registrada.</p></div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {avaliacoes.map(av=>{
                  const exp = expandAval[av.id]
                  return (
                    <div key={av.id} className="table-card" style={{padding:'14px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpandAval(p=>({...p,[av.id]:!p[av.id]}))}>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <div style={{fontSize:24,fontWeight:800,color:notaCor(av.nota_geral),minWidth:40}}>{Number(av.nota_geral).toFixed(1)}</div>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{av.periodo}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{av.tipo_periodo.charAt(0).toUpperCase()+av.tipo_periodo.slice(1)}{av.avaliador&&` · ${av.avaliador}`}</div>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={e=>{e.stopPropagation();setEditAval(av);setModalAval(true)}}><Pencil size={12}/></button>
                          <ChevronDown size={14} color="var(--text-muted)" style={{transform:exp?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
                        </div>
                      </div>
                      {exp&&(
                        <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
                          {av.rh_criterios_avaliacao?.length>0&&(
                            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                              {av.rh_criterios_avaliacao.map(c=>(
                                <div key={c.id} style={{display:'flex',alignItems:'center',gap:10}}>
                                  <span style={{fontSize:12,color:'var(--text-muted)',minWidth:160}}>{c.nome}</span>
                                  <div style={{flex:1,height:6,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
                                    <div style={{height:'100%',width:`${(c.nota/10)*100}%`,background:notaCor(c.nota)}}/>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:700,color:notaCor(c.nota),minWidth:28}}>{Number(c.nota).toFixed(1)}</span>
                                  {c.peso!==1&&<span style={{fontSize:10,color:'var(--text-muted)'}}>x{c.peso}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {av.comentarios&&<p style={{fontSize:12,color:'var(--text-muted)',margin:0,lineHeight:1.5}}>{av.comentarios}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </div>
      )}

      {/* AUSÊNCIAS */}
      {abaColab==='ausencias'&&(
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-primary btn-sm" onClick={()=>setModalAus(true)}><Plus size={14}/> Nova ausência</button></div>
          {ausencias.length===0?<div className="empty-state"><p>Nenhuma ausência.</p></div>
            :<div className="table-card"><table>
              <thead><tr><th>Tipo</th><th>Status</th><th>Início</th><th>Fim</th><th>Dias</th><th></th></tr></thead>
              <tbody>{ausencias.map(a=>{
                const ta=TIPO_AUSENCIA.find(t=>t.v===a.tipo); const sa=STATUS_AUSENCIA.find(s=>s.v===a.status)||STATUS_AUSENCIA[0]
                return <tr key={a.id}><td style={{fontWeight:600}}>{ta?.l||a.tipo}</td><td><span className={`badge ${sa.cls}`} style={{fontSize:10}}>{sa.l}</span></td><td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_inicio)}</td><td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_fim)}</td><td style={{fontSize:12,color:'var(--accent)',fontWeight:700}}>{diffDias(a.data_inicio,a.data_fim)}</td><td><div className="actions-cell"><button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditAus(a);setModalAus(true)}}><Pencil size={12}/></button><button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelAus(a.id)}><Trash2 size={12}/></button></div></td></tr>
              })}</tbody>
            </table></div>
          }
        </div>
      )}

      {/* FEEDBACKS */}
      {abaColab==='feedbacks'&&(
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-primary btn-sm" onClick={()=>setModalFeed(true)}><Plus size={14}/> Novo feedback</button></div>
          {feedbacks.length===0?<div className="empty-state"><p>Nenhum feedback.</p></div>
            :<div style={{display:'flex',flexDirection:'column',gap:10}}>{feedbacks.map(f=>{
              const tf=TIPO_FEEDBACK.find(t=>t.v===f.tipo)
              return <div key={f.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderLeft:`4px solid ${tf?.cor}`,borderRadius:8,padding:'12px 16px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                  <div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontSize:11,fontWeight:700,color:tf?.cor,textTransform:'uppercase'}}>{tf?.l}</span><span style={{fontSize:11,color:'var(--text-muted)'}}>{fmtData(f.data)}</span>{f.relacionado_a&&<span style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 7px',color:'var(--text-muted)'}}>{f.relacionado_a}</span>}</div><p style={{fontSize:13,color:'var(--text)',margin:0,lineHeight:1.5}}>{f.descricao}</p></div>
                  <div className="actions-cell"><button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditFeed(f);setModalFeed(true)}}><Pencil size={12}/></button><button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelFeed(f.id)}><Trash2 size={12}/></button></div>
                </div>
              </div>
            })}</div>
          }
        </div>
      )}


      {/* TREINAMENTOS */}
      {abaColab==='treinamentos'&&(
        <TreinamentosColaborador colaborador_id={colab.id} showToast={showToast}/>
      )}

      {/* PROCESSOS */}
      {abaColab==='processos'&&(
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:12}}>
            <button className="btn btn-primary btn-sm" style={{background:'#22c55e',borderColor:'#22c55e'}}
              onClick={async()=>{ const p=await createProcesso(colab.id,'onboarding'); setProcessos(prev=>[p,...prev]); showToast('Onboarding iniciado!') }}>
              ✅ Novo Onboarding
            </button>
            <button className="btn btn-primary btn-sm" style={{background:'#f97316',borderColor:'#f97316'}}
              onClick={async()=>{ const p=await createProcesso(colab.id,'offboarding'); setProcessos(prev=>[p,...prev]); showToast('Offboarding iniciado!') }}>
              🚪 Novo Offboarding
            </button>
          </div>
          {processos.length===0
            ? <div className="empty-state"><p>Nenhum processo registrado. Inicie um onboarding ou offboarding.</p></div>
            : processos.map(p=>(
                <CardProcesso key={p.id} processo={p}
                  onUpdate={()=>getProcessos(colab.id).then(setProcessos)}/>
              ))
          }
        </div>
      )}

      {modalAus&&<ModalAusencia ausencia={editAus} colaborador_id={colab.id} onSave={handleSaveAus} onClose={()=>{setModalAus(false);setEditAus(null)}}/>}
      {modalFeed&&<ModalFeedback feedback={editFeed} colaborador_id={colab.id} onSave={handleSaveFeed} onClose={()=>{setModalFeed(false);setEditFeed(null)}}/>}
      {modalAval&&<ModalAvaliacao avaliacao={editAval} colaborador_id={colab.id} onSave={handleSaveAval} onClose={()=>{setModalAval(false);setEditAval(null)}}/>}
    </div>
  )
}

// ── CARD OKR ───────────────────────────────────────────────
function CardOKR({ okr, onEdit, onDelete, onEditKR, onDeleteKR, onUpdateProgresso }) {
  const [expanded, setExpanded] = useState(true)
  const [editingKR, setEditingKR] = useState(null)
  const [novoValor, setNovoValor] = useState({})
  const so = STATUS_OKR.find(s=>s.v===okr.status)||STATUS_OKR[0]
  const krs = okr.rh_key_results || []
  const progGeral = krs.length
    ? Math.round(krs.reduce((s,kr)=>s+pct(kr.valor_atual,kr.valor_inicial,kr.valor_alvo),0)/krs.length)
    : 0

  return (
    <div className="table-card" style={{padding:'16px 20px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
        <div style={{flex:1,cursor:'pointer'}} onClick={()=>setExpanded(p=>!p)}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
            <span className={`badge ${so.cls}`} style={{fontSize:10}}>{so.l}</span>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>{okr.periodo}</span>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>{okr.tipo==='grupo'?`📦 ${okr.rh_grupos?.nome||'—'}`:`👤 ${okr.rh_colaboradores?.nome||'—'}`}</span>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:6}}>{okr.titulo}</div>
          {/* Barra de progresso geral */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,height:6,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${progGeral}%`,background:corProgresso(progGeral),transition:'width 0.4s'}}/>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:corProgresso(progGeral),minWidth:36}}>{progGeral}%</span>
          </div>
        </div>
        <div className="actions-cell">
          <button className="btn btn-primary btn-sm" style={{fontSize:10,padding:'3px 8px'}} onClick={()=>onEditKR(null,okr.id)}>
            <Plus size={11}/> KR
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>onEdit(okr)}><Pencil size={12}/></button>
          <button className="btn btn-danger btn-icon btn-sm" onClick={()=>onDelete(okr.id)}><Trash2 size={12}/></button>
        </div>
      </div>

      {expanded && krs.length > 0 && (
        <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:10}}>
          {krs.map(kr=>{
            const p = pct(kr.valor_atual, kr.valor_inicial, kr.valor_alvo)
            const editing = editingKR===kr.id
            return (
              <div key={kr.id} style={{background:'var(--surface-2)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--text)',flex:1}}>{kr.descricao}</span>
                  <div className="actions-cell">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>onEditKR(kr,okr.id)}><Pencil size={11}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>onDeleteKR(kr.id,okr.id)}><Trash2 size={11}/></button>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{flex:1,height:8,borderRadius:99,background:'var(--surface)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${p}%`,background:corProgresso(p),transition:'width 0.3s'}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:corProgresso(p),minWidth:32}}>{p}%</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'var(--text-muted)'}}>
                  <span>{kr.valor_inicial}{kr.unidade} → {kr.valor_alvo}{kr.unidade}</span>
                  <span style={{color:'var(--accent)',fontWeight:600}}>Atual: {kr.valor_atual}{kr.unidade}</span>
                  {!editing
                    ? <button className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'2px 8px',marginLeft:'auto'}}
                        onClick={()=>{setEditingKR(kr.id);setNovoValor(p=>({...p,[kr.id]:String(kr.valor_atual)}))}}>
                        Atualizar
                      </button>
                    : <div style={{display:'flex',gap:6,marginLeft:'auto',alignItems:'center'}}>
                        <input className="form-input" type="number" style={{padding:'3px 8px',fontSize:11,width:80}}
                          value={novoValor[kr.id]||''} onChange={e=>setNovoValor(p=>({...p,[kr.id]:e.target.value}))}/>
                        <button className="btn btn-primary btn-sm" style={{fontSize:10,padding:'3px 8px'}}
                          onClick={async()=>{ await onUpdateProgresso(kr.id,novoValor[kr.id],okr.id); setEditingKR(null) }}>
                          ✓
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'3px 6px'}}
                          onClick={()=>setEditingKR(null)}>✕</button>
                      </div>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
      {expanded && krs.length===0 && (
        <div style={{marginTop:10,fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>Nenhum Key Result ainda. Adicione com "+ KR".</div>
      )}
    </div>
  )
}

// ── DASHBOARD GERENCIAL ────────────────────────────────────
function DashboardRH({ colaboradores, grupos, ausenciasAll, avaliacoes, okrs }) {
  const hoje = new Date().toISOString().slice(0,10)
  const ativos    = colaboradores.filter(c=>c.status==='ativo')
  const ausentes  = ausenciasAll.filter(a=>a.data_inicio<=hoje&&a.data_fim>=hoje)
  const okrsAtivos = okrs.filter(o=>o.status==='ativo')
  const okrsAtrasados = okrs.filter(o=>o.status==='atrasado')

  // Médias por grupo
  const mediaPorGrupo = grupos.map(g=>{
    const colabsGrupo = ativos.filter(c=>c.grupo_id===g.id)
    const avsGrupo = avaliacoes.filter(av=>colabsGrupo.some(c=>c.id===av.colaborador_id))
    const media = avsGrupo.length ? avsGrupo.reduce((s,av)=>s+Number(av.nota_geral),0)/avsGrupo.length : null
    return {grupo:g.nome,media,total:colabsGrupo.length,avaliacoes:avsGrupo.length}
  }).filter(g=>g.total>0)

  // Progresso médio OKRs
  const progOKRs = okrsAtivos.map(okr=>{
    const krs = okr.rh_key_results||[]
    const p = krs.length ? Math.round(krs.reduce((s,kr)=>s+pct(kr.valor_atual,kr.valor_inicial,kr.valor_alvo),0)/krs.length) : 0
    return {...okr, progresso:p}
  })

  return (
    <div>
      {/* Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:28}}>
        {[
          {l:'Ativos',       v:ativos.length,    cor:'#22c55e', icon:UserCheck},
          {l:'Ausentes hoje',v:ausentes.length,  cor:'#f97316', icon:Clock},
          {l:'OKRs ativos',  v:okrsAtivos.length,cor:'var(--accent)',icon:Target},
          {l:'OKRs atrasados',v:okrsAtrasados.length,cor:'#ef4444',icon:AlertCircle},
        ].map(({l,v,cor,icon:Icon})=>(
          <div key={l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderTop:`3px solid ${cor}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)'}}>{l}</span>
              <Icon size={15} color={cor} strokeWidth={1.5}/>
            </div>
            <div style={{fontSize:28,fontWeight:800,color:cor,lineHeight:1}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Performance por grupo */}
        <div className="table-card" style={{padding:'16px 20px'}}>
          <h3 style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:14}}>📊 Performance por grupo</h3>
          {mediaPorGrupo.length===0
            ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhuma avaliação registrada ainda.</p>
            : mediaPorGrupo.map(g=>(
              <div key={g.grupo} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{fontWeight:600,color:'var(--text)'}}>{g.grupo}</span>
                  <span style={{fontWeight:800,color:g.media?notaCor(g.media):'var(--text-muted)'}}>
                    {g.media?g.media.toFixed(1):'—'}
                    <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:4}}>({g.avaliacoes} aval.)</span>
                  </span>
                </div>
                {g.media&&<div style={{height:6,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(g.media/10)*100}%`,background:notaCor(g.media)}}/>
                </div>}
              </div>
            ))
          }
        </div>

        {/* OKRs em andamento */}
        <div className="table-card" style={{padding:'16px 20px'}}>
          <h3 style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:14}}>🎯 OKRs em andamento</h3>
          {progOKRs.length===0
            ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhum OKR ativo.</p>
            : progOKRs.slice(0,6).map(okr=>(
              <div key={okr.id} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:600,color:'var(--text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{okr.titulo}</span>
                  <span style={{fontWeight:800,color:corProgresso(okr.progresso),marginLeft:8}}>{okr.progresso}%</span>
                </div>
                <div style={{height:5,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${okr.progresso}%`,background:corProgresso(okr.progresso),transition:'width 0.3s'}}/>
                </div>
              </div>
            ))
          }
        </div>

        {/* Ausências próximas */}
        <div className="table-card" style={{padding:'16px 20px'}}>
          <h3 style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:14}}>📅 Ausências próximas</h3>
          {ausenciasAll.filter(a=>a.data_fim>=hoje&&['planejado','aprovado'].includes(a.status)).length===0
            ? <p style={{fontSize:12,color:'var(--text-muted)'}}>Nenhuma ausência futura.</p>
            : ausenciasAll.filter(a=>a.data_fim>=hoje&&['planejado','aprovado'].includes(a.status)).slice(0,5).map(a=>(
              <div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,fontSize:12}}>
                <span style={{fontWeight:600,color:'var(--text)'}}>{a.rh_colaboradores?.nome||'—'}</span>
                <span style={{color:'var(--text-muted)'}}>{TIPO_AUSENCIA.find(t=>t.v===a.tipo)?.l} · {fmtData(a.data_inicio)} → {fmtData(a.data_fim)}</span>
              </div>
            ))
          }
        </div>

        {/* Equipe por grupo */}
        <div className="table-card" style={{padding:'16px 20px'}}>
          <h3 style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:14}}>👥 Equipe por grupo</h3>
          {grupos.map(g=>{
            const n = ativos.filter(c=>c.grupo_id===g.id).length
            return (
              <div key={g.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{g.nome}</span>
                <span style={{fontSize:12,color:'var(--accent)',fontWeight:700}}>{n} membro{n!==1?'s':''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ── MODAL TREINAMENTO ─────────────────────────────────────
function ModalTreinamento({ treinamento, grupos, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: treinamento?.titulo||'',
    descricao: treinamento?.descricao||'',
    tipo: treinamento?.tipo||'curso',
    link: treinamento?.link||'',
    obrigatorio: treinamento?.obrigatorio||false,
    grupo_id: treinamento?.grupo_id||'',
  })
  const [saving, setSaving] = useState(false)
  const TIPOS_TREI = [{v:'curso',l:'Curso'},{v:'leitura',l:'Leitura'},{v:'pratica',l:'Prática'},{v:'mentoria',l:'Mentoria'}]
  async function save() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try { await onSave({...form, id:treinamento?.id}) } finally { setSaving(false) }
  }
  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header">
          <h2 className="modal-title">{treinamento?'Editar Treinamento':'Novo Treinamento'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Onboarding de Marketing"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                {TIPOS_TREI.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Grupo (opcional)</label>
              <select className="form-select" value={form.grupo_id} onChange={e=>setForm(f=>({...f,grupo_id:e.target.value}))}>
                <option value="">Todos os grupos</option>
                {grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" rows={2} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Objetivo e conteúdo do treinamento..."/>
          </div>
          <div className="form-group">
            <label className="form-label">Link / Material</label>
            <input className="form-input" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://..."/>
          </div>
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
              <input type="checkbox" checked={form.obrigatorio} onChange={e=>setForm(f=>({...f,obrigatorio:e.target.checked}))}
                style={{width:16,height:16,accentColor:'var(--accent)'}}/>
              <span style={{fontWeight:600,color:'var(--text)'}}>Treinamento obrigatório</span>
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.titulo.trim()}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── ABA TREINAMENTOS (catálogo global) ────────────────────
function AbaTreinamentos({ grupos, showToast }) {
  const [treinamentos, setTreinamentos] = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [editT, setEditT]               = useState(null)
  const [filtroGrupo, setFiltroGrupo]   = useState('')
  const [filtroTipo, setFiltroTipo]     = useState('')

  const TIPO_COR = {curso:'#6366f1',leitura:'#22c55e',pratica:'#f97316',mentoria:'#06b6d4'}
  const TIPOS_TREI = [{v:'curso',l:'Curso'},{v:'leitura',l:'Leitura'},{v:'pratica',l:'Prática'},{v:'mentoria',l:'Mentoria'}]

  useEffect(()=>{ getTreinamentos().then(setTreinamentos).finally(()=>setLoading(false)) },[])

  async function handleSave(t) {
    const s = await saveTreinamento(t)
    if (t.id) setTreinamentos(p=>p.map(x=>x.id===t.id?s:x))
    else setTreinamentos(p=>[...p,s])
    setModal(false); setEditT(null); showToast('Treinamento salvo!')
  }
  async function handleDelete(id) {
    if (!window.confirm('Excluir treinamento?')) return
    await deleteTreinamento(id)
    setTreinamentos(p=>p.filter(x=>x.id!==id))
    showToast('Removido!')
  }

  const filtrados = treinamentos.filter(t=>{
    if (filtroGrupo && t.grupo_id !== filtroGrupo && t.grupo_id !== null) return false
    if (filtroGrupo === '__sem__' && t.grupo_id !== null) return false
    if (filtroTipo && t.tipo !== filtroTipo) return false
    return true
  })

  if (loading) return <div className="loading"><div className="spinner"/></div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_TREI.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)}>
            <option value="">Todos os grupos</option>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={14}/> Treinamento</button>
      </div>

      {filtrados.length===0
        ? <div className="empty-state"><p>Nenhum treinamento cadastrado.</p></div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {filtrados.map(t=>{
              const cor = TIPO_COR[t.tipo]||'#6b7280'
              return (
                <div key={t.id} className="table-card" style={{padding:'14px 18px',borderTop:`3px solid ${cor}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:700,color:cor,textTransform:'uppercase'}}>{t.tipo}</span>
                        {t.obrigatorio && <span style={{fontSize:10,background:'#ef444420',color:'#ef4444',border:'1px solid #ef444440',borderRadius:4,padding:'1px 6px',fontWeight:700}}>OBRIG.</span>}
                        {t.rh_grupos && <span style={{fontSize:10,color:'var(--text-muted)',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 6px'}}>{t.rh_grupos.nome}</span>}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:t.descricao?4:0}}>{t.titulo}</div>
                      {t.descricao&&<div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.4}}>{t.descricao}</div>}
                      {t.link&&(
                        <a href={t.link} target="_blank" rel="noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'var(--accent)',marginTop:6,textDecoration:'none'}}>
                          <ExternalLink size={10}/> Ver material
                        </a>
                      )}
                    </div>
                    <div className="actions-cell">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditT(t);setModal(true)}}><Pencil size={12}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelete(t.id)}><Trash2 size={12}/></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
      }
      {modal && <ModalTreinamento treinamento={editT} grupos={grupos} onSave={handleSave} onClose={()=>{setModal(false);setEditT(null)}}/>}
    </div>
  )
}

// ── CARD PROCESSO (Onboarding/Offboarding) ────────────────
function CardProcesso({ processo, onUpdate }) {
  const [itens, setItens]     = useState(processo.rh_checklist_itens||[])
  const [novoItem, setNovoItem]= useState('')
  const [addingItem, setAdding]= useState(false)
  const concluidos = itens.filter(i=>i.concluido).length
  const total = itens.length
  const pctProg = total>0 ? Math.round((concluidos/total)*100) : 0
  const concluido = !!processo.data_conclusao

  async function toggle(item) {
    const upd = await toggleChecklistItem(item.id, !item.concluido)
    setItens(p=>p.map(x=>x.id===item.id?upd:x))
  }
  async function addItem() {
    if (!novoItem.trim()) return
    const novo = await addChecklistItem(processo.id, novoItem.trim())
    setItens(p=>[...p,novo]); setNovoItem(''); setAdding(false)
  }
  async function removeItem(id) {
    await deleteChecklistItem(id); setItens(p=>p.filter(x=>x.id!==id))
  }
  async function conclude() {
    if (!window.confirm('Marcar processo como concluído?')) return
    await concludeProcesso(processo.id); onUpdate()
  }

  const corTipo = processo.tipo==='onboarding' ? '#22c55e' : '#f97316'

  return (
    <div className="table-card" style={{padding:'16px 20px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,fontWeight:700,color:corTipo,textTransform:'uppercase',letterSpacing:'0.05em'}}>
            {processo.tipo==='onboarding'?'✅ Onboarding':'🚪 Offboarding'}
          </span>
          {concluido
            ? <span className="badge badge-green" style={{fontSize:10}}>Concluído</span>
            : <span className="badge badge-indigo" style={{fontSize:10}}>Em andamento</span>
          }
          {processo.responsavel&&<span style={{fontSize:11,color:'var(--text-muted)'}}>Resp: {processo.responsavel}</span>}
        </div>
        <span style={{fontSize:11,color:'var(--text-muted)'}}>Início: {fmtData(processo.data_inicio)}{processo.data_conclusao&&` · Conclusão: ${fmtData(processo.data_conclusao)}`}</span>
      </div>

      {/* Barra progresso */}
      <div style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:4}}>
          <span>{concluidos}/{total} itens concluídos</span>
          <span style={{fontWeight:700,color:pctProg===100?'#22c55e':'var(--accent)'}}>{pctProg}%</span>
        </div>
        <div style={{height:6,borderRadius:99,background:'var(--surface-2)',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pctProg}%`,background:pctProg===100?'#22c55e':'var(--accent)',transition:'width 0.3s'}}/>
        </div>
      </div>

      {/* Checklist */}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {itens.sort((a,b)=>a.ordem-b.ordem).map(item=>(
          <div key={item.id} style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={item.concluido} onChange={()=>toggle(item)}
              style={{width:16,height:16,accentColor:'#22c55e',cursor:'pointer',flexShrink:0}}/>
            <span style={{fontSize:13,flex:1,color:item.concluido?'var(--text-muted)':'var(--text)',
              textDecoration:item.concluido?'line-through':'none'}}>
              {item.descricao}
            </span>
            {!concluido&&<button onClick={()=>removeItem(item.id)}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',padding:2,opacity:0.5,display:'flex'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}>
              <Trash2 size={11}/>
            </button>}
          </div>
        ))}

        {/* Adicionar item */}
        {!concluido&&(
          addingItem
            ? <div style={{display:'flex',gap:6,marginTop:4}}>
                <input className="form-input" style={{flex:1,padding:'5px 10px',fontSize:12}}
                  value={novoItem} onChange={e=>setNovoItem(e.target.value)}
                  placeholder="Novo item do checklist..."
                  onKeyDown={e=>{if(e.key==='Enter')addItem(); if(e.key==='Escape')setAdding(false)}}
                  autoFocus/>
                <button className="btn btn-primary btn-sm" style={{fontSize:11,padding:'4px 10px'}} onClick={addItem}>✓</button>
                <button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>{setAdding(false);setNovoItem('')}}>✕</button>
              </div>
            : <button className="btn btn-ghost btn-sm" style={{fontSize:11,alignSelf:'flex-start',marginTop:4,display:'flex',alignItems:'center',gap:4}}
                onClick={()=>setAdding(true)}>
                <Plus size={11}/> Adicionar item
              </button>
        )}
      </div>

      {/* Ação concluir */}
      {!concluido&&pctProg===100&&(
        <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
          <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={conclude}>
            <CheckCircle size={14}/> Marcar processo como concluído
          </button>
        </div>
      )}
    </div>
  )
}

// ── SEÇÃO TREINAMENTOS DO COLABORADOR ─────────────────────
function TreinamentosColaborador({ colaborador_id, showToast }) {
  const [progressos, setProgressos]   = useState([])
  const [treinamentos, setTreinamentos] = useState([])
  const [loading, setLoading]          = useState(true)
  const STATUS_TREI = [
    {v:'nao_iniciado', l:'Não iniciado', cls:'badge-amber'},
    {v:'em_andamento', l:'Em andamento', cls:'badge-indigo'},
    {v:'concluido',    l:'Concluído',    cls:'badge-green'},
  ]
  const hoje = new Date().toISOString().slice(0,10)

  useEffect(()=>{
    Promise.all([getProgressoColab(colaborador_id), getTreinamentos()])
      .then(([p,t])=>{ setProgressos(p); setTreinamentos(t) })
      .finally(()=>setLoading(false))
  },[colaborador_id])

  async function handleUpdate(treinamento_id, status) {
    const dc = status==='concluido' ? hoje : null
    const s = await upsertProgresso(colaborador_id, treinamento_id, status, dc)
    setProgressos(p=>{ const ex=p.find(x=>x.treinamento_id===treinamento_id); return ex?p.map(x=>x.treinamento_id===treinamento_id?s:x):[...p,s] })
    showToast('Progresso atualizado!')
  }

  if (loading) return <div style={{padding:20}}><div className="spinner"/></div>

  // Treinamentos sem progresso
  const idsComProgresso = progressos.map(p=>p.treinamento_id)
  const semProgresso = treinamentos.filter(t=>!idsComProgresso.includes(t.id))

  const todos = [
    ...progressos.map(p=>({...p.rh_treinamentos, _status:p.status, _prog:p})),
    ...semProgresso.map(t=>({...t, _status:'nao_iniciado', _prog:null}))
  ]

  if (todos.length===0) return <p style={{fontSize:13,color:'var(--text-muted)'}}>Nenhum treinamento disponível.</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {todos.map(t=>{
        const s = STATUS_TREI.find(x=>x.v===t._status)||STATUS_TREI[0]
        return (
          <div key={t.id} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{t.titulo}</span>
                {t.obrigatorio&&<span style={{fontSize:9,background:'#ef444420',color:'#ef4444',border:'1px solid #ef444440',borderRadius:3,padding:'1px 5px',fontWeight:700}}>OBRIG.</span>}
              </div>
              {t.descricao&&<div style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.descricao}</div>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <select className="form-select" style={{padding:'4px 8px',fontSize:11,width:'auto'}}
                value={t._status}
                onChange={e=>handleUpdate(t.id,e.target.value)}>
                {STATUS_TREI.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
              {t.link&&<a href={t.link} target="_blank" rel="noreferrer" style={{color:'var(--accent)',display:'flex'}}><ExternalLink size={13}/></a>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function RH() {
  const [aba, setAba]             = useState('dashboard')
  const [grupos, setGrupos]       = useState([])
  const [colaboradores, setColabs]= useState([])
  const [ausenciasAll, setAusAll] = useState([])
  const [avaliacoes, setAvalAll]  = useState([])
  const [okrs, setOKRs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [perfil, setPerfil]       = useState(null)
  const [modalColab, setModalColab]   = useState(false)
  const [editColab, setEditColab]     = useState(null)
  const [modalGrupo, setModalGrupo]   = useState(false)
  const [editGrupo, setEditGrupo]     = useState(null)
  const [modalOKR, setModalOKR]       = useState(false)
  const [editOKR, setEditOKR]         = useState(null)
  const [modalKR, setModalKR]         = useState(null) // {kr, okr_id}
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [busca, setBusca]             = useState('')
  const [filtroOKRTipo, setFiltroOKRTipo] = useState('')
  const [filtroOKRStatus, setFiltroOKRStatus] = useState('ativo')
  const [modoAusencia, setModoAusencia] = useState('ciclo') // 'ciclo' | 'mes' | 'custom'
  const [mesRefAusencia, setMesRefAusencia] = useState(()=>new Date().toISOString().slice(0,7))
  const [dataIniCustom, setDataIniCustom] = useState(()=>{
    const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10)
  })
  const [dataFimCustom, setDataFimCustom] = useState(()=>new Date().toISOString().slice(0,10))
  const [filtroAusenciaTipo, setFiltroAusenciaTipo] = useState('')
  const [toast, showToast]            = useToast()

  async function carregar() {
    const [gs,cs,aus,avs,os] = await Promise.all([
      getGrupos(), getColaboradores(), getTodasAusencias(), getTodasAvaliacoes(), getOKRs()
    ])
    setGrupos(gs); setColabs(cs); setAusAll(aus); setAvalAll(avs); setOKRs(os)
  }
  useEffect(()=>{ carregar().finally(()=>setLoading(false)) },[])

  async function handleSaveColab(c) {
    const s=await saveColaborador(c)
    if(c.id)setColabs(p=>p.map(x=>x.id===c.id?s:x)); else setColabs(p=>[...p,s])
    setModalColab(false);setEditColab(null);showToast('Colaborador salvo!')
  }
  async function handleDelColab(id) {
    if(!window.confirm('Excluir colaborador?'))return
    await deleteColaborador(id); setColabs(p=>p.filter(x=>x.id!==id)); showToast('Removido!')
  }
  async function handleSaveGrupo(g) {
    const s=await saveGrupo(g)
    if(g.id)setGrupos(p=>p.map(x=>x.id===g.id?s:x)); else setGrupos(p=>[...p,s])
    setModalGrupo(false);setEditGrupo(null);showToast('Grupo salvo!')
  }
  async function handleDelGrupo(id) {
    if(!window.confirm('Excluir grupo?'))return
    await deleteGrupo(id); setGrupos(p=>p.filter(x=>x.id!==id)); showToast('Removido!')
  }
  async function handleSaveOKR(o) {
    const s=await saveOKR(o)
    if(o.id)setOKRs(p=>p.map(x=>x.id===o.id?s:x)); else setOKRs(p=>[s,...p])
    setModalOKR(false);setEditOKR(null);showToast('OKR salvo!')
  }
  async function handleDelOKR(id) {
    if(!window.confirm('Excluir OKR e todos os Key Results?'))return
    await deleteOKR(id); setOKRs(p=>p.filter(x=>x.id!==id)); showToast('Removido!')
  }
  async function handleSaveKR(kr) {
    const s=await saveKR(kr)
    setOKRs(p=>p.map(o=>o.id===kr.okr_id?{...o,rh_key_results:kr.id?(o.rh_key_results||[]).map(x=>x.id===kr.id?s:x):[...(o.rh_key_results||[]),s]}:o))
    setModalKR(null);showToast('Key Result salvo!')
  }
  async function handleDelKR(id, okr_id) {
    if(!window.confirm('Excluir Key Result?'))return
    await deleteKR(id)
    setOKRs(p=>p.map(o=>o.id===okr_id?{...o,rh_key_results:(o.rh_key_results||[]).filter(x=>x.id!==id)}:o))
    showToast('Removido!')
  }
  async function handleUpdateProgresso(id, valor, okr_id) {
    const s=await updateKRProgresso(id,valor)
    setOKRs(p=>p.map(o=>o.id===okr_id?{...o,rh_key_results:(o.rh_key_results||[]).map(x=>x.id===id?s:x)}:o))
    showToast('Progresso atualizado!')
  }

  // ── EXPORTAÇÕES ─────────────────────────────────────────
  // Calcula o intervalo de datas para a aba de Ausências conforme o modo.
  function calcularPeriodoAusencia() {
    if (modoAusencia === 'custom') {
      const labelIni = dataIniCustom ? fmtData(dataIniCustom) : '—'
      const labelFim = dataFimCustom ? fmtData(dataFimCustom) : '—'
      return {
        inicio: dataIniCustom || '0000-01-01',
        fim: dataFimCustom || '9999-12-31',
        label: `${labelIni} até ${labelFim}`,
        sufixoArquivo: `${dataIniCustom||'inicio'}_a_${dataFimCustom||'fim'}`
      }
    }
    const [a_ano, a_mes] = mesRefAusencia.split('-')
    const ano = Number(a_ano), mes = Number(a_mes)
    if (modoAusencia === 'ciclo') {
      // Ciclo de ponto: dia 26 do mês anterior até dia 25 do mês de referência.
      const mesAnt = mes === 1 ? 12 : mes - 1
      const anoAnt = mes === 1 ? ano - 1 : ano
      const inicio = `${anoAnt}-${String(mesAnt).padStart(2,'0')}-26`
      const fim    = `${ano}-${String(mes).padStart(2,'0')}-25`
      return {
        inicio, fim,
        label: `Ciclo de ponto: ${fmtData(inicio)} a ${fmtData(fim)} (referente a ${NOMES_MES[mes-1]} de ${ano})`,
        sufixoArquivo: `ciclo_${a_ano}-${a_mes}`
      }
    }
    // 'mes' — mês cheio
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return {
      inicio: `${a_ano}-${a_mes}-01`,
      fim:    `${a_ano}-${a_mes}-${String(ultimoDia).padStart(2,'0')}`,
      label: `${NOMES_MES[mes-1]} de ${ano}`,
      sufixoArquivo: `${a_ano}-${a_mes}`
    }
  }

  function handleExportAusencias(formato) {
    const periodo = calcularPeriodoAusencia()
    const aus = ausenciasAll.filter(a=>{
      // ausência intersecta o período selecionado
      if (a.data_fim < periodo.inicio || a.data_inicio > periodo.fim) return false
      if (filtroAusenciaTipo && a.tipo !== filtroAusenciaTipo) return false
      return true
    }).sort((a,b)=>a.data_inicio.localeCompare(b.data_inicio))

    if (aus.length === 0) {
      showToast('Nenhuma ausência no período selecionado.', 'error')
      return
    }

    const cabecalho = ['Colaborador','Cargo','Grupo','Tipo','Data início','Data fim','Dias','Status','Observações']
    const linhas = [cabecalho, ...aus.map(a=>{
      const colab = colaboradores.find(c=>c.id===a.colaborador_id)
      const ta = TIPO_AUSENCIA.find(t=>t.v===a.tipo)
      const sa = STATUS_AUSENCIA.find(s=>s.v===a.status)
      return [
        a.rh_colaboradores?.nome || colab?.nome || '—',
        colab?.cargo || '—',
        a.rh_colaboradores?.rh_grupos?.nome || '—',
        ta?.l || a.tipo,
        fmtData(a.data_inicio),
        fmtData(a.data_fim),
        diffDias(a.data_inicio, a.data_fim),
        sa?.l || a.status,
        a.observacoes || ''
      ]
    })]

    exportar(formato, linhas, {
      titulo: 'Relatório de Ausências',
      subtitulo: `${periodo.label} · ${aus.length} registro${aus.length!==1?'s':''}`,
      nomeBase: `ausencias_${periodo.sufixoArquivo}`,
      colWidths: [28,22,18,14,12,12,8,16,40],
      abaXlsx: 'Ausências'
    })
    showToast(`${aus.length} ausência${aus.length!==1?'s':''} exportada${aus.length!==1?'s':''}.`)
  }

  function handleExportOKRs(formato) {
    if (okrsFiltrados.length === 0) {
      showToast('Nenhum OKR para exportar com os filtros atuais.', 'error')
      return
    }
    const cabecalho = ['Título','Tipo','Responsável / Grupo','Período','Status','Progresso geral','Key Results']
    const linhas = [cabecalho, ...okrsFiltrados.map(okr=>{
      const krs = okr.rh_key_results || []
      const progressoGeral = krs.length
        ? Math.round(krs.reduce((s,kr)=>s+pct(kr.valor_atual, kr.valor_inicial, kr.valor_alvo), 0) / krs.length)
        : 0
      const responsavel = okr.tipo === 'individual'
        ? (okr.rh_colaboradores?.nome || '—')
        : (okr.rh_grupos?.nome || '—')
      const krResumo = krs.length
        ? krs.map(kr=>`${kr.descricao}: ${kr.valor_atual}/${kr.valor_alvo}${kr.unidade||''} (${pct(kr.valor_atual,kr.valor_inicial,kr.valor_alvo)}%)`).join(' | ')
        : '—'
      const sa = STATUS_OKR.find(s=>s.v===okr.status)
      return [
        okr.titulo,
        okr.tipo === 'individual' ? 'Individual' : 'Grupo',
        responsavel,
        okr.periodo || '—',
        sa?.l || okr.status,
        `${progressoGeral}%`,
        krResumo
      ]
    })]
    exportar(formato, linhas, {
      titulo: 'Relatório de OKRs',
      subtitulo: `${okrsFiltrados.length} OKR${okrsFiltrados.length!==1?'s':''}`,
      nomeBase: 'okrs',
      colWidths: [40,12,24,16,14,14,80],
      abaXlsx: 'OKRs'
    })
    showToast(`${okrsFiltrados.length} OKR${okrsFiltrados.length!==1?'s':''} exportado${okrsFiltrados.length!==1?'s':''}.`)
  }

  async function handleExportTreinamentos(formato) {
    const progressos = await getTodosProgressosTreinamento()
    if (progressos.length === 0) {
      showToast('Nenhum registro de treinamento.', 'error')
      return
    }
    const STATUS_TRE_LBL = {nao_iniciado:'Não iniciado', em_andamento:'Em andamento', concluido:'Concluído'}
    const cabecalho = ['Colaborador','Cargo','Grupo','Treinamento','Tipo','Obrigatório','Status','Data conclusão']
    const linhas = [cabecalho, ...progressos.map(p=>[
      p.rh_colaboradores?.nome || '—',
      p.rh_colaboradores?.cargo || '—',
      p.rh_colaboradores?.rh_grupos?.nome || '—',
      p.rh_treinamentos?.titulo || '—',
      p.rh_treinamentos?.tipo || '—',
      p.rh_treinamentos?.obrigatorio ? 'Sim' : 'Não',
      STATUS_TRE_LBL[p.status] || p.status,
      p.data_conclusao ? fmtData(p.data_conclusao) : '—'
    ])]
    exportar(formato, linhas, {
      titulo: 'Relatório de Treinamentos',
      subtitulo: `${progressos.length} registro${progressos.length!==1?'s':''} de progresso`,
      nomeBase: 'treinamentos',
      colWidths: [28,22,18,32,12,12,16,14],
      abaXlsx: 'Treinamentos'
    })
    showToast(`${progressos.length} registro${progressos.length!==1?'s':''} exportado${progressos.length!==1?'s':''}.`)
  }

  if (loading) return <div className="loading"><div className="spinner"/></div>

  if (perfil) return (
    <PerfilColaborador
      colab={perfil} grupos={grupos} colaboradores={colaboradores}
      onEdit={c=>{setEditColab(c);setModalColab(true)}}
      onBack={()=>setPerfil(null)}
      showToast={showToast}
    />
  )

  const colabsFiltrados = colaboradores.filter(c=>{
    if(filtroStatus&&c.status!==filtroStatus)return false
    if(filtroGrupo&&c.grupo_id!==filtroGrupo)return false
    if(busca&&!(c.nome.toLowerCase().includes(busca.toLowerCase())||c.cargo.toLowerCase().includes(busca.toLowerCase())))return false
    return true
  })
  const okrsFiltrados = okrs.filter(o=>{
    if(filtroOKRTipo&&o.tipo!==filtroOKRTipo)return false
    if(filtroOKRStatus&&o.status!==filtroOKRStatus)return false
    return true
  })

  const hoje = new Date().toISOString().slice(0,10)
  const ativos = colaboradores.filter(c=>c.status==='ativo').length
  const ausentes = ausenciasAll.filter(a=>a.data_inicio<=hoje&&a.data_fim>=hoje).length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>RH</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{ativos} ativo{ativos!==1?'s':''} · {grupos.length} grupos</p>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {aba==='equipe'&&<button className="btn btn-primary" onClick={()=>setModalColab(true)}><Plus size={14}/> Colaborador</button>}
          {aba==='grupos'&&<button className="btn btn-primary" onClick={()=>setModalGrupo(true)}><Plus size={14}/> Grupo</button>}
          {aba==='okrs'&&<>
            <BotaoExportar onExportar={handleExportOKRs} disabled={okrsFiltrados.length===0}/>
            <button className="btn btn-primary" onClick={()=>setModalOKR(true)}><Plus size={14}/> Novo OKR</button>
          </>}
          {aba==='ausencias'&&<BotaoExportar onExportar={handleExportAusencias}/>}
          {aba==='treinamentos'&&<BotaoExportar onExportar={handleExportTreinamentos}/>}
        </div>
      </div>

      {/* Abas */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:20}}>
        {[
          {k:'dashboard',l:'Dashboard',    icon:BarChart2},
          {k:'equipe',   l:'Equipe',       icon:Users},
          {k:'grupos',   l:'Grupos',       icon:UserCheck},
          {k:'okrs',     l:'OKRs',         icon:Target},
          {k:'ausencias',l:'Ausências',    icon:Clock},
          {k:'treinamentos',l:'Treinamentos', icon:GraduationCap},
        ].map(({k,l,icon:Icon})=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{display:'flex',alignItems:'center',gap:5,padding:'9px 16px',fontSize:13,fontWeight:aba===k?700:400,cursor:'pointer',background:'none',border:'none',borderBottom:aba===k?'2px solid var(--accent)':'2px solid transparent',color:aba===k?'var(--accent)':'var(--text-muted)'}}>
            <Icon size={14} strokeWidth={1.5}/>{l}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {aba==='dashboard'&&(
        <DashboardRH colaboradores={colaboradores} grupos={grupos} ausenciasAll={ausenciasAll} avaliacoes={avaliacoes} okrs={okrs}/>
      )}

      {/* EQUIPE */}
      {aba==='equipe'&&(
        <div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
            <input className="search-input" style={{flex:'1 1 200px'}} placeholder="Buscar por nome ou cargo..." value={busca} onChange={e=>setBusca(e.target.value)}/>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>{STATUS_COLAB.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)}>
              <option value="">Todos os grupos</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          {colabsFiltrados.length===0
            ?<div className="empty-state"><p>Nenhum colaborador encontrado.</p></div>
            :<div className="table-card"><table>
              <thead><tr><th>Nome</th><th>Cargo</th><th>Grupo</th><th>Contrato</th><th>Status</th><th>Entrada</th><th></th></tr></thead>
              <tbody>{colabsFiltrados.map(c=>{
                const sc=STATUS_COLAB.find(s=>s.v===c.status)||STATUS_COLAB[0]
                const grp=grupos.find(g=>g.id===c.grupo_id)
                const ultAval = avaliacoes.filter(av=>av.colaborador_id===c.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]
                return <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>setPerfil(c)}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td><div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="td-strong">{c.nome}</span>
                    {ultAval&&<span style={{fontSize:11,fontWeight:700,color:notaCor(ultAval.nota_geral)}}>★{Number(ultAval.nota_geral).toFixed(1)}</span>}
                  </div></td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.cargo}</td>
                  <td style={{fontSize:12}}>{grp?.nome||<span className="td-muted">—</span>}</td>
                  <td><span className="badge badge-indigo" style={{fontSize:10}}>{c.tipo_contrato}</span></td>
                  <td><span className={`badge ${sc.cls}`} style={{fontSize:10}}>{sc.l}</span></td>
                  <td className="td-muted" style={{fontSize:12}}>{fmtData(c.data_entrada)}</td>
                  <td onClick={e=>e.stopPropagation()}><div className="actions-cell">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditColab(c);setModalColab(true)}}><Pencil size={13}/></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelColab(c.id)}><Trash2 size={13}/></button>
                  </div></td>
                </tr>
              })}</tbody>
            </table></div>
          }
        </div>
      )}

      {/* GRUPOS */}
      {aba==='grupos'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
          {grupos.map(g=>{
            const membros=colaboradores.filter(c=>c.grupo_id===g.id&&c.status==='ativo')
            const avsGrupo=avaliacoes.filter(av=>membros.some(c=>c.id===av.colaborador_id))
            const mediaGrupo=avsGrupo.length?avsGrupo.reduce((s,av)=>s+Number(av.nota_geral),0)/avsGrupo.length:null
            return <div key={g.id} className="table-card" style={{padding:'16px 20px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{g.nome}</span>
                    {mediaGrupo&&<span style={{fontSize:12,fontWeight:800,color:notaCor(mediaGrupo)}}>★{mediaGrupo.toFixed(1)}</span>}
                  </div>
                  {g.responsavel&&<div style={{fontSize:12,color:'var(--text-muted)'}}>Resp: {g.responsavel}</div>}
                  {g.descricao&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{g.descricao}</div>}
                </div>
                <div className="actions-cell">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{setEditGrupo(g);setModalGrupo(true)}}><Pencil size={13}/></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelGrupo(g.id)}><Trash2 size={13}/></button>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                <Users size={13} color="var(--accent)"/>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{membros.length} membro{membros.length!==1?'s':''} ativo{membros.length!==1?'s':''}</span>
              </div>
              {membros.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}}>
                {membros.slice(0,5).map(m=><span key={m.id} style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 8px',color:'var(--text-muted)',cursor:'pointer'}} onClick={()=>setPerfil(m)}>{m.nome.split(' ')[0]}</span>)}
                {membros.length>5&&<span style={{fontSize:11,color:'var(--text-muted)'}}>+{membros.length-5}</span>}
              </div>}
            </div>
          })}
          {grupos.length===0&&<div className="empty-state"><p>Nenhum grupo cadastrado.</p></div>}
        </div>
      )}

      {/* OKRs */}
      {aba==='okrs'&&(
        <div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroOKRStatus} onChange={e=>setFiltroOKRStatus(e.target.value)}>
              <option value="">Todos os status</option>{STATUS_OKR.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroOKRTipo} onChange={e=>setFiltroOKRTipo(e.target.value)}>
              <option value="">Individual e Grupo</option>
              <option value="individual">Individual</option>
              <option value="grupo">Grupo</option>
            </select>
          </div>
          {okrsFiltrados.length===0
            ?<div className="empty-state"><p>Nenhum OKR encontrado.</p></div>
            :okrsFiltrados.map(okr=>(
              <CardOKR key={okr.id} okr={okr}
                onEdit={o=>{setEditOKR(o);setModalOKR(true)}}
                onDelete={handleDelOKR}
                onEditKR={(kr,okr_id)=>setModalKR({kr,okr_id})}
                onDeleteKR={handleDelKR}
                onUpdateProgresso={handleUpdateProgresso}
              />
            ))
          }
        </div>
      )}

      {/* AUSÊNCIAS GERAL */}
      {aba==='ausencias'&&(()=>{
        const periodo = calcularPeriodoAusencia()
        const ausDoPeriodo = ausenciasAll.filter(a=>{
          if (a.data_fim < periodo.inicio || a.data_inicio > periodo.fim) return false
          if (filtroAusenciaTipo && a.tipo !== filtroAusenciaTipo) return false
          return true
        }).sort((a,b)=>a.data_inicio.localeCompare(b.data_inicio))

        const MODOS = [
          {v:'ciclo',  l:'Ciclo de ponto (26→25)'},
          {v:'mes',    l:'Mês cheio'},
          {v:'custom', l:'Personalizado'},
        ]

        return (
          <div>
            {/* Seletor de modo */}
            <div style={{display:'flex',gap:0,marginBottom:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:3,width:'fit-content'}}>
              {MODOS.map(m=>(
                <button key={m.v} onClick={()=>setModoAusencia(m.v)}
                  style={{
                    padding:'6px 14px',fontSize:12,fontWeight:modoAusencia===m.v?700:500,cursor:'pointer',
                    background:modoAusencia===m.v?'var(--surface)':'transparent',
                    color:modoAusencia===m.v?'var(--text)':'var(--text-muted)',
                    border:'none',borderRadius:4
                  }}>{m.l}</button>
              ))}
            </div>

            {/* Filtros do modo escolhido */}
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
              {modoAusencia !== 'custom' && (
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>Mês de referência:</span>
                  <input type="month" className="form-input" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
                    value={mesRefAusencia} onChange={e=>setMesRefAusencia(e.target.value)}/>
                </div>
              )}
              {modoAusencia === 'custom' && (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:12,color:'var(--text-muted)'}}>De:</span>
                    <input type="date" className="form-input" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
                      value={dataIniCustom} onChange={e=>setDataIniCustom(e.target.value)}/>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:12,color:'var(--text-muted)'}}>Até:</span>
                    <input type="date" className="form-input" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
                      value={dataFimCustom} onChange={e=>setDataFimCustom(e.target.value)}/>
                  </div>
                </>
              )}
              <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}}
                value={filtroAusenciaTipo} onChange={e=>setFiltroAusenciaTipo(e.target.value)}>
                <option value="">Todos os tipos</option>
                {TIPO_AUSENCIA.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <div style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)',textAlign:'right'}}>
                {periodo.label}<br/>
                <strong style={{color:'var(--text)'}}>{ausDoPeriodo.length}</strong> registro{ausDoPeriodo.length!==1?'s':''}
              </div>
            </div>

            {ausDoPeriodo.length===0
              ?<div className="empty-state"><p>Nenhuma ausência no período selecionado.</p></div>
              :<div className="table-card"><table>
                <thead><tr><th>Colaborador</th><th>Grupo</th><th>Tipo</th><th>Status</th><th>Início</th><th>Fim</th><th>Dias</th></tr></thead>
                <tbody>{ausDoPeriodo.map(a=>{
                  const ta=TIPO_AUSENCIA.find(t=>t.v===a.tipo); const sa=STATUS_AUSENCIA.find(s=>s.v===a.status)||STATUS_AUSENCIA[0]
                  return <tr key={a.id}>
                    <td className="td-strong" style={{cursor:'pointer'}} onClick={()=>setPerfil(colaboradores.find(c=>c.id===a.colaborador_id))}>{a.rh_colaboradores?.nome||'—'}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{a.rh_colaboradores?.rh_grupos?.nome||'—'}</td>
                    <td style={{fontSize:12}}>{ta?.l||a.tipo}</td>
                    <td><span className={`badge ${sa.cls}`} style={{fontSize:10}}>{sa.l}</span></td>
                    <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_inicio)}</td>
                    <td className="td-muted" style={{fontSize:12}}>{fmtData(a.data_fim)}</td>
                    <td style={{fontSize:12,color:'var(--accent)',fontWeight:700}}>{diffDias(a.data_inicio,a.data_fim)}</td>
                  </tr>
                })}</tbody>
              </table></div>
            }
          </div>
        )
      })()}

      {/* TREINAMENTOS */}
      {aba==='treinamentos'&&(
        <AbaTreinamentos grupos={grupos} showToast={showToast}/>
      )}

      {/* Modais */}
      {modalColab&&<ModalColaborador colab={editColab} grupos={grupos} onSave={handleSaveColab} onClose={()=>{setModalColab(false);setEditColab(null)}}/>}
      {modalGrupo&&<ModalGrupo grupo={editGrupo} onSave={handleSaveGrupo} onClose={()=>{setModalGrupo(false);setEditGrupo(null)}}/>}
      {modalOKR&&<ModalOKR okr={editOKR} colaboradores={colaboradores} grupos={grupos} onSave={handleSaveOKR} onClose={()=>{setModalOKR(false);setEditOKR(null)}}/>}
      {modalKR&&<ModalKR kr={modalKR.kr} okr_id={modalKR.okr_id} onSave={handleSaveKR} onClose={()=>setModalKR(null)}/>}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
