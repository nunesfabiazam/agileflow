# AgileFlow 🚀

Plataforma de gestão ágil de projetos — tarefas, sprints, kanban, documentação e relatórios.

## Stack

| Camada    | Tecnologia                          |
|-----------|-------------------------------------|
| Frontend  | React 18 + TypeScript + Vite        |
| Backend   | Node.js + Express + TypeScript      |
| ORM       | Prisma                              |
| Banco     | PostgreSQL 16                       |
| Auth      | JWT                                 |
| Deploy    | Docker Compose                      |

## Como rodar (modo desenvolvimento)

### Pré-requisitos
- Docker e Docker Compose instalados
- Node.js 20+ (para desenvolvimento local sem Docker)

### 1. Clonar e configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Subir tudo com Docker Compose

```bash
docker-compose up -d
```

Isso vai iniciar:
- **PostgreSQL** na porta `5432`
- **Backend API** na porta `3001`
- **Frontend** na porta `3000`

### 3. Rodar as migrations e seed (primeira vez)

```bash
docker exec agileflow_backend npm run db:migrate
docker exec agileflow_backend npm run db:seed
```

### 4. Acessar

- Frontend: http://localhost:3000
- API: http://localhost:3001/api
- Health check: http://localhost:3001/api/health

### Login de demonstração

Após o seed, use qualquer um dos usuários abaixo (senha: `senha123`):

| E-mail                | Papel           |
|-----------------------|-----------------|
| elisa@agileflow.dev   | Product Manager |
| ana@agileflow.dev     | Developer       |
| bruno@agileflow.dev   | Developer       |
| carla@agileflow.dev   | QA              |
| diego@agileflow.dev   | UX Designer     |

## Desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Editar .env com sua string de conexão PostgreSQL
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Principais endpoints da API

| Método | Rota                          | Descrição                        |
|--------|-------------------------------|----------------------------------|
| POST   | /api/auth/register            | Cadastro de usuário              |
| POST   | /api/auth/login               | Login + JWT                      |
| GET    | /api/projects                 | Listar projetos do usuário       |
| POST   | /api/projects                 | Criar projeto                    |
| GET    | /api/tasks?projectId=         | Listar tasks com filtros         |
| POST   | /api/tasks                    | Criar task                       |
| PATCH  | /api/tasks/:id                | Atualizar task                   |
| POST   | /api/tasks/reorder            | Reordenar tasks no kanban        |
| GET    | /api/sprints?projectId=       | Listar sprints                   |
| POST   | /api/sprints/:id/start        | Iniciar sprint                   |
| POST   | /api/sprints/:id/complete     | Concluir sprint                  |
| GET    | /api/epics?projectId=         | Listar épicos                    |
| GET    | /api/columns?projectId=       | Listar colunas do kanban         |
| POST   | /api/columns                  | Criar coluna                     |
| GET    | /api/documents?projectId=     | Listar documentos                |
| POST   | /api/documents                | Criar documento                  |
| GET    | /api/reports/project/:id      | Relatório de projeto             |
| GET    | /api/reports/sprint/:id       | Relatório de sprint              |
| POST   | /api/import/jira-csv          | Importar tasks do Jira (CSV)     |
| POST   | /api/import/confluence-html   | Importar docs do Confluence      |

## Estrutura do projeto

```
agileflow/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          ← Modelo de dados completo
│   └── src/
│       ├── index.ts               ← Entrada da API
│       ├── middleware/auth.ts     ← Autenticação JWT
│       ├── routes/                ← Todas as rotas REST
│       │   ├── auth.ts
│       │   ├── tasks.ts
│       │   ├── projects.ts
│       │   ├── sprints.ts
│       │   ├── epics.ts
│       │   ├── columns.ts
│       │   ├── documents.ts
│       │   ├── reports.ts
│       │   └── imports.ts
│       ├── types/index.ts
│       └── utils/seed.ts
└── frontend/
    └── src/
        ├── App.tsx                ← Roteamento
        ├── main.tsx
        ├── api/                   ← Todas as chamadas à API
        ├── components/
        │   ├── Kanban/            ← KanbanBoard, TaskCard, TaskDetail, AddColumn
        │   ├── Layout/Sidebar.tsx
        │   └── Shared/            ← Avatar, Badge
        ├── pages/                 ← Login, Kanban, Backlog, Dashboard, Docs, Team, Reports
        ├── store/useAppStore.ts   ← Estado global (Zustand)
        ├── types/index.ts         ← Tipos TypeScript
        └── styles/global.css      ← Estilos globais
```
