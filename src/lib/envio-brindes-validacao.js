// Validação e leitura da planilha de envio de brindes (roda no NAVEGADOR da assessora).
// A validação "de verdade" é refeita no servidor (api/_lib/validacao.js): esta aqui
// serve para mostrar os erros ANTES de enviar. Mantenha as duas regras iguais.

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const limpa = (v, max = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export function cpfValido(cpf) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(cpf.slice(0, 9)) === Number(cpf[9]) && dv(cpf.slice(0, 10)) === Number(cpf[10]);
}

export function telefoneNormalizado(valor) {
  let t = soDigitos(valor);
  if ((t.length === 12 || t.length === 13) && t.startsWith('55')) t = t.slice(2);
  if (t.length !== 10 && t.length !== 11) return null;
  const ddd = Number(t.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (t.length === 11 && t[2] !== '9') return null;
  return t;
}

export function validarDestinatario(d) {
  const erros = [];
  const nome = limpa(d.nome_completo);
  if (!nome) erros.push({ campo: 'nome_completo', mensagem: 'Nome completo obrigatório' });
  else if (nome.split(' ').filter(Boolean).length < 2) erros.push({ campo: 'nome_completo', mensagem: 'Informe nome e sobrenome' });

  // O Excel apaga zeros à esquerda de CPF e CEP: completa quando faltam poucos dígitos.
  let cpf = soDigitos(d.cpf);
  if (cpf.length === 9 || cpf.length === 10) cpf = cpf.padStart(11, '0');
  if (!cpf) erros.push({ campo: 'cpf', mensagem: 'CPF obrigatório' });
  else if (!cpfValido(cpf)) erros.push({ campo: 'cpf', mensagem: 'CPF inválido' });

  const email = limpa(d.email).toLowerCase();
  if (!email) erros.push({ campo: 'email', mensagem: 'E-mail obrigatório' });
  else if (!EMAIL.test(email)) erros.push({ campo: 'email', mensagem: 'E-mail inválido' });

  const telBruto = limpa(d.telefone);
  const telefone = telBruto ? telefoneNormalizado(telBruto) : null;
  if (!telBruto) erros.push({ campo: 'telefone', mensagem: 'Telefone obrigatório' });
  else if (!telefone) erros.push({ campo: 'telefone', mensagem: 'Telefone inválido (use DDD + número)' });

  let cep = soDigitos(d.cep);
  if (cep.length === 7) cep = cep.padStart(8, '0');
  if (!cep) erros.push({ campo: 'cep', mensagem: 'CEP obrigatório' });
  else if (cep.length !== 8) erros.push({ campo: 'cep', mensagem: 'CEP deve ter 8 dígitos' });

  const logradouro = limpa(d.logradouro);
  const numero = limpa(d.numero, 20);
  const bairro = limpa(d.bairro);
  const cidade = limpa(d.cidade);
  const uf = limpa(d.uf, 2).toUpperCase();
  if (!logradouro) erros.push({ campo: 'logradouro', mensagem: 'Endereço (rua) obrigatório' });
  if (!numero) erros.push({ campo: 'numero', mensagem: 'Número obrigatório (use S/N se não houver)' });
  if (!bairro) erros.push({ campo: 'bairro', mensagem: 'Bairro obrigatório' });
  if (!cidade) erros.push({ campo: 'cidade', mensagem: 'Cidade obrigatória' });
  if (!uf) erros.push({ campo: 'uf', mensagem: 'UF obrigatória' });
  else if (!UFS.includes(uf)) erros.push({ campo: 'uf', mensagem: 'UF inválida' });

  return {
    ok: erros.length === 0,
    erros,
    dados: { nome_completo: nome, cpf, email, telefone: telefone || '', cep, logradouro, numero, complemento: limpa(d.complemento), bairro, cidade, uf },
  };
}

// ── Colunas da planilha ──
export const CAMPOS = [
  { campo: 'nome_completo', titulo: 'Nome completo', obrigatorio: true,  sinonimos: ['nome completo', 'nome', 'nome contato', 'aluno', 'aluna', 'destinatario', 'cliente'] },
  { campo: 'cpf',           titulo: 'CPF',           obrigatorio: true,  sinonimos: ['cpf'] },
  { campo: 'email',         titulo: 'E-mail',        obrigatorio: true,  sinonimos: ['email', 'e mail', 'e-mail'] },
  { campo: 'telefone',      titulo: 'Telefone',      obrigatorio: true,  sinonimos: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'] },
  { campo: 'cep',           titulo: 'CEP',           obrigatorio: true,  sinonimos: ['cep'] },
  { campo: 'logradouro',    titulo: 'Logradouro',    obrigatorio: true,  sinonimos: ['logradouro', 'endereco', 'rua'] },
  { campo: 'numero',        titulo: 'Número',        obrigatorio: true,  sinonimos: ['numero', 'num', 'n'] },
  { campo: 'complemento',   titulo: 'Complemento',   obrigatorio: false, sinonimos: ['complemento', 'compl'] },
  { campo: 'bairro',        titulo: 'Bairro',        obrigatorio: true,  sinonimos: ['bairro'] },
  { campo: 'cidade',        titulo: 'Cidade',        obrigatorio: true,  sinonimos: ['cidade', 'municipio'] },
  { campo: 'uf',            titulo: 'UF',            obrigatorio: true,  sinonimos: ['uf', 'estado'] },
];

const normalizaCabecalho = (s) =>
  String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Casa só por igualdade (sem "contém"), e cada campo só é usado uma vez.
export function mapearColunas(cabecalho) {
  const mapa = {};
  const usados = new Set();
  cabecalho.forEach((celula, idx) => {
    const chave = normalizaCabecalho(celula);
    if (!chave) return;
    const alvo = CAMPOS.find((c) => !usados.has(c.campo) && c.sinonimos.some((s) => normalizaCabecalho(s) === chave));
    if (alvo) { usados.add(alvo.campo); mapa[alvo.campo] = idx; }
  });
  const faltando = CAMPOS.filter((c) => c.obrigatorio && mapa[c.campo] === undefined).map((c) => c.titulo);
  return { mapa, faltando };
}

// matriz = linhas da planilha (array de arrays, já como texto). Devolve linhas validadas.
export function lerLinhas(matriz) {
  const idxCab = matriz.findIndex((l) => l.some((c) => String(c).trim() !== ''));
  if (idxCab < 0) return { erroArquivo: 'A planilha está vazia.', linhas: [] };

  const { mapa, faltando } = mapearColunas(matriz[idxCab]);
  if (faltando.length > 0) {
    return { erroArquivo: `Não encontrei estas colunas: ${faltando.join(', ')}. Baixe o modelo e use os mesmos títulos.`, linhas: [] };
  }

  const linhas = [];
  const cpfsVistos = new Map();
  for (let i = idxCab + 1; i < matriz.length; i++) {
    const bruto = matriz[i];
    if (!bruto.some((c) => String(c).trim() !== '')) continue; // pula linha vazia
    const obj = {};
    CAMPOS.forEach((c) => { obj[c.campo] = mapa[c.campo] === undefined ? '' : bruto[mapa[c.campo]]; });
    const r = validarDestinatario(obj);
    const erros = [...r.erros];
    if (r.dados.cpf && !r.erros.some((e) => e.campo === 'cpf')) {
      if (cpfsVistos.has(r.dados.cpf)) erros.push({ campo: 'cpf', mensagem: `CPF repetido (também na linha ${cpfsVistos.get(r.dados.cpf)})` });
      else cpfsVistos.set(r.dados.cpf, i + 1);
    }
    linhas.push({ _linha: i + 1, dados: r.dados, erros });
  }
  return { erroArquivo: null, linhas };
}

export const mascararCpf = (cpf) => (cpf && cpf.length === 11 ? `***.***.${cpf.slice(6, 9)}-**` : cpf || '');
export const formatarMoeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
