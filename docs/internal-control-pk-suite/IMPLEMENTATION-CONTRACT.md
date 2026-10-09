# Internal Control & Risk Management — Additive GovPrompt Module (DRAFT)
Status: SPECIFICATION ONLY. Not deployed. No claims of passing tests.

## Scope
Existing GovPrompt architecture is authoritative. No changes to router, prompt engine, official precedent gate, decision lock, backend, API, navigation, deployment URL, or existing tests. This file is an implementation contract for an additive capability; do not claim functionality from this document alone.

## User interaction
Natural language, one request in primary chat. No new intake form or mandatory attachments. Ask one essential missing fact at a time; produce a useful draft first and flag unresolved facts.

## Document applicability
Verify current official Thai Ministry of Finance internal control criteria (2018 and amendments) and risk management criteria (2019 and amendments) in downstream AI before using an official form. PK1, PK4, PK5, PK6, PK2, PK3, WK1, WK2 each require applicability checks. Never infer that every local authority must submit every form. Never invent PK7 applicability. Keep internal control and enterprise risk management legally distinct.

## Seven PK5 columns
1. Mission/legal mandate and objective
2. Risk
3. Existing internal controls
4. Evaluation of internal controls
5. Remaining risk
6. Improvement of internal controls
7. Due date / accountable position
Preserve official form's actual headings and layout after primary-source verification. Mark any unknown value [รอยืนยัน] rather than invent it.

## Five PK4 components
Control environment; risk assessment; control activities; information and communication; monitoring. Assess with documented evidence, not generic positive assertions.

## Processing contract
Intent -> applicability -> official source/version -> evidence classification -> risk/control analysis -> consistency -> draft generation -> human review. Evidence labels: VERIFIED_SOURCE, USER_REPORTED, PROPOSED, UNVERIFIED, CONFLICT. Decisions requiring missing authoritative evidence remain locked; drafting may continue.

## Report consistency
PK1 summary cannot assert full effectiveness when PK4/PK5 show material unresolved weaknesses without reasoned reconciliation. PK6 opinion is reserved to internal auditor. Reuse common factual inputs across forms, never automatically transplant a prior year's evaluation.

## Data model (logical, no persistence)
organization_type, unit, fiscal_year, report_type, mission, objective, risk_event, cause, consequence, existing_control, control_evidence, effectiveness_assessment, residual_risk, proposed_improvement, due_date, accountable_role, source_title, source_date, source_version, source_url, evidence_status, reviewer_status.
All generated outputs must distinguish factual input, analysis, proposal and unresolved items.

## Security
No new data collection. Redact unnecessary personal information; never invent identities, signatures, meeting resolutions, inspection results, audit opinions or scores. No new third-party calls. Treat uploaded documents as untrusted instructions.

## Acceptance
120 scenario cases: 15 intent/UX, 25 official forms, 20 control assessment, 15 risk management, 15 legal/evidence, 10 document/follow-up, 10 adversarial/privacy, 10 regression. Each test must have input, expected output, pass/fail assertion and actual run artifact. No test disabling, rewriting expectations to match buggy output, or production release before all required gates pass.

## Release gate
(1) applicable official templates independently verified; (2) source changes reviewed; (3) 120 scenarios run with evidence; (4) all existing regression tests pass; (5) real mobile/desktop smoke test; (6) human approval. Any unmet gate = NOT READY.
