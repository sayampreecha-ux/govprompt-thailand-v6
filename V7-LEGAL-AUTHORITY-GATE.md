# GovPrompt v7 — Legal Authority Transition Hard Gate

This gate applies to high-risk Thai government legal/financial analysis that relies on judgments, official opinions, rulings, precedents, or administrative guidance.

## Mandatory checks before a decisive conclusion

1. Identify the date of the precedent facts, not merely the judgment/publication date.
2. Identify the date of the current facts.
3. Search for laws, regulations, circulars, orders, rulings, and official guidance issued between those dates.
4. Verify both the rule version applicable at the event time and the current rule version.
5. Resolve the legal effect of every relevant later authority.
6. Perform a contrary-authority / contrary-evidence check.
7. Do not mark VERIFIED, HIGH MATCH, PASS, or give a categorical decision while any transition issue remains unresolved.

## Required blocked state

When unresolved, set `decisionLock=true`, `qualityStatus=UNVERIFIED`, `caseMatch=NOT_ASSESSED`, and `workflowStatus=BLOCKED_LATER_AUTHORITY_CHECK`.

## Regression case

The test suite includes the scenario involving Supreme Administrative Court precedent อ.24/2567 and Ministry of Interior circular มท 0808.2/ว 0679 dated 6 February 2018. The precedent cannot be treated as automatically controlling current facts until the intervening circular and applicable rule versions are analyzed.
