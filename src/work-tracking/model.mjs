export const WORK_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_REVIEW: 'WAITING_REVIEW',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
});

export const RISK_LEVEL = Object.freeze({
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
});

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
};

const daysBetween = (from, to) => {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
};

export function normalizeProject(input = {}) {
  return {
    id: String(input.id || '').trim(),
    organizationId: String(input.organizationId || '').trim(),
    department: String(input.department || '').trim(),
    projectType: String(input.projectType || '').trim(),
    name: String(input.name || '').trim(),
    owner: String(input.owner || '').trim(),
    location: String(input.location || '').trim(),
    contractNo: String(input.contractNo || '').trim(),
    contractor: String(input.contractor || '').trim(),
    budget: Math.max(0, Number(input.budget) || 0),
    spent: Math.max(0, Number(input.spent) || 0),
    plannedProgress: clampPercent(input.plannedProgress),
    actualProgress: clampPercent(input.actualProgress),
    startDate: input.startDate || null,
    dueDate: input.dueDate || null,
    status: Object.values(WORK_STATUS).includes(input.status)
      ? input.status
      : WORK_STATUS.NOT_STARTED,
    lastUpdatedAt: input.lastUpdatedAt || null,
    problem: String(input.problem || '').trim(),
  };
}

export function assessProjectRisk(projectInput, now = new Date()) {
  const project = normalizeProject(projectInput);
  const variance = project.actualProgress - project.plannedProgress;
  const daysRemaining = project.dueDate ? daysBetween(now, project.dueDate) : null;
  const budgetUtilization = project.budget > 0
    ? Math.round((project.spent / project.budget) * 1000) / 10
    : 0;

  if (project.status === WORK_STATUS.COMPLETED) {
    return {
      level: RISK_LEVEL.GREEN,
      score: 0,
      reasons: ['งานเสร็จสิ้นแล้ว'],
      metrics: { variance, daysRemaining, budgetUtilization },
    };
  }

  const reasons = [];
  let score = 0;

  if (project.status === WORK_STATUS.BLOCKED) {
    score += 4;
    reasons.push('สถานะงานติดปัญหา');
  }

  if (variance <= -20) {
    score += 4;
    reasons.push(`ผลงานจริงต่ำกว่าแผน ${Math.abs(variance)} จุดเปอร์เซ็นต์`);
  } else if (variance <= -10) {
    score += 2;
    reasons.push(`ผลงานจริงต่ำกว่าแผน ${Math.abs(variance)} จุดเปอร์เซ็นต์`);
  }

  if (daysRemaining !== null) {
    if (daysRemaining < 0) {
      score += 5;
      reasons.push(`เกินกำหนด ${Math.abs(daysRemaining)} วัน`);
    } else if (daysRemaining <= 14 && project.actualProgress < 80) {
      score += 3;
      reasons.push(`เหลือ ${daysRemaining} วัน แต่ความก้าวหน้า ${project.actualProgress}%`);
    } else if (daysRemaining <= 30 && project.actualProgress < 60) {
      score += 2;
      reasons.push(`เหลือ ${daysRemaining} วัน และความก้าวหน้ายังต่ำ`);
    }
  }

  if (project.lastUpdatedAt) {
    const daysSinceUpdate = daysBetween(project.lastUpdatedAt, now);
    if (daysSinceUpdate !== null && daysSinceUpdate > 30) {
      score += 2;
      reasons.push(`ไม่มีการอัปเดต ${daysSinceUpdate} วัน`);
    }
  }

  const level = score >= 5
    ? RISK_LEVEL.RED
    : score >= 2
      ? RISK_LEVEL.YELLOW
      : RISK_LEVEL.GREEN;

  return {
    level,
    score,
    reasons: reasons.length ? reasons : ['ยังไม่พบสัญญาณความเสี่ยงสำคัญ'],
    metrics: {
      variance,
      daysRemaining,
      budgetUtilization,
    },
  };
}

export function buildDashboardSummary(projects = [], now = new Date()) {
  const normalized = projects.map(normalizeProject);
  const risks = normalized.map((project) => ({
    project,
    risk: assessProjectRisk(project, now),
  }));

  const counts = {
    total: normalized.length,
    completed: normalized.filter((item) => item.status === WORK_STATUS.COMPLETED).length,
    inProgress: normalized.filter((item) => item.status === WORK_STATUS.IN_PROGRESS).length,
    notStarted: normalized.filter((item) => item.status === WORK_STATUS.NOT_STARTED).length,
    waitingReview: normalized.filter((item) => item.status === WORK_STATUS.WAITING_REVIEW).length,
    blocked: normalized.filter((item) => item.status === WORK_STATUS.BLOCKED).length,
    green: risks.filter((item) => item.risk.level === RISK_LEVEL.GREEN).length,
    yellow: risks.filter((item) => item.risk.level === RISK_LEVEL.YELLOW).length,
    red: risks.filter((item) => item.risk.level === RISK_LEVEL.RED).length,
  };

  const totalBudget = normalized.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = normalized.reduce((sum, item) => sum + item.spent, 0);
  const averageProgress = normalized.length
    ? normalized.reduce((sum, item) => sum + item.actualProgress, 0) / normalized.length
    : 0;

  return {
    counts,
    finance: {
      totalBudget,
      totalSpent,
      utilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
    },
    averageProgress: Math.round(averageProgress * 10) / 10,
    priority: risks
      .filter((item) => item.risk.level !== RISK_LEVEL.GREEN)
      .sort((a, b) => b.risk.score - a.risk.score),
  };
}
