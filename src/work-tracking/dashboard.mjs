import {
  RISK_LEVEL,
  WORK_STATUS,
  assessProjectRisk,
  buildDashboardSummary,
  normalizeProject,
} from './model.mjs';

export const STATUS_LABELS = Object.freeze({
  [WORK_STATUS.NOT_STARTED]: 'ยังไม่เริ่ม',
  [WORK_STATUS.IN_PROGRESS]: 'กำลังดำเนินการ',
  [WORK_STATUS.WAITING_REVIEW]: 'รอตรวจ/ตรวจรับ',
  [WORK_STATUS.COMPLETED]: 'เสร็จสิ้น',
  [WORK_STATUS.BLOCKED]: 'ติดปัญหา',
});

export const RISK_LABELS = Object.freeze({
  [RISK_LEVEL.GREEN]: 'ปกติ',
  [RISK_LEVEL.YELLOW]: 'ต้องติดตาม',
  [RISK_LEVEL.RED]: 'เร่งด่วน',
});

export function formatBaht(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(number);
}

export function scopeProjectsToOrganization(projects = [], organizationId = '') {
  const tenant = String(organizationId || '').trim();
  if (!tenant) return [];
  return projects
    .map(normalizeProject)
    .filter((project) => project.organizationId === tenant);
}

export function filterProjects(projects = [], filters = {}, now = new Date()) {
  const query = String(filters.query || '').trim().toLowerCase();
  const status = String(filters.status || '').trim();
  const riskLevel = String(filters.riskLevel || '').trim();

  return projects.filter((projectInput) => {
    const project = normalizeProject(projectInput);
    const risk = assessProjectRisk(project, now);
    const haystack = [
      project.id,
      project.name,
      project.department,
      project.owner,
      project.problem,
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status && project.status !== status) return false;
    if (riskLevel && risk.level !== riskLevel) return false;
    return true;
  });
}

export function buildDashboardRows(projects = [], now = new Date()) {
  return projects.map((projectInput) => {
    const project = normalizeProject(projectInput);
    const risk = assessProjectRisk(project, now);
    return {
      id: project.id,
      name: project.name,
      department: project.department,
      owner: project.owner,
      budget: project.budget,
      spent: project.spent,
      budgetText: formatBaht(project.budget),
      spentText: formatBaht(project.spent),
      plannedProgress: project.plannedProgress,
      actualProgress: project.actualProgress,
      progressVariance: risk.metrics?.variance ?? 0,
      dueDate: project.dueDate,
      status: project.status,
      statusLabel: STATUS_LABELS[project.status] || project.status,
      riskLevel: risk.level,
      riskLabel: RISK_LABELS[risk.level] || risk.level,
      riskScore: risk.score || 0,
      riskReasons: risk.reasons || [],
      daysRemaining: risk.metrics?.daysRemaining ?? null,
      problem: project.problem,
    };
  });
}

export function buildOrganizationDashboard(projects = [], organizationId = '', options = {}) {
  const now = options.now || new Date();
  const scoped = scopeProjectsToOrganization(projects, organizationId);
  const filtered = filterProjects(scoped, options.filters || {}, now);
  const summary = buildDashboardSummary(filtered, now);
  const rows = buildDashboardRows(filtered, now)
    .sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name, 'th'));

  return {
    organizationId: String(organizationId || '').trim(),
    filters: options.filters || {},
    summary,
    rows,
    priorityRows: rows.filter((row) => row.riskLevel !== RISK_LEVEL.GREEN),
  };
}
