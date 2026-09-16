# GovPrompt Thailand V7.1 — Revenue Stress Baseline Report

Baseline commit: `9f83ab5004bc3995246f3a0231e5ebe77838d384`  
Diagnostic branch: `v7/revenue-stress-baseline`  
Test-only commit: `7b23ed6ae38e9d5080485c4783849eeac078fa05`  
GitHub Actions run: `35042466226`  
Date: 16 September 2026

## Scope

This is a diagnostic baseline only. No production Core, Router, UI, Gate, Workflow, catalog, or public-page behavior was changed.

The goal is to test whether the current Universal Core can handle local-revenue work without adding a `local-revenue` route, Revenue Module, new menu, or hard-coded legal/tax answers.

## CI result

- Existing regression tests: **71/71 passed**
- Revenue stress tests: **9/20 passed**
- Revenue stress tests: **11/20 failed**
- Combined suite: **80/91 passed, 11 failed**
- Syntax checks: **passed**

This means the existing V7.1 baseline remains internally stable, while the new revenue scenarios expose gaps in routing, retrieval triggering, and ambiguity classification.

## Revenue stress results

| ID | Result | Main observation |
|---|---|---|
| R01 | FAIL | Revenue-improvement prompt routes, but legal/authority retrieval is forced even though the task is management analysis. |
| R02 | FAIL | Below-target revenue analysis routes, but retrieval is forced unnecessarily. |
| R03 | FAIL | Five-year revenue analysis routes, but retrieval is forced unnecessarily. |
| R04 | FAIL | Revenue prioritization routes, but retrieval is forced unnecessarily. |
| R05 | FAIL | Land-tax liability routes, but Official Authority Retrieval does not activate. |
| R06 | FAIL | Tax amount/rate question falls back; no usable route is selected. |
| R07 | PASS | Delinquent-tax procedure reaches authority retrieval. |
| R08 | FAIL | Tax-exemption eligibility falls back. |
| R09 | FAIL | Local fee collection authority falls back. |
| R10 | PASS* | Legal-version gate behavior passes in isolation; Router coverage should still be reviewed end-to-end. |
| R11 | PASS | ค่า K remains searchable before decisive contract facts are complete. |
| R12 | FAIL | Vague `ค่า…เก็บได้เท่าไร` is incorrectly treated as an identifiable subject. |
| R13 | FAIL | Past-practice-only wording is incorrectly treated as an identifiable subject. |
| R14 | PASS | Conflict and contrary-evidence checks remain present. |
| R15 | PASS | Delinquency notice drafting is routable and authority-aware. |
| R16 | PASS | Revenue-acceleration management memo is routable. |
| R17 | FAIL | Annual revenue-efficiency plan falls back. |
| R18 | PASS* | Data-anomaly prompt is routable, but route-quality should be reviewed end-to-end. |
| R19 | PASS* | Loaded causal premise avoids personnel-blame routing in the baseline assertion; route-quality still needs live-output review. |
| R20 | PASS* | Multi-artifact prompt is routable; cross-artifact consistency still requires live-model testing. |

`PASS*` means the deterministic repository assertion passed, but a live-model / full-composer test is still required before claiming production readiness.

## Deterministic Router snapshot for key cases

The current Router can select tools from weak Thai substring/n-gram overlap even where the semantic task differs. Examples from the current code path include:

- R01 → `GP002` (หนังสือราชการ)
- R02 → `GP005` (กฎหมาย)
- R03 → `GP005` (กฎหมาย)
- R04 → `GP001` (หนังสือราชการ)
- R05 → `GP016` (ประชาสัมพันธ์)
- R06 → fallback
- R08 → fallback
- R09 → fallback
- R17 → fallback
- R18 → `GP015` (โครงการ)
- R19 → `GP006` (กฎหมาย)
- R20 → `GP001` (หนังสือราชการ)

These results indicate that “routable” is not always equivalent to “correctly routed.”

## Failure map

### 1. Router semantic coverage / noisy matching — SYSTEMIC

Affected directly or materially: R01, R02, R03, R04, R05, R06, R08, R09, R17; route quality also warrants review in R18–R20.

Observed pattern:

- Public-revenue/tax/fee concepts are not consistently recognized by the current domain-intent layer.
- Fragment-based Thai scoring can promote unrelated tools from weak substring overlap.
- Some revenue tasks therefore fall back; others route to document, legal, publicity, or project tools for incidental wording rather than task intent.

### 2. Official Authority Retrieval trigger scope — SYSTEMIC

Affected: R01–R05 and related cases.

Observed pattern:

- Category-based activation is broad enough that a misroute into categories containing terms such as `กฎหมาย` or `ราชการ` can force retrieval for management/data-analysis tasks.
- Conversely, tax/fee concepts such as liability, exemption, tax amount, and fee-collection authority are not reliably recognized by the query trigger when the Router does not place them in an authority category.

Result: both **over-retrieval** and **under-retrieval** occur depending on the route.

### 3. Subject ambiguity classification — SYSTEMIC but narrow

Affected: R12, R13.

`extractSubject()` currently treats some vague phrases as identifiable because they are not caught by the narrow demonstrative/generic-only patterns.

Risk: the system may search a guessed or meaningless subject rather than clarify the actual matter.

## What is already strong

The new tests did **not** invalidate the existing legal-control architecture:

- Existing 71 regression tests all passed.
- Searchable vs Decidable behavior for ค่า K remains intact.
- Legal Version / transition logic remains intact.
- Conflict Check and Contrary Evidence Check remain intact.
- Decision Integrity and Quality Gates remain intact.

Therefore the evidence does **not** support a major Core rewrite.

## Recommendation

**TARGETED CORE PATCH — recommended, but not applied in this diagnostic branch.**

The patch should remain Universal and should address root causes only:

1. Improve Router intent quality so weak fragment-only matches cannot outrank a better government-work domain or cause irrelevant routing.
2. Make authority-retrieval activation depend on the substantive legal/financial consequence of the current query, not merely an overly broad routed category.
3. Expand generic ambiguity detection so vague placeholders/past-practice-only wording clarifies the subject before search.
4. Do not add a `local-revenue` route, Revenue Module, new UI/menu, tax rate, legal conclusion, fixed number, or permanent case answer.
5. After any patch, rerun all existing tests plus R01–R20 before considering merge.

## Stop condition

No production patch should be merged from this report alone. The next step is a targeted Universal-Core patch on a separate change set, followed by full regression and then live-model/data-pilot testing.
