import { WORK_STATUS, normalizeProject } from './model.mjs';

const COLUMN_ALIASES = Object.freeze({
  id: ['id', 'รหัส', 'รหัสโครงการ', 'project id'],
  name: ['name', 'ชื่อโครงการ', 'โครงการ', 'project name'],
  department: ['department', 'กอง', 'หน่วยงาน', 'ส่วนงาน'],
  projectType: ['projecttype', 'ประเภท', 'ประเภทโครงการ'],
  owner: ['owner', 'ผู้รับผิดชอบ', 'เจ้าหน้าที่'],
  location: ['location', 'พื้นที่', 'สถานที่'],
  contractNo: ['contractno', 'เลขที่สัญญา', 'สัญญา'],
  contractor: ['contractor', 'ผู้รับจ้าง'],
  budget: ['budget', 'งบประมาณ', 'วงเงิน', 'วงเงินสัญญา'],
  spent: ['spent', 'เบิกจ่าย', 'จ่ายแล้ว', 'ยอดเบิกจ่าย'],
  plannedProgress: ['plannedprogress', 'แผน', 'ความก้าวหน้าตามแผน', 'แผนร้อยละ'],
  actualProgress: ['actualprogress', 'ผลจริง', 'ความก้าวหน้าจริง', 'ผลงานร้อยละ'],
  startDate: ['startdate', 'วันเริ่ม', 'วันที่เริ่ม'],
  dueDate: ['duedate', 'วันสิ้นสุด', 'กำหนดเสร็จ', 'สิ้นสุดสัญญา'],
  status: ['status', 'สถานะ'],
  lastUpdatedAt: ['lastupdatedat', 'วันที่อัปเดต', 'อัปเดตล่าสุด'],
  problem: ['problem', 'ปัญหา', 'อุปสรรค', 'หมายเหตุ'],
});

const STATUS_ALIASES = new Map([
  ['NOT_STARTED', WORK_STATUS.NOT_STARTED],
  ['ยังไม่เริ่ม', WORK_STATUS.NOT_STARTED],
  ['IN_PROGRESS', WORK_STATUS.IN_PROGRESS],
  ['กำลังดำเนินการ', WORK_STATUS.IN_PROGRESS],
  ['ดำเนินการ', WORK_STATUS.IN_PROGRESS],
  ['WAITING_REVIEW', WORK_STATUS.WAITING_REVIEW],
  ['รอตรวจ', WORK_STATUS.WAITING_REVIEW],
  ['รอตรวจรับ', WORK_STATUS.WAITING_REVIEW],
  ['COMPLETED', WORK_STATUS.COMPLETED],
  ['เสร็จ', WORK_STATUS.COMPLETED],
  ['เสร็จสิ้น', WORK_STATUS.COMPLETED],
  ['BLOCKED', WORK_STATUS.BLOCKED],
  ['ติดปัญหา', WORK_STATUS.BLOCKED],
]);

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_\-./()]+/g, '');

function parseCsvRows(text = '') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows.filter((values) => values.some((value) => value !== ''));
}

function buildColumnMap(headers = []) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const result = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeHeader);
    const index = normalizedHeaders.findIndex((header) => normalizedAliases.includes(header));
    if (index >= 0) result[field] = index;
  }
  return result;
}

function cell(row, columnMap, field) {
  const index = columnMap[field];
  return index === undefined ? '' : String(row[index] ?? '').trim();
}

function toNumber(value) {
  const cleaned = String(value || '').replace(/[,฿%\s]/g, '');
  if (!cleaned) return 0;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function mapStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return WORK_STATUS.NOT_STARTED;
  return STATUS_ALIASES.get(raw) || STATUS_ALIASES.get(raw.toUpperCase()) || WORK_STATUS.NOT_STARTED;
}

export function importProjectsFromCsv(csvText, organizationId) {
  const tenant = String(organizationId || '').trim();
  if (!tenant) {
    return { projects: [], errors: [{ row: 0, message: 'ต้องระบุ organizationId ก่อนนำเข้าข้อมูล' }], headers: [] };
  }

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { projects: [], errors: [{ row: 0, message: 'CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 รายการ' }], headers: rows[0] || [] };
  }

  const headers = rows[0];
  const columnMap = buildColumnMap(headers);
  if (columnMap.name === undefined) {
    return { projects: [], errors: [{ row: 1, message: 'ไม่พบคอลัมน์ชื่อโครงการ' }], headers };
  }

  const projects = [];
  const errors = [];

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const name = cell(row, columnMap, 'name');
    if (!name) {
      errors.push({ row: rowNumber, message: 'ไม่มีชื่อโครงการ' });
      return;
    }

    projects.push(normalizeProject({
      id: cell(row, columnMap, 'id') || `CSV-${String(rowNumber - 1).padStart(4, '0')}`,
      organizationId: tenant,
      name,
      department: cell(row, columnMap, 'department'),
      projectType: cell(row, columnMap, 'projectType'),
      owner: cell(row, columnMap, 'owner'),
      location: cell(row, columnMap, 'location'),
      contractNo: cell(row, columnMap, 'contractNo'),
      contractor: cell(row, columnMap, 'contractor'),
      budget: toNumber(cell(row, columnMap, 'budget')),
      spent: toNumber(cell(row, columnMap, 'spent')),
      plannedProgress: toNumber(cell(row, columnMap, 'plannedProgress')),
      actualProgress: toNumber(cell(row, columnMap, 'actualProgress')),
      startDate: cell(row, columnMap, 'startDate') || null,
      dueDate: cell(row, columnMap, 'dueDate') || null,
      status: mapStatus(cell(row, columnMap, 'status')),
      lastUpdatedAt: cell(row, columnMap, 'lastUpdatedAt') || null,
      problem: cell(row, columnMap, 'problem'),
    }));
  });

  return { projects, errors, headers };
}

export const CSV_TEMPLATE_HEADERS = [
  'รหัสโครงการ', 'ชื่อโครงการ', 'กอง', 'ประเภทโครงการ', 'ผู้รับผิดชอบ', 'พื้นที่',
  'เลขที่สัญญา', 'ผู้รับจ้าง', 'งบประมาณ', 'เบิกจ่าย', 'แผน', 'ผลจริง',
  'วันเริ่ม', 'กำหนดเสร็จ', 'สถานะ', 'วันที่อัปเดต', 'ปัญหา',
];
