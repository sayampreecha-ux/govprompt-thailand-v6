import { WORK_STATUS } from './model.mjs';
import { TASK_PRIORITY } from './task-model.mjs';
import { PILOT_ORGANIZATION_ID } from './pilot-data.mjs';

export const constructionPilotTasks = Object.freeze([
  {
    id: 'TASK-001', organizationId: PILOT_ORGANIZATION_ID, departmentId: 'DEP-ENGINEERING',
    projectId: 'CON-2569-001', title: 'ติดตามผู้รับจ้างเร่งรัดงานโครงสร้าง', assignedUserId: 'OFFICER-001',
    status: WORK_STATUS.IN_PROGRESS, priority: TASK_PRIORITY.URGENT,
    dueAt: '2026-08-27T16:30:00+07:00', lastUpdatedAt: '2026-08-25T15:00:00+07:00',
  },
  {
    id: 'TASK-002', organizationId: PILOT_ORGANIZATION_ID, departmentId: 'DEP-ENGINEERING',
    projectId: 'CON-2569-002', title: 'ตรวจสอบปริมาณงานงวดปัจจุบัน', assignedUserId: 'OFFICER-002',
    status: WORK_STATUS.IN_PROGRESS, priority: TASK_PRIORITY.HIGH,
    dueAt: '2026-08-30T16:30:00+07:00', lastUpdatedAt: '2026-08-24T15:00:00+07:00',
  },
  {
    id: 'TASK-003', organizationId: PILOT_ORGANIZATION_ID, departmentId: 'DEP-ENGINEERING',
    projectId: 'CON-2569-003', title: 'ประสานแก้ไขจุดติดขัดหน้างาน', assignedUserId: 'OFFICER-003',
    status: WORK_STATUS.BLOCKED, priority: TASK_PRIORITY.HIGH,
    dueAt: '2026-08-24T16:30:00+07:00', lastUpdatedAt: '2026-08-20T15:00:00+07:00',
  },
  {
    id: 'TASK-004', organizationId: PILOT_ORGANIZATION_ID, departmentId: 'DEP-ENGINEERING',
    projectId: 'CON-2569-004', title: 'จัดเตรียมเอกสารตรวจรับ', assignedUserId: 'OFFICER-001',
    status: WORK_STATUS.WAITING_REVIEW, priority: TASK_PRIORITY.NORMAL,
    dueAt: '2026-09-05T16:30:00+07:00', lastUpdatedAt: '2026-08-26T09:00:00+07:00',
  },
  {
    id: 'TASK-005', organizationId: PILOT_ORGANIZATION_ID, departmentId: 'DEP-ENGINEERING',
    projectId: 'CON-2569-005', title: 'บันทึกผลตรวจรับเข้าระบบ', assignedUserId: 'OFFICER-002',
    status: WORK_STATUS.COMPLETED, priority: TASK_PRIORITY.NORMAL,
    dueAt: '2026-08-20T16:30:00+07:00', completedAt: '2026-08-19T14:00:00+07:00', lastUpdatedAt: '2026-08-19T14:00:00+07:00',
  },
]);
