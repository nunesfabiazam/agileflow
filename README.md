# AgileFlow 🚀

Plataforma de gestão ágil de projetos — tarefas, sprints, kanban, documentação, relatórios e colaboração em equipe.

## 🌐 Deploy

| Serviço   | URL                                          |
|-----------|----------------------------------------------|
| Frontend  | https://agileflow-kappa.vercel.app           |
| Backend   | https://agileflow-anlp.onrender.com          |
| Banco     | Neon PostgreSQL (sa-east-1, AWS)             |

---

## Stack

| Camada    | Tecnologia                                        |
|-----------|---------------------------------------------------|
| Frontend  | React 18 + TypeScript + Vite + Zustand            |
| Backend   | Node.js + Express + TypeScript                    |
| ORM       | Prisma                                            |
| Banco     | PostgreSQL 16 (Neon — serverless)                 |
| Auth      | JWT (7 dias)                                      |
| Deploy    | Vercel (frontend) · Render (backend) · Neon (DB)  |

---

## Funcionalidades

### Gestão de Projetos
- **Projetos** — criação com nome, chave (ex: `PROJ`), emoji e cor; seletor global no sidebar
- **Membros** — convite por e-mail, papéis (Admin, PM, Developer, QA, UX, Scrum Master, Stakeholder, Viewer)
- **Kanban** — arrastar e soltar, colunas customizáveis por projeto, filtros por assignee/prioridade/sprint/épico
- **Backlog** — lista completa com filtros avançados, atribuição de sprint, seleção e edição em massa

### Tarefas
- **Tipos** — História, Bug, Tarefa, Spike, Épico, Subtarefa
- **Prioridades** — Crítica, Alta, Média, Baixa
- **Campos** — título, descrição, pontos de história, data de entrega, assignees, coluna, sprint, épico
- **Critérios de aceitação** — checklist por task
- **Dependências** — blockers e blocked-by entre tasks
- **Comentários** — com suporte a @menções
- **Time Tracking** — timer automático e log manual por task
- **Subtarefas** — hierarquia pai/filho
- **Clonagem** — duplicar task para o mesmo ou outro projeto
- **Importação em massa** — até 500 tasks por projeto

### Filtros e Busca
- **Busca global** — busca por tasks, documentos e épicos com atalho `⌘K`
- **Filtros do Backlog** — busca por texto, tipo, prioridade, épico, responsável e status (coluna)
- **Edição em massa no Backlog** — alterar status, prioridade, tipo, épico e sprint para múltiplas tasks simultaneamente

### Sprints
- **Ciclo de vida** — Planejamento → Ativa → Concluída / Cancelada
- **Burndown chart** — gráfico de progresso da sprint
- **Velocity Analytics** — histórico de velocidade por sprint
- **Conclusão de sprint** — move tasks incompletas para o backlog ou próxima sprint

### Épicos
- **Progresso visual** — barra de conclusão baseada nas tasks vinculadas
- **Roadmap** — visão de linha do tempo dos épicos por projeto

### Documentação
- **Espaços globais** — todos os projetos compartilham e visualizam toda a documentação
- **Hierarquia** — espaços → documentos → subdocumentos
- **Editor rico (Tiptap)** — negrito, itálico, sublinhado, tachado, código, **paleta de cores de texto**, destaque, títulos H1–H3, listas, lista de tarefas, citação, bloco de código, tabelas, alinhamento, links, imagens com redimensionamento, upload de arquivos
- **Cover e emoji** — capa visual por gradiente e ícone emoji por documento (persistidos no banco)
- **Espaços editáveis** — renomear nome e ícone dos espaços inline
- **Versionamento** — histórico de versões por documento
- **Status** — Rascunho / Publicado
- **Importação de documentos** — Markdown, Word (.docx), PDF, HTML, Confluence (ZIP)

### Outros
- **Relatórios** — métricas por projeto e sprint, gráficos, exportação
- **Notificações** — in-app com @menções e eventos de sprint/task
- **Gerenciamento de usuários** — painel admin com criação, edição, upload de avatar, ativação/desativação
- **Perfil** — edição de nome, telefone, cor do avatar e upload de foto
- **Importação de tasks** — Jira CSV (PT-BR e EN), Jira JSON, Excel (.xlsx)
- **AI Assistant** — sugestões em tasks e documentos (Anthropic Claude)
- **Reset de senha** — via SMS (Twilio)

---

## Como rodar localmente

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16 local **ou** conta gratuita no [Neon](https://neon.tech)

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone https://github.com/nunesfabiazam/agileflow.git
cd agileflow
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

```env
# Banco local:
DATABASE_URL=postgresql://usuario:senha@localhost:5432/agileflow

# Ou Neon (recomendado):
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require

JWT_SECRET=sua-chave-secreta-forte
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Crie `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 2. Backend

```bash
cd backend
npm install
npx prisma migrate deploy   # aplica as migrations
npx prisma db seed          # popula dados de demonstração (opcional)
npm run dev                 # inicia em http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # inicia em http://localhost:5173
```

### Com Docker Compose

```bash
docker-compose up -d
# Backend:  http://localhost:3001
# Frontend: http://localhost:3000
docker exec agileflow_backend npx prisma db seed
```

---

## Login de demonstração

Após o seed, use os usuários abaixo (senha padrão: `senha123`):

| E-mail                  | Papel           |
|-------------------------|-----------------|
| elisa@agileflow.dev     | Product Manager |
| ana@agileflow.dev       | Developer       |
| bruno@agileflow.dev     | Developer       |
| carla@agileflow.dev     | QA              |
| diego@agileflow.dev     | UX Designer     |

> **Admin:** crie ou promova um usuário com role `ADMIN` no painel de Gerenciamento de Usuários para acesso total.

---

## Variáveis de ambiente — Backend

| Variável               | Descrição                                   | Obrigatório |
|------------------------|---------------------------------------------|-------------|
| `DATABASE_URL`         | String de conexão PostgreSQL (Neon ou local)| ✅          |
| `JWT_SECRET`           | Chave secreta para assinar tokens JWT       | ✅          |
| `PORT`                 | Porta do servidor (padrão: `3001`)          | ❌          |
| `NODE_ENV`             | `development` ou `production`               | ❌          |
| `FRONTEND_URL`         | URL do frontend para CORS                   | ❌          |
| `ANTHROPIC_API_KEY`    | Chave da API Anthropic (AI Assistant)       | ❌          |
| `TWILIO_ACCOUNT_SID`   | SID da conta Twilio (reset de senha SMS)    | ❌          |
| `TWILIO_AUTH_TOKEN`    | Token de autenticação Twilio                | ❌          |
| `TWILIO_PHONE_NUMBER`  | Número de origem dos SMS                    | ❌          |

---

## Principais endpoints da API

### Autenticação
| Método | Rota                          | Descrição                     |
|--------|-------------------------------|-------------------------------|
| POST   | /api/auth/login               | Login + retorna JWT           |
| POST   | /api/auth/register            | Cadastro de usuário           |
| GET    | /api/auth/me                  | Dados do usuário autenticado  |
| POST   | /api/auth/forgot-password     | Solicitar reset de senha SMS  |
| POST   | /api/auth/reset-password      | Redefinir senha via token     |

### Usuários
| Método | Rota                  | Descrição                           |
|--------|-----------------------|-------------------------------------|
| GET    | /api/users            | Listar usuários ativos              |
| PATCH  | /api/users/:id        | Editar perfil (nome, cor, avatar)   |
| GET    | /api/admin/users      | Listar todos os usuários (admin)    |
| POST   | /api/admin/users      | Criar usuário (admin)               |
| PATCH  | /api/admin/users/:id  | Editar usuário (admin)              |
| DELETE | /api/admin/users/:id  | Desativar usuário (admin)           |

### Projetos e Membros
| Método | Rota                              | Descrição                      |
|--------|-----------------------------------|--------------------------------|
| GET    | /api/projects                     | Listar projetos                |
| POST   | /api/projects                     | Criar projeto                  |
| PATCH  | /api/projects/:id                 | Editar projeto                 |
| GET    | /api/projects/:id/members         | Listar membros                 |
| POST   | /api/projects/:id/members         | Adicionar membro               |
| DELETE | /api/projects/:id/members/:userId | Remover membro                 |

### Tasks
| Método | Rota                          | Descrição                                           |
|--------|-------------------------------|-----------------------------------------------------|
| GET    | /api/tasks?projectId=         | Listar tasks (limite padrão: 500)                   |
| POST   | /api/tasks                    | Criar task                                          |
| GET    | /api/tasks/:id                | Detalhe da task                                     |
| PATCH  | /api/tasks/:id                | Atualizar task                                      |
| DELETE | /api/tasks/:id                | Excluir task                                        |
| POST   | /api/tasks/:id/clone          | Clonar task                                         |
| POST   | /api/tasks/reorder            | Reordenar tasks no Kanban                           |
| PATCH  | /api/tasks/bulk               | **Edição em massa** (status, prioridade, tipo, épico, sprint) |
| GET    | /api/tasks/:id/comments       | Listar comentários                                  |
| POST   | /api/tasks/:id/comments       | Adicionar comentário                                |
| GET    | /api/tasks/:id/time-logs      | Logs de tempo                                       |
| POST   | /api/tasks/:id/time-logs      | Registrar tempo                                     |

### Sprints
| Método | Rota                              | Descrição              |
|--------|-----------------------------------|------------------------|
| GET    | /api/sprints?projectId=           | Listar sprints         |
| POST   | /api/sprints                      | Criar sprint           |
| POST   | /api/sprints/:id/start            | Iniciar sprint         |
| POST   | /api/sprints/:id/complete         | Concluir sprint        |
| DELETE | /api/sprints/:id                  | Excluir sprint         |
| GET    | /api/sprints/:id/burndown         | Dados burndown chart   |
| GET    | /api/sprints/velocity/:projectId  | Dados de velocity      |

### Épicos e Documentação
| Método | Rota                            | Descrição                                       |
|--------|---------------------------------|-------------------------------------------------|
| GET    | /api/epics?projectId=           | Listar épicos                                   |
| POST   | /api/epics                      | Criar épico                                     |
| PATCH  | /api/epics/:id                  | Editar épico                                    |
| DELETE | /api/epics/:id                  | Excluir épico                                   |
| GET    | /api/documents                  | Listar documentos (todos os projetos)           |
| POST   | /api/documents                  | Criar documento                                 |
| PATCH  | /api/documents/:id              | Editar documento (conteúdo, cover, emoji)       |
| DELETE | /api/documents/:id              | Excluir documento                               |
| GET    | /api/documents/spaces           | Listar espaços (globais, todos os projetos)     |
| POST   | /api/documents/spaces           | Criar espaço                                    |
| PATCH  | /api/documents/spaces/:id       | Renomear espaço / alterar ícone                 |
| DELETE | /api/documents/spaces/:id       | Excluir espaço                                  |

### Busca e Importação
| Método | Rota                          | Descrição                                        |
|--------|-------------------------------|--------------------------------------------------|
| GET    | /api/search?q=                | Busca global (tasks, documentos, épicos)         |
| POST   | /api/import/jira-csv          | Importar tasks de Jira CSV (PT-BR ou EN)         |
| POST   | /api/import/jira-json         | Importar tasks de Jira JSON                      |
| POST   | /api/import/excel-tasks       | Importar tasks de planilha Excel (.xlsx)         |
| POST   | /api/import/document          | Importar documento (MD, DOCX, PDF, HTML)         |
| POST   | /api/import/confluence-html   | Importar espaço Confluence (HTML ou ZIP)         |
| GET    | /api/import/template/jira-csv | Baixar template CSV para importação              |
| GET    | /api/import/template/excel    | Baixar template Excel para importação            |
| GET    | /api/reports/project/:id      | Relatório geral do projeto                       |
| GET    | /api/ai/suggest               | Sugestão de AI para task ou documento            |

---

## Estrutura do projeto

```
agileflow/
├── docker-compose.yml
├── reset_dados.sql              ← Script para limpar dados (mantém usuários)
├── README.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        ← Modelo de dados completo
│   │   └── migrations/          ← Histórico de migrations
│   └── src/
│       ├── index.ts             ← Entrada da API + registro de rotas
│       ├── middleware/auth.ts   ← Autenticação JWT
│       └── routes/
│           ├── auth.ts          ← Login, registro, reset de senha
│           ├── adminUsers.ts    ← CRUD de usuários (admin)
│           ├── users.ts         ← Perfil do usuário logado
│           ├── projects.ts      ← Projetos e membros
│           ├── tasks.ts         ← Tasks + edição em massa (/bulk)
│           ├── columns.ts       ← Colunas Kanban por projeto
│           ├── sprints.ts       ← Ciclo de vida das sprints
│           ├── sprintAnalytics.ts ← Burndown + velocity
│           ├── epics.ts         ← Épicos
│           ├── documents.ts     ← Docs + espaços globais
│           ├── comments.ts      ← Comentários
│           ├── timeLogs.ts      ← Time tracking
│           ├── notifications.ts ← Notificações in-app
│           ├── reports.ts       ← Relatórios
│           ├── search.ts        ← Busca global
│           ├── ai.ts            ← AI Assistant (Claude)
│           └── imports.ts       ← Importação Jira/Excel/Confluence/PDF/DOCX
└── frontend/
    ├── vercel.json              ← Rewrite para SPA routing
    └── src/
        ├── App.tsx              ← Roteamento React Router
        ├── api/index.ts         ← Chamadas à API (axios)
        ├── components/
        │   ├── kanban/          ← KanbanBoard, TaskCard, TaskDetailModal
        │   ├── docs/            ← TiptapEditor (com paleta de cores)
        │   ├── Layout/Sidebar.tsx
        │   └── Shared/          ← Avatar, Badge, GlobalSearch, ProfileModal
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── DashboardPage.tsx
        │   ├── KanbanPage.tsx
        │   ├── BacklogPage.tsx  ← Filtros avançados + edição em massa
        │   ├── DocsPage.tsx     ← Documentação global multi-projeto
        │   ├── DocEditorPage.tsx ← Editor Tiptap com cover/emoji
        │   ├── EpicsPage.tsx
        │   ├── RoadmapPage.tsx
        │   ├── SprintAnalyticsPage.tsx
        │   ├── ReportsPage.tsx
        │   ├── TimeReportPage.tsx
        │   ├── TeamPage.tsx
        │   └── UserManagementPage.tsx
        ├── store/useAppStore.ts ← Estado global (Zustand)
        ├── types/index.ts
        └── styles/global.css
```

---

## Importação de tasks — formatos suportados

| Formato           | Rota                        | Observações                                    |
|-------------------|-----------------------------|------------------------------------------------|
| Jira CSV (PT-BR)  | POST /api/import/jira-csv   | Colunas: `Resumo`, `Situação`, `Prioridade`…   |
| Jira CSV (EN)     | POST /api/import/jira-csv   | Colunas: `Summary`, `Status`, `Priority`…      |
| Jira JSON         | POST /api/import/jira-json  | Export nativo do Jira Cloud                    |
| Excel (.xlsx)     | POST /api/import/excel-tasks| Colunas: `Título`, `Tipo`, `Prioridade`, `Status` |

Baixe os templates em `/api/import/template/jira-csv` e `/api/import/template/excel`.

---

## Edição em massa no Backlog

Selecione uma ou mais tasks com o checkbox e use o painel que aparece para alterar:

| Campo       | Opções                                                  |
|-------------|---------------------------------------------------------|
| Status      | Qualquer coluna Kanban do projeto                       |
| Prioridade  | Crítica · Alta · Média · Baixa                          |
| Tipo        | História · Bug · Tarefa · Spike · Épico · Subtarefa     |
| Épico       | Qualquer épico do projeto · Remover épico               |
| Sprint      | Qualquer sprint ativa/planejada · Mover para backlog    |

Apenas os campos selecionados são alterados — campos em `— não alterar —` são ignorados.

---

## Reset de dados

O arquivo `reset_dados.sql` na raiz do projeto apaga todos os dados operacionais mantendo apenas os usuários cadastrados. Útil para recomeçar do zero sem recriar contas.

```bash
# Execute no Neon SQL Editor ou via psql:
psql $DATABASE_URL -f reset_dados.sql
```

> ⚠️ **Irreversível.** Faça backup antes (Neon → Branches → Restore point).

---

## Deploy

### Variáveis no Render (backend)

No painel do serviço backend no Render, adicione em **Environment**:

```
DATABASE_URL       = (External URL do Neon)
JWT_SECRET         = (chave secreta forte)
NODE_ENV           = production
FRONTEND_URL       = https://agileflow-kappa.vercel.app
```

### Variáveis no Vercel (frontend)

No painel do projeto no Vercel, em **Settings → Environment Variables**:

```
VITE_API_URL = https://agileflow-anlp.onrender.com/api
```

### Processo de deploy

```bash
# 1. Fazer as alterações localmente e commitar
git add .
git commit -m "feat: descrição da mudança"

# 2. Subir para o repositório
git push origin main

# Render faz deploy automático do backend
# Vercel faz deploy automático do frontend
```

> O Render pode hibernar o serviço gratuito após inatividade — a primeira requisição pode demorar ~30 segundos para "acordar" o backend.
