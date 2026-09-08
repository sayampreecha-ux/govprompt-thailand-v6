# GovPrompt v7.1 — Legal Authority Transition Gate Test Report

Date: 2026-09-08
Branch: `v7/release-candidate`

## Result

Critical regression suite: **PASS 3/3**

1. A precedent-based decision is blocked when the later-authority search has not been completed.
2. The house-rent regression scenario involving Supreme Administrative Court judgment อ.24/2567 remains blocked while the effect of Ministry of Interior letter มท 0808.2/ว 0679 dated 6 February 2018 is unresolved.
3. The gate passes only after the precedent fact date, current fact date, intervening-authority search, rule-version check, transition effect, and contrary-evidence check are all resolved.

Expected blocked state: `BLOCKED_LATER_AUTHORITY_CHECK`
Expected lock: `decisionLock=true`

## Enforcement rule

A judgment, ruling, official opinion, or precedent must not be treated as automatically applicable to current facts merely because it is high-authority. GovPrompt must first resolve factual chronology, intervening authorities, applicable rule versions, transition effects, and contrary evidence. If any material point is unresolved, a categorical legal/financial conclusion is prohibited.

## Regression fixture

The regression test is maintained in `test/legal-authority-transition-gate.test.mjs` and enforced by `legal-authority-transition-gate.js` together with `quality-gate.js` and `shared-context.js`.
