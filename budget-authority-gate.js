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
    if (/องค์การบริหารส่วนจังหวัด|\bอบจ\b/i.test(input)) return 'อบจ';
    if (/เทศบาลนคร|\bทน\b/i.test(input)) return 'เทศบาลนคร';
    if (/เทศบาลเมือง|\bทม\b/i.test(input)) return 'เทศบาลเมือง';
    if (/เทศบาลตำบล|\bทต\b/i.test(input)) return 'เทศบาลตำบล';
    if (/องค์การบริหารส่วนตำบล|\bอบต\b/i.test(input)) return 'อบต';
    return null;
  }

  function detectFiscalYear(source = {}) {
    const input = normalize([
      source.fiscalYear, source.budgetYear, source.query,
      ...Object.values(source.userInputs || {})
    ].join(' '));
    if (/2569|2026/.test(input)) return FY2026;
    return null;
  }

  function isBudgetMatter(source = {}) {
    return /งบประมาณ|เงินอุดหนุนเฉพาะกิจ|เงินอุดหนุน|เงินจัดสรร|คำของบ|ขอรับงบ|โอนเงินจัดสรร|เปลี่ยนแปลงเงินจัดสรร|แผนการใช้จ่าย|สำนักงบประมาณ|สงป\.?/i.test(
      [source.query, source.task?.query, ...Object.values(source.userInputs || {})].join(' ')
    );
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

    const decisionLock = blockers.length > 0;
    return Object.freeze({
      applicable: true,
      status: decisionLock ? 'VERIFY_BUDGET_AUTHORITY' : 'DIRECT_UNIT_RULE_READY',
      decisionLock, blockers, fiscalYear, orgType, budgetUnitStatus,
      authorityBase: [
        'พ.ร.บ.วิธีการงบประมาณ พ.ศ. 2561',
        'ระเบียบว่าด้วยการบริหารงบประมาณ พ.ศ. 2562',
        'หลักเกณฑ์/หนังสือของสำนักงบประมาณที่ใช้บังคับในปีที่เกี่ยวข้อง',
        'หนังสือจัดสรรของรายการ'
      ],
      governorApproval
    });
  }

  const api = Object.freeze({ evaluate, detectOrgType, detectFiscalYear });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_BUDGET_AUTHORITY_GATE = api;
})();