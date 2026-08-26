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

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
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

function parseStrictNumber(value, { label, min = null, max = null } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, value: 0 };

  const cleaned = raw.replace(/[,฿%\s]/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) {
    return { ok: false, message: `${label}ไม่ใช่ตัวเลขที่ถูกต้อง: ${raw}` };
  }

  const number = Number(cleaned);
  if (!Number.isFinite(number)) return { ok: false, message: `${label}ไม่ใช่ตัวเลขที่ถูกต้อง: ${raw}` };
  if (min !== null && number < min) return { ok: false, message: `${label}ต้องไม่น้อยกว่า ${min}` };
  if (max !== null && number > max) return { ok: false, message: `${label}ต้องไม่เกิน ${max}` };
  return { ok: true, value: number };
}

function isValidCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseStrictDate(value, label) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, value: null };

  let year;
  let month;
  let day;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const thai = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (thai) {
    day = Number(thai[1]);
    month = Number(thai[2]);
    year = Number(thai[3]);
    if (year >= 2400) year -= 543;
  } else {
    return { ok: false, message: `${label}ต้องเป็น YYYY-MM-DD หรือ วว/ดด/ปปปป` };
  }

  if (!isValidCalendarDate(year, month, day)) {
    return { ok: false, message: `${label}ไม่ใช่วันที่จริง: ${raw}` };
  }

  return {
    ok: true,
    value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function parseStrictStatus(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, value: WORK_STATUS.NOT_STARTED };
  const mapped = STATUS_ALIASES.get(raw) || STATUS_ALIASES.get(raw.toUpperCase());
  if (!mapped) return { ok: false, message: `สถานะไม่อยู่ในค่าที่รองรับ: ${raw}` };
  return { ok: true, value: mapped };
}

const emptyResult = (errors = [], headers = []) => ({ projects: [], projectRows: [], errors, headers });

export function importProjectsFromCsv(csvText, organizationId) {
  const tenant = String(organizationId || '').trim();
  if (!tenant) return emptyResult([{ row: 0, message: 'ต้องระบุ organizationId ก่อนนำเข้าข้อมูล' }]);

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return emptyResult([{ row: 0, message: 'CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 รายการ' }], rows[0] || []);
  }

  const headers = rows[0];
  const columnMap = buildColumnMap(headers);
  if (columnMap.name === undefined) {
    return emptyResult([{ row: 1, message: 'ไม่พบคอลัมน์ชื่อโครงการ' }], headers);
  }

  const projects = [];
  const projectRows = [];
  const errors = [];

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const rowErrors = [];
    const name = cell(row, columnMap, 'name');
    if (!name) rowErrors.push('ไม่มีชื่อโครงการ');

    const budget = parseStrictNumber(cell(row, columnMap, 'budget'), { label: 'งบประมาณ', min: 0 });
    const spent = parseStrictNumber(cell(row, columnMap, 'spent'), { label: 'เบิกจ่าย', min: 0 });
    const planned = parseStrictNumber(cell(row, columnMap, 'plannedProgress'), { label: 'แผนความก้าวหน้า', min: 0, max: 100 });
    const actual = parseStrictNumber(cell(row, columnMap, 'actualProgress'), { label: 'ความก้าวหน้าจริง', min: 0, max: 100 });
    const startDate = parseStrictDate(cell(row, columnMap, 'startDate'), 'วันเริ่ม');
    const dueDate = parseStrictDate(cell(row, columnMap, 'dueDate'), 'กำหนดเสร็จ');
    const status = parseStrictStatus(cell(row, columnMap, 'status'));

    [budget, spent, planned, actual, startDate, dueDate, status]
      .filter((item) => !item.ok)
      .forEach((item) => rowErrors.push(item.message));

    if (rowErrors.length) {
      errors.push({ row: rowNumber, message: rowErrors.join(' · ') });
      return;
    }

    const project = normalizeProject({
      id: cell(row, columnMap, 'id') || `CSV-${String(rowNumber - 1).padStart(4, '0')}`,
      organizationId: tenant,
      name,
      department: cell(row, columnMap, 'department'),
      projectType: cell(row, columnMap, 'projectType'),
      owner: cell(row, columnMap, 'owner'),
      location: cell(row, columnMap, 'location'),
      contractNo: cell(row, columnMap, 'contractNo'),
      contractor: cell(row, columnMap, 'contractor'),
      budget: budget.value,
      spent: spent.value,
      plannedProgress: planned.value,
      actualProgress: actual.value,
      startDate: startDate.value,
      dueDate: dueDate.value,
      status: status.value,
      lastUpdatedAt: cell(row, columnMap, 'lastUpdatedAt') || null,
      problem: cell(row, columnMap, 'problem'),
    });

    projects.push(project);
    projectRows.push({ row: rowNumber, project });
  });

  return { projects, projectRows, errors, headers };
}

export const CSV_TEMPLATE_HEADERS = [
  'รหัสโครงการ', 'ชื่อโครงการ', 'กอง', 'ประเภทโครงการ', 'ผู้รับผิดชอบ', 'พื้นที่',
  'เลขที่สัญญา', 'ผู้รับจ้าง', 'งบประมาณ', 'เบิกจ่าย', 'แผน', 'ผลจริง',
  'วันเริ่ม', 'กำหนดเสร็จ', 'สถานะ', 'วันที่อัปเดต', 'ปัญหา',
];
