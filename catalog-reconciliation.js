(() => {
  'use strict';

  const EXPECTED_IDS = Object.freeze(Array.from({ length: 222 }, (_, index) => `GP${String(index + 1).padStart(3, '0')}`));

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function reconcile(catalog) {
    const items = Array.isArray(catalog) ? catalog : [];
    const ids = items.map(item => String(item?.id || ''));
    const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))].sort();
    const presentIds = [...new Set(ids.filter(id => EXPECTED_IDS.includes(id)))].sort();
    const missingIds = EXPECTED_IDS.filter(id => !presentIds.includes(id));
    const conflictingIds = duplicateIds.filter(id => items.filter(item => item?.id === id).some((item, index, matches) => index > 0 && JSON.stringify(item) !== JSON.stringify(matches[0])));
    return freeze({
      expectedRange: 'GP001–GP222',
      present: presentIds,
      missing: missingIds,
      duplicate: duplicateIds,
      conflict: conflictingIds,
      summary: { present: presentIds.length, missing: missingIds.length, duplicate: duplicateIds.length, conflict: conflictingIds.length }
    });
  }

  window.GOVPROMPT_CATALOG_RECONCILIATION = Object.freeze({ reconcile, expectedIds: EXPECTED_IDS });
})();
