(() => {
  'use strict';

  const FY2026 = 2569;
  const DIRECT_TYPES = Object.freeze(['อบจ', 'เทศบาลนคร', 'เทศบาลเมือง', 'เทศบาลตำบล']);
  const GOVERNOR_REASON = 'ไม่กำหนดให้ส่งผู้ว่าราชการจังหวัดโดยอัตโนมัติจากเพียงการเป็นเงินอุดหนุนเฉพาะกิจ; ต้องตรวจหลักเกณฑ์ปีงบประมาณ หนังสือจัดสรร และอำนาจเฉพาะเรื่อง';

  function text(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function normalize(value) { return text(value).normalize('NFC').replace(/[()（）]/g, ' '); }

  function detectOrgType(source = {}) {
    const input = normalize([
      source.orgType, source.organizationType, source.unitType, source.agency,
      source.department, source.query, source.task?.query, ...Object.values(source.userInputs || {})
    ].join(' '));
    if (/องค์การบริหารส่วนจังหวัด|(?:^|[\s,./()])อบจ(?:$|[\s,./()])/i.test(input)) return 'อบจ';
    if (/เทศบาลนคร|(?:^|[\s,./()])ทน(?:$|[\s,./()])/i.test(input)) return 'เทศบาลนคร';
    if (/เทศบาลเมือง|(?:^|[\s,./()])ทม(?:$|[\s,./()])/i.test(input)) return 'เทศบาลเมือง';
    if (/เทศบาลตำบล|(?:^|[\s,./()])ทต(?:$|[\s,./()])/i.test(input)) return 'เทศบาลตำบล';
    if (/องค์การบริหารส่วนตำบล|(?:^|[\s,./()])อบต(?:$|[\s,./()])/i.test(input)) return 'อบต';
    return null;
  }

  function detectFiscalYear(source = {}) {
    const input = normalize([
      source.fiscalYear, source.budgetYear, source.query, source.task?.query,
      ...Object.values(source.userInputs || {})
    ].join(' '));
    if (/2569|2026/.test(input)) return FY2026;
    return null;
  }

  function isBudgetMatter(source = {}) {
    return /งบประมาณ|เงินอุดหนุนเฉพาะกิจ|เงินอุดหนุน|เงินจัดสรร|คำของบ|ขอรับงบ|โอนเงินจัดสรร|เปลี่ยนแปลงเงินจัดสรร|แผนการใช้จ่าย|เงินกัน|กันเงิน|ก่อหนี้ผูกพัน|คำชี้แจงงบประมาณ|มติสภา|ญัตติ|สำนักงบประมาณ|สงป\.?/i.test(
      [source.query, source.task?.query, ...Object.values(source.userInputs || {})].join(' ')
    );
  }

  function detectBudgetStatus(source = {}) {
    const input = normalize([
      source.budgetStatus, source.budgetUnitStatus, source.commitmentStatus,
      source.query, source.task?.query, ...Object.values(source.userInputs || {})
    ].join(' '));

    if (/ก่อหนี้ผูกพันแล้ว|ก่อหนี้แล้ว|มีข้อผูกพันแล้ว|ทำสัญญาแล้ว|ทำสัญญาเรียบร้อยแล้ว/i.test(input)) {
      return 'COMMITTED';
    }
    if (/ยังไม่ได้ก่อหนี้ผูกพัน|มิได้ก่อหนี้ผูกพัน|ไม่ก่อหนี้ผูกพัน|ยังไม่มีข้อผูกพัน/i.test(input)) {
      return 'UNCOMMITTED';
    }
    if (/เงินกัน|กันเงิน/i.test(input)) return 'RESERVED_UNCLASSIFIED';
    return null;
  }

  function detectBudgetChange(source = {}) {
    const input = normalize([
      source.budgetChange, source.changeType, source.query, source.task?.query,
      ...Object.values(source.userInputs || {})
    ].join(' '));
    return {
      statement: /แก้ไข.*คำชี้แจง|เปลี่ยนแปลง.*คำชี้แจง|คำชี้แจง.*เปลี่ยน/i.test(input),
      substantive: /ลักษณะ|ปริมาณ|คุณภาพ|สถานที่ก่อสร้าง|เปลี่ยนสถานที่|เปลี่ยนสาระสำคัญ/i.test(input),
      amountIncrease: /เพิ่มวงเงิน|เพิ่ม.*วงเงิน|วงเงิน.*เพิ่ม/i.test(input),
      councilMotion: /มติสภา|แก้ไข.*มติ|เปลี่ยนแปลง.*มติ|ญัตติ/i.test(input)
    };
  }

  function evaluate(source = {}) {
    if (!isBudgetMatter(source)) {
      return Object.freeze({
        applicable: false, status: 'NOT_APPLICABLE', decisionLock: false, blockers: [],
        orgType: detectOrgType(source), fiscalYear: detectFiscalYear(source)
      });
    }

    const fiscalYear = detectFiscalYear(source);
    const orgType = detectOrgType(source);
    const blockers = [];
    const budgetStatus = detectBudgetStatus(source);
    const budgetChange = detectBudgetChange(source);
    let budgetUnitStatus = 'UNVERIFIED';

    if (fiscalYear === FY2026 && DIRECT_TYPES.includes(orgType)) {
      budgetUnitStatus = 'DIRECT_BUDGET_UNIT';
    } else if (orgType === 'อบต') {
      budgetUnitStatus = 'VERIFY_DIRECT_STATUS_BY_OFFICIAL_SOURCE';
      blockers.push('อบต ต้องตรวจสถานะหน่วยรับงบประมาณของหน่วยนั้นและปีงบประมาณจากแหล่งทางการ');
    } else if (!orgType) {
      blockers.push('ยังไม่ทราบประเภทหน่วยงาน/สถานะหน่วยรับงบประมาณ');
    } else {
      blockers.push('ต้องตรวจสถานะหน่วยรับงบประมาณของปีที่เกี่ยวข้องจากแหล่งทางการ');
    }

    const governorApproval = {
      automatic: false,
      required: null,
      rule: GOVERNOR_REASON,
      determination: 'NO_AUTO_ROUTE'
    };

    const authorityRoute = {
      status: budgetStatus || 'UNVERIFIED',
      primaryRuleCandidate:
        budgetStatus === 'COMMITTED' ? 'CHECK_RULE_31_FIRST' :
        budgetStatus === 'UNCOMMITTED' ? 'CHECK_RULE_30_IF_BUDGET_STATEMENT_CHANGE' :
        'CHECK_STATUS_BEFORE_SELECTING_RULE',
      rule30: {
        applicableByKeyword: false,
        note: 'ข้อ 30 ไม่ถูกเรียกอัตโนมัติเพียงเพราะพบคำว่า เงินกัน; ต้องตรวจสถานะและสิ่งที่เปลี่ยนก่อน'
      },
      rule31: {
        applicableByKeyword: false,
        note: 'หากก่อหนี้ผูกพันแล้ว ให้ตรวจข้อ 31 และเงื่อนไขการแก้ไขก่อน'
      },
      councilProcedure: {
        candidate: budgetChange.councilMotion ? 'CHECK_COUNCIL_AUTHORITY' : 'NOT_AUTOMATIC',
        rule38: 'ใช้ข้อ 38 เฉพาะเมื่อผลการตรวจสาระพบว่าต้องเสนอญัตติต่อสภา; ข้อ 38 เป็นกระบวนการเสนอญัตติ ไม่ใช่ฐานอำนาจสาระของการแก้ไขงบประมาณ'
      },
      decisionLock: !budgetStatus || (
        budgetStatus === 'COMMITTED' &&
        budgetChange.statement &&
        budgetChange.amountIncrease === false &&
        source.rule31Checked !== true
      )
    };

    const gateBlockers = [];
    if (!budgetStatus && /เงินกัน|กันเงิน|ก่อหนี้|ข้อผูกพัน|คำชี้แจง|มติสภา|ญัตติ/i.test(
      [source.query, source.task?.query, ...Object.values(source.userInputs || {})].join(' ')
    )) gateBlockers.push('budget-status-not-classified');
    if (authorityRoute.decisionLock) gateBlockers.push('committed-budget-rule31-check-required');

    const decisionLock = blockers.length > 0 || gateBlockers.length > 0;
    return Object.freeze({
      applicable: true,
      status: decisionLock ? 'VERIFY_BUDGET_AUTHORITY' : 'DIRECT_UNIT_RULE_READY',
      decisionLock, blockers: [...blockers, ...gateBlockers], fiscalYear, orgType, budgetUnitStatus,
      budgetStatus, budgetChange, authorityRoute,
      authorityBase: [
        'พ.ร.บ.วิธีการงบประมาณ พ.ศ. 2561',
        'ระเบียบว่าด้วยการบริหารงบประมาณ พ.ศ. 2562',
        'ระเบียบ/หลักเกณฑ์การรับเงินและการเบิกจ่ายเงินของ อปท. ที่ใช้บังคับกับรายการและช่วงเวลา',
        'ระเบียบวิธีการงบประมาณของ อปท. พ.ศ. 2563 ข้อ 30–31 เมื่อตรงกับลักษณะการเปลี่ยนแปลง',
        'ระเบียบข้อบังคับการประชุมสภาท้องถิ่นฯ ข้อ 38 เมื่อจำเป็นต้องเสนอญัตติ'
      ],
      governorApproval
    });
  }

  const api = Object.freeze({ evaluate, detectOrgType, detectFiscalYear, detectBudgetStatus, detectBudgetChange });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_BUDGET_AUTHORITY_GATE = api;
})();