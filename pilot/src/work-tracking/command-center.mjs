import { RISK_LEVEL, buildDashboardSummary, normalizeProject } from './model.mjs';
import { TASK_URGENCY, buildTaskSummary, normalizeTask } from './task-model.mjs';

const normalize = (value) => String(value || '').trim();

export function buildCommandCenter({
  projects = [],
  tasks = [],
  organizationId = '',
  now = new Date(),
} = {}) {
  const tenant = normalize(organizationId);
  if (!tenant) {
    return {
      organizationId: '',
      projectSummary: buildDashboardSummary([], now),
      taskSummary: buildTaskSummary([], now),
      actionQueue: [],
      counts: { urgentProjects: 0, attentionProjects: 0, urgentTasks: 0, attentionTasks: 0, totalActionItems: 0 },
    };
  }

  const scopedProjects = projects
    .map(normalizeProject)
    .filter((item) => item.organizationId === tenant);
  const scopedTasks = tasks
    .map(normalizeTask)
    .filter((item) => item.organizationId === tenant);

  const projectSummary = buildDashboardSummary(scopedProjects, now);
  const taskSummary = buildTaskSummary(scopedTasks, now);

  const projectActions = projectSummary.priority.map(({ project, risk }) => ({
    type: 'PROJECT',
    id: project.id,
    projectId: project.id,
    title: project.name,
    level: risk.level === RISK_LEVEL.RED ? 'URGENT' : 'ATTENTION',
    score: risk.score,
    reasons: risk.reasons,
    dueAt: project.dueDate,
  }));

  const taskActions = taskSummary.priority.map(({ task, urgency }) => ({
    type: 'TASK',
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    level: urgency.level === TASK_URGENCY.URGENT ? 'URGENT' : 'ATTENTION',
    score: urgency.score,
    reasons: urgency.reasons,
    dueAt: task.dueAt,
  }));

  const actionQueue = [...projectActions, ...taskActions]
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'URGENT' ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return String(a.dueAt || '').localeCompare(String(b.dueAt || ''));
    });

  const counts = {
    urgentProjects: projectActions.filter((item) => item.level === 'URGENT').length,
    attentionProjects: projectActions.filter((item) => item.level === 'ATTENTION').length,
    urgentTasks: taskActions.filter((item) => item.level === 'URGENT').length,
    attentionTasks: taskActions.filter((item) => item.level === 'ATTENTION').length,
    totalActionItems: actionQueue.length,
  };

  return { organizationId: tenant, projectSummary, taskSummary, actionQueue, counts };
}
