import test from 'node:test';
import assert from 'node:assert/strict';

import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import { mapProjectRow, mapTaskRow, toUpdateProjectProgressRpc } from '../src/work-tracking/supabase-adapter.mjs';

test('maps snake-case project row into domain model', () => {
  const project = mapProjectRow({
    id: 'P-1', organization_id: 'ORG-A', department_id: 'DEP-ENG', project_type: 'ROAD',
    name: 'ปรับปรุงถนน', owner_user_id: 'U-1', location_text: 'พื้นที่ A', contract_no: 'C-1',
    contractor_name: 'ผู้รับจ้าง', budget_amount: '1500000', spent_amount: '500000',
    planned_progress: 60, actual_progress: 45, start_date: '2026-06-01', due_date: '2026-09-30',
    status: WORK_STATUS.IN_PROGRESS, problem_summary: 'ฝนตก', updated_at: '2026-08-26T00:00:00Z',
  });
  assert.equal(project.organizationId, 'ORG-A');
  assert.equal(project.departmentId, 'DEP-ENG');
  assert.equal(project.budget, 1500000);
  assert.equal(project.contractNo, 'C-1');
});

test('maps task row into task domain model', () => {
  const task = mapTaskRow({
    id: 'T-1', organization_id: 'ORG-A', department_id: 'DEP-ENG', project_id: 'P-1',
    title: 'สำรวจพื้นที่', assigned_user_id: 'U-1', status: WORK_STATUS.IN_PROGRESS,
    priority: 'HIGH', due_at: '2026-09-01T10:00:00Z', updated_at: '2026-08-26T00:00:00Z',
  });
  assert.equal(task.projectId, 'P-1');
  assert.equal(task.assignedUserId, 'U-1');
  assert.equal(task.priority, 'HIGH');
});

test('builds RPC args without organization or role fields from client', () => {
  const args = toUpdateProjectProgressRpc({
    project: { id: 'P-1', organizationId: 'ORG-A', actualProgress: 70, status: WORK_STATUS.IN_PROGRESS, problem: 'ติดตามวัสดุ' },
    expectedUpdatedAt: '2026-08-26T00:00:00Z',
    requestId: 'REQ-1',
  });
  assert.deepEqual(Object.keys(args).sort(), [
    'p_actual_progress', 'p_expected_updated_at', 'p_problem_summary', 'p_project_id', 'p_request_id', 'p_status',
  ].sort());
  assert.equal('organization_id' in args, false);
  assert.equal('role' in args, false);
});
