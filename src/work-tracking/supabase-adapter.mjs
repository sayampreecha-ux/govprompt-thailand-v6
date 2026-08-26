import { normalizeProject } from './model.mjs';
import { normalizeTask } from './task-model.mjs';

export function mapProjectRow(row = {}) {
  return normalizeProject({
    id: row.id,
    organizationId: row.organization_id,
    departmentId: row.department_id,
    department: row.department_name || '',
    projectType: row.project_type,
    name: row.name,
    ownerUserId: row.owner_user_id,
    owner: row.owner_name || '',
    location: row.location_text,
    contractNo: row.contract_no,
    contractor: row.contractor_name,
    budget: row.budget_amount,
    spent: row.spent_amount,
    plannedProgress: row.planned_progress,
    actualProgress: row.actual_progress,
    startDate: row.start_date,
    dueDate: row.due_date,
    status: row.status,
    lastUpdatedAt: row.last_updated_at || row.updated_at,
    problem: row.problem_summary,
  });
}

export function mapTaskRow(row = {}) {
  return normalizeTask({
    id: row.id,
    organizationId: row.organization_id,
    departmentId: row.department_id,
    projectId: row.project_id,
    title: row.title,
    assignedUserId: row.assigned_user_id,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    lastUpdatedAt: row.updated_at,
  });
}

export function toUpdateProjectProgressRpc({ project = {}, expectedUpdatedAt = null, requestId = '' } = {}) {
  const normalized = normalizeProject(project);
  if (!normalized.id) throw new Error('PROJECT_ID_REQUIRED');
  return {
    p_project_id: normalized.id,
    p_actual_progress: normalized.actualProgress,
    p_status: normalized.status,
    p_problem_summary: normalized.problem || null,
    p_expected_updated_at: expectedUpdatedAt || null,
    p_request_id: String(requestId || '').trim() || null,
  };
}
