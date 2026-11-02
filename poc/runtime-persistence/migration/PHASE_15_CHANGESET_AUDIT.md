# Phase 15 — Change-set Audit & Commit Preparation

التاريخ: 2026-11-02
الفرع: `feat/hide-authenticated-start-cta`
الحالة مقارنة بالـ remote: متساوٍ تمامًا (لا commits متقدمة أو متأخرة) — كل العمل محلي غير مُلتزَم.

## 1. العدد الفعلي والتصنيف

**الإجمالي: 73 ملفًا** = 57 جديدًا (untracked) + 16 معدّلًا + 1 محذوفًا.
(‏`git status --short` يعرض 63 سطرًا فقط لأن 3 مجلدات تظهر مطوية.)

| التصنيف | العدد | الوصف |
|---|---|---|
| A — Production Runtime Implementation | 12 | كود `lib/runtime` الإنتاجي |
| B — Runtime Tests + stubs اختبارية | 13 | اختبارات الوحدة وملفات stub خاصة بها |
| C — Database / Migration | 8 | 0023 + schema + journal |
| D — POC & Experimental | 24 | بيئة التكامل وأدوات POC |
| E — Documentation | 11 | وثائق معمارية وخطط الترحيل |
| F — Unrelated / Temporary / Sensitive | 0 | لا شيء |

تفصيل التصنيف الكامل لكل ملف في الجداول أدناه. لا يوجد أي ملف خارج نطاق مشروع Runtime.

### A. Production Runtime Implementation (يُدرج)

| الملف | النوع | القرار | السبب |
|---|---|---|---|
| `lib/runtime/lesson-play-resolution.ts` | جديد | إدراج | الـ Resolver المركزي لمساري العرض |
| `lib/runtime/lesson-version-runtime-binding.ts` | جديد | إدراج | خدمة الربط غير القابل للتغيير + الحالات |
| `lib/runtime/lesson-approval-publishing.ts` | جديد | إدراج | منسق الاعتماد: نشر ← اعتماد ← ربط + تعويض |
| `lib/runtime/historical-runtime-classification.ts` | جديد | إدراج | تصنيف الدروس التاريخية |
| `lib/runtime/runtime-ops-report.ts` | جديد | إدراج | تقرير المطابقة التشغيلي |
| `lib/runtime/runtime-publication.ts` | جديد | إدراج | الناشر مع Idempotency/Fencing/Lease |
| `lib/runtime/runtime-content-store.ts` | جديد | إدراج | حدود التخزين write-once |
| `lib/runtime/runtime-entry-content.ts` | جديد | إدراج | قارئ المحتوى مع SHA-256 |
| `lib/runtime/runtime-identity-v1.ts` | جديد | إدراج | خوارزمية الهوية المجمّدة |
| `lib/runtime/runtime-resolver-flag.ts` | جديد | إدراج | Feature Flag معطل افتراضيًا |
| `lib/runtime/s3-sigv4.ts` | جديد | إدراج | عميل SigV4 (node:crypto فقط، بلا اعتماديات) |
| `actions/lessons.ts` (معدل) | معدل | إدراج | تك الاعتماد بمسار النشر+الربط |
| `lib/dashboard/queries/lesson.ts` (معدل) | معدل | إدراج | تمرير مساري العرض عبر الـ Resolver |

### B. Runtime Tests + stubs (تُدرج مع كودها)

9 ملفات `*.test.ts` (‏historical-runtime-classification, lesson-approval-publishing, lesson-play-cutover, lesson-play-resolution, lesson-version-runtime-binding, runtime-identity-v1, runtime-ops-report, runtime-publication, template-independence) + 5 ملفات stubs/test-hooks ‏`.mjs` (‏lesson-version-runtime-binding.test-hooks, runtime-binding-db-stub, runtime-binding-schema-stub, schema-definitions-stub, server-only-stub). تحققت أن الـ stubs لا يستوردها أي ملف إنتاجي — اختبارات فقط.

### C. Database / Migration (يُدرج)

| الملف | القرار | ملاحظة |
|---|---|---|
| `database/migrations/0023_runtime_versions.sql` | إدراج | إضافي فقط، بلا تعديل لجداول قائمة |
| `database/migrations/meta/_journal.json` (معدل) | إدراج | إدخال idx 23 بعد 0022 — ترتيب صحيح |
| `database/schema/runtime-versions.ts` و4 ملفات schema أخرى (assets, publication-attempts, storage-locations, storage-objects) | إدراج | متوافقة مع 0023 (مُثبت في Phase 2 وبالاختبارات) |
| `database/schema/enums.ts` (معدل) | إدراج | enums الحالات |
| `database/schema/index.ts` (معدل) | إدراج | تصدير الجداول الجديدة |
| `database/schema/lesson-versions.ts` (معدل) | إدراج | عمودا الربط |

### D. POC & Experimental (يُدرج كوحدة منفصلة)

كل ما تحت `poc/runtime-persistence/`: بيئة التكامل (‏`integration-environment/` مع حذف `minio/init-minio.sh` واستبداله بـ`init-s3-bucket.sh` و`docker-compose.yml` المعدل و`s3/seaweedfs-s3.json`)، أدوات الهوية والنشر والتزامن (‏`runtime-identity-v1.mjs`, `s3-client.mjs`, `publisher-process.mjs`, `integration-adapter-poc.mjs`, `generate-identity-vectors.mjs`, `lease-concurrency-poc.test.mjs`, `identity-vectors-poc.test.mjs`, `identity-vectors.json`)، وأدوات `inventory/` و`s3-compat/`. ملف `seaweedfs-s3.json` يستخدم متغيرات بيئة فقط (`${POC_S3_ROOT_USER}`) — بلا قيم صلبة.

### E. Documentation (يُدرج)

`docs/architecture/RUNTIME_VERSION_SCHEMA_DESIGN.md` (جديد)، `docs/architecture/PERSISTENT_RUNTIME_STORAGE_ADR.md` (معدل)، `lib/runtime/README.md` (معدل)، `poc/runtime-persistence/README.md`، `poc/runtime-persistence/inventory/{EXPORT_CONTRACT,EXTRACTION_GUIDE}.md`، `poc/runtime-persistence/s3-compat/AWS_S3_READINESS.md`، `poc/runtime-persistence/migration/{ACCEPTANCE_GATES,MIGRATION_EXECUTION_PLAN,MIGRATION_RUNBOOK,PRODUCTION_GAP_TEST_PLAN,PHASE_14_PRODUCTION_READINESS_REPORT}.md`.

### رسائل i18n و Gitignore

`messages/{ar,en,zh}.json` (معدل — مفتاح `runtimePublishFailed` فقط في كل لغة، تم التحقق من diff حرفيًا)، `.gitignore` (معدل — يستثني `.env.integration` الحقيقي؛ تغيير وقائي مباشر مرتبط بالمشروع).

## 2. قائمة الملفات الضرورية للـ Commit

كل الملفات الـ73 تخص المشروع. لا استبعاد كامل لأي ملف، لكن **التقسيم إلى 6 Commits** إلزامي لأن دمج POC مع كود التطبيق في commit واحد يجعل المراجعة والتراجع أصعب:

- Commit 1 (DB): 8 ملفات من الفئة C.
- Commit 2 (نشر وتخزين): publication, content-store, s3-sigv4, entry-content, identity-v1 + اختباراتها (‏runtime-identity-v1.test, runtime-publication.test).
- Commit 3 (ربط وتصنيف): binding, historical-classification, ops-report + اختباراتها + الـ 5 stubs.
- Commit 4 (عرض واعتماد): lesson-play-resolution, runtime-resolver-flag, queries/lesson.ts, actions/lessons.ts, messages×3, template-independence.test, lesson-play-cutover.test, lesson-play-resolution.test, lesson-approval-publishing(.test).
- Commit 5 (وثائق معمارية): docs/architecture×2 + lib/runtime/README.md.
- Commit 6 (POC): كل `poc/runtime-persistence/` + `.gitignore`.

ملاحظة: commit 4 يحتاج commit 1–3 مرحلةً في نفس الفرع (ترتيب تطبيقي)، وقد أدرجتُ `lesson-approval-publishing` هنا لأن تفعيله يتم عبر `actions/lessons.ts` في نفس commit.

## 3. الملفات المستبعدة

**لا شيء.** لا يوجد ملف مؤقت أو حساس أو خارج النطاق في التغييرات الحالية. الملف الوحيد المحذوف (`init-minio.sh`) هو استبدال مقصود بـ`init-s3-bucket.sh` (‏SeaweedFS بدل MinIO) وقد تحققت أن `docker-compose.yml` يشير للملف الجديد فقط.

## 4. نتائج فحص الأسرار والملفات الحساسة

| الفحص | النتيجة |
|---|---|
| أنماط أسرار (‏AKIA/AWS secret/PEM/JWT/sk-/مفاتيح طويلة) في الملفات الجديدة كلها | صفر مطابقة |
| نفس الفحص في الملفات المعدلة | صفر مطابقة |
| `.env.integration` الحقيقي (صلاحيات 600) | **مستثنى فعليًا** — `git check-ignore` يؤكد إدراجه في `.gitignore` السطر 34 |
| `.env.integration.example` | قيم نائبة فقط (`..._local_only_change_me`) |
| `seaweedfs-s3.json` | متغيرات بيئة فقط، لا قيم صلبة |
| بيانات اتصال قواعد | لا شيء؛ أسماء مشاريع Supabase في `scripts/database-target-guard.mjs` ملف **متتبَع مسبقًا** وليس جزءًا من هذا التغيير، وهو حارس قراءة فقط |
| القيم السرية في التقرير | لم تُعرض أي قيمة سرية |

## 5. نتائج فحص الاتساق

| الفحص | النتيجة |
|---|---|
| اعتماديات جديدة (‏package.json / lockfiles) | **لا شيء معدّل** — التنفيذ بلا اعتماديات خارجية جديدة |
| استيراد الـ stubs من كود الإنتاج | لا يوجد — اختبارات فقط |
| 0023 مقابل Drizzle schema | متوافقان (مُثبت في Phase 2 وبالاختبارات 107/107) |
| journal: 0022 موجود قبل 0023 | صحيح؛ 0022 نفسه متتبَع مسبقًا في المستودع |
| docker-compose يشير لملف init صحيح | نعم (`init-s3-bucket.sh`) |
| تغييرات غير مقصودة على القوالب/Activity Model | لا يوجد؛ `composePlayerHtml` و`lib/templates` لم تُمَس |
| `git diff --check` | نظيف |
| الاختبارات قابلة للتشغيل | نمط التشغيل الموثق في README يعمل (‏103/103 + 4/4 مُثبتة سابقًا)؛ لم تُعَد التشغيل بلا حاجة |
| تراجع في مسارات تاريخية/محجورة | لا يوجد — الفحص التصميمي + إثباتات Phase 12/13 |

**ملاحظة اتساق واحدة (غير مانعة، لكن يجب حسمها قبل الالتزام):**
لا يوجد `database/migrations/meta/0023_snapshot.json`. الملف 0023 مؤلَّف يدويًا وإدخال الـ journal أُضيف يدويًا، فلم يُنشأ snapshot تلقائيًا. أثره: `drizzle-kit generate` المستقبلي سيبني diffه من snapshot 0022 وقد يقترح إعادة إنشاء بنية 0023. الحل الموصى به قبل Commit 1: توليد الـ snapshot عبر `drizzle-kit generate` من حالة schema الحالية (ينشئ الملف الناقص فقط دون تعديل 0023) أو توثيق قرار الاستغناء عنه صراحة في الـ commit message. هذا خيار تقني يحتاج قرارك؛ لم أنفذه التزامًا بقيود «لا تعديل ملفات».

## 6. أوامر Git المقترحة (بالتدقيق، بلا `git add .`)

```bash
# Commit 1 — DB
git add database/migrations/0023_runtime_versions.sql database/migrations/meta/_journal.json \
  database/schema/runtime-versions.ts database/schema/runtime-assets.ts \
  database/schema/runtime-publication-attempts.ts database/schema/runtime-storage-objects.ts \
  database/schema/runtime-storage-locations.ts database/schema/enums.ts \
  database/schema/index.ts database/schema/lesson-versions.ts

# Commit 2 — النشر والتخزين
git add lib/runtime/runtime-identity-v1.ts lib/runtime/runtime-identity-v1.test.ts \
  lib/runtime/runtime-publication.ts lib/runtime/runtime-publication.test.ts \
  lib/runtime/runtime-content-store.ts lib/runtime/s3-sigv4.ts \
  lib/runtime/runtime-entry-content.ts

# Commit 3 — الربط والتصنيف
git add lib/runtime/lesson-version-runtime-binding.ts lib/runtime/lesson-version-runtime-binding.test.ts \
  lib/runtime/lesson-version-runtime-binding.test-hooks.mjs \
  lib/runtime/runtime-binding-db-stub.mjs lib/runtime/runtime-binding-schema-stub.mjs \
  lib/runtime/schema-definitions-stub.mjs lib/runtime/server-only-stub.mjs \
  lib/runtime/historical-runtime-classification.ts lib/runtime/historical-runtime-classification.test.ts \
  lib/runtime/runtime-ops-report.ts lib/runtime/runtime-ops-report.test.ts

# Commit 4 — العرض والاعتماد والـ Flag
git add lib/runtime/lesson-play-resolution.ts lib/runtime/lesson-play-resolution.test.ts \
  lib/runtime/lesson-play-cutover.test.ts lib/runtime/runtime-resolver-flag.ts \
  lib/runtime/lesson-approval-publishing.ts lib/runtime/lesson-approval-publishing.test.ts \
  lib/runtime/template-independence.test.ts \
  lib/dashboard/queries/lesson.ts actions/lessons.ts \
  messages/ar.json messages/en.json messages/zh.json

# Commit 5 — الوثائق المعمارية
git add docs/architecture/RUNTIME_VERSION_SCHEMA_DESIGN.md \
  docs/architecture/PERSISTENT_RUNTIME_STORAGE_ADR.md lib/runtime/README.md

# Commit 6 — POC والبيئة
git add poc/runtime-persistence .gitignore
```

(‏`git add poc/runtime-persistence` مسار محدد وليس `.`؛ يغطي الحذف `init-minio.sh` والملفات الـ26 تحته.)

## 7. رسائل Commit المقترحة

1. `feat(runtime): add immutable runtime version registry (migration 0023 + drizzle schema)`
2. `feat(runtime): implement runtime publication with idempotency, fencing and write-once S3 storage`
3. `feat(runtime): add immutable lesson-version runtime binding with remediation states`
4. `feat(runtime): resolve lesson playback through runtime resolver behind cutover flag`
5. `docs(runtime): add runtime version schema design doc and update storage ADR`
6. `chore(runtime): add runtime persistence POC environment, tools and migration runbooks`

كل رسالة تتبع نمط repo (‏`type(scope): subject`) المستخدم في `git log` الحالي.

## 8. القرار النهائي

# READY FOR COMMIT

بشرط واحد مسبق: حسم نقطة الـ snapshot الناقصة في §5 (توليده أو توثيق الاستغناء). بعدها يمكن تنفيذ الـ 6 Commits بالأوامر أعلاه دون أي تعديل آخر. لم يُنفَّذ أي Commit أو Push أو تعديل ملفات في هذه المرحلة.
