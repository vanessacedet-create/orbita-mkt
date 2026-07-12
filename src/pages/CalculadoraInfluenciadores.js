import { useMemo, useState } from 'react'
import { Calculator, Copy, ExternalLink, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

const initial = {
  nome: '', arroba: '', plataforma: 'Instagram', perfil_url: '', seguidores: '',
  visualizacoes_medias: '', alcance_medio: '', engajamento_socialcat: '',
  socialcat_url: '', socialcat_consultado_em: new Date().toISOString().slice(0, 10),
  afinidade_editorial: 3, qualidade_publico: 3, qualidade_conteudo: 3,
  profissionalismo: 3, potencial_comercial: 3, seguranca_marca: 3,
  objetivo: 'Vendas', selo: 'Sétimo Selo', produto_campanha: '',
  quantidade_stories: 3, quantidade_videos: 1, quantidade_posts: 0,
  custo_produtos: '', frete: '', cpm_visualizacoes: 35, comissao_percentual: 10,
  direitos_uso: 'orgânico', exclusividade: 'sem exclusividade', observacoes: '',
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function notaEngajamento(seguidores, taxa) {
  const s = num(seguidores)
  let excelente = 6
  if (s > 500000) excelente = 1.5
  else if (s > 200000) excelente = 2
  else if (s > 50000) excelente = 3
  else if (s > 10000) excelente = 4
  return clamp((num(taxa) / excelente) * 10, 0, 10)
}

function Field({ label, children }) {
  return <label className="calc-field"><span>{label}</span>{children}</label>
}

function Rating({ label, value, onChange }) {
  return <Field label={label}><div className="calc-rating">{[1,2,3,4,5].map(n => (
    <button key={n} type="button" className={n <= value ? 'active' : ''} onClick={() => onChange(n)}>{n}</button>
  ))}</div></Field>
}

function Card({ title, value, description, recommended, commission, children }) {
  return <article className={`calc-proposal ${recommended ? 'recommended' : ''}`}>
    {recommended && <small>RECOMENDADA</small>}
    <h3>{title}</h3><p>{description}</p><strong>{moeda.format(value)}</strong>
    <div className="calc-commission">+ {commission}% de comissão sobre vendas</div>
    <ul>{children}</ul>
  </article>
}

export default function CalculadoraInfluenciadores() {
  const [form, setForm] = useState(initial)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  const result = useMemo(() => {
    const engagement = notaEngajamento(form.seguidores, form.engajamento_socialcat)
    const reach = num(form.visualizacoes_medias) || num(form.alcance_medio) || num(form.seguidores) * 0.12
    const reachScore = clamp((reach / Math.max(num(form.seguidores), 1)) * 40, 0, 10)
    const qualitative = num(form.afinidade_editorial) * 4 + num(form.qualidade_publico) * 3 +
      num(form.qualidade_conteudo) * 2 + num(form.profissionalismo) * 2 +
      num(form.potencial_comercial) * 2 + num(form.seguranca_marca) * 2
    const score = Math.round(clamp(engagement * 2 + reachScore * 1.5 + qualitative, 0, 100))
    const complexity = num(form.quantidade_videos) * 1.3 + num(form.quantidade_posts) * 0.8 + num(form.quantidade_stories) * 0.18
    const rights = form.direitos_uso === 'anúncios 90 dias' ? 1.5 : form.direitos_uso === 'anúncios 30 dias' ? 1.3 : form.direitos_uso === 'repost da editora' ? 1.1 : 1
    const exclusivity = form.exclusividade === '90 dias' ? 1.4 : form.exclusividade === '30 dias' ? 1.2 : form.exclusividade === '15 dias' ? 1.1 : 1
    const fee = Math.max((reach / 1000) * num(form.cpm_visualizacoes), 120) * Math.max(complexity, .7) *
      (.8 + num(form.afinidade_editorial) * .12) * (.85 + num(form.qualidade_conteudo) * .07) *
      (.8 + clamp(engagement / 10, 0, 1) * .6) * rights * exclusivity
    const costs = num(form.custo_produtos) + num(form.frete)
    const classification = score >= 80 ? 'Parceiro estratégico' : score >= 60 ? 'Parceiro recomendado' : score >= 40 ? 'Potencial para teste' : 'Baixa prioridade'
    return { engagement, reach, score, classification, p1: costs, p2: Math.max(fee * .72 + costs, costs), p3: Math.max(fee * 1.65 + costs, fee * .72 + costs), recommended: score >= 80 ? 3 : score >= 55 ? 2 : 1 }
  }, [form])

  async function save() {
    if (!form.nome.trim() || !num(form.engajamento_socialcat)) return setMessage('Preencha o nome e a taxa do The Social Cat.')
    setSaving(true); setMessage('')
    const payload = {
      nome_influenciador: form.nome.trim(), arroba: form.arroba, plataforma: form.plataforma,
      perfil_url: form.perfil_url || null, seguidores: num(form.seguidores), visualizacoes_medias: num(form.visualizacoes_medias),
      alcance_medio: num(form.alcance_medio), engajamento_socialcat: num(form.engajamento_socialcat),
      socialcat_url: form.socialcat_url || null, socialcat_consultado_em: form.socialcat_consultado_em || null,
      afinidade_editorial: num(form.afinidade_editorial), qualidade_publico: num(form.qualidade_publico),
      qualidade_conteudo: num(form.qualidade_conteudo), profissionalismo: num(form.profissionalismo),
      potencial_comercial: num(form.potencial_comercial), seguranca_marca: num(form.seguranca_marca),
      objetivo: form.objetivo, selo: form.selo, produto_campanha: form.produto_campanha || null,
      quantidade_stories: num(form.quantidade_stories), quantidade_videos: num(form.quantidade_videos), quantidade_posts: num(form.quantidade_posts),
      custo_produtos: num(form.custo_produtos), frete: num(form.frete), cpm_visualizacoes: num(form.cpm_visualizacoes),
      comissao_percentual: num(form.comissao_percentual), direitos_uso: form.direitos_uso, exclusividade: form.exclusividade,
      pontuacao: result.score, classificacao: result.classification, valor_proposta_1: result.p1,
      valor_proposta_2: result.p2, valor_proposta_3: result.p3, observacoes: form.observacoes || null,
    }
    const { error } = await supabase.from('influenciadores_calculos').insert(payload)
    setSaving(false); setMessage(error ? `Erro ao salvar: ${error.message}` : 'Simulação salva com sucesso.')
  }

  async function copy() {
    await navigator.clipboard.writeText(`${form.nome} — ${form.arroba}\n${result.classification} (${result.score}/100)\nEngajamento The Social Cat: ${num(form.engajamento_socialcat).toFixed(2)}%\n\n1. Experiência inicial: ${moeda.format(result.p1)}\n2. Cachê + performance: ${moeda.format(result.p2)}\n3. Campanha estratégica: ${moeda.format(result.p3)}`)
    setMessage('Resumo copiado.')
  }

  const input = (key, type='text', extra={}) => <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} {...extra} />

  return <div className="calc-page">
    <header><div><h1><Calculator size={26}/> Calculadora de Propostas</h1><p>Exclusiva para influenciadores e creators. Engajamento registrado a partir do The Social Cat.</p></div><button className="btn-primary" onClick={save} disabled={saving}><Save size={15}/> {saving ? 'Salvando...' : 'Salvar'}</button></header>
    <div className="calc-grid"><main>
      <section><h2>1. Influenciador e audiência</h2><div className="fields three">
        <Field label="Nome">{input('nome')}</Field><Field label="@ do perfil">{input('arroba')}</Field>
        <Field label="Plataforma"><select value={form.plataforma} onChange={e => set('plataforma', e.target.value)}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Outra</option></select></Field>
        <Field label="URL do perfil">{input('perfil_url')}</Field><Field label="Seguidores">{input('seguidores','number',{min:0})}</Field>
        <Field label="Visualizações médias">{input('visualizacoes_medias','number',{min:0})}</Field><Field label="Alcance médio">{input('alcance_medio','number',{min:0})}</Field>
      </div></section>
      <section><h2>2. Engajamento — The Social Cat</h2><div className="fields three">
        <Field label="Taxa de engajamento (%)">{input('engajamento_socialcat','number',{min:0,step:.01})}</Field>
        <Field label="Data da consulta">{input('socialcat_consultado_em','date')}</Field>
        <Field label="Link da consulta"><div className="url-field">{input('socialcat_url')}{form.socialcat_url && <a href={form.socialcat_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a>}</div></Field>
      </div></section>
      <section><h2>3. Avaliação qualitativa</h2><div className="fields two">
        <Rating label="Afinidade editorial" value={form.afinidade_editorial} onChange={v => set('afinidade_editorial',v)}/>
        <Rating label="Qualidade do público" value={form.qualidade_publico} onChange={v => set('qualidade_publico',v)}/>
        <Rating label="Qualidade do conteúdo" value={form.qualidade_conteudo} onChange={v => set('qualidade_conteudo',v)}/>
        <Rating label="Profissionalismo" value={form.profissionalismo} onChange={v => set('profissionalismo',v)}/>
        <Rating label="Potencial comercial" value={form.potencial_comercial} onChange={v => set('potencial_comercial',v)}/>
        <Rating label="Segurança de marca" value={form.seguranca_marca} onChange={v => set('seguranca_marca',v)}/>
      </div></section>
      <section><h2>4. Campanha e condições</h2><div className="fields three">
        <Field label="Objetivo"><select value={form.objetivo} onChange={e=>set('objetivo',e.target.value)}>{['Vendas','Divulgação de lançamento','Reconhecimento de marca','Geração de conteúdo','Tráfego para o site'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Selo / unidade"><select value={form.selo} onChange={e=>set('selo',e.target.value)}>{['Sétimo Selo','Ecclesiae','Vide Editorial','Auster','Kírion','Texugo','O Mínimo','Axia','Papillon','Edições Livre','Editoras parceiras'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Produto ou campanha">{input('produto_campanha')}</Field><Field label="Stories">{input('quantidade_stories','number',{min:0})}</Field>
        <Field label="Vídeos / Reels">{input('quantidade_videos','number',{min:0})}</Field><Field label="Posts / carrosséis">{input('quantidade_posts','number',{min:0})}</Field>
        <Field label="Custo dos produtos">{input('custo_produtos','number',{min:0,step:.01})}</Field><Field label="Frete">{input('frete','number',{min:0,step:.01})}</Field>
        <Field label="CPM de referência">{input('cpm_visualizacoes','number',{min:0,step:.01})}</Field><Field label="Comissão (%)">{input('comissao_percentual','number',{min:0,step:.1})}</Field>
        <Field label="Direitos de uso"><select value={form.direitos_uso} onChange={e=>set('direitos_uso',e.target.value)}><option value="orgânico">Orgânico</option><option value="repost da editora">Repost da editora</option><option value="anúncios 30 dias">Anúncios 30 dias</option><option value="anúncios 90 dias">Anúncios 90 dias</option></select></Field>
        <Field label="Exclusividade"><select value={form.exclusividade} onChange={e=>set('exclusividade',e.target.value)}><option value="sem exclusividade">Sem exclusividade</option><option>15 dias</option><option>30 dias</option><option>90 dias</option></select></Field>
      </div><Field label="Observações"><textarea rows="4" value={form.observacoes} onChange={e=>set('observacoes',e.target.value)}/></Field></section>
    </main><aside>
      <section className="diagnostic"><h2>Diagnóstico</h2><strong>{result.score}<small>/100</small></strong><p>{result.classification}</p><div>Engajamento: {num(form.engajamento_socialcat).toFixed(2)}%</div></section>
      <Card title="1. Experiência inicial" value={result.p1} commission={form.comissao_percentual} recommended={result.recommended===1} description="Permuta ou teste inicial com mensuração."><li>Produtos e frete</li><li>Link ou cupom rastreável</li><li>Até 1 vídeo curto</li></Card>
      <Card title="2. Cachê + performance" value={result.p2} commission={form.comissao_percentual} recommended={result.recommended===2} description="Remuneração fixa e incentivo por vendas."><li>{form.quantidade_videos} vídeo(s)</li><li>{form.quantidade_stories} Stories</li><li>{form.quantidade_posts} post(s)</li></Card>
      <Card title="3. Campanha estratégica" value={result.p3} commission={form.comissao_percentual} recommended={result.recommended===3} description="Pacote ampliado para parceiros estratégicos."><li>Planejamento de campanha</li><li>{form.exclusividade}</li><li>{form.direitos_uso}</li></Card>
      <button className="btn-secondary copy" onClick={copy}><Copy size={15}/> Copiar resumo</button>{message && <p className="calc-message">{message}</p>}
    </aside></div>
    <style>{`.calc-page{max-width:1500px;margin:auto;padding:0 0 48px}.calc-page header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.calc-page h1{display:flex;gap:9px;align-items:center;margin:0;color:var(--text);font-size:25px}.calc-page header p,.calc-page section p{color:var(--text-secondary);font-size:13px}.calc-page button{display:flex;align-items:center;justify-content:center;gap:7px}.calc-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(330px,.8fr);gap:16px}.calc-grid main,.calc-grid aside{display:grid;gap:16px;align-content:start}.calc-grid aside{position:sticky;top:16px}.calc-page section,.calc-proposal{background:var(--surface,rgba(15,23,42,.72));border:1px solid var(--border);border-radius:14px;padding:18px}.calc-page h2,.calc-proposal h3{margin:0 0 14px;color:var(--text);font-size:16px}.fields{display:grid;gap:12px;margin-bottom:12px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.calc-field{display:grid;gap:6px}.calc-field>span{font-size:12px;font-weight:700;color:var(--text-secondary)}.calc-field input,.calc-field select,.calc-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid var(--border);background:var(--card-bg);color:var(--text)}.calc-rating{display:flex;gap:6px}.calc-rating button{width:38px;height:36px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary)}.calc-rating button.active{border-color:var(--accent);color:var(--accent);background:rgba(224,96,48,.12)}.url-field{display:flex;gap:7px}.url-field a{display:grid;place-items:center;padding:0 12px;border:1px solid var(--border);border-radius:9px;color:var(--text)}.diagnostic>strong{font-size:34px;color:var(--text)}.diagnostic>strong small{font-size:14px;color:var(--text-secondary)}.diagnostic>p{font-weight:800;color:var(--accent)}.calc-proposal{position:relative}.calc-proposal.recommended{border-color:var(--accent)}.calc-proposal>small{position:absolute;right:12px;top:12px;color:var(--accent);font-weight:800}.calc-proposal>strong{display:block;font-size:26px;color:var(--text);margin:16px 0 4px}.calc-commission{font-size:12px;color:var(--accent);font-weight:700}.calc-proposal ul{color:var(--text-secondary);font-size:12px;line-height:1.8}.copy{width:100%}.calc-message{padding:12px;border-radius:9px;background:rgba(148,163,184,.09)}@media(max-width:1050px){.calc-grid{grid-template-columns:1fr}.calc-grid aside{position:static}}@media(max-width:700px){.fields.three,.fields.two{grid-template-columns:1fr}.calc-page header{flex-direction:column}}`}</style>
  </div>
}
