# Calendário de Divulgações — instalação (Órbita)

## Antes de começar
O código desta funcionalidade está na branch `feature/calendario-divulgacoes-20261015`. **Não fazer merge nem liberar para parceiros antes dos testes**. A implantação do banco é manual e deve ocorrer no projeto Supabase do Órbita (não no Supabase do Agente de Compras ou Estoque CDL).

## 1. Supabase
1. Abra Supabase > projeto do Órbita > SQL Editor > New query.
2. Copie todo o arquivo `supabase/migrations/20261015_calendario_divulgacoes.sql`.
3. Execute e verifique se não houve erros. Faça isso em um ambiente de testes primeiro.
4. Confira as tabelas `calendario_divulgacoes` e `calendario_links` e as funções RPC `calendario_criar_link`, `calendario_consultar`, `calendario_atualizar_publico`.
5. Atenção: a migration presume a extensão pgcrypto no schema `extensions`, padrão em vários projetos Supabase. Se a extensão estiver instalada em outro schema, ajuste as referências `extensions.digest` antes de executar. A definição exata no projeto atual precisa ser conferida.

## 2. Revisar e publicar o código
1. Abra o Pull Request do calendário.
2. Verifique diff, testes e permissões; faça merge na `main` somente após a migration e validação.
3. Na Vercel, confira deploy ligado ao repositório `vanessacedet-create/orbita-mkt` e branch `main`.
4. Confirme que `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY` apontam para o projeto Órbita. Nunca inclua a chave service_role no navegador.
5. Para rotas diretas no React Router, verifique o rewrite de SPA já utilizado pelo projeto. URL pública: `/calendario/parceiro/<token>`.

## 3. Operação
1. Faça login interno no Órbita e abra **Calendário de Divulgações**.
2. Selecione parceiro cadastrado.
3. Clique em **Nova divulgação**, preencha data, título, formato, tema, roteiro e status; salve.
4. Clique em **Gerar ou renovar link exclusivo**.
5. Copie o link imediatamente e encaminhe ao parceiro pelo WhatsApp. O link em texto claro não é persistido; emitir outro revoga o anterior.
6. Teste o link em aba anônima: mude mês/semana, abra a divulgação, altere status e informe URL de publicação.
7. Volte à área interna e confira atualização recarregando a página.

## Segurança e limites da primeira versão
- Parceiros externos não fazem login: o link funciona como credencial; se for compartilhado, outra pessoa poderá acessar e alterar status.
- Acesso via token usa RPC no Supabase, com hash SHA-256 armazenado na tabela de links.
- A interface pública não pode editar o roteiro, data, título ou parceiro.
- Não existe ainda upload de vídeos, comentários, aprovação por mídia, alertas nem logs granulares.
- O formulário interno grava na tabela nova, sem reescrever históricos de campanhas existentes.
- **Não validado em produção**. Aplicar migration, testar RLS/RPC e testar build do React antes de publicar.
