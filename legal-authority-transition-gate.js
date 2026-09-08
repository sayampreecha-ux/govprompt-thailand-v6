(() => {
  'use strict';

  const DECISIVE = new Set(['VERIFIED', 'HIGH_MATCH', 'PASS']);
  const BLOCKED_STATUS = 'BLOCKED_LATER_AUTHORITY_CHECK';

  function text(v) { return String(v ?? '').trim(); }
  function dateValue(v) {
    const s = text(v);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Hard gate for Thai-government legal/financial decisions that rely on
   * judgments, rulings, official opinions or precedents.
   *
   * Rule: a precedent can never be treated as VERIFIED/HIGH MATCH for the
   * present facts until the system has checked whether a later authority was
   * issued between the precedent facts and the present facts, and has resolved
   * the effect of every relevant later authority.
   */
  function evaluate(input = {}) {
    const precedentReliedOn = input.precedentReliedOn === true;
    if (!precedentReliedOn) return Object.freeze({ pass: true, status: 'NOT_APPLICABLE', decisionLock: false, blockers: [] });

    const precedentFactDate = dateValue(input.precedentFactDate);
    const currentFactDate = dateValue(input.currentFactDate);
    const laterAuthoritySearchCompleted = input.laterAuthoritySearchCompleted === true;
    const laterAuthorities = Array.isArray(input.laterAuthorities) ? input.laterAuthorities : [];
    const unresolved = laterAuthorities.filter(a => a?.relevant !== false && a?.transitionResolved !== true);
    const blockers = [];

    if (!precedentFactDate) blockers.push('missing-precedent-fact-date');
    if (!currentFactDate) blockers.push('missing-current-fact-date');
    if (!laterAuthoritySearchCompleted) blockers.push('later-authority-search-not-completed');
    if (precedentFactDate && currentFactDate && currentFactDate < precedentFactDate) blockers.push('timeline-not-resolved');
    if (unresolved.length) blockers.push('later-authority-effect-unresolved');

    const pass = blockers.length === 0;
    return Object.freeze({
      pass,
      status: pass ? 'PASS' : BLOCKED_STATUS,
      decisionLock: !pass,
      blockers: Object.freeze(blockers),
      requirements: Object.freeze([
        'identify-date-of-precedent-facts-not-judgment-date',
        'identify-date-of-current-facts',
        'search-authorities-issued-between-those-dates',
        'verify-current-and-event-time-rule-versions',
        'resolve-effect-of-each-relevant-later-authority',
        'perform-contrary-evidence-check-before-final-decision'
      ])
    });
  }

  function enforceDecisionState(state = {}, transition = {}) {
    const result = evaluate(transition);
    if (result.pass) return Object.freeze({ ...state, transitionGate: result });
    return Object.freeze({
      ...state,
      decisionLock: true,
      qualityStatus: 'UNVERIFIED',
      caseMatch: 'NOT_ASSESSED',
      ruleInterpretationConfidence: 'NOT_ASSESSED',
      workflowStatus: BLOCKED_STATUS,
      nextAction: 'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK',
      transitionGate: result
    });
  }

  const api = Object.freeze({ evaluate, enforceDecisionState, BLOCKED_STATUS });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_LEGAL_TRANSITION_GATE = api;
})();
