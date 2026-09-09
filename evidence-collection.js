(() => {
  'use strict';

  const CLASSIFICATION = Object.freeze({ SAFE: 'SAFE', SENSITIVE: 'SENSITIVE', PROHIBITED: 'PROHIBITED' });
  const STATUS = Object.freeze({ MISSING: 'missing', SUPPLIED: 'supplied', NEEDS_VERIFICATION: 'needs-verification', VERIFIED_BY_HUMAN: 'verified-by-human' });
  const PROHIBITED = new Set(['national-id', 'bank-account', 'patient-hn', 'medical-record', 'biometric']);
  const SENSITIVE = new Set(['person-name', 'address', 'phone', 'email', 'health-summary']);

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function classify(type) {
    const normalized = String(type || '').trim();
    if (PROHIBITED.has(normalized)) return CLASSIFICATION.PROHIBITED;
    if (SENSITIVE.has(normalized)) return CLASSIFICATION.SENSITIVE;
    return CLASSIFICATION.SAFE;
  }

  function create(entries = []) {
    const seen = new Set();
    const records = entries.map(entry => {
      const type = String(entry?.type || '').trim();
      const classification = classify(type);
      const status = Object.values(STATUS).includes(entry?.status) ? entry.status : STATUS.MISSING;
      if (!type || seen.has(type) || classification === CLASSIFICATION.PROHIBITED) return null;
      seen.add(type);
      return { type, classification, status };
    }).filter(Boolean);
    return freeze(records);
  }

  window.GOVPROMPT_EVIDENCE = Object.freeze({ create, classify, classification: CLASSIFICATION, statuses: STATUS });
})();
