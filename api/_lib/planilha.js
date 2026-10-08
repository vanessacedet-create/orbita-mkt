// Monta o arquivo .xlsx que vai para o Google Drive.
const XLSX = require('xlsx');

const TIPOS = { aluno_novo: 'Aluno novo', renovacao: 'Renovação' };

function montarPlanilha({ livraria, enviadoPorNome, enviadoPorEmail, tipo, mes, livroTitulo, precoUnitario, destinatarios }) {
  const cab = ['Nome completo', 'CPF', 'E-mail', 'Telefone', 'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF'];
  const linhas = destinatarios.map((d) => [
    d.nome_completo, d.cpf, d.email, d.telefone, d.cep, d.logradouro, d.numero, d.complemento, d.bairro, d.cidade, d.uf,
  ]);
  const abaDest = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  abaDest['!cols'] = [34, 14, 30, 14, 10, 34, 8, 20, 22, 22, 5].map((wch) => ({ wch }));
  // Tudo é gravado como texto: preserva zeros à esquerda (CPF, CEP) e não interpreta fórmulas.

  const abaResumo = XLSX.utils.aoa_to_sheet([
    ['Livraria', livraria],
    ['Enviado por', `${enviadoPorNome} <${enviadoPorEmail}>`],
    ['Tipo', TIPOS[tipo] || tipo],
    ['Mês de referência', mes],
    ['Livro', livroTitulo],
    ['Quantidade', destinatarios.length],
    ['Preço unitário (parceiro)', precoUnitario],
    ['Valor dos livros', Math.round(precoUnitario * destinatarios.length * 100) / 100],
    ['Frete', 'a calcular pela CEDET'],
  ]);
  abaResumo['!cols'] = [{ wch: 28 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, abaDest, 'Destinatários');
  XLSX.utils.book_append_sheet(wb, abaResumo, 'Resumo');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { montarPlanilha, TIPOS };
