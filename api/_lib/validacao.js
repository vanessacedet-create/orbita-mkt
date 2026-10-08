// Validação dos dados de cada destinatário. Roda no SERVIDOR (a validação "de verdade")
// e será espelhada na tela para a assessora ver os erros antes de enviar.

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const limpa = (v, max = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

function cpfValido(cpf) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(cpf.slice(0, 9)) === Number(cpf[9]) && dv(cpf.slice(0, 10)) === Number(cpf[10]);
}

function telefoneNormalizado(valor) {
  let t = soDigitos(valor);
  if ((t.length === 12 || t.length === 13) && t.startsWith('55')) t = t.slice(2); // tira o +55
  if (t.length !== 10 && t.length !== 11) return null;
  const ddd = Number(t.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (t.length === 11 && t[2] !== '9') return null; // celular começa com 9
  return t;
}

// Devolve { ok, dados, erros:[{campo, mensagem}] }
function validarDestinatario(d) {
  const erros = [];
  const obrigatorio = (campo, valor, mensagem) => {
    if (!valor) erros.push({ campo, mensagem });
  };

  const nome = limpa(d.nome_completo);
  if (!nome) erros.push({ campo: 'nome_completo', mensagem: 'Nome completo obrigatório' });
  else if (nome.split(' ').filter((p) => p.length > 0).length < 2)
    erros.push({ campo: 'nome_completo', mensagem: 'Informe nome e sobrenome' });

  const cpf = soDigitos(d.cpf);
  if (!cpf) erros.push({ campo: 'cpf', mensagem: 'CPF obrigatório' });
  else if (!cpfValido(cpf)) erros.push({ campo: 'cpf', mensagem: 'CPF inválido' });

  const email = limpa(d.email).toLowerCase();
  if (!email) erros.push({ campo: 'email', mensagem: 'E-mail obrigatório' });
  else if (!EMAIL.test(email)) erros.push({ campo: 'email', mensagem: 'E-mail inválido' });

  const telefoneBruto = limpa(d.telefone);
  const telefone = telefoneBruto ? telefoneNormalizado(telefoneBruto) : null;
  if (!telefoneBruto) erros.push({ campo: 'telefone', mensagem: 'Telefone obrigatório' });
  else if (!telefone) erros.push({ campo: 'telefone', mensagem: 'Telefone inválido (use DDD + número)' });

  const cep = soDigitos(d.cep);
  if (!cep) erros.push({ campo: 'cep', mensagem: 'CEP obrigatório' });
  else if (cep.length !== 8) erros.push({ campo: 'cep', mensagem: 'CEP deve ter 8 dígitos' });

  const logradouro = limpa(d.logradouro);
  const numero = limpa(d.numero, 20);
  const bairro = limpa(d.bairro);
  const cidade = limpa(d.cidade);
  const uf = limpa(d.uf, 2).toUpperCase();
  obrigatorio('logradouro', logradouro, 'Endereço (rua) obrigatório');
  obrigatorio('numero', numero, 'Número obrigatório (use S/N se não houver)');
  obrigatorio('bairro', bairro, 'Bairro obrigatório');
  obrigatorio('cidade', cidade, 'Cidade obrigatória');
  if (!uf) erros.push({ campo: 'uf', mensagem: 'UF obrigatória' });
  else if (!UFS.includes(uf)) erros.push({ campo: 'uf', mensagem: 'UF inválida' });

  return {
    ok: erros.length === 0,
    erros,
    dados: {
      nome_completo: nome, cpf, email, telefone: telefone || '', cep,
      logradouro, numero, complemento: limpa(d.complemento), bairro, cidade, uf,
    },
  };
}

module.exports = { UFS, cpfValido, telefoneNormalizado, validarDestinatario };
