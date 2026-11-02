# خطة سد الفجوة مع الإنتاج وبيئة الاختبار المنفصلة

> وثيقة موجهة لصاحب المشروع (غير مبرمج) — تفاصيل تقنية مدعومة بفحص فعلي
> للملفات على الفرع `feat/hide-authenticated-start-cta`.
> تاريخ الإعداد: 2026-11-02 — **المحدّثة 2026-11-02 بنطاق مزدوج: Library (0022) + Immutable Runtime (0023)**.
> **لم يُنفَّذ أي شيء على الإنتاج.**
>
> **ملاحظة تشغيلية حاسمة (اكتشاف لاحق):** إنتاجك بلا جدول `__drizzle_migrations`
> (الفحص الفعلي أكد غيابه)، أي أن migrations طُبقت تاريخيًا يدويًا. لذلك
> **يُمنع** تشغيل `db:migrate:production` على قاعدتك — سيحاول تطبيق كل
> migrations من 0001 وسيفشل. التطبيق الإنتاجي الوحيد الآمن: **يدوي، migration
> تلو الآخر، بالترتيب، عبر محرر SQL في لوحة Supabase، مع تخطي ما تثبت
> علاماته وجوده**. استعلامات العلامات (قراءة فقط) في أسفل الوثيقة.

---

## 1. تقرير الفجوة: قاعدة الإنتاج مقابل البنية المطلوبة

نتيجة فحصك الفعلي لـ Supabase Production:

| العنصر | في الإنتاج الآن | المطلوب | الفجوة |
| --- | --- | --- | --- |
| `lessons` | موجود | موجود | — |
| `lesson_versions` | موجود | موجود + عمودان جديدان | **عمودان ناقصان** |
| `lesson_versions.runtime_version_id` | غير موجود | موجود (nullable) | يضاف بـ 0023 |
| `lesson_versions.runtime_binding_status` | غير موجود | موجود (smallint, افتراضي 0=Unbound) | يضاف بـ 0023 |
| `runtime_versions` | غير موجود | موجود | **جدول ناقص** |
| `runtime_storage_objects` | غير موجود | موجود | جدول ناقص |
| `runtime_storage_locations` | غير موجود | موجود | جدول ناقص |
| `runtime_assets` | غير موجود | موجود | جدول ناقص |
| `runtime_publication_attempts` | غير موجود | موجود | جدول ناقص |
| `schema_definitions`, `templates`, `share_links` | موجودة | موجودة | — |
| `library_books` (Migration 0022 — المكتبة التعليمية) | غير موجود | موجود | **جدول ناقص** — لا علاقة له بـ Runtime |

**الخلاصة: الفجوة كاملة داخل ملفي Migration اثنين فقط:**
1. **`0022_add_library_books.sql`** — جدول المكتبة (مستقل تمامًا، انظر §1ب).
2. **`0023_runtime_versions.sql`** — بنية Immutable Runtime كاملة.

كلاهما إضافي بالكامل (لا حذف، لا تعديل أعمدة، لا أنواع ENUM جديدة، لا بيانات أولية إلزامية). **الترتيب الإلزامي: 0022 قبل 0023** (ليس لضرورة تقنية بينهما — 0023 لا يعتمد على 0022 — بل لضبط الإصدار الخطي ومنع تخطي رقم في سجل الترقية).

## 1ب. ما يضيفه 0022 تحديدًا (فحص سطر بسطر)

- **جدول واحد:** `library_books` — 30 عمودًا، منها jsonb متعدد اللغات
  (`display_title`, `description`, `long_description`, `access_notes`, `cover_alt`)
  بنفس نمط `LocalizedText` المستخدم في `schema_definitions.level`.
- **قيد واحد:** `UNIQUE(slug)` — يولّد فهرسًا فريدًا تلقائيًا.
- **لا Foreign Keys إطلاقًا:** `created_by`/`updated_by` هما uuid عاديان بلا
  إحالة إلى `users` (مطابق للـ Drizzle schema). الاعتماديات على الجداول
  الموجودة: **صفر** — يعمل على أي خط أساس فيه migrations السابقة.
- **لا بيانات أولية ولا إعدادات إضافية** — لكن إنشاء الجدول وحده لا يكفي
  لظهور الميزة في الواجهة: الأكواد موجودة (`actions/library.ts` + صفحات admin
  وpublic) وتفترض الصلاحيات `Permissions.library*` وصفوف محتوى تدخلها
  الإدارة يدويًا. لا خدمات تخزين أغلفة ولا RLS — الأغلفة URL خارجي (`cover_url`).
- **ملاحظة:** ميزة المكتبة برمجيًا جاهزة في الكود، فغياب الجدول في الإنتاج
  يعني أن هذه الميزة معطلة/مكسورة هناك حاليًا — تطبيق 0022 يصلحها.

ما يضيفه 0023 تحديدًا (فحصت كل سطر منه):
- 5 جداول جديدة بالكامل (مع الفهارس والمفاتيح الأجنبية والقيود).
- عمودان على `lesson_versions` + قيد فحص (CHECK) + فهرس.
- **لا يحذف شيئًا، لا يعدّل أعمدة موجودة، لا ينقل بيانات، لا يستخدم أنواع ENUM جديدة.**
- الصفوف الموجودة في `lesson_versions` تحصل تلقائيًا على `runtime_binding_status = 0` (Unbound) — أي يبقى سلوكها الحالي كما هو تمامًا. لا Backfill.

## 2. توافق 0023 مع حالة الإنتاج الحالية

تحليل التوافق (مبني على بنية الملف نفسها):

1. **0023 migration تجميعي واحد ويكفي وحده.** كل الجداول الخمسة والعمودان في ملف واحد؛ لا حاجة لأي migration آخر لبنية Runtime. ( migrations 0001–0022 السابقة تخص ميزات أخرى: مكتبة، أرصدة، Paddle، إلخ — لا علاقة لها بـ Runtime.)
2. **اعتمادياته الوحيدة** هي جداول يجب أن تكون موجودة مسبقًا: `lesson_versions` ✓ (موجود عندك)، `templates` ✓ (موجودة — للمفتاح الأجنبي)، و`users` (جدول المستخدمين — موجود حتمًا لأن التطبيق يعمل؛ يمكن التأكد منه بخطوة تحقق أدناه).
3. **إضافي بالكامل (additive):** يعمل بغض النظر عن أي اختلافات أخرى بين إنتاجك وخط الأساس.
4. **نقطة حرجة واحدة — تتبع الترحيل:** المشروع يطبّق migrations عبر `drizzle-kit migrate`، الذي يسجّل الملفات المطبقة في جدول `__drizzle_migrations` داخل قاعدة البيانات نفسها. إذا نُفّذ 0023 يدويًا من محرر SQL في لوحة Supabase، فلن يُسجَّل في هذا الجدول، وأي تشغيل لاحق لـ `db:migrate:production` قد يحاول تطبيقه مرة أخرى ويفشل (الملف لا يحتوي `IF NOT EXISTS`). **لذلك في الإنتاج النهائي يجب تطبيقه عبر أمر المشروع الرسمي، لا باللصق اليدوي.** (في بيئة الاختبار المرمية لا يهم التتبع.)
5. تطبيق الملف مرتين يفشل بأمان (`relation already exists`) — لا يوجد خطر كتم للفشل.

### خطوات تحقق مقترحة (قراءة فقط، من لوحة Supabase → SQL Editor):

```sql
-- 1) هل جدول المستخدمين موجود (اعتمادية 0023 الوحيدة غير المؤكدة بعد)؟
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='users';

-- 2) هل خط أساس الإنتاج يشمل migrations حتى 0022؟
--    (وجود هذين العنصرين يعني أن كل ما قبل 0023 مطبق)
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='schema_definitions' AND column_name='level_key';
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='library_books';

-- 3) ما الذي سجّله متتبع الترحيل في الإنتاج؟
SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at;
```

إن كان (1) موجودًا و(2) موجودين، فإن تطبيق 0023 وحده ينقل الإنتاج إلى البنية المطلوبة بالكامل. إن كان `__drizzle_migrations` غير موجود أصلًا، فهذا يعني أن الإنتاج بُني بطريقة أخرى، وعندها نعيد تقييم خط الأساس قبل أي خطوة.

## 3. خطة الاختبار المنفصلة عن الإنتاج

**المبدأ: لا تُنسخ أي بيانات إنتاج إطلاقًا.** البيئة الاختبارية تُبنى فارغة من migrations، وتُملأ ببيانات اصطناعية فقط. هذه أقوى حماية ممكنة — لا حاجة حتى لخطة إخفاء هوية لأن لا بيانات حقيقية تدخل البيئة أصلًا.

الخطوات (أنا أنفذها محليًا عند موافقتك، أو تفعلها أنت في لوحة Supabase):

1. **إنشاء مشروع Supabase اختباري جديد** (مجاني): app.supabase.com → New Project → اسم مثل `fusaha-runtime-test` → كلمة مرور قوية للـ database → region قريبة. هذا المشروع منفصل تمامًا عن إنتاجك، بلا أي رابط.
2. **بناء خط الأساس 0001→0022** ثم **تطبيق 0023 منفصلًا** — لإثبات أن 0023 يعمل على خط أساس يشبه إنتاجك (بدون جداول Runtime).
3. **تشغيل مجموعة اختبارات Runtime** (103 اختبارات في `lib/runtime` + 4 في `lib/db`) ضد قاعدة الاختبار هذه — نفس المجموعات التي نجحت 160/160 على القاعدة المحلية.
4. **التحقق اليدوي النهائي** باستعلامات قراءة فقط (أدناه).

ملاحظة: نفس الإثبات أجري فعليًا هذا الصباح على قاعدة محلية مؤقتة (24 migration تُطبق بالترتيب، 103/103 اختبارًا ناجحًا)، لكن إثباته على **Supabase** تحديدًا يزيل أي شك في فروق البيئة (إصدارات Postgres، أذونات، الـ pooler).

## 4. التعليمات خطوة بخطوة (بنفسك، عبر لوحة Supabase)

> هذه الخطوات تنشئ بيئة اختبار فقط. لا تلمس مشروع الإنتاج إطلاقًا.

**الخطوة 1 — إنشاء المشروع الاختباري:**
1. ادخل إلى https://app.supabase.com واختر مؤسستك (أو أنشئ واحدة).
2. اضغط **New Project**. الاسم: `fusaha-runtime-test`. كلمة مرور قوية للـ Database (احفظها). Region: نفس region الإنتاج إن أمكن.
3. انتظر اكتمال التهيئة (دقيقتان تقريبًا).

**الخطوة 2 — بناء المخطط:**
1. من القائمة اليسرى: **SQL Editor** → **New query**.
2. افتح على جهازك الملف `database/migrations/0001_last_shard.sql` وانسخ محتواه كاملًا والصقه في المحرر → **Run**. كرر بالترتيب مع كل ملفات المجلد `database/migrations/` حتى `0022_add_library_books.sql` (ملفان يبدآن بـ 0001 — طبقهما كليهما بالترتيب: `0001_last_shard` ثم `0001_wet_lockheed`).
3. الآن طبّق `0023_runtime_versions.sql` وحده في استعلام منفصل (هذا هو الاختبار الحقيقي). يجب أن تظهر رسالة نجاح بلا أخطاء.

**الخطوة 3 — التحقق البصري:**
1. **Table Editor**: يجب أن ترى الجداول الخمسة الجديدة: `runtime_versions`, `runtime_assets`, `runtime_storage_objects`, `runtime_storage_locations`, `runtime_publication_attempts`.
2. افتح جدول `lesson_versions`: يجب أن يظهر العمودان `runtime_version_id` و`runtime_binding_status`، وقيمة الافتراضي 0.

**الخطوة 4 — التحقق باستعلام (SQL Editor → New query):**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'runtime%';
-- المتوقع: 5 جداول

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='lesson_versions'
  AND column_name IN ('runtime_version_id','runtime_binding_status');
-- المتوقع: صفان
```

**الخطوة 5 — سلّم لي:** أرسل لي **Connection String** الخاصة بالمشروع الاختباري (Settings → Database → Connection string → URI، الشكل: `postgresql://postgres:...db.supabase.co:5432/postgres`)، وسأشغّل عليها مجموعات الاختبارات كاملة وأعطيك تقرير النتائج. هذه القاعدة اختبارية فارغة بالكامل فلا خطر من مشاركة بياناتها.

> بديل: إن فضّلت، أنا أنشئ المشروع الاختباري بنفسي عند موافقتك — لكن إنشاء المشروع يتطلب تسجيل دخولك أنت، لذا الخطوات أعلاه هي الأبسط.

## 5. ما يحدث بعد نجاح الاختبار

عندما تنجح الخطوات أعلاه:
1. تبقى بوابة INV (Inventory) و S3 (AWS) كما هي — هما المدخلان الخارجيان الوحيدان المتبقيان قبل أي ترحيل حقيقي.
2. **ترقية الإنتاج (لاحقًا، عند موافقة صريحة، يدويًا عبر لوحة Supabase):**
   أ. نفّذ استعلام العلامات (أسفل الوثيقة) لتحديد آخر migration مطبق فعلًا.
   ب. طبّق الناقصة **بالترتيب**: أي migrations سابقة ناقصة ← `0022_add_library_books.sql` ← `0023_runtime_versions.sql`، كل واحدة في استعلام منفصل، وتخطَّ أي ملف تثبت علاماته أنه مطبق.
   ج. بعد كل ملف، تحقق من نجاحه (رسالة نجاد بلا أخطاء + تحقق بصري في Table Editor).
   د. **لا تشغّل `db:migrate:production` أبدًا على هذه القاعدة** — بغياب `__drizzle_migrations` سيفشل من أول ملف. (إن أردت مستقبلًا إعادة تفعيل المسار الرسمي، يلزم أولًا إعادة بناء جدول المتتبع يدويًا بصفوف كل migrations المطبقة — مهمة منفصلة بموافقة صريحة.)
3. حتى ذلك الحين لا شيء يتغير في الإنتاج، وFeature Flag مطفأ، وسلوك التطبيق الحالي مستمر.

## 5ب. استعلام العلامات — تحديد آخر migration مطبق فعلًا (قراءة فقط)

غياب `__drizzle_migrations` يعني أنه لا يوجد سجل تاريخي نقرأه؛ بدلًا منه نفحص
الأثر DDL المميز لكل migration. شغّل هذا في SQL Editor على الإنتاج (BEGIN
READ ONLY + ROLLBACK يجعلانه قراءة حصرية بلا أي أثر):

```sql
BEGIN READ ONLY;
SELECT 'M-0010 system_settings' AS marker, CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0016 app_settings', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_settings') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0017 level_key (already confirmed)', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schema_definitions' AND column_name='level_key') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0018 credit_packages.badge_label', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_packages' AND column_name='badge_label') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0019 users.paddle_customer_id', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='paddle_customer_id') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0020 color_light dropped', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_packages' AND column_name='color_light') THEN 'NOT-APPLIED' ELSE 'APPLIED' END
UNION ALL SELECT 'M-0021 name is jsonb', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_packages' AND column_name='name' AND udt_name='jsonb') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0022 library_books (already confirmed MISSING)', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='library_books') THEN 'APPLIED' ELSE 'MISSING' END
UNION ALL SELECT 'M-0023 runtime_versions', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='runtime_versions') THEN 'APPLIED' ELSE 'MISSING' END;
ROLLBACK;
```

القراءة: آخر سطر APPLIED متتالي يحدد موقع الإنتاج؛ كل ما بعده في القائمة
هو ما سيُطبق يدويًا في ترقية الإنتاج المستقبلية (بالترتيب، مع تخطي المطبق).

## 6. القيود المحترمة في هذه الخطة

- لا Migration على الإنتاج، ولا أي كتابة فيه (كل استعلامات التحقق قراءة فقط).
- لا نسخ لأي بيانات إنتاج — البيئة تُبنى فارغة.
- لا تغيير في الكود أو المعمارية أو الوثائق التصميمية.
- لا Commit ولا Push. الفرع unchanged.
