import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AgileFlow database...');

  // Users
  const hash = await bcrypt.hash('senha123', 12);
  const [ana, bruno, carla, diego, elisa] = await Promise.all([
    prisma.user.upsert({ where: { email: 'ana@agileflow.dev' }, update: {}, create: { name: 'Ana Lima', email: 'ana@agileflow.dev', password: hash, role: 'DEVELOPER', color: '#6366f1' } }),
    prisma.user.upsert({ where: { email: 'bruno@agileflow.dev' }, update: {}, create: { name: 'Bruno Costa', email: 'bruno@agileflow.dev', password: hash, role: 'DEVELOPER', color: '#22c55e' } }),
    prisma.user.upsert({ where: { email: 'carla@agileflow.dev' }, update: {}, create: { name: 'Carla Dias', email: 'carla@agileflow.dev', password: hash, role: 'QA', color: '#f97316' } }),
    prisma.user.upsert({ where: { email: 'diego@agileflow.dev' }, update: {}, create: { name: 'Diego Melo', email: 'diego@agileflow.dev', password: hash, role: 'UX', color: '#a855f7' } }),
    prisma.user.upsert({ where: { email: 'elisa@agileflow.dev' }, update: {}, create: { name: 'Elisa Ramos', email: 'elisa@agileflow.dev', password: hash, role: 'PM', color: '#3b82f6' } }),
  ]);

  // Project
  const project = await prisma.project.upsert({
    where: { key: 'AF' },
    update: {},
    create: {
      name: 'Projeto AgileFlow Demo', key: 'AF', description: 'Projeto de demonstração com dados de exemplo.',
      color: '#6366f1', iconEmoji: '🚀', ownerId: elisa.id,
      members: { create: [
        { userId: elisa.id, role: 'PM' },
        { userId: ana.id,   role: 'DEVELOPER' },
        { userId: bruno.id, role: 'DEVELOPER' },
        { userId: carla.id, role: 'QA' },
        { userId: diego.id, role: 'UX' },
      ]},
      kanbanColumns: { create: [
        { name: 'A Fazer',       color: '#64748b', order: 0, isDefault: false },
        { name: 'Em Progresso',  color: '#3b82f6', order: 1, isDefault: false },
        { name: 'Em Revisão',    color: '#a855f7', order: 2, isDefault: false },
        { name: 'Concluído',     color: '#22c55e', order: 3, isDefault: true  },
      ]},
      spaces: { create: [
        { name: 'Engenharia', icon: '⚙️', order: 0 },
        { name: 'Produto',    icon: '📦', order: 1 },
        { name: 'UX & Design',icon: '🎨', order: 2 },
        { name: 'QA',         icon: '🧪', order: 3 },
      ]},
    },
    include: { kanbanColumns: true },
  });

  const cols = project.kanbanColumns.sort((a, b) => a.order - b.order);
  const [colTodo, colInProg, colReview, colDone] = cols;

  // Epic
  const epic = await prisma.epic.create({
    data: { title: 'Autenticação e Segurança', color: '#6366f1', projectId: project.id, creatorId: elisa.id },
  });

  // Sprint
  const sprint = await prisma.sprint.create({
    data: { name: 'Sprint 7', goal: 'Entregar módulo de autenticação completo', status: 'ACTIVE', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-14'), projectId: project.id },
  });

  // Tasks
  const t1 = await prisma.task.create({
    data: {
      taskKey: 'AF-101', title: 'Implementar login com OAuth2 (Google e GitHub)', type: 'STORY', priority: 'HIGH',
      storyPoints: 5, projectId: project.id, epicId: epic.id, sprintId: sprint.id, columnId: colDone.id, creatorId: elisa.id,
      description: 'Como usuário, quero poder fazer login utilizando minha conta Google ou GitHub para não precisar criar uma nova senha.',
      assignees: { create: [{ userId: ana.id }, { userId: bruno.id }] },
      criteria: { create: [
        { text: 'Botão "Entrar com Google" visível na tela de login', isDone: true, order: 0 },
        { text: 'Botão "Entrar com GitHub" visível na tela de login', isDone: true, order: 1 },
        { text: 'Redirecionamento correto após autenticação', isDone: true, order: 2 },
        { text: 'Sessão expira após 24h de inatividade', isDone: true, order: 3 },
      ]},
    },
  });

  const t2 = await prisma.task.create({
    data: {
      taskKey: 'AF-102', title: 'Corrigir erro 500 ao resetar senha com e-mail inválido', type: 'BUG', priority: 'HIGH',
      storyPoints: 2, projectId: project.id, epicId: epic.id, sprintId: sprint.id, columnId: colReview.id, creatorId: carla.id,
      description: 'API retorna 500 ao invés de 404 para e-mails não cadastrados.',
      assignees: { create: [{ userId: bruno.id }] },
      criteria: { create: [
        { text: 'API retorna 404 com mensagem amigável', isDone: true, order: 0 },
        { text: 'Nenhum stack trace exposto', isDone: true, order: 1 },
        { text: 'Teste automatizado cobrindo o cenário', isDone: false, order: 2 },
      ]},
    },
  });

  const t3 = await prisma.task.create({
    data: {
      taskKey: 'AF-103', title: 'Criar widget de métricas no dashboard principal', type: 'STORY', priority: 'MEDIUM',
      storyPoints: 8, projectId: project.id, sprintId: sprint.id, columnId: colInProg.id, creatorId: elisa.id,
      description: 'Cards de métricas com valores em tempo real no topo do dashboard.',
      assignees: { create: [{ userId: ana.id }, { userId: diego.id }] },
    },
  });

  await prisma.task.create({
    data: {
      taskKey: 'AF-104', title: 'Testes de regressão no fluxo de login', type: 'TASK', priority: 'HIGH',
      storyPoints: 3, projectId: project.id, epicId: epic.id, sprintId: sprint.id, columnId: colInProg.id, creatorId: carla.id,
      assignees: { create: [{ userId: carla.id }] },
    },
  });

  await prisma.task.create({
    data: {
      taskKey: 'AF-105', title: 'Spike: avaliar Stripe vs Pagar.me para pagamentos BR', type: 'SPIKE', priority: 'MEDIUM',
      storyPoints: 3, projectId: project.id, columnId: colTodo.id, creatorId: elisa.id,
      assignees: { create: [{ userId: elisa.id }, { userId: bruno.id }] },
    },
  });

  // Document
  await prisma.document.create({
    data: {
      title: 'Spec de Autenticação OAuth2', type: 'SPEC', projectId: project.id, authorId: bruno.id,
      content: '# Autenticação OAuth2\n\nEste documento descreve a implementação do OAuth2 com Google e GitHub.\n\n## Fluxo\n\n1. Usuário clica em "Entrar com Google"\n2. Redirecionamento para Google OAuth\n3. Callback com código de autorização\n4. Troca por access token\n5. Criação ou login do usuário\n\n## Endpoints\n\n- `GET /api/auth/google` — Inicia o fluxo OAuth\n- `GET /api/auth/google/callback` — Callback do Google',
      linkedTasks: { create: [{ taskId: t1.id }, { taskId: t2.id }] },
    },
  });

  // Comments
  await prisma.comment.createMany({
    data: [
      { taskId: t1.id, authorId: bruno.id, content: 'Backend do OAuth2 está pronto. Testei localmente com Google — OK.' },
      { taskId: t1.id, authorId: ana.id, content: 'Frontend integrado. Aguardando review do Bruno.' },
      { taskId: t1.id, authorId: carla.id, content: 'QA concluído. Todos os cenários passaram ✅' },
      { taskId: t2.id, authorId: bruno.id, content: 'Identifiquei o problema: falta de guard clause no service. Fix simples.' },
    ],
  });

  console.log('✅ Seed concluído com sucesso!');
  console.log('\nUsuários criados (senha: senha123):');
  console.log('  ana@agileflow.dev     — Developer');
  console.log('  bruno@agileflow.dev   — Developer');
  console.log('  carla@agileflow.dev   — QA');
  console.log('  diego@agileflow.dev   — UX Designer');
  console.log('  elisa@agileflow.dev   — Product Manager');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
