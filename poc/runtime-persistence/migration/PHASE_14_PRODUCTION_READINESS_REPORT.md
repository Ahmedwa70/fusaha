# Phase 14 — Production Readiness Audit

التاريخ: 2026-11-02
الفرع: `feat/hide-authenticated-start-cta`
نطاق المراجعة: تدقيق هندسي قراءة فقط لمسار Immutable Runtime وفصل تشغيل الدروس عن القوالب. لم تُنفَّذ أي اختبارات جديدة ولم يُعَد تنفيذ ما ثبتت نجاحه في المراحل 1–13.

---

## 1. ما أصبح مثبتًا نهائيًا (بالأدلة من المراحل السابقة)

| الإثبات | النتيجة | المرحلة |
|---|---|---|
| اختبارات الوحدة والتكامل على قاعدة بلا `library_books` | 107/107 ناجحة | 2–5 |
| اختبارات `lib/runtime` + `lib/db` على بيئة Disposable | 103/103 + 4/4 | 5 |
| إثبات متصفح عام: حذف القالب الفعلي ثم نجاح `/l/[token]` و`/frame` مع تحقق SHA-256 | ناجح | 12 |
| إثبات متصفح بجلسة مصادقة حقيقية (معلّم اختباري): تشغيل من Dashboard بعد حذف القالب | ناجح، المحتوى من Runtime فقط | 13 |
| سلوك الدروس التاريخية غير المرتبطة (B) والمحجورة (C) بعد الحذف | B يُقدَّم من القالب، C يُرفض (404) | 12/13 |
| تعطيل `RUNTIME_RESOLVER_CUTOVER_ENABLED` يعيد المسار القديم حرفيًا | مُثبت عمليًا | 12 |
| Migration 0023 تعمل منفردة دون 0022 | مُثبت على Supabase محلي + 0 مرجع لـ `library_books` داخل 0023 (تم التحقق من الملف كاملًا، 140 سطرًا) | 11 |
| نجاح Recovery وIdempotency وFencing والتزامن | مُثبت في اختبارات النشر | 5 |

## 2. ما هو موجود في كود التطبيق الفعلي

كل ما يلي موجود في شجرة العمل الحالية (الفرع الصحيح `feat/hide-authenticated-start-cta`):

- **`lib/runtime/` (كود إنتاجي)**: الـ Resolver المركزي `lesson-play-resolution.ts`، خدمة الربط `lesson-version-runtime-binding.ts`، الناشر `runtime-publication.ts` (مع Idempotency key وفحص `request_fingerprint` وLease/Fencing)، مخزن المحتوى `runtime-content-store.ts` (write-once عبر `If-None-Match: *` مع مقارنة بايت عند التكرار ورفض التعارض الصلب)، قارئ المحتوى `runtime-entry-content.ts` (تحقق SHA-256 مستقل، لا ETag)، الهوية `runtime-identity-v1.ts`، الـ Flag `runtime-resolver-flag.ts`، أدوات التصنيف والتقارير التشغيلية.
- **مسارات العرض**: `lib/dashboard/queries/lesson.ts` (`getApprovedLessonForPlay` و`getApprovedLessonByShareToken`) يمرّران كليهما عبر `assemblePlayableLesson` وحدها؛ صفحة المشاركة العامة `app/l/[token]/page.tsx` ومسارا الإطار `frame/route.ts` (Dashboard والعام) كلها تستهلك من هاتين الدالتين فقط — لا منطق حل مكرر. المسار الوحيد المتبقي لـ `templates.htmlPlayer` خارج الـ Resolver هو معاينة مسودة أثناء التحرير (`updateLessonVersionContent`، حالة Draft فقط، لا يعرض دروسًا معتمدة).
- **دورة الاعتماد**: `actions/lessons.ts` → `approveLesson` ينشر الحزمة أولًا (دون تغيير حالة الاعتماد)، ثم اعتماد في معاملة، ثم ربط؛ عند فشل الربط بعد الاعتماد يحدث تعويض يرجع الدرس والإصدار لحالتهما السابقتين. فشل النشر يعني «لم يُعتمد شيء». مفتاح Idempotency ثابت `lesson-approve:<lessonVersionId>`.
- **قاعدة البيانات**: Migration `0023_runtime_versions.sql` (إضافي فقط، خمس جداول جديدة + عمودان إضافيان على `lesson_versions`، بلا تعديل أو Backfill لأي جدول قائم)، مع خمسة ملفات Drizzle schema وتحديث `enums.ts` و`lesson-versions.ts` والـ journal.
- **إنزال آمن**: عند تعطيل الـ Flag لا يُقرأ أي سطر Runtime ويعود المسار القديم بايت-بايت؛ عند تفعيله: Bound/Legacy يقرآن من التخزين مع SHA-256، Unbound يستخدم fallback صريحًا موثقًا في السجلات، Quarantined/Unrecoverable يفشلان مغلقين (null → 404)، وأي خطأ عقد يفشل مغلقًا.

## 3. ما لا يزال POC فقط (أو غير مُثبت خارج بيئة الاختبار)

- **بيئة SeaweedFS المحلية** (`integration-environment/docker-compose.yml`) هي المخزن الوحيد المُختبر. توافق **AWS S3 الحقيقي غير مُثبت**: أداة `s3-compat-check.mjs` جاهزة لكنها لم تُشغَّل على AWS فعلي، وVersioning وObject Lock وصلاحيات IAM محدودة متطلبات على مستوى الـ Bucket/الحساب وليست مفروضة بالكود (الكود يفرض write-once شرطيًا فقط).
- **لا يوجد Reaper خلفي** لمحاولات النشر المهجورة (مبسّطة موثقة في `runtime-publication.ts`؛ المحاولة تبقى غير قابلة للوصول حتى انقضاء Lease).
- **لا يوجد Backfill** للدروس التاريخية ولا تصنيف جماعي (بقرار معتمد)، وأدوات التصنيف التشغيلية (`runtime-ops-report`, `historical-runtime-classification`) لم تُستخدم على بيانات حقيقية.
- **أدوات Inventory وExport وRunbook** (`inventory/`, `migration/`) وثائق وسكربتات جاهزة، كلها تنتظر مدخلات خارجية (Export مُجهَّل الهوية، Bucket AWS).
- سكربتات اختبار E2E المحلية (Supabase CLI، seed، مصادقة) عُملت من مساحة العمل وليست جزءًا من المستودع.

## 4. العوائق الفعلية أمام Staging

1. **كود التطبيق غير مُلتزَم إطلاقًا**: الفرع المحلي متساوٍ تمامًا مع `origin` (لا commits متقدمة)، أي أن كل عمل Runtime في كود التطبيق (‏`lib/runtime`، Migration 0023، ملفات schema، تعديلات `actions/lessons.ts` و`lib/dashboard/queries/lesson.ts`، تحديث الـ journal والوثائق) موجود **فقط في شجرة العمل المحلية**. لا يوجد شيء يمكن نشره على Staging قبل الالتزام والدفع، وأي إعادة تشغيل/فقدان محلي يضيع العمل.
2. **تطبيق Migration على Staging يدوي بالضرورة**: قاعدة Production/Staging بلا `__drizzle_migrations` (تطبيق تاريخي يدوي)، لذلك `db:migrate` سيفشل من 0001. تطبيق 0023 يكون عبر Supabase SQL Editor فقط، بعد فحوصات READ-only في `PRODUCTION_GAP_TEST_PLAN.md`، ولا يجوز افتراض اكتمال migrations السابقة (مؤكد حتى الآن: `users` ✓، `templates` ✓، `level_key` ✓).
3. **إعدادات التخزين غير موجودة على Staging**: بلا `RUNTIME_CONTENT_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET` يسير `approveLesson` على المسار القديم (بتحذير مسجل فقط) — أي دروس معتمدة بلا ربط Runtime في Staging حتى ضبط التخزين.
4. **Feature Flag معطل افتراضيًا**: Staging سيشغّل المسار القديم حتى تفعيل `RUNTIME_RESOLVER_CUTOVER_ENABLED=1` صراحة (سلوك مقصود، لكن يجب تضمينه في خطوات النشر).
5. توافق AWS غير مُثبت (انظر §3) — لا يجوز تقديم SeaweedFS كبديل عن إثبات AWS.

## 5. المتطلبات الخارجية التي تحتاج تدخلك

1. **الموافقة على Commit وPush** لعمل Runtime على الفرع (القيود الحالية تمنعاني منهما).
2. مشروع **Supabase Staging** منفصل + تطبيق Migration 0023 يدويًا عبر لوحة SQL (التعليمات في `PRODUCTION_GAP_TEST_PLAN.md` و`MIGRATION_RUNBOOK.md`).
3. **Bucket AWS S3** بـ Versioning وObject Lock (COMPLIANCE) وصلاحيات IAM محدودة، أو موافقة صريحة على اختبار التوافق بحساب مدفوع.
4. **Export إنتاج مُجهَّل الهوية** عند بدء الترحيل التجريبي (بوابة INV).

## 6. خطة انتقال قصيرة إلى Staging (مرتبة بالأولوية)

1. الالتزام (Commit) بدفع جميع تغييرات Runtime على `feat/hide-authenticated-start-cta` ودفعها — بعد موافقتك.
2. إنشاء/تحديد مشروع Supabase Staging وتشغيل فحوصات READ-only للخط الأساس ثم تطبيق `0023_runtime_versions.sql` يدويًا عبر SQL Editor.
3. تجهيز مخزن S3 لـ Staging (أو S3-compatible مؤقت معزول) وضبط متغيرات `RUNTIME_CONTENT_S3_*` في بيئة Staging.
4. نشر الفرع على Staging **مع بقاء الـ Flag معطلًا** والتحقق من سلوك العرض الحالي دون أي تغيير.
5. تفعيل الـ Flag على Staging: اعتماد درس جديد، تشغيله من Dashboard ورابط المشاركة، حذف قالبه في Staging والتحقق من استمرار التشغيل وSHA-256.
6. تشغيل `s3-compat-check` على Bucket AWS الحقيقي عند توفر الاعتماديات.
7. اجتياز بوابات `ACCEPTANCE_GATES.md` ثم قرار بدء Migration Trial.

## 7. القرار النهائي

# READY WITH EXTERNAL PREREQUISITES

الأساس التقني سليم ومُدقَّق ومُبرهَن محليًا بأعلى معيار متاح (متصفح حقيقي، جلسة مصادقة حقيقية، حذف فعلي للقالب، تحقق SHA-256، 107/107 اختبارًا). لكن الانتقال إلى Staging يتعذر عمليًا اليوم لثلاثة أسباب موضوعية: الكود غير مُلتزَم في المستودع البعيد إطلاقًا، ولم يُطبَّق شيء على بيئة Staging حقيقية، وتوافق AWS S3 غير مُثبت. لا شيء من هذه الأسباب خلل هندسي — كلها متطلبات إجرائية/خارجية مذكورة في §4 و§5.
