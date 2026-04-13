---
name: project-init
description: |
  Inicializa um novo projeto com configuração completa e isolada de Git (GitHub/GitLab/Bitbucket) e Supabase CLI.
  Coleta interativamente TODOS os tokens, credenciais e dados necessários — nunca depende de variáveis de ambiente preexistentes.
  Configura identidade Git local, remote SSH/HTTPS, autenticação Supabase CLI com token dedicado, e gera arquivos .env.
  Use esta skill SEMPRE que o usuário disser "iniciar projeto", "project init", "setup de projeto", "configurar projeto novo",
  "use a skill project_init", "quero começar um projeto", "novo projeto com git e supabase", ou qualquer variação que envolva
  configurar um novo ambiente de desenvolvimento do zero com controle de versão e/ou backend Supabase.
  Também use quando o usuário quiser reconfigurar credenciais de um projeto existente.
---

# Project Init — Setup Completo de Ambiente

Esta skill guia o desenvolvedor através da configuração completa e isolada de um novo projeto,
coletando todas as credenciais necessárias de forma interativa. Ela **nunca assume** que tokens
ou credenciais já existem no sistema — tudo é pedido explicitamente.

## Princípios

1. **Zero dependência de ambiente**: Não leia nem confie em variáveis de ambiente globais. Peça tudo.
2. **Isolamento por projeto**: Toda configuração fica local ao projeto (git config local, .env local, token Supabase por projeto).
3. **Segurança primeiro**: Tokens nunca são commitados. O .gitignore é criado/atualizado antes de qualquer commit.
4. **Idempotente**: Se rodar de novo no mesmo projeto, detecta o que já existe e pergunta se quer sobrescrever.

## Fluxo de Execução

Siga estes passos na ordem. Use o formato de pergunta interativa sempre que possível (ask_user_input ou perguntas diretas).
Adapte o idioma ao idioma que o usuário está usando.

### Fase 1 — Coleta de Informações do Projeto

Pergunte ao usuário:

1. **Nome do projeto** — usado para criar a pasta (se não existir) e como referência.
2. **Caminho do projeto** — onde o projeto vai ficar no disco. Se a pasta não existir, crie-a.
3. **Descrição curta** — uma linha descrevendo o projeto (usada no README e package.json se aplicável).

### Fase 2 — Configuração Git

Pergunte ao usuário:

4. **Provedor Git** — GitHub, GitLab, Bitbucket ou outro.
5. **URL do repositório remoto** — no formato SSH (`git@github.com:user/repo.git`) ou HTTPS.
   - Se o usuário não tiver criado o repo ainda, instrua a criar primeiro e voltar com a URL.
6. **Nome para commits** — o `user.name` do git (ex: "João Silva").
7. **Email para commits** — o `user.email` do git (ex: "joao@empresa.com").
8. **Método de autenticação** — SSH key ou HTTPS com token.
   - **Se SSH**: pergunte qual chave SSH usar (caminho completo, ex: `~/.ssh/id_ed25519_empresa`).
     Verifique se o arquivo existe. Se não existir, ofereça criar uma nova keypair.
   - **Se HTTPS**: peça o Personal Access Token (PAT) e configure o remote com token embutido
     ou configure o credential helper local.

Execute os seguintes comandos no diretório do projeto:

```bash
cd <caminho_do_projeto>
git init  # apenas se ainda não for um repo git
git config --local user.name "<nome>"
git config --local user.email "<email>"
```

Para SSH, se o usuário quer um host alias dedicado (para múltiplas contas), crie/atualize o `~/.ssh/config`:

```
Host github-<identificador>
  HostName github.com
  User git
  IdentityFile <caminho_da_chave>
```

E configure o remote usando o alias:

```bash
git remote add origin git@github-<identificador>:<user>/<repo>.git
# ou, se origin já existir:
git remote set-url origin git@github-<identificador>:<user>/<repo>.git
```

Para HTTPS com token:

```bash
git remote add origin https://<token>@github.com/<user>/<repo>.git
```

> **Importante**: Avise o usuário que tokens embutidos na URL do remote ficam visíveis em `git remote -v`.
> Sugira usar SSH como alternativa mais segura se possível.

### Fase 3 — Configuração Supabase

Pergunte ao usuário:

9. **Este projeto usa Supabase?** — Se não, pule esta fase.
10. **Supabase Access Token** — O token pessoal (`sbp_...`) da conta Supabase que será usada neste projeto.
    Instrua o usuário a obter em: https://supabase.com/dashboard → Account Preferences → Access Tokens → Generate new token.
11. **Project ID do Supabase** — O ID do projeto Supabase (visível na URL do dashboard ou em Project Settings → General).
12. **Supabase Project URL** — A URL do projeto (ex: `https://xyzcompany.supabase.co`).
13. **Supabase Anon Key** — A chave pública anon/public do projeto.
14. **Supabase Service Role Key** — (opcional, pergunte se o usuário quer incluir) A chave de service role.

Execute:

```bash
cd <caminho_do_projeto>

# Inicializa Supabase no projeto (se ainda não inicializado)
npx supabase init 2>/dev/null || echo "Supabase já inicializado"

# Linka ao projeto remoto usando o token fornecido
npx supabase link --project-ref <project_id> --token <access_token>
```

### Fase 4 — Geração de Arquivos

Crie os seguintes arquivos no diretório do projeto:

#### `.env` (credenciais locais — NUNCA commitado)

```env
# === Git ===
# Configurado via git config --local (não precisa de variável aqui)
# Identidade: <nome> <email>

# === Supabase ===
SUPABASE_ACCESS_TOKEN=<access_token>
SUPABASE_PROJECT_ID=<project_id>
SUPABASE_URL=<project_url>
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_se_fornecida>
```

#### `.env.example` (template seguro para o time — SEM valores reais)

```env
# === Supabase ===
SUPABASE_ACCESS_TOKEN=sbp_seu_token_aqui
SUPABASE_PROJECT_ID=seu_project_id
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

#### `.gitignore` (crie ou atualize — NUNCA remova linhas existentes)

Garanta que as seguintes linhas estão presentes:

```gitignore
# Environment variables
.env
.env.local
.env.*.local

# Supabase
supabase/.temp/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

#### `README.md` (apenas se não existir)

```markdown
# <nome_do_projeto>

<descrição_curta>

## Setup

1. Clone o repositório
2. Copie `.env.example` para `.env` e preencha com suas credenciais
3. Instale as dependências
4. Execute `npx supabase link --project-ref <seu_project_id>`
```

### Fase 5 — Validação

Após criar tudo, execute uma validação:

```bash
cd <caminho_do_projeto>

echo "=== Validação do Setup ==="

# Git
echo ""
echo "[Git] Identidade:"
git config --local user.name
git config --local user.email

echo ""
echo "[Git] Remote:"
git remote -v

# .env existe
echo ""
if [ -f .env ]; then
  echo "[.env] Arquivo encontrado ✓"
else
  echo "[.env] AVISO: Arquivo .env não encontrado!"
fi

# .gitignore protege .env
echo ""
if grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo "[.gitignore] .env está protegido ✓"
else
  echo "[.gitignore] AVISO: .env NÃO está no .gitignore!"
fi

# Supabase linkado
echo ""
if [ -f supabase/.temp/project-ref ]; then
  echo "[Supabase] Projeto linkado: $(cat supabase/.temp/project-ref) ✓"
else
  echo "[Supabase] Projeto não linkado (rode supabase link)"
fi
```

Apresente o resultado da validação ao usuário de forma clara.

### Fase 6 — Resumo Final

Ao final, apresente um resumo formatado com tudo que foi configurado:

```
╔══════════════════════════════════════════════════╗
║           PROJETO CONFIGURADO COM SUCESSO        ║
╠══════════════════════════════════════════════════╣
║ Projeto:    <nome>                               ║
║ Caminho:    <caminho>                            ║
║ Git User:   <nome> <email>                       ║
║ Git Remote: <url>                                ║
║ Auth:       SSH (chave: ~/.ssh/id_ed25519_xyz)   ║
║ Supabase:   <project_id> ✓                       ║
║ .env:       Criado ✓                             ║
║ .gitignore: Protegido ✓                          ║
╚══════════════════════════════════════════════════╝
```

## Notas para o Agente

- Se o projeto já existir e tiver um `.git`, pergunte se o usuário quer reconfigurar ou manter o que tem.
- Se o projeto já tiver um `.env`, pergunte antes de sobrescrever.
- Nunca faça `git add .env` ou commite arquivos com tokens.
- Se o usuário mencionar "Multigravity" ou perfis de Antigravity, lembre que cada perfil tem seu próprio ambiente isolado — a configuração de SSH pode ser específica ao perfil.
- O Supabase CLI no Windows pode precisar de `npx` em vez de chamada direta.
- Se algum comando falhar, mostre o erro e sugira a correção — não siga em frente silenciosamente.
- Esta skill funciona tanto no Antigravity (via terminal integrado) quanto no Claude Code (via bash tool).
