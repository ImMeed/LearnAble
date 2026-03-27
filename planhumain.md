## Plan: LearnAble AR/EN Unified Build (PDF + MVP + Nova)

Build LearnAble as a bilingual Arabic/English platform (Arabic default) that includes all functional requirements from your MVP prompt and the provided ISIMM PDF text, with selected Nova repo capabilities explicitly tracked as post-MVP parity items. Prioritize transactional correctness, educational accessibility, and psychologist-validated parent communication.

**Steps**
1. Phase 0 - Canonical Scope Freeze (*blocks all implementation*)
2. Lock three requirement sources into one matrix: MVP prompt, ISIMM PDF text, Nova repo patterns.
3. Tag each requirement as `MVP required` or `Post-MVP parity` to avoid scope drift.
4. Phase 1 - Bilingual Accessibility Foundation (*depends on 0; blocks all UX work*)
5. Implement full AR/EN language switcher with persisted locale and runtime dir switching (`rtl` for Arabic, `ltr` for English).
6. Build Dyslexia Smart Reading Mode baseline: accessible font stack, improved line/letter spacing, high contrast presets, simplified layout, and dyslexia-friendly keyboard option.
7. Build Focus/ADHD support shell: section-by-section lesson presentation, Pomodoro-style timer, progress indicators, and attention reminders.
8. Add localized validation/error message architecture in backend responses and frontend forms.
9. Phase 2 - Identity, Roles, and Safety Core (*depends on 1*)
10. Keep single-role JWT model for MVP runtime guards (`ROLE_STUDENT`, `ROLE_TUTOR`, `ROLE_ADMIN`, `ROLE_PARENT`, `ROLE_PSYCHOLOGIST`).
11. Implement auth lifecycle endpoints and add hardening backlog from Nova as post-MVP: email verification, password reset, optional CAPTCHA/2FA, login audit history.
12. Enforce no-diagnosis product policy in AI and role workflows.
13. Phase 3 - Student Learning Flow (*depends on 1 and 2*)
14. Implement first-login screening activity for students and store indicator summaries (educational risk signals, not diagnosis).
15. Implement lesson consumption pipeline with support tools: voice reader, AI simple explanation, summaries, step-by-step Q&A.
16. Implement auto-generated flashcards and quizzes from lesson content.
17. Implement interactive reading games for phonics/spelling/word recognition.
18. Implement learning-awareness section (“Know More”) covering dyslexia/ADHD/depression as educational awareness content.
19. Phase 4 - Economy, XP, Gamification, and Quiz Transactions (*depends on 3; blocks redeem flows*)
20. Implement quiz schema and play APIs (`/quizzes`, `/play/init`, `/play/answer`) with backend-only scoring.
21. Implement central points/XP engine (wallet row-lock + append-only ledgers) and enforce invariant checks.
22. Implement hint endpoint with Gemini, 500-char truncation, and `HINT_PENALTY` transaction.
23. Implement gamification progression with XP + badge unlocks + level-up notifications.
24. Add Nova progression/reward taxonomy patterns as post-MVP parity (advanced level calculator, richer reward chains).
25. Phase 5 - Library and Entitlements (*depends on 4 economy*)
26. Implement books and digital purchase models and APIs (`/books`, `/books/{id}`, `/library/books/{id}/redeem`, `/my-library`, `/books/{id}/read`).
27. Enforce atomic redeem: points debit + ledger write + purchase creation in one transaction.
28. Phase 6 - Teacher Supervision and Assistance (*depends on 3; partly parallel with 5*)
29. Implement teacher dashboard for attendance/progress/engagement and assessment visibility.
30. Implement automated end-of-lesson/assessment student feedback prompts.
31. Implement special assistance requests and teacher scheduling workflow for one-to-one support/video help.
32. Implement active-teacher presence indicator for students.
33. Add emotional recognition during calls as `Post-MVP parity` unless required for immediate demo hardware/runtime constraints.
34. Phase 7 - Psychologist and Parent Workflow (*depends on 2, 3, and notifications core*)
35. Implement psychologist review pipeline combining first-login screening summaries plus periodic teacher questionnaires (bi-weekly cadence support).
36. Implement psychologist confirm-support endpoint for linked students.
37. Enforce parent notification rule: parents are informed only after psychologist confirmation.
38. Implement notification fan-out + read-state APIs with AR/EN localized rendering.
39. Phase 8 - Forum Collaboration (*depends on 1 and 2; parallel with late 7 UI*)
40. Implement MVP forum schema and endpoints for spaces/posts/comments/votes/reports/moderation.
41. Add post-MVP Nova parity enhancements: accepted-solution, richer filters/search modes, optional OpenGraph previews, optional censorship pipeline.
42. Phase 9 - AI Integration and Policy Controls (*depends on 1 and 2; extends phases 3/4/7*)
43. Implement Gemini-backed `/ai/explain` and `/ai/translate` with locale-aware response language and neurodivergent-friendly simplification rules.
44. Add strict safety policy checks: no diagnosis, educational support framing only, bounded prompts.
45. Phase 10 - Data, Docs, and Verification Gates (*depends on all prior phases*)
46. Build bilingual seed data (AR primary + EN mirrors) covering all roles, links, lessons, quizzes, games, books, forum, notifications.
47. Add comprehensive tests: auth guards, transaction integrity, entitlement checks, psychologist-parent gating, localization outputs, AI language behavior.
48. Execute acceptance runbook against MVP criteria + ISIMM PDF feature checklist + selected Nova parity items.

**Relevant files**
- `d:/Projects/LearnAble/backend/app/main.py` - app composition and global middleware wiring.
- `d:/Projects/LearnAble/backend/app/core/config.py` - locale and provider settings.
- `d:/Projects/LearnAble/backend/app/core/security.py` - JWT and auth hardening hooks.
- `d:/Projects/LearnAble/backend/app/core/roles.py` - role guard constraints.
- `d:/Projects/LearnAble/backend/app/modules/auth/**` - auth/profile lifecycle.
- `d:/Projects/LearnAble/backend/app/modules/study/**` - screening, session, focus flow.
- `d:/Projects/LearnAble/backend/app/modules/quiz/**` - play/init/answer/hint.
- `d:/Projects/LearnAble/backend/app/modules/gamification/**` - rewards, leaderboard, badges.
- `d:/Projects/LearnAble/backend/app/modules/library/**` - redeem and entitlement.
- `d:/Projects/LearnAble/backend/app/modules/forum/**` - collaboration and moderation.
- `d:/Projects/LearnAble/backend/app/modules/notifications/**` - parent/psychologist communication.
- `d:/Projects/LearnAble/backend/app/modules/ai/**` - Gemini integration and prompt policy.
- `d:/Projects/LearnAble/backend/alembic/versions/*.py` - migration chain for all domains.
- `d:/Projects/LearnAble/backend/scripts/seed_demo_ar.py` - Arabic demo data.
- `d:/Projects/LearnAble/backend/scripts/seed_demo_en.py` - English mirror data.
- `d:/Projects/LearnAble/frontend/src/app/i18n.ts` - AR/EN resources and switch logic.
- `d:/Projects/LearnAble/frontend/src/app/router.tsx` - localized route strategy.
- `d:/Projects/LearnAble/frontend/src/app/styles.css` - RTL/LTR-safe accessibility styles.
- `d:/Projects/LearnAble/frontend/src/features/**` - feature implementations by domain.
- `d:/Projects/c/Esprit-PIDEV-3A56--2026-Nova-Learning-Management-Platform/src/Service/game/TokenService.php` - points economy reference.
- `d:/Projects/c/Esprit-PIDEV-3A56--2026-Nova-Learning-Management-Platform/src/Service/game/LevelCalculatorService.php` - progression reference.
- `d:/Projects/c/Esprit-PIDEV-3A56--2026-Nova-Learning-Management-Platform/src/Controller/LanguageController.php` - locale switching pattern reference.

**Verification**
1. API contract tests for all MVP endpoints plus ISIMM-required teacher/psychologist flows.
2. Wallet/ledger invariant tests under concurrent quiz/game/redeem/hint operations.
3. Parent-notification gating tests proving psychologist confirmation is mandatory.
4. AR/EN localization tests for UI strings, backend errors, notifications, and AI outputs.
5. Accessibility tests for reading mode, focus mode, and dyslexia support controls.
6. Frontend E2E smoke for student, tutor, psychologist, and parent role journeys.
7. Seed-data replay test to validate demo readiness in both languages.

**Decisions**
- Language scope: full AR/EN switchable app, Arabic default.
- Clinical boundary: educational support only; no medical diagnosis output.
- Parent communication boundary: psychologist-validated notifications only.
- Economy boundary: points spendable, XP non-spendable, backend authoritative mutations.

**Further Considerations**
1. Emotional recognition delivery tier: Option A immediate MVP inclusion, Option B feature-flagged post-MVP (recommended), Option C mock data in demo only.
2. Questionnaire cadence implementation: Option A strict bi-weekly scheduler, Option B configurable cadence with bi-weekly default (recommended).
3. Translation ownership: Option A static locale files only, Option B admin-manageable translation content for selected modules.

**Traceability Matrix (Pre-Phase-2 Gate)**
| Requirement | Source | Scope Tag | Planned Phase | Current Status |
|---|---|---|---|---|
| Arabic-first + RTL by default | MVP + PDF | MVP required | Phase 1 | Partial (shell done) |
| Full AR/EN switcher with runtime dir toggle | User decision + plan revision | MVP required | Phase 1 | Not started |
| Single-role JWT with 5 roles | MVP | MVP required | Phase 2 | Partial (role/JWT ready) |
| Register/login + role profile endpoints | MVP | MVP required | Phase 2 | Partial (basic done; hardening pending) |
| No diagnosis policy in platform behavior | PDF + MVP | MVP required | Phase 2/9 | Partial (policy noted, enforcement pending) |
| Student first-login screening | PDF | MVP required | Phase 3 | Not started |
| Dyslexia smart reading mode | PDF | MVP required | Phase 1/3 | Not started |
| Focus mode + Pomodoro + reminders | PDF | MVP required | Phase 1/3 | Not started |
| Voice reader for lessons | PDF | MVP required | Phase 3 | Not started |
| Auto flashcards + quizzes from content | PDF + MVP | MVP required | Phase 3/4 | Not started |
| Quiz play lifecycle (`init`/`answer`) | MVP | MVP required | Phase 4 | Not started |
| Hint with points penalty + Gemini | MVP | MVP required | Phase 4/9 | Not started |
| Central points wallet + append-only ledger | MVP | MVP required | Phase 4 | Partial (models done, logic pending) |
| XP progression + badges + level-up feedback | PDF + MVP | MVP required | Phase 4 | Not started |
| Library redeem + read entitlement | MVP | MVP required | Phase 5 | Not started |
| Atomic points deduction on redeem | MVP | MVP required | Phase 5 | Not started |
| Teacher dashboard (attendance/progress/engagement) | PDF | MVP required | Phase 6 | Not started |
| Student feedback prompts after lesson/assessment | PDF | MVP required | Phase 6 | Not started |
| 1:1 help requests + scheduling/video support | PDF | MVP required | Phase 6 | Not started |
| Active teacher online indicator | PDF | MVP required | Phase 6 | Not started |
| Psychologist reviews screening + teacher questionnaires | PDF | MVP required | Phase 7 | Not started |
| Parent notified only after psychologist confirmation | PDF + MVP | MVP required | Phase 7 | Not started |
| Notifications list/read + fan-out | MVP + PDF | MVP required | Phase 7 | Partial (list stub only) |
| Forum posts/comments/votes/reports/moderation | MVP | MVP required | Phase 8 | Not started |
| AI explain/translate localized AR/EN output | MVP + language decision | MVP required | Phase 9 | Partial (stub done) |
| Seed scripts with bilingual demo data | MVP + language decision | MVP required | Phase 10 | Not started |
| Transaction, role, entitlement, localization tests | MVP + PDF quality intent | MVP required | Phase 10 | Partial (basic tests only) |
| Emotional recognition during teacher calls | PDF + Nova | Post-MVP parity (or feature-flag) | Phase 6 extension | Not started |
| Advanced auth hardening (email verification, reset, 2FA, CAPTCHA) | Nova | Post-MVP parity | Phase 2 extension | Not started |
| Advanced forum enhancements (accepted solution, rich filters, OG previews) | Nova | Post-MVP parity | Phase 8 extension | Not started |
| Advanced progression/reward taxonomy | Nova | Post-MVP parity | Phase 4 extension | Not started |
