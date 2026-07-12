# Calculadora de propostas para influenciadores

## Etapa obrigatória no Supabase

Antes de testar o botão **Salvar**, abra o SQL Editor do Supabase e execute o arquivo:

`supabase/migrations/20260712_influenciadores_calculos.sql`

A migration é aditiva e cria somente a tabela `public.influenciadores_calculos`, seus índices, políticas RLS e trigger de atualização.

Ela não modifica tabelas, políticas, funções ou dados do grupo de Editoras Parceiras.

## Fonte do engajamento

A taxa é consultada manualmente no The Social Cat e registrada com URL e data da consulta. A primeira versão não usa scraping nem API não oficial.

## Isolamento

A tela está em `src/pages/CalculadoraInfluenciadores.js` e deve usar uma rota e permissão exclusivas do grupo Influenciadores. Perfis de Parceiras não devem receber acesso ao módulo.
