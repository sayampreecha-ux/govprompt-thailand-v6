(() => {
  'use strict';

  const POLICY_VERSION = 'emergency-procurement-gate.1';
  const FLOOD_TERMS = Object.freeze([
    'น้ำท่วม','อุทกภัย','ภัยธรรมชาติ','อุบัติภัย','ฉุกเฉิน','เร่งด่วน',
    'ถุงยังชีพ','กระสอบทราย','เครื่องสูบน้ำ','ซ่อมแซมถนน'
  ]);

  const text = v => String(v ?? '').normalize('NFC').replace(/\s+/g,' ').trim();
  const hasAny = (s, terms) => terms.filter(t => s.includes(t));
  const numberFrom = v => {
    const s = text(v).replace(/,/g,'');
    const m = s.match(/\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  function evaluate(input = {}) {
    const query = text(input.query || input['คำถามหรือเรื่องที่ต้องการตรวจสอบ'] || '');
    const facts = text(input.facts || input['ข้อเท็จจริงที่มี'] || '');
    const item = text(input.item || input['รายการพัสดุ'] || '');
    const amount = numberFrom(input.amount ?? input['วงเงิน'] ?? input['วงเงิน/งบประมาณ']);
    const combined = [query,facts,item].filter(Boolean).join(' ');
    const floodHits = hasAny(combined, FLOOD_TERMS);
    const emergencyFacts = /จำเป็น|เร่งด่วน|ฉุกเฉิน|ไม่ทัน|ล่าช้า|ความเสียหาย|เสียหายร้ายแรง|คาดหมาย|คาดการณ์|ทันที/i.test(combined);

    let route = 'NOT_TRIGGERED';
    let decisionLock = false;
    let reason = 'ไม่พบข้อเท็จจริงที่ทำให้ Emergency Procurement Gate ต้องทำงาน';

    if (floodHits.length) {
      route = 'REQUIRES_EMERGENCY_PROCUREMENT_REVIEW';
      decisionLock = true;
      reason = 'พบคำที่เกี่ยวกับอุทกภัย/ภัยธรรมชาติหรือเหตุฉุกเฉิน แต่ยังห้ามสรุปวิธีจัดซื้อจากคำสำคัญเพียงอย่างเดียว';
    }

    let candidate = 'UNDETERMINED';
    if (floodHits.length && amount !== null && amount <= 500000 && emergencyFacts) {
      candidate = 'M56_2_B__CHECK_REGULATION_79';
    } else if (floodHits.length && emergencyFacts) {
      candidate = 'M56_2_D__CHECK_REGULATION_78';
    }

    const requiredFacts = Object.freeze([
      'ลักษณะพัสดุ/งานและวัตถุประสงค์',
      'ข้อเท็จจริงของเหตุภัยและเวลาที่เกิดเหตุ',
      'ความจำเป็นและความเร่งด่วน',
      'เหตุผลว่าขั้นตอนปกติจะไม่ทันหรืออาจก่อความเสียหายอย่างไร',
      'วงเงินและการไม่แบ่งซื้อแบ่งจ้าง',
      'ฐานอำนาจในการใช้จ่าย/ช่วยเหลือประชาชน',
      'แหล่งกฎหมาย/หนังสือราชการฉบับที่ใช้บังคับ ณ เวลาตัดสิน'
    ]);

    const authorityPaths = Object.freeze({
      M56_2_B__CHECK_REGULATION_79: 'พิจารณา พ.ร.บ.จัดซื้อจัดจ้างฯ มาตรา 56(2)(ข) และระเบียบฯ ข้อ 79 โดยตรวจเงื่อนไขให้ครบก่อนใช้ข้อ 79 วรรคสอง',
      M56_2_D__CHECK_REGULATION_78: 'พิจารณา พ.ร.บ.จัดซื้อจัดจ้างฯ มาตรา 56(2)(ง) และวิธีปฏิบัติตามระเบียบฯ ข้อ 78 โดยตรวจเงื่อนไขฉุกเฉินจากอุบัติภัย/ภัยธรรมชาติและความเสี่ยงจากความล่าช้า',
      UNDETERMINED: 'ยังเลือกเส้นทางไม่ได้ ต้องค้นฐานกฎหมายปฐมภูมิและตรวจข้อเท็จจริงเพิ่มเติม'
    });

    if (candidate !== 'UNDETERMINED') decisionLock = true;

    return Object.freeze({
      policyVersion: POLICY_VERSION,
      triggered: floodHits.length > 0,
      triggerTerms: Object.freeze(floodHits),
      candidateRoute: candidate,
      decisionLock,
      emergencyFactsDetected: emergencyFacts,
      amount,
      reason,
      authorityPath: authorityPaths[candidate],
      requiredFacts,
      prohibitions: Object.freeze([
        'ห้ามตีความว่า “น้ำท่วม = ข้อ 79 วรรคสอง” โดยอัตโนมัติ',
        'ห้ามใช้มาตรา 56(2)(ง) หรือข้อ 78 โดยไม่ตรวจเงื่อนไขข้อเท็จจริง',
        'ห้ามใช้เพดาน 500,000 บาทเป็นเงื่อนไขของมาตรา 56(2)(ง)',
        'ห้ามนำฐานวิธีจัดซื้อมาแทนฐานอำนาจการช่วยเหลือ/การใช้จ่ายงบประมาณ'
      ]),
      nextAction: 'SEARCH_PRIMARY_SOURCE_AND_RUN_FACT_MATCH'
    });
  }

  function promptPolicy(result) {
    if (!result?.triggered) return '';
    return [
      '',
      '=== EMERGENCY PROCUREMENT DECISION GATE ===',
      'Policy: ' + result.policyVersion,
      'สถานะ: ' + (result.decisionLock ? 'DECISION LOCK — ห้ามฟันธงวิธีจัดซื้อจนกว่าการตรวจจะครบ' : 'REVIEW'),
      'หลัก: น้ำท่วม/ภัยธรรมชาติไม่ใช่คำตอบของวิธีจัดซื้อโดยอัตโนมัติ',
      'Candidate route: ' + result.candidateRoute,
      'แนวทาง: ' + result.authorityPath,
      'ต้องตรวจ: ' + result.requiredFacts.join(' | '),
      'ข้อห้าม: ' + result.prohibitions.join(' | '),
      'การค้นกฎหมาย: ใช้แหล่งปฐมภูมิและตรวจฉบับที่ใช้บังคับ ณ วันที่เกิดเหตุ/วันที่ตัดสิน ก่อน Final Decision',
      'หากข้อมูลยังไม่ครบ ให้ตอบได้เฉพาะกฎทั่วไปและรายการข้อเท็จจริงที่ต้องตรวจ ห้ามสรุปว่าใช้ข้อ 79 หรือข้อ 78 ได้แล้ว',
      '=== END EMERGENCY PROCUREMENT DECISION GATE ==='
    ].join('\n');
  }

  const api = Object.freeze({ evaluate, promptPolicy, policyVersion: POLICY_VERSION });
  if (typeof window !== 'undefined') window.GOVPROMPT_EMERGENCY_PROCUREMENT_GATE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();