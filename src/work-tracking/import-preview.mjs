import { importProjectsFromCsv } from './csv-import.mjs';
import {
  DATA_QUALITY_SEVERITY,
  validateProjectBatch,
} from './data-quality.mjs';

export const IMPORT_ROW_STATUS = Object.freeze({
  VALID: 'VALID',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

export function buildProjectImportPreview(csvText, organizationId) {
  const imported = importProjectsFromCsv(csvText, organizationId);
  const quality = validateProjectBatch(imported.projects);
  const issuesByProjectId = new Map();

  quality.issues.forEach((item) => {
    const list = issuesByProjectId.get(item.projectId) || [];
    list.push(item);
    issuesByProjectId.set(item.projectId, list);
  });

  const projectRows = imported.projectRows.map(({ row, project }) => {
    const issues = issuesByProjectId.get(project.id) || [];
    const hasError = issues.some((item) => item.severity === DATA_QUALITY_SEVERITY.ERROR);
    const hasWarning = issues.some((item) => item.severity === DATA_QUALITY_SEVERITY.WARNING);
    const status = hasError
      ? IMPORT_ROW_STATUS.ERROR
      : hasWarning
        ? IMPORT_ROW_STATUS.WARNING
        : IMPORT_ROW_STATUS.VALID;

    return { row, project, status, issues };
  });

  const parserRows = imported.errors.map((item) => ({
    row: item.row,
    project: null,
    status: IMPORT_ROW_STATUS.ERROR,
    issues: [{
      projectId: '',
      severity: DATA_QUALITY_SEVERITY.ERROR,
      code: 'CSV_PARSE_OR_REQUIRED_FIELD',
      field: '',
      message: item.message,
    }],
  }));

  const rows = [...projectRows, ...parserRows].sort((a, b) => a.row - b.row);
  const errors = rows.filter((item) => item.status === IMPORT_ROW_STATUS.ERROR).length;
  const warnings = rows.filter((item) => item.status === IMPORT_ROW_STATUS.WARNING).length;
  const valid = rows.filter((item) => item.status === IMPORT_ROW_STATUS.VALID).length;

  return {
    organizationId: String(organizationId || '').trim(),
    headers: imported.headers,
    rows,
    acceptedProjects: quality.validProjects,
    canCommit: errors === 0 && rows.length > 0,
    requiresWarningConfirmation: errors === 0 && warnings > 0,
    summary: {
      totalRows: rows.length,
      valid,
      warnings,
      errors,
      accepted: quality.validProjects.length,
    },
  };
}
