# AgileFlow 🚀

Plataforma de gestão ágil de projetos — tarefas, sprints, kanban, documentação, relatórios e colaboração em equipe.

## 🌐 Deploy

| Serviço   | URL                                          |
|-----------|----------------------------------------------|
| Frontend  | https://agileflow-kappa.vercel.app           |
| Backend   | https://agileflow-anlp.onrender.com          |

## Stack

| Camada    | Tecnologia                              |
|-----------|-----------------------------------------|
| Frontend  | React 18 + TypeScript + Vite + Zustand  |
| Backend   | Node.js + Express + TypeScript          |
| ORM       | Prisma                                  |
| Banco     | PostgreSQL 16                           |
| Auth      | JWT (7 dias)                            |
| Deploy    | Vercel (frontend) + Render (backend)    |

## Funcionalidades

- **Kanban** — arrastar e soltar, colunas customizáveis, filtros por assignee/prioridade/sprint
- **Tasks** — criação, edição, assignees, pontos, critérios de aceitação, dependências, comentários com @menção
- **Sprints** — planejamento, início, conclusão, burndown chart e velocity analytics
- **Épicos** — agrupamento de tasks com progresso visual
- **Documentação** — editor WYSIWYG (Tiptap), hierarquia de espaços/docs, versionamento
- **Relatórios** — métricas por projeto e sprint, gráficos, exportação
- **Time Tracking** — timer automático e log manual por task, relatório por membro
- **Notificações** — in-app com @menções e eventos de sprint/task
- **Gerenciamento de usuários** — painel admin com criação, edição, upload de avatar, ativação/desativação
- **Perfil** — edição de nome, telefone, cor do avatar e upload de foto
- **Importação** — Jira CSV e Confluence HTML
- **AI Assistant** — sugestões automáticas em tasks e documentos (Anthropic Claude)
- **Reset de senha** — via SMS (Twilio)

## Como rodar localmente

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16 (ou Docker)

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone https://github.com/nunesfabiazam/agileflow.git
cd agileflow
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edite `backend/.env` e defina:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/agileflow
JWT_SECRET=sua-chave-secreta
```

Edite `frontend/.env` e defina:

```env
VITE_API_URL=http://localhost:3001/api
```

### 2. Backend

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed     # popula com dados de demonstração
npm run dev         # inicia em http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev         # inicia em http://localhost:5173
```

### Com Docker Compose

```bash
docker-compose up -d
# Backend:  http://localhost:3001
# Frontend: http://localhost:3000
docker exec agileflow_backend npm run db:seed
```

## Login de demonstração

Após o seed, use qualquer um dos usuários abaixo (senha: `senha123`):

| E-mail                  | Papel           |
|-------------------------|-----------------|
| elisa@agileflow.dev     | Product Manager |
| ana@agileflow.dev       | Developer       |
| bruno@agileflow.dev     | Developer       |
| carla@agileflow.dev     | QA              |
| diego@agileflow.dev     | UX Designer     |

> **Admin:** crie um usuário com role `ADMIN` via painel de Gerenciamento de Usuários para ter acesso total.

## Variáveis de ambiente (backend)

| Variável               | Descrição                                 | Obrigatório |
|------------------------|-------------------------------------------|-------------|
| `DATABASE_URL`         | String de conexão PostgreSQL              | ✅          |
| `JWT_SECRET`           | Chave secreta para assinar tokens JWT     | ✅          |
| `PORT`                 | Porta do servidor (padrão: 3001)          | ❌          |
| `FRONTEND_URL`         | URL do frontend para CORS                 | ❌          |
| `ANTHROPIC_API_KEY`    | Chave da API Anthropic (AI Assistant)     | ❌          |
| `TWILIO_ACCOUNT_SID`   | SID da conta Twilio (reset de senha SMS)  | ❌          |
| `TWILIO_AUTH_TOKEN`    | Token de autenticação Twilio              | ❌          |
| `TWILIO_PHONE_NUMBER`  | Número de origem dos SMS                  | ❌          |

## Principais endpoints da API

| Método | Rota                              | Descrição                          |
|--------|-----------------------------------|------------------------------------|
| POST   | /api/auth/login                   | Login + JWT                        |
| POST   | /api/auth/register                | Cadastro                           |
| GET    | /api/auth/me                      | Usuário autenticado                |
| POST   | /api/auth/forgot-password         | Solicitar reset via SMS            |
| POST   | /api/auth/reset-password          | Redefinir senha                    |
| GET    | /api/users                        | Listar usuários ativos             |
| PATCH  | /api/users/:id                    | Editar perfil (nome, cor, avatar)  |
| GET    | /api/admin/users                  | Listar todos os usuários (admin)   |
| POST   | /api/admin/users                  | Criar usuário (admin)              |
| PATCH  | /api/admin/users/:id              | Editar usuário (admin)             |
| DELETE | /api/admin/users/:id              | Desativar usuário (admin)          |
| GET    | /api/projects                     | Listar projetos                    |
| POST   | /api/projects                     | Criar projeto                      |
| GET    | /api/tasks?projectId=             | Listar tasks                       |
| POST   | /api/tasks                        | Criar task                         |
| PATCH  | /api/tasks/:id                    | Atualizar task                     |
| GET    | /api/tasks/:id/comments           | Comentários da task                |
| POST   | /api/tasks/:id/comments           | Adicionar comentário               |
| GET    | /api/tasks/:id/time-logs          | Logs de tempo da task              |
| POST   | /api/tasks/:id/time-logs          | Registrar tempo                    |
| GET    | /api/sprints?projectId=           | Listar sprints                     |
| POST   | /api/sprints/:id/start            | Iniciar sprint                     |
| POST   | /api/sprints/:id/complete         | Concluir sprint                    |
| GET    | /api/sprints/:id/burndown         | Dados do burndown chart            |
| GET    | /api/sprints/velocity/:projectId  | Dados de velocity                  |
| GET    | /api/epics?projectId=             | Listar épicos                      |
| GET    | /api/documents?projectId=         | Listar documentos                  |
| GET    | /api/reports/project/:id          | Relatório de projeto               |
| GET    | /api/search?q=                    | Busca global                       |
| POST   | /api/import/jira-csv              | Importar do Jira (CSV)             |
| POST   | /api/import/confluence-html       | Importar do Confluence             |

## Estrutura do projeto

```
agileflow/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   └── schema.prisma              ← Modelo de dados
│   └── src/
│       ├── index.ts                   ← Entrada da API + registro de rotas
│       ├── middleware/auth.ts         ← Autenticação JWT
│       └── routes/
│           ├── auth.ts                ← Login, registro, reset de senha
│           ├── adminUsers.ts          ← CRUD de usuários (admin)
│           ├── users.ts               ← Perfil do usuário logado
│           ├── projects.ts
│           ├── tasks.ts
│           ├── sprints.ts
│           ├── sprintAnalytics.ts     ← Burndown + velocity
│           ├── epics.ts
│           ├── columns.ts
│           ├── documents.ts
│           ├── comments.ts
│           ├── timeLogs.ts
│           ├── notifications.ts
│           ├── reports.ts
│           ├── search.ts
│           ├── ai.ts                  ← AI Assistant (Claude)
│           └── imports.ts
└── frontend/
    ├── vercel.json                    ← Rewrite para SPA routing
    └── src/
        ├── App.tsx                    ← Roteamento React Router
        ├── api/                       ← Chamadas à API (axios)
        ├── components/
        │   ├── kanban/                ← KanbanBoard, TaskCard, TaskDetail
        │   ├── Layout/Sidebar.tsx
        │   └── Shared/                ← Avatar, Badge, ProfileModal
        ├── pages/                     ← Login, Dashboard, Kanban, Backlog,
        │                                 Docs, Team, Reports, Roadmap,
        │                                 SprintAnalytics, TimeReport,
        │                                 UserManagementPage
        ├── store/useAppStore.ts       ← Estado global (Zustand)
        ├── types/index.ts
        └── styles/global.css
```
