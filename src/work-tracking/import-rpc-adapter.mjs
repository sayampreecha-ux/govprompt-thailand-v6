import { IMPORT_ROW_STATUS } from './import-preview.mjs';
import { normalizeProject } from './model.mjs';

const normalize = (value) => String(value || '').trim();
const MAX_IMPORT_ROWS = 500;

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

export function countUnresolvedImportOwners(preview = {}) {
  if (!Array.isArray(preview.rows)) return 0;
  return preview.rows.filter((row) => {
    if (!row?.project || row.status === IMPORT_ROW_STATUS.ERROR) return false;
    return Boolean(normalize(row.project.owner)) && !normalize(row.project.ownerUserId);
  }).length;
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
  if (preview.rows.length > MAX_IMPORT_ROWS) throw new Error('IMPORT_TOO_LARGE');

  const errors = preview.rows.filter((row) => row.status === IMPORT_ROW_STATUS.ERROR);
  if (errors.length) throw new Error('IMPORT_HAS_ERRORS');

  const warnings = preview.rows.filter((row) => row.status === IMPORT_ROW_STATUS.WARNING);
  const unresolvedOwners = countUnresolvedImportOwners(preview);
  if ((warnings.length || unresolvedOwners > 0) && !confirmWarnings) {
    throw new Error('WARNING_CONFIRMATION_REQUIRED');
  }

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
