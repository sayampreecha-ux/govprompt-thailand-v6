import { WORK_STATUS } from './model.mjs';

export const TASK_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const TASK_URGENCY = Object.freeze({
  NORMAL: 'NORMAL',
  ATTENTION: 'ATTENTION',
  URGENT: 'URGENT',
});

const normalize = (value) => String(value || '').trim();

const daysBetween = (from, to) => {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
};

export function normalizeTask(input = {}) {
  return {
    id: normalize(input.id),
    organizationId: normalize(input.organizationId),
    departmentId: normalize(input.departmentId),
    projectId: normalize(input.projectId),
    title: normalize(input.title),
    assignedUserId: normalize(input.assignedUserId),
    status: Object.values(WORK_STATUS).includes(input.status)
      ? input.status
      : WORK_STATUS.NOT_STARTED,
    priority: Object.values(TASK_PRIORITY).includes(input.priority)
      ? input.priority
      : TASK_PRIORITY.NORMAL,
    dueAt: input.dueAt || null,
    completedAt: input.completedAt || null,
    lastUpdatedAt: input.lastUpdatedAt || null,
  };
}

export function assessTaskUrgency(taskInput = {}, now = new Date()) {
  const task = normalizeTask(taskInput);
  if (task.status === WORK_STATUS.COMPLETED) {
    return { level: TASK_URGENCY.NORMAL, score: 0, daysRemaining: null, reasons: ['งานย่อยเสร็จสิ้นแล้ว'] };
  }

  let score = 0;
  const reasons = [];
  const daysRemaining = task.dueAt ? daysBetween(now, task.dueAt) : null;

  if (task.status === WORK_STATUS.BLOCKED) {
    score += 4;
    reasons.push('งานย่อยติดปัญหา');
  }

  if (task.priority === TASK_PRIORITY.URGENT) {
    score += 3;
    reasons.push('กำหนดความสำคัญเป็นเร่งด่วน');
  } else if (task.priority === TASK_PRIORITY.HIGH) {
    score += 2;
    reasons.push('กำหนดความสำคัญสูง');
  }

  if (daysRemaining !== null) {
    if (daysRemaining < 0) {
      score += 5;
      reasons.push(`งานย่อยเกินกำหนด ${Math.abs(daysRemaining)} วัน`);
    } else if (daysRemaining <= 2) {
      score += 3;
      reasons.push(`เหลือ ${daysRemaining} วัน`);
    } else if (daysRemaining <= 7) {
      score += 1;
      reasons.push(`ครบกำหนดภายใน ${daysRemaining} วัน`);
    }
  }

  if (task.lastUpdatedAt) {
    const daysSinceUpdate = daysBetween(task.lastUpdatedAt, now);
    if (daysSinceUpdate !== null && daysSinceUpdate > 14) {
      score += 1;
      reasons.push(`ไม่มีการอัปเดต ${daysSinceUpdate} วัน`);
    }
  }

  const level = score >= 5
    ? TASK_URGENCY.URGENT
    : score >= 2
      ? TASK_URGENCY.ATTENTION
      : TASK_URGENCY.NORMAL;

  return {
    level,
    score,
    daysRemaining,
    reasons: reasons.length ? reasons : ['ยังไม่พบสัญญาณเร่งด่วน'],
  };
}

export function buildTaskSummary(tasks = [], now = new Date()) {
  const normalized = tasks.map(normalizeTask);
  const assessed = normalized.map((task) => ({ task, urgency: assessTaskUrgency(task, now) }));

  return {
    counts: {
      total: normalized.length,
      completed: normalized.filter((item) => item.status === WORK_STATUS.COMPLETED).length,
      inProgress: normalized.filter((item) => item.status === WORK_STATUS.IN_PROGRESS).length,
      blocked: normalized.filter((item) => item.status === WORK_STATUS.BLOCKED).length,
      urgent: assessed.filter((item) => item.urgency.level === TASK_URGENCY.URGENT).length,
      attention: assessed.filter((item) => item.urgency.level === TASK_URGENCY.ATTENTION).length,
    },
    priority: assessed
      .filter((item) => item.urgency.level !== TASK_URGENCY.NORMAL)
      .sort((a, b) => b.urgency.score - a.urgency.score),
  };
}
