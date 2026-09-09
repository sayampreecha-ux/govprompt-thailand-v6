import { WORK_STATUS, normalizeProject } from './model.mjs';

export const DATA_QUALITY_SEVERITY = Object.freeze({
  ERROR: 'ERROR',
  WARNING: 'WARNING',
});

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const issue = (project, severity, code, message, field = '') => ({
  projectId: project.id,
  severity,
  code,
  field,
  message,
});

export function validateProjectQuality(projectInput = {}) {
  const project = normalizeProject(projectInput);
  const issues = [];

  if (!project.name) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'MISSING_NAME', 'ไม่มีชื่อโครงการ', 'name'));
  }

  if (!project.organizationId) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'MISSING_ORGANIZATION', 'ไม่มี organizationId', 'organizationId'));
  }

  if (!project.department) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'MISSING_DEPARTMENT', 'ยังไม่ได้ระบุกอง/หน่วยงานรับผิดชอบ', 'department'));
  }

  if (!project.owner) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'MISSING_OWNER', 'ยังไม่ได้ระบุผู้รับผิดชอบ', 'owner'));
  }

  if (project.budget <= 0) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'MISSING_BUDGET', 'งบประมาณเป็นศูนย์หรือยังไม่ได้ระบุ', 'budget'));
  }

  if (project.budget > 0 && project.spent > project.budget) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'SPENT_OVER_BUDGET', 'ยอดเบิก/จ่ายสูงกว่าวงเงิน ควรตรวจสอบการแก้ไขสัญญาหรือข้อมูลนำเข้า', 'spent'));
  }

  if (project.startDate && !isValidDate(project.startDate)) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'INVALID_START_DATE', 'วันที่เริ่มไม่อยู่ในรูปแบบที่ระบบอ่านได้', 'startDate'));
  }

  if (project.dueDate && !isValidDate(project.dueDate)) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'INVALID_DUE_DATE', 'กำหนดเสร็จไม่อยู่ในรูปแบบที่ระบบอ่านได้', 'dueDate'));
  }

  if (isValidDate(project.startDate) && isValidDate(project.dueDate)) {
    if (new Date(project.startDate).getTime() > new Date(project.dueDate).getTime()) {
      issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'DATE_ORDER', 'วันที่เริ่มอยู่หลังวันกำหนดเสร็จ', 'dueDate'));
    }
  }

  if (project.status === WORK_STATUS.COMPLETED && project.actualProgress < 100) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'COMPLETED_PROGRESS_MISMATCH', 'สถานะเสร็จสิ้น แต่ความก้าวหน้าจริงต่ำกว่า 100%', 'actualProgress'));
  }

  if (project.status !== WORK_STATUS.COMPLETED && project.actualProgress >= 100) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'PROGRESS_STATUS_MISMATCH', 'ความก้าวหน้า 100% แต่สถานะยังไม่เสร็จสิ้น อาจอยู่ระหว่างตรวจรับ', 'status'));
  }

  if (!project.dueDate && project.status !== WORK_STATUS.COMPLETED) {
    issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'MISSING_DUE_DATE', 'ยังไม่ได้ระบุกำหนดเสร็จ จึงประเมินความเสี่ยงด้านเวลาไม่ได้', 'dueDate'));
  }

  return issues;
}

export function validateProjectBatch(projects = []) {
  const normalized = projects.map(normalizeProject);
  const issues = normalized.flatMap(validateProjectQuality);

  const idCounts = new Map();
  const contractCounts = new Map();
  normalized.forEach((project) => {
    if (project.id) idCounts.set(project.id, (idCounts.get(project.id) || 0) + 1);
    if (project.contractNo) contractCounts.set(project.contractNo, (contractCounts.get(project.contractNo) || 0) + 1);
  });

  normalized.forEach((project) => {
    if (project.id && idCounts.get(project.id) > 1) {
      issues.push(issue(project, DATA_QUALITY_SEVERITY.ERROR, 'DUPLICATE_ID', `รหัสโครงการซ้ำ: ${project.id}`, 'id'));
    }
    if (project.contractNo && contractCounts.get(project.contractNo) > 1) {
      issues.push(issue(project, DATA_QUALITY_SEVERITY.WARNING, 'DUPLICATE_CONTRACT', `เลขที่สัญญาซ้ำ: ${project.contractNo}`, 'contractNo'));
    }
  });

  const errorIds = new Set(
    issues
      .filter((item) => item.severity === DATA_QUALITY_SEVERITY.ERROR)
      .map((item) => item.projectId),
  );

  return {
    projects: normalized,
    validProjects: normalized.filter((project) => !errorIds.has(project.id)),
    issues,
    summary: {
      total: normalized.length,
      valid: normalized.filter((project) => !errorIds.has(project.id)).length,
      errors: issues.filter((item) => item.severity === DATA_QUALITY_SEVERITY.ERROR).length,
      warnings: issues.filter((item) => item.severity === DATA_QUALITY_SEVERITY.WARNING).length,
    },
  };
}
