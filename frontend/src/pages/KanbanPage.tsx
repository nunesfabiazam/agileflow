import { useAppStore } from '../store/useAppStore';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { useQuery } from '@tanstack/react-query';
import { sprintsApi } from '../api';

export function KanbanPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => sprintsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const activeSprint = sprintsData?.find(s => s.status === 'ACTIVE');

  if (!activeProjectId) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🗂️</div>
        <div className="empty-text">Nenhum projeto selecionado</div>
        <div className="empty-sub">Selecione um projeto na barra lateral para visualizar o Kanban.</div>
      </div>
    );
  }

  return (
    <div>
      <SprintPanel projectId={activeProjectId} />
      <KanbanBoard
        projectId={activeProjectId}
        sprintId={activeSprint?.id}
        sprintName={activeSprint?.name}
      />
    </div>
  );
}
