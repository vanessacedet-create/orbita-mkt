# Integração ChatGPT → tarefas do Órbita

Esta Edge Function cria uma ponte mínima e autenticada para o ChatGPT consultar usuários e criar/consultar/atualizar tarefas no banco existente do Órbita.

## Endpoint

Após o deploy da função `chatgpt-tarefas`:

`https://<project-ref>.supabase.co/functions/v1/chatgpt-tarefas`

Todas as requisições devem enviar:

`x-orbita-api-key: <chave privada>`

A chave fica somente nos secrets da Edge Function, com o nome `ORBITA_CHATGPT_API_KEY`. Não coloque a chave no React, GitHub ou Vercel.

## Rotas

- `GET /usuarios?nome=Yasmin` — localiza o usuário antes de atribuir.
- `GET /tarefas?responsavel=Yasmin` — consulta tarefas.
- `POST /tarefas` — cria tarefa.
- `PATCH /tarefas/:id` — altera título, descrição, status, prioridade ou prazo.

Exemplo de criação:

```json
{
  "titulo": "Conferir parceiros sem retorno",
  "responsavel": "Yasmin",
  "descricao": "Revisar os parceiros que ainda não responderam.",
  "data_prazo": "2026-09-29",
  "prioridade": "alta",
  "grupo": "parceiras",
  "checklist": ["Revisar contatos", "Registrar retornos no Órbita"]
}
```

A API não escolhe silenciosamente entre nomes ambíguos: se houver mais de uma pessoa compatível, retorna os candidatos para confirmação.

## Deploy no Supabase

No projeto correto do Órbita:

1. Crie um secret forte chamado `ORBITA_CHATGPT_API_KEY`.
2. Faça deploy da Edge Function `chatgpt-tarefas`.
3. Para integração externa por chave própria, configure a função para não exigir JWT do usuário; a própria função valida `x-orbita-api-key`.
4. Teste primeiro `GET /usuarios?nome=Yasmin`.
5. Cadastre o endpoint como uma integração/plugin do ChatGPT usando a chave no header privado.

A função usa `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor da Edge Function. Essa chave nunca deve ser enviada ao ChatGPT nem ao navegador.

## Próxima etapa

Depois do deploy, a integração do ChatGPT deve mapear quatro ações: procurar usuário, listar tarefas, criar tarefa e atualizar tarefa. Isso permite comandos naturais como “crie para a Yasmin uma tarefa para amanhã, prioridade alta” sem duplicar o módulo de tarefas do Órbita.
