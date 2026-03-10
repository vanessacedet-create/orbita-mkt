# 🪐 Orbita MKT — CEDET

Plataforma interna de apoio para a equipe de marketing do CEDET.
Sistema modular com controle de acesso por perfil.

---

## Perfis de Acesso

| Perfil         | Dashboard | Cortesias | Usuários |
|----------------|-----------|-----------|----------|
| Administrador  | ✅         | ✅         | ✅        |
| Gerente        | ✅         | ✅         | ❌        |
| Analista       | ✅         | ✅         | ❌        |
| Assistente     | ✅         | ❌         | ❌        |

---

## Estrutura do Projeto

```
src/
├── context/AuthContext.js   # Sessão, perfil e permissões
├── lib/supabase.js          # Conexão e funções do banco
├── pages/
│   ├── Login.js             # Tela de login
│   ├── Dashboard.js         # Visão geral
│   ├── Cortesias.js         # Parceiros, livros e envios
│   └── Usuarios.js          # Gestão de usuários (admin)
├── App.js                   # Rotas e shell principal
└── App.css                  # Estilos globais
supabase-schema.sql          # Script do banco de dados
```

---

## Configuração Passo a Passo

### ETAPA 1 — Supabase: criar as tabelas

1. Acesse seu projeto no **supabase.com**
2. Clique em **SQL Editor** → **New query**
3. Cole todo o conteúdo de `supabase-schema.sql`
4. Clique em **Run** — deve aparecer "Success"

### ETAPA 2 — Supabase: criar o primeiro administrador

1. No Supabase, vá em **Authentication → Users**
2. Clique em **Add user → Create new user**
3. Preencha e-mail e senha
4. Após criar, vá em **Table Editor → usuarios**
5. Encontre o usuário e mude o campo `perfil` para `administrador`

### ETAPA 3 — GitHub: criar repositório e fazer upload

1. Crie um repositório no GitHub
2. Faça upload de todos os arquivos desta pasta
3. Certifique-se de que as pastas `src/` e `public/` aparecem no repositório

### ETAPA 4 — Vercel: deploy

1. Acesse **vercel.com** e conecte ao repositório
2. Adicione as variáveis de ambiente:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
3. Clique em **Deploy**

---

## Adicionando Novos Módulos

Para adicionar um novo módulo ao sistema:

1. Crie o arquivo em `src/pages/NovoModulo.js`
2. Adicione a rota em `src/App.js`
3. Adicione ao menu em `src/App.js` (array `MENU`)
4. Defina as permissões em `src/context/AuthContext.js` (objeto `MODULOS_PERMISSOES`)

Exemplo:
```js
// Em AuthContext.js
export const MODULOS_PERMISSOES = {
  dashboard:    ['administrador', 'gerente', 'analista', 'assistente'],
  cortesias:    ['administrador', 'gerente', 'analista'],
  financeiro:   ['administrador', 'gerente'],   // novo módulo
  usuarios:     ['administrador'],
}
```

---

## Desenvolvimento Local

```bash
npm install
cp .env.example .env
# Edite .env com suas credenciais do Supabase
npm start
```
