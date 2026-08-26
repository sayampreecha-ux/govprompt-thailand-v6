import { IMPORT_ROW_STATUS } from './import-preview.mjs';
import { normalizeProject } from './model.mjs';

const normalize = (value) => String(value || '').trim();

export function toImportProjectRow(projectInput = {}) {
  const project = normalizeProject(projectInput);
  return {
    projectCode: project.id,
    name: project.name,
    projectType: project.projectType || null,
    ownerUserId: project.ownerUserId || null,
    location: project.location || null,
    contractNo: project.contractNo || null,
    contractor: project.contractor || null,
    budget: project.budget,
    spent: project.spent,
    plannedProgress: project.plannedProgress,
    actualProgress: project.actualProgress,
    startDate: project.startDate || null,
    dueDate: project.dueDate || null,
    status: project.status,
    problem: project.problem || null,
  };
}

export function buildCommitProjectImportRpc({
  preview = {},
  organizationId = '',
  departmentId = '',
  filename = '',
  confirmWarnings = false,
  requestId = '',
} = {}) {
  const tenant = normalize(organizationId);
  const department = normalize(departmentId);
  const safeFilename = normalize(filename);

  if (!tenant) throw new Error('ORGANIZATION_REQUIRED');
  if (!department) throw new Error('DEPARTMENT_REQUIRED');
  if (!safeFilename) throw new Error('FILENAME_REQUIRED');
  if (!Array.isArray(preview.rows) || preview.rows.length === 0) throw new Error('IMPORT_ROWS_REQUIRED');

  const errors = preview.rows.filter((row) => row.status === IMPORT_ROW_STATUS.ERROR);
  if (errors.length) throw new Error('IMPORT_HAS_ERRORS');

  const warnings = preview.rows.filter((row) => row.status === IMPORT_ROW_STATUS.WARNING);
  if (warnings.length && !confirmWarnings) throw new Error('WARNING_CONFIRMATION_REQUIRED');

  const projects = preview.rows
    .filter((row) => row.project && row.status !== IMPORT_ROW_STATUS.ERROR)
    .map((row) => toImportProjectRow(row.project));

  if (!projects.length) throw new Error('IMPORT_ROWS_REQUIRED');

  return {
    p_organization_id: tenant,
    p_department_id: department,
    p_filename: safeFilename,
    p_rows: projects,
    p_confirm_warnings: Boolean(confirmWarnings),
    p_request_id: normalize(requestId) || null,
  };
}
