// Utilitário do Google Drive para o módulo de envio de brindes.
// Roda SÓ no servidor (Vercel Function). Usa as variáveis de ambiente:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Escopo autorizado: drive.file (o app só enxerga os arquivos que ele mesmo criou).

const PASTA_ENVIOS = 'Envios de brindes - NÃO COMPARTILHAR';

let tokenEmCache = null; // { valor, expiraEm }

function falhar(mensagem, status) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

async function obterAccessToken() {
  if (tokenEmCache && tokenEmCache.expiraEm > Date.now() + 60_000) {
    return tokenEmCache.valor;
  }
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw falhar('Variáveis do Google ausentes no servidor.', 500);
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.access_token) {
    // json.error costuma ser algo como "invalid_grant" (token revogado/expirado)
    throw falhar(`Google recusou a renovação do acesso (${json.error || resp.status}).`, 502);
  }
  tokenEmCache = {
    valor: json.access_token,
    expiraEm: Date.now() + (json.expires_in || 3000) * 1000,
  };
  return tokenEmCache.valor;
}

async function driveFetch(url, opcoes = {}) {
  const token = await obterAccessToken();
  const resp = await fetch(url, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, ...(opcoes.headers || {}) },
  });
  if (resp.status === 204) return null;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (json.error && (json.error.message || json.error)) || resp.status;
    throw falhar(`Erro do Google Drive: ${msg}`, 502);
  }
  return json;
}

// Acha (ou cria) a pasta de envios. Com o escopo drive.file, só enxerga pastas
// criadas por este app: uma pasta criada à mão NÃO é vista.
async function garantirPasta(nome = PASTA_ENVIOS) {
  const nomeSeguro = nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name='${nomeSeguro}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const lista = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`
  );
  if (lista.files && lista.files.length > 0) return lista.files[0].id;

  const criada = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return criada.id;
}

// Envia um arquivo (Buffer) para a pasta. Devolve { id, name }.
async function enviarArquivo({ pastaId, nome, buffer, mimeType }) {
  const limite = `orbita_${Date.now().toString(16)}`;
  const metadados = JSON.stringify({ name: nome, parents: [pastaId] });
  const corpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadados}\r\n` +
        `--${limite}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      'utf8'
    ),
    buffer,
    Buffer.from(`\r\n--${limite}--`, 'utf8'),
  ]);
  return driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: corpo,
    }
  );
}

// Apaga o arquivo. A API do Drive apaga direto, sem passar pela lixeira
// (conforme a documentação que conheço; não testei na conta de vocês).
async function apagarArquivo(arquivoId) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivoId)}`, {
    method: 'DELETE',
  });
}

module.exports = { PASTA_ENVIOS, garantirPasta, enviarArquivo, apagarArquivo };
