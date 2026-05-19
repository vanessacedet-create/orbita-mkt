// src/pages/GuiaParcerias.js
import { useState } from 'react'
import { BookOpen, BookMarked, Tag, DollarSign, Users, TrendingUp, ShoppingCart, ChevronRight, Info, AlertTriangle, CheckCircle } from 'lucide-react'

// ── DADOS ──────────────────────────────────────────────────

const TIPOS = [
  {
    num: 1,
    titulo: 'Livraria Virtual Personalizada',
    subtitulo: 'O influenciador tem uma vitrine própria com curadoria de livros do grupo CEDET',
    cor: '#1A3A2A', bg: '#E8F0EC',
    como: [
      'Influenciador indica os livros que recomenda',
      'Página com identidade visual e link próprio',
      'Comissão por cada venda gerada via sua loja',
      'Conteúdo orgânico da loja alimenta o canal',
    ],
    perfis: ['Booktokers', 'Bookstagrammers', 'Educadores'],
    perfis_cor: ['#E6F1FB', '#185FA5'],
    requisito: '600 pedidos no semestre pelo cupom Book Time + aprovação de Vanessa',
    metricas: ['Conversão da loja', 'GMV — volume total vendido', 'Livros mais clicados', 'Pedidos mensais'],
    novo: false,
  },
  {
    num: 2,
    titulo: 'Cupom — Book Time',
    subtitulo: 'Divulgação com cupom de desconto na plataforma Book Time',
    cor: '#1A3A5C', bg: '#EAF0F8',
    como: [
      'Cupom único por influenciador',
      'Influenciador divulga em posts, stories e vídeos',
      'Comissão por uso do cupom',
      'Cupom ativado em até 2 dias úteis após o cadastro',
    ],
    perfis: ['Lifestyle', 'Criadores gerais', 'Booktokers'],
    requisito: 'Porta de entrada e teste de conversão antes da livraria',
    metricas: ['Usos do cupom por mês', 'Total de pedidos no semestre', 'Receita atribuída', 'Ticket médio'],
    novo: false,
  },
  {
    num: 3,
    titulo: 'Cupom — Editoras Próprias',
    subtitulo: 'Divulgação com cupom nos sites das 12 marcas editoriais do grupo CEDET',
    cor: '#8B5E1A', bg: '#FBF3E4',
    como: [
      'Cupom específico para cada editora ou site',
      'Ideal para lançamentos e catálogos nichados',
      'Comissão por uso do cupom',
      'Toda a receita fica dentro do grupo CEDET',
    ],
    perfis: ['Booktokers', 'Educadores', 'Nicho alinhado'],
    requisito: 'Usar quando influenciador quiser focar em uma única marca editorial',
    metricas: ['Usos do cupom por editora', 'Conversão por nicho', 'Receita por marca editorial'],
    novo: false,
  },
  {
    num: 4,
    titulo: 'Parceria de Valor Fixo',
    subtitulo: 'Pagamento fixo por entrega — sem depender de comissão por conversão',
    cor: '#8B3A2A', bg: '#FAF0EE',
    como: [
      'Valor pago por post, vídeo ou ciclo de ativações',
      'Briefing com entregáveis e prazo definidos',
      'Pode combinar com cupom para rastrear retorno',
      'Contrato com cláusulas de exclusividade (opcional)',
    ],
    perfis: ['Alto alcance', 'Brand awareness'],
    requisito: 'Critérios a serem definidos por Vanessa — Gerente de Marketing',
    metricas: ['Alcance e impressões', 'CPM — custo por mil impressões', 'Crescimento de marca', 'ROI'],
    novo: true,
  },
]

const RACI = [
  { atividade: 'Cadastro de novo influenciador no Orbita',              exec: true,  aprova: false, informa: true  },
  { atividade: 'Criação e ativação do cupom (até 2 dias úteis)',         exec: true,  aprova: false, informa: false },
  { atividade: 'Comunicação com o influenciador (metas, progresso)',     exec: true,  aprova: false, informa: false },
  { atividade: 'Checkpoint trimestral — avaliação de progresso',         exec: true,  aprova: false, informa: true  },
  { atividade: 'Revisão de estratégia de divulgação no checkpoint',      exec: true,  aprova: false, informa: false },
  { atividade: 'Avaliação de resultado ao fim do semestre',              exec: true,  aprova: false, informa: true  },
  { atividade: 'Autorização de graduação para livraria virtual',         exec: false, aprova: true,  informa: false },
  { atividade: 'Criação da vitrine da livraria virtual',                 exec: true,  aprova: false, informa: true  },
  { atividade: 'Gestão de casos excepcionais (pausa, problemas etc.)',   exec: true,  aprova: true,  informa: false },
  { atividade: 'Iniciativa e comunicação de encerramento',               exec: true,  aprova: true,  informa: false },
  { atividade: 'Gestão da última campanha antes do encerramento',        exec: true,  aprova: false, informa: true  },
  { atividade: 'Definição de critérios e prazos do tipo 4 (valor fixo)', exec: false, aprova: true,  informa: false },
]

const SCORE = [
  {
    titulo: 'Perfil do criador',
    itens: [
      { label: 'Booktoker / Bookstagrammer', pts: '+3 pts' },
      { label: 'Educador / Professor',        pts: '+2 pts' },
      { label: 'Lifestyle / Comportamento',   pts: '+1 pt'  },
      { label: 'Criador geral',               pts: '0 pts'  },
    ],
  },
  {
    titulo: 'Audiência',
    itens: [
      { label: 'Mais de 500 mil seguidores', pts: '+3 pts' },
      { label: '100 mil – 500 mil',          pts: '+2 pts' },
      { label: '20 mil – 100 mil',           pts: '+1 pt'  },
      { label: 'Menos de 20 mil',            pts: '0 pts'  },
    ],
  },
  {
    titulo: 'Taxa de engajamento',
    itens: [
      { label: 'Acima de 5%',   pts: '+3 pts' },
      { label: '3% – 5%',       pts: '+2 pts' },
      { label: '1% – 3%',       pts: '+1 pt'  },
      { label: 'Abaixo de 1%',  pts: '0 pts'  },
    ],
  },
  {
    titulo: 'Histórico de conversão',
    itens: [
      { label: 'Comprovado (vendas registradas)', pts: '+3 pts' },
      { label: 'Parcial (poucas ativações)',       pts: '+1 pt'  },
      { label: 'Sem histórico',                    pts: '0 pts'  },
    ],
  },
]

const FAIXAS = [
  { pts: '10 – 12 pts', tipo: 'Tipo 1 — Livraria + Tipo 3 — Editoras', obs: 'Perfil ideal — forte alinhamento e audiência qualificada', cor: '#3B6D11', bg: '#EAF3DE' },
  { pts: '7 – 9 pts',   tipo: 'Tipo 3 — Editoras',                      obs: 'Bom alinhamento; adicionar Book Time se perfil for mais amplo', cor: '#854F0B', bg: '#FAEEDA' },
  { pts: '4 – 6 pts',   tipo: 'Tipo 2 — Book Time',                     obs: 'Porta de entrada; avaliar progressão ao longo do semestre', cor: '#185FA5', bg: '#E6F1FB' },
  { pts: '≥ 8 + 500K+', tipo: 'Tipo 4 — Valor Fixo',                   obs: 'Grande alcance; critérios a definir por Vanessa', cor: '#8B3A2A', bg: '#FAF0EE' },
  { pts: '0 – 3 pts',   tipo: 'Avaliar caso a caso',                    obs: 'Baixo potencial inicial — verificar alinhamento antes de ativar', cor: '#5F5E5A', bg: '#F1EFE8' },
]

// ── ESTILOS ────────────────────────────────────────────────

const s = {
  page:       { padding: '2rem', maxWidth: 820, margin: '0 auto', fontFamily: 'inherit' },
  header:     { marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #E4E0D8' },
  h1:         { fontSize: 22, fontWeight: 600, color: '#1A1814', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#A8A298' },
  tabs:       { display: 'flex', gap: 4, background: '#F1EFE8', borderRadius: 8, padding: 4, marginBottom: '1.5rem' },
  tab:        { flex: 1, textAlign: 'center', padding: '7px 10px', fontSize: 13, borderRadius: 6, cursor: 'pointer', color: '#7A7568', border: 'none', background: 'none', transition: 'all .15s' },
  tabActive:  { background: '#fff', color: '#1A1814', fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  section:    { marginBottom: '2rem' },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#A8A298', marginBottom: 12 },
  card:       { border: '1px solid #E4E0D8', borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#fff' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #F0EDE6' },
  cardNum:    { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  cardTitle:  { fontSize: 14, fontWeight: 600, color: '#1A1814', marginBottom: 2 },
  cardSub:    { fontSize: 12, color: '#7A7568' },
  cardBody:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' },
  cardCol:    { padding: '14px 18px', borderRight: '1px solid #F0EDE6', fontSize: 13 },
  colTitle:   { fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#A8A298', marginBottom: 8 },
  li:         { display: 'flex', gap: 8, alignItems: 'flex-start', color: '#7A7568', lineHeight: 1.5, marginBottom: 5, fontSize: 13 },
  dot:        { color: '#A8A298', flexShrink: 0 },
  badge:      { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, marginRight: 4, marginBottom: 4 },
  badgeNew:   { background: '#FAEEDA', color: '#854F0B', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, marginLeft: 8 },
  callout:    { borderRadius: 8, padding: '12px 16px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start', margin: '12px 0', lineHeight: 1.6 },
  funnel:     { background: '#fff', border: '1px solid #E4E0D8', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' },
  funnelRow:  { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderBottom: '1px solid #F0EDE6' },
  fIcon:      { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  cycleGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid #E4E0D8', borderRadius: 10, overflow: 'hidden', background: '#fff', marginBottom: '1.5rem' },
  cycleCol:   { padding: '16px 14px', borderRight: '1px solid #F0EDE6' },
  cycleLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#A8A298', marginBottom: 6 },
  cycleTitle: { fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 5 },
  cycleDesc:  { fontSize: 12, color: '#7A7568', lineHeight: 1.5 },
  cycleBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, marginTop: 8 },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #E4E0D8', borderRadius: 10, overflow: 'hidden' },
  th:         { padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#A8A298', background: '#F7F5F0', borderBottom: '1px solid #E4E0D8', textAlign: 'center' },
  td:         { padding: '11px 14px', borderBottom: '1px solid #F0EDE6', verticalAlign: 'middle', color: '#7A7568' },
  pill:       { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700 },
  scoreGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' },
  scoreCard:  { background: '#fff', border: '1px solid #E4E0D8', borderRadius: 10, padding: 14 },
  criterion:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F0EDE6', fontSize: 13 },
  steps:      { display: 'flex', flexDirection: 'column' },
  step:       { display: 'flex', gap: 12, paddingBottom: 18, position: 'relative' },
  stepNum:    { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, border: '1px solid #E4E0D8', background: '#fff', color: '#7A7568' },
  stepBody:   { flex: 1, paddingTop: 4 },
  stepTitle:  { fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 4 },
  stepDesc:   { fontSize: 13, color: '#7A7568', lineHeight: 1.6, margin: 0 },
  hr:         { border: 'none', borderTop: '1px solid #E4E0D8', margin: '2rem 0' },
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────

function Callout({ type = 'info', children }) {
  const styles = {
    info:    { bg: '#EAF0F8', color: '#1A3A5C', Icon: Info },
    warn:    { bg: '#FBF3E4', color: '#8B5E1A', Icon: AlertTriangle },
    success: { bg: '#E8F0EC', color: '#1A3A2A', Icon: CheckCircle },
  }
  const { bg, color, Icon } = styles[type]
  return (
    <div style={{ ...s.callout, background: bg, color }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}

function RaciPill({ r, a, i }) {
  if (r && a) return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <span style={{ ...s.pill, background: '#E8F0EC', color: '#1A3A2A' }}>R</span>
      <span style={{ ...s.pill, background: '#EAF0F8', color: '#1A3A5C' }}>A</span>
    </div>
  )
  if (r) return <span style={{ ...s.pill, background: '#E8F0EC', color: '#1A3A2A' }}>R</span>
  if (a) return <span style={{ ...s.pill, background: '#EAF0F8', color: '#1A3A5C' }}>A</span>
  if (i) return <span style={{ ...s.pill, background: '#F1EFE8', color: '#5F5E5A' }}>I</span>
  return <span style={{ color: '#C8C4BB' }}>–</span>
}

// ── ABAS ──────────────────────────────────────────────────

function TabTipos() {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#7A7568', marginBottom: '1.5rem', lineHeight: 1.7 }}>
        Existem quatro modelos de parceria disponíveis. Cada um serve a um perfil diferente de influenciador
        e a um objetivo diferente para o grupo.
      </p>

      {TIPOS.map(t => (
        <div key={t.num} style={{ ...s.card, borderColor: t.num === 4 ? '#E4D8C8' : '#E4E0D8' }}>
          <div style={s.cardHeader}>
            <div style={{ ...s.cardNum, background: t.bg, color: t.cor }}>{t.num}</div>
            <div>
              <div style={s.cardTitle}>
                {t.titulo}
                {t.novo && <span style={s.badgeNew}>A definir</span>}
              </div>
              <div style={s.cardSub}>{t.subtitulo}</div>
            </div>
          </div>
          <div style={s.cardBody}>
            <div style={s.cardCol}>
              <div style={s.colTitle}>Como funciona</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {t.como.map((c, i) => (
                  <li key={i} style={s.li}><span style={s.dot}>·</span>{c}</li>
                ))}
              </ul>
            </div>
            <div style={{ ...s.cardCol }}>
              <div style={s.colTitle}>Melhor para</div>
              <div style={{ marginBottom: 10 }}>
                {t.perfis.map(p => (
                  <span key={p} style={{ ...s.badge, background: t.bg, color: t.cor }}>{p}</span>
                ))}
              </div>
              <div style={s.colTitle}>
                {t.num === 4 ? 'Responsável pela definição' : t.num === 2 ? 'Papel estratégico' : 'Requisito de entrada / uso'}
              </div>
              <div style={{ fontSize: 13, color: '#7A7568', lineHeight: 1.5 }}>{t.requisito}</div>
            </div>
            <div style={{ ...s.cardCol, borderRight: 'none' }}>
              <div style={s.colTitle}>Métricas de acompanhamento</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {t.metricas.map((m, i) => (
                  <li key={i} style={s.li}><span style={s.dot}>·</span>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <Callout type="warn">
        <strong>Book Time vs. Editoras próprias:</strong> use o cupom Book Time quando o influenciador quiser
        divulgar livros de várias marcas. Use o cupom de editora específica quando quiser focar em uma única
        marca editorial. Se tiver afinidade com mais de uma editora, prefira sempre o Book Time.
      </Callout>
    </div>
  )
}

function TabFunil() {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#7A7568', marginBottom: '1.5rem', lineHeight: 1.7 }}>
        O tipo 2 (Book Time) é a porta de entrada para todas as novas parcerias. Influenciadores que provam
        resultado ao longo do semestre evoluem para o tipo 1 (Livraria Virtual). Os tipos 3 e 4 são trilhas
        paralelas, não etapas do funil principal.
      </p>

      <div style={s.funnel}>
        {[
          {
            icon: '①', bg: '#EAF0F8', color: '#1A3A5C',
            title: 'Entrada — Cupom Book Time',
            desc: 'Todo novo influenciador começa com o cupom Book Time. Após o cadastro no Orbita, o cupom é ativado em até 2 dias úteis. O time comunica a meta do semestre (600 pedidos) e os critérios de graduação para a livraria.',
            tags: [{ label: 'Todos os perfis elegíveis', bg: '#F1EFE8', color: '#5F5E5A' }, { label: 'Ativação em até 2 dias úteis', bg: '#F1EFE8', color: '#5F5E5A' }],
          },
          {
            icon: '②', bg: '#F1EFE8', color: '#5F5E5A',
            title: 'Checkpoint — Fim do Q1',
            desc: 'O estagiário ou analista avalia o progresso. O referencial é estar próximo de 300 pedidos ao fim do Q1. O checkpoint não é eliminatório — serve para identificar quem precisa de ajuste na estratégia de divulgação.',
            tags: [{ label: 'Referencial: ~300 pedidos no Q1', bg: '#FAEEDA', color: '#854F0B' }, { label: 'Ação: revisar estratégia + conversa', bg: '#F1EFE8', color: '#5F5E5A' }],
          },
          {
            icon: '③', bg: '#F1EFE8', color: '#5F5E5A',
            title: 'Decisão — Fim do semestre',
            desc: 'Os pedidos dos dois trimestres são somados. ≥ 600 pedidos → proposto para graduação com aprovação de Vanessa. Abaixo de 600 → continua com cupom Book Time e inicia novo semestre.',
            tags: [{ label: '≥ 600 pedidos → aprovação Vanessa → livraria', bg: '#EAF3DE', color: '#3B6D11' }, { label: '< 600 pedidos → novo semestre', bg: '#F1EFE8', color: '#5F5E5A' }],
          },
          {
            icon: '④', bg: '#E8F0EC', color: '#1A3A2A',
            title: 'Graduação — Livraria Virtual',
            desc: 'Com aprovação de Vanessa, o influenciador migra para a livraria personalizada. O time cria a vitrine com o influenciador e define a curadoria inicial de livros.',
            tags: [{ label: 'Reservado para quem provou conversão', bg: '#EAF3DE', color: '#3B6D11' }],
            last: true,
          },
        ].map((row, i) => (
          <div key={i} style={{ ...s.funnelRow, borderBottom: row.last ? 'none' : '1px solid #F0EDE6' }}>
            <div style={{ ...s.fIcon, background: row.bg, color: row.color }}>{row.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1814', marginBottom: 4 }}>{row.title}</div>
              <div style={{ fontSize: 13, color: '#7A7568', lineHeight: 1.6, marginBottom: 8 }}>{row.desc}</div>
              <div>
                {row.tags.map(t => (
                  <span key={t.label} style={{ ...s.badge, background: t.bg, color: t.color }}>{t.label}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Callout type="success">
        Quem não atinge 600 pedidos no semestre <strong>não é desligado automaticamente</strong> — continua
        ativo com o cupom Book Time e reinicia o ciclo. O encerramento da parceria é uma decisão separada
        com processo e aviso prévio próprios.
      </Callout>

      <hr style={s.hr} />

      <div style={{ ...s.sectionLabel, marginTop: 0 }}>Ciclos Trimestrais</div>
      <p style={{ fontSize: 13, color: '#7A7568', marginBottom: '1rem', lineHeight: 1.7 }}>
        Todas as parcerias seguem um calendário trimestral fixo, com momentos definidos para avaliar,
        ajustar e tomar decisões — sem depender de acompanhamento individual caso a caso.
      </p>

      <div style={s.cycleGrid}>
        {[
          { label: 'Q1', title: 'Ativação', desc: 'Influenciador entra com cupom Book Time. Time comunica a meta semestral e fornece materiais de divulgação.', badge: 'Início do semestre', bg: '#EAF0F8', color: '#1A3A5C' },
          { label: 'Fim do Q1', title: 'Checkpoint', desc: 'Avaliação de ritmo. Se abaixo de ~300 pedidos, agendar conversa para revisar estratégia de divulgação.', badge: 'Revisão de progresso', bg: '#FBF3E4', color: '#8B5E1A' },
          { label: 'Q2', title: 'Aceleração', desc: 'Segundo trimestre do semestre. Foco em manter ou acelerar o volume de pedidos para atingir os 600.', badge: 'Sprint final', bg: '#E8F0EC', color: '#1A3A2A' },
          { label: 'Fim do Q2', title: 'Decisão', desc: 'Soma total do semestre. ≥ 600 → aprovação de Vanessa e migração para livraria. < 600 → novo semestre.', badge: 'Graduação ou renovação', bg: '#FAF0EE', color: '#8B3A2A', last: true },
        ].map((c, i) => (
          <div key={i} style={{ ...s.cycleCol, borderRight: c.last ? 'none' : '1px solid #F0EDE6' }}>
            <div style={s.cycleLabel}>{c.label}</div>
            <div style={s.cycleTitle}>{c.title}</div>
            <div style={s.cycleDesc}>{c.desc}</div>
            <span style={{ ...s.cycleBadge, background: c.bg, color: c.color }}>{c.badge}</span>
          </div>
        ))}
      </div>

      <Callout type="info">
        Os ciclos do Q3 e Q4 seguem a mesma lógica. Influenciadores que entram em momentos diferentes
        do ano são sincronizados no próximo ciclo disponível — não é necessário criar calendários individuais.
      </Callout>
    </div>
  )
}

function TabRaci() {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#7A7568', marginBottom: '1rem', lineHeight: 1.7 }}>
        Define quem executa, quem aprova e quem é informado em cada etapa do processo.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { pill: 'R', bg: '#E8F0EC', color: '#1A3A2A', label: 'Responsável — executa a atividade' },
          { pill: 'A', bg: '#EAF0F8', color: '#1A3A5C', label: 'Aprovador — autoriza e valida' },
          { pill: 'I', bg: '#F1EFE8', color: '#5F5E5A', label: 'Informado — recebe o resultado' },
        ].map(l => (
          <div key={l.pill} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#7A7568' }}>
            <span style={{ ...s.pill, background: l.bg, color: l.color }}>{l.pill}</span>
            {l.label}
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, textAlign: 'left', width: '55%' }}>Atividade</th>
              <th style={s.th}>Estagiário / Analista</th>
              <th style={s.th}>Vanessa (Gerente)</th>
            </tr>
          </thead>
          <tbody>
            {RACI.map((row, i) => (
              <tr key={i}>
                <td style={{ ...s.td, fontWeight: 500, color: '#1A1814', background: '#F7F5F0', borderBottom: i === RACI.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                  {row.atividade}
                </td>
                <td style={{ ...s.td, textAlign: 'center', borderBottom: i === RACI.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                  <RaciPill r={row.exec && !row.aprova} a={false} i={row.informa && !row.exec} />
                  {row.exec && row.aprova && <RaciPill r={true} a={false} i={false} />}
                </td>
                <td style={{ ...s.td, textAlign: 'center', borderBottom: i === RACI.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                  {row.aprova
                    ? <span style={{ ...s.pill, background: '#EAF0F8', color: '#1A3A5C' }}>A</span>
                    : row.informa && !row.exec
                    ? <span style={{ color: '#C8C4BB' }}>–</span>
                    : row.informa
                    ? <span style={{ ...s.pill, background: '#F1EFE8', color: '#5F5E5A' }}>I</span>
                    : <span style={{ color: '#C8C4BB' }}>–</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr style={s.hr} />
      <div style={s.sectionLabel}>Processos operacionais</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ativação de nova parceria</div>
      <div style={{ ...s.steps, marginBottom: '1.5rem' }}>
        {[
          { title: 'Cadastro no Orbita', desc: 'Estagiário ou analista cadastra o influenciador com os dados de perfil e preenche os critérios do score (perfil, audiência, engajamento, histórico de conversão).' },
          { title: 'Criação do cupom — até 2 dias úteis', desc: 'Com o cadastro confirmado, o cupom Book Time é criado e ativado em até 2 dias úteis.' },
          { title: 'Comunicação com o influenciador', desc: 'O time envia ao influenciador o cupom ativo, explica a meta do semestre (600 pedidos), os critérios de graduação para a livraria e os materiais de divulgação disponíveis.' },
        ].map((step, i, arr) => (
          <div key={i} style={{ ...s.step, paddingBottom: i === arr.length - 1 ? 0 : 18 }}>
            {i < arr.length - 1 && <div style={{ position: 'absolute', left: 14, top: 34, bottom: 0, width: 1, background: '#E4E0D8' }} />}
            <div style={s.stepNum}>{i + 1}</div>
            <div style={s.stepBody}>
              <div style={s.stepTitle}>{step.title}</div>
              <p style={s.stepDesc}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Encerramento de parceria</div>
      <div style={s.steps}>
        {[
          { title: 'Comunicação do encerramento', desc: 'O encerramento pode ser iniciado por qualquer um dos lados — CEDET ou influenciador. É necessário um aviso prévio de um mês.' },
          { title: 'Última campanha', desc: 'Antes do encerramento formal, é realizada uma última campanha de divulgação. O estagiário ou analista gerencia essa campanha.' },
          { title: 'Encerramento formal', desc: 'Após a última campanha, o cupom é desativado e o influenciador é marcado como inativo no Orbita.' },
        ].map((step, i, arr) => (
          <div key={i} style={{ ...s.step, paddingBottom: i === arr.length - 1 ? 0 : 18 }}>
            {i < arr.length - 1 && <div style={{ position: 'absolute', left: 14, top: 34, bottom: 0, width: 1, background: '#E4E0D8' }} />}
            <div style={s.stepNum}>{i + 1}</div>
            <div style={s.stepBody}>
              <div style={s.stepTitle}>{step.title}</div>
              <p style={s.stepDesc}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Callout type="info" style={{ marginTop: 16 }}>
        <strong>Casos excepcionais</strong> (problemas pessoais, suspensão de conta, mudança de algoritmo)
        são analisados pontualmente pelo estagiário ou analista em conjunto com Vanessa. A principal
        ação disponível é a <strong>pausa temporária da parceria</strong>, sem penalização para nenhum dos lados.
      </Callout>
    </div>
  )
}

function TabCriterios() {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#7A7568', marginBottom: '1.5rem', lineHeight: 1.7 }}>
        Para novos influenciadores sem histórico de conversão, usamos um score de 0 a 12 pontos para
        recomendar o tipo inicial de parceria.
      </p>

      <div style={s.scoreGrid}>
        {SCORE.map(sc => (
          <div key={sc.titulo} style={s.scoreCard}>
            <div style={{ ...s.colTitle, marginBottom: 10 }}>{sc.titulo}</div>
            {sc.itens.map((it, i) => (
              <div key={i} style={{ ...s.criterion, borderBottom: i === sc.itens.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                <span style={{ color: '#7A7568' }}>{it.label}</span>
                <span style={{ fontWeight: 600, color: it.pts === '0 pts' ? '#C8C4BB' : '#2D6B4A' }}>{it.pts}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ ...s.sectionLabel, marginTop: 0 }}>Faixa de pontuação → tipo recomendado</div>
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, textAlign: 'left' }}>Pontuação</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Tipo recomendado</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {FAIXAS.map((f, i) => (
              <tr key={i}>
                <td style={{ ...s.td, fontWeight: 600, color: '#1A1814', background: '#F7F5F0', borderBottom: i === FAIXAS.length - 1 ? 'none' : '1px solid #F0EDE6' }}>{f.pts}</td>
                <td style={{ ...s.td, borderBottom: i === FAIXAS.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                  <span style={{ ...s.badge, background: f.bg, color: f.cor }}>{f.tipo}</span>
                </td>
                <td style={{ ...s.td, borderBottom: i === FAIXAS.length - 1 ? 'none' : '1px solid #F0EDE6' }}>{f.obs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...s.sectionLabel }}>Matriz por perfil de criador</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, textAlign: 'left' }}>Perfil</th>
              {['Tipo 1 Livraria', 'Tipo 2 Book Time', 'Tipo 3 Editoras', 'Tipo 4 Valor Fixo'].map(h => (
                <th key={h} style={s.th}>{h.split(' ').slice(0, 2).join(' ')}<br /><span style={{ fontWeight: 400 }}>{h.split(' ').slice(2).join(' ')}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { perfil: 'Booktoker / Bookstagrammer', t1: '★', t2: '✓', t3: '★', t4: '–' },
              { perfil: 'Educador / Professor',        t1: '✓', t2: '–', t3: '★', t4: '–' },
              { perfil: 'Lifestyle / Comportamento',   t1: '–', t2: '★', t3: '✓', t4: '✓' },
              { perfil: 'Criador geral (grande alcance)', t1: '–', t2: '★', t3: '–', t4: '★' },
            ].map((row, i, arr) => (
              <tr key={i}>
                <td style={{ ...s.td, fontWeight: 500, color: '#1A1814', background: '#F7F5F0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid #F0EDE6' }}>{row.perfil}</td>
                {[row.t1, row.t2, row.t3, row.t4].map((v, j) => (
                  <td key={j} style={{ ...s.td, textAlign: 'center', borderBottom: i === arr.length - 1 ? 'none' : '1px solid #F0EDE6' }}>
                    {v === '★' ? <span style={{ color: '#2D6B4A', fontWeight: 700, fontSize: 15 }}>★</span>
                     : v === '✓' ? <span style={{ color: '#5F5E5A' }}>✓</span>
                     : <span style={{ color: '#C8C4BB' }}>–</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: '#A8A298', marginTop: 6 }}>
        <span style={{ color: '#2D6B4A' }}>★</span> ideal &nbsp;·&nbsp;
        <span style={{ color: '#5F5E5A' }}>✓</span> recomendado &nbsp;·&nbsp;
        – não indicado
      </p>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────

const TABS = [
  { id: 'tipos',     label: 'Tipos de parceria' },
  { id: 'funil',     label: 'Funil & Ciclos'    },
  { id: 'raci',      label: 'RACI & Processos'  },
  { id: 'criterios', label: 'Critérios & Score' },
]

export default function GuiaParcerias() {
  const [aba, setAba] = useState('tipos')

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Guia de Parcerias com Influenciadores</h1>
        <p style={s.subtitle}>Guia interno · Time de Marketing CEDET · Versão 1.1</p>
      </div>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={aba === t.id ? { ...s.tab, ...s.tabActive } : s.tab}
            onClick={() => setAba(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'tipos'     && <TabTipos />}
      {aba === 'funil'     && <TabFunil />}
      {aba === 'raci'      && <TabRaci />}
      {aba === 'criterios' && <TabCriterios />}
    </div>
  )
}
