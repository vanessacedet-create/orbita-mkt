// Leitura da planilha de FRETE (enviada pelo setor responsável) e casamento
// dos nomes com as pessoas do lote. Roda no navegador da equipe.

const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

// minúsculas, sem acentos, sem pontuação, espaços únicos
export function normalizarNome(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// igual à anterior, mas ignora "de/da/do/dos/das/e"
export function chaveNome(s) {
  return normalizarNome(s).split(' ').filter((p) => p && !PARTICULAS.has(p)).join(' ');
}

// "R$ 1.234,56" | "18,40" | "18.40" | 18.4  ->  número (ou null)
export function parseValorBR(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  let t = String(v == null ? '' : v).replace(/R\$/gi, '').replace(/\s+/g, '').trim();
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.234 = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Acha a linha de cabeçalho e sugere as colunas de nome e valor.
// Procura, nas primeiras 25 linhas, a primeira que tenha uma coluna de nome E uma de valor
// (planilhas costumam ter título ou linhas em branco antes). Se não achar, usa a primeira
// linha não vazia e deixa a escolha das colunas para a pessoa.
function sugerirColunas(cabecalho) {
  const norm = cabecalho.map(normalizarNome);
  const acha = (palavras, evitar = -1) => {
    for (const p of palavras) {
      const i = norm.findIndex((h, k) => k !== evitar && h && h.split(' ').includes(p));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idxNome = acha(['nome', 'cliente', 'destinatario', 'contato', 'aluno', 'aluna']);
  const idxValor = acha(['frete', 'valor', 'preco', 'custo', 'total'], idxNome);
  return { idxNome, idxValor };
}

export function lerCabecalho(matriz) {
  const limite = Math.min(matriz.length, 25);
  let primeiraNaoVazia = -1;
  for (let i = 0; i < limite; i++) {
    const linha = matriz[i];
    if (!linha.some((c) => String(c).trim() !== '')) continue;
    if (primeiraNaoVazia < 0) primeiraNaoVazia = i;
    const cabecalho = linha.map((c) => String(c == null ? '' : c).trim());
    const { idxNome, idxValor } = sugerirColunas(cabecalho);
    if (idxNome >= 0 && idxValor >= 0) return { idxCab: i, cabecalho, idxNome, idxValor };
  }
  if (primeiraNaoVazia < 0) return null;
  const cabecalho = matriz[primeiraNaoVazia].map((c) => String(c == null ? '' : c).trim());
  const { idxNome, idxValor } = sugerirColunas(cabecalho);
  return { idxCab: primeiraNaoVazia, cabecalho, idxNome, idxValor };
}

// Transforma as linhas abaixo do cabeçalho em { linha, nome, valor, bruto }
export function extrairLinhas(matriz, idxCab, idxNome, idxValor) {
  const linhas = [];
  for (let i = idxCab + 1; i < matriz.length; i++) {
    const l = matriz[i];
    const nome = String(l[idxNome] == null ? '' : l[idxNome]).replace(/\s+/g, ' ').trim();
    const bruto = l[idxValor];
    if (!nome && String(bruto == null ? '' : bruto).trim() === '') continue; // linha vazia
    linhas.push({ linha: i + 1, nome, valor: parseValorBR(bruto), bruto: String(bruto == null ? '' : bruto) });
  }
  return linhas;
}

// Casa cada pessoa do lote com UMA linha da planilha de frete.
// Só casa automaticamente quando o nome é único dos dois lados. O resto vai para conferência manual.
export function casar(destinatarios, linhasFrete) {
  const porChave = new Map();
  linhasFrete.forEach((l, idx) => {
    if (l.valor == null || !l.nome) return;
    const k = chaveNome(l.nome);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(idx);
  });
  const contaDest = new Map();
  destinatarios.forEach((d) => {
    const k = chaveNome(d.nome_completo);
    contaDest.set(k, (contaDest.get(k) || 0) + 1);
  });

  const casados = new Map(); // destinatario.id -> { idx, tipo: 'exato' | 'aproximado' }
  const usados = new Set();
  destinatarios.forEach((d) => {
    const k = chaveNome(d.nome_completo);
    const candidatos = porChave.get(k) || [];
    if (contaDest.get(k) === 1 && candidatos.length === 1) {
      const idx = candidatos[0];
      const exato = normalizarNome(linhasFrete[idx].nome) === normalizarNome(d.nome_completo);
      casados.set(d.id, { idx, tipo: exato ? 'exato' : 'aproximado' });
      usados.add(idx);
    }
  });
  const pendentes = destinatarios.filter((d) => !casados.has(d.id)).map((d) => d.id);
  const sobras = linhasFrete.map((l, idx) => idx).filter((idx) => !usados.has(idx));
  return { casados, pendentes, sobras };
}

// Monta a lista final [{destinatario_id, valor_frete}] ou devolve o que falta.
// resolucoes: { [destId]: { tipo: 'linha', idx } | { tipo: 'manual', valor: '18,40' } }
export function montarFretes(destinatarios, linhasFrete, casamento, resolucoes) {
  const itens = [];
  const faltam = [];
  const linhaUsadaManual = new Set();
  destinatarios.forEach((d) => {
    let valor = null;
    const c = casamento.casados.get(d.id);
    if (c) valor = linhasFrete[c.idx].valor;
    else {
      const r = resolucoes[d.id];
      if (r && r.tipo === 'linha' && linhasFrete[r.idx]) {
        if (linhaUsadaManual.has(r.idx)) valor = null; // a mesma linha não vale para duas pessoas
        else { linhaUsadaManual.add(r.idx); valor = linhasFrete[r.idx].valor; }
      } else if (r && r.tipo === 'manual') valor = parseValorBR(r.valor);
    }
    if (valor == null) faltam.push(d.id);
    else itens.push({ destinatario_id: d.id, valor_frete: valor });
  });
  const total = Math.round(itens.reduce((s, i) => s + i.valor_frete, 0) * 100) / 100;
  return { itens, faltam, total };
}

// ───────────── Planilha de RASTREIO (nome + código) ─────────────

// "ab 123 456 789 br" -> "AB123456789BR" (ou null se não parecer um código)
export function normalizarCodigo(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9-]{5,40}$/.test(t) ? t : null;
}

function sugerirColunasRastreio(cabecalho) {
  const norm = cabecalho.map(normalizarNome);
  const acha = (palavras, evitar = -1) => {
    for (const p of palavras) {
      const i = norm.findIndex((h, k) => k !== evitar && h && h.split(' ').includes(p));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idxNome = acha(['nome', 'cliente', 'destinatario', 'contato', 'aluno', 'aluna']);
  const idxCodigo = acha(['rastreio', 'rastreamento', 'codigo', 'objeto', 'tracking', 'cod'], idxNome);
  return { idxNome, idxCodigo };
}

// Mesma ideia do frete: procura nas primeiras 25 linhas o cabeçalho com nome E código.
export function lerCabecalhoRastreio(matriz) {
  const limite = Math.min(matriz.length, 25);
  let primeira = -1;
  for (let i = 0; i < limite; i++) {
    const linha = matriz[i];
    if (!linha.some((c) => String(c).trim() !== '')) continue;
    if (primeira < 0) primeira = i;
    const cabecalho = linha.map((c) => String(c == null ? '' : c).trim());
    const { idxNome, idxCodigo } = sugerirColunasRastreio(cabecalho);
    if (idxNome >= 0 && idxCodigo >= 0) return { idxCab: i, cabecalho, idxNome, idxCodigo };
  }
  if (primeira < 0) return null;
  const cabecalho = matriz[primeira].map((c) => String(c == null ? '' : c).trim());
  const { idxNome, idxCodigo } = sugerirColunasRastreio(cabecalho);
  return { idxCab: primeira, cabecalho, idxNome, idxCodigo };
}

// Devolve linhas no mesmo formato do frete, com o CÓDIGO no campo "valor" (assim a função
// casar() serve para os dois casos). valor = null quando o código é inválido.
export function extrairLinhasRastreio(matriz, idxCab, idxNome, idxCodigo) {
  const linhas = [];
  for (let i = idxCab + 1; i < matriz.length; i++) {
    const l = matriz[i];
    const nome = String(l[idxNome] == null ? '' : l[idxNome]).replace(/\s+/g, ' ').trim();
    const bruto = String(l[idxCodigo] == null ? '' : l[idxCodigo]).trim();
    if (!nome && !bruto) continue;
    linhas.push({ linha: i + 1, nome, valor: normalizarCodigo(bruto), bruto });
  }
  return linhas;
}

// resolucoes: { [destId]: { tipo: 'linha', idx } | { tipo: 'manual', valor: 'AB123456789BR' } }
// Devolve os códigos que já dá para gravar e quem ainda está sem código.
export function montarRastreios(destinatarios, linhas, casamento, resolucoes) {
  const itens = [];
  const faltam = [];
  const usadas = new Set();
  destinatarios.forEach((d) => {
    let codigo = null;
    const c = casamento.casados.get(d.id);
    if (c) codigo = linhas[c.idx].valor;
    else {
      const r = resolucoes[d.id];
      if (r && r.tipo === 'linha' && linhas[r.idx]) {
        if (!usadas.has(r.idx)) { usadas.add(r.idx); codigo = linhas[r.idx].valor; }
      } else if (r && r.tipo === 'manual') codigo = normalizarCodigo(r.valor);
    }
    if (codigo == null) faltam.push(d.id);
    else itens.push({ destinatario_id: d.id, codigo_rastreio: codigo });
  });
  return { itens, faltam };
}
