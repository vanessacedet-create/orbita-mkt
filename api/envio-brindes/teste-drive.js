// TEMPORÁRIO — só para testar a conexão com o Google Drive.
// Cria a pasta de envios (se não existir), envia um arquivo de teste e apaga em seguida.
// NÃO devolve nenhum dado de segredo. APAGUE este arquivo depois do teste.
const { garantirPasta, enviarArquivo, apagarArquivo } = require('../_lib/drive');

module.exports = async (req, res) => {
  const etapas = [];
  try {
    const pastaId = await garantirPasta();
    etapas.push('pasta ok');

    const arquivo = await enviarArquivo({
      pastaId,
      nome: 'teste-conexao.txt',
      buffer: Buffer.from('teste de conexao do Orbita - pode apagar', 'utf8'),
      mimeType: 'text/plain',
    });
    etapas.push('envio ok');

    await apagarArquivo(arquivo.id);
    etapas.push('exclusao ok');

    res.status(200).json({ ok: true, etapas });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, etapas, erro: e.message });
  }
};
