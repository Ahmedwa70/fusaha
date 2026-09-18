-- The dashboard pricing card is read in the teacher's own language, so every
-- admin-entered display field on credit_packages becomes jsonb keyed by
-- locale — the same shape schema_definitions.level uses (see migration 0017
-- and lib/localized-text.ts).
--
-- The copy that exists at the time of this migration gets real en/zh text
-- instead of falling back to Arabic in those locales; anything else is
-- carried over as Arabic-only and filled in by an admin from the packages
-- form, which requires every locale from now on.
ALTER TABLE "credit_packages" ALTER COLUMN "name" SET DATA TYPE jsonb USING (
  CASE "name"
    WHEN 'الباقة الأساسية' THEN jsonb_build_object('ar', "name", 'en', 'Starter Pack', 'zh', '基础套餐')
    WHEN 'الباقة المتقدمة' THEN jsonb_build_object('ar', "name", 'en', 'Advanced Pack', 'zh', '进阶套餐')
    WHEN 'باقة المحترفين' THEN jsonb_build_object('ar', "name", 'en', 'Professional Pack', 'zh', '专业套餐')
    ELSE jsonb_build_object('ar', "name")
  END
);--> statement-breakpoint
ALTER TABLE "credit_packages" ALTER COLUMN "badge_label" SET DATA TYPE jsonb USING (
  CASE
    WHEN "badge_label" IS NULL THEN NULL
    WHEN "badge_label" IN ('الأكثر توازنًا', 'الأكثر توازناً') THEN jsonb_build_object('ar', "badge_label", 'en', 'Best Balance', 'zh', '最均衡')
    WHEN "badge_label" = 'الأفضل قيمة' THEN jsonb_build_object('ar', "badge_label", 'en', 'Best Value', 'zh', '最超值')
    ELSE jsonb_build_object('ar', "badge_label")
  END
);--> statement-breakpoint
ALTER TABLE "credit_packages" ALTER COLUMN "subtitle" SET DATA TYPE jsonb USING (
  CASE
    WHEN "subtitle" IS NULL THEN NULL
    WHEN "subtitle" = 'للاستخدام المنتظم' THEN jsonb_build_object('ar', "subtitle", 'en', 'For regular use', 'zh', '适合日常使用')
    WHEN "subtitle" = 'للاستخدام المكثف والمستمر' THEN jsonb_build_object('ar', "subtitle", 'en', 'For heavy, ongoing use', 'zh', '适合高强度持续使用')
    WHEN "subtitle" LIKE 'للتجربة%' THEN jsonb_build_object('ar', "subtitle", 'en', 'For trying out and light use', 'zh', '适合试用与轻度使用')
    ELSE jsonb_build_object('ar', "subtitle")
  END
);--> statement-breakpoint
ALTER TABLE "credit_packages" ALTER COLUMN "footer_text" SET DATA TYPE jsonb USING (
  CASE
    WHEN "footer_text" IS NULL THEN NULL
    WHEN "footer_text" IN ('ابدأ الآن واستكشف امكانيات المنصة', 'ابدأ الان واستكشف امكانيات المنصة') THEN jsonb_build_object('ar', "footer_text", 'en', 'Start now and explore the platform', 'zh', '立即开始，探索平台功能')
    WHEN "footer_text" = 'خيار مثالي للاستخدام المنتظم' THEN jsonb_build_object('ar', "footer_text", 'en', 'An ideal choice for regular use', 'zh', '日常使用的理想选择')
    WHEN "footer_text" = 'احصل على قيمة أكبر مقابل كل دولار' THEN jsonb_build_object('ar', "footer_text", 'en', 'Get more value for every dollar', 'zh', '每一分钱都更超值')
    ELSE jsonb_build_object('ar', "footer_text")
  END
);--> statement-breakpoint
-- features goes from string[] to one object per bullet, each carrying that
-- bullet's text in every locale — the bullets stay in the same order, so the
-- list reads identically in all three languages.
UPDATE "credit_packages" SET "features" = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN feature IN ('رصيد 500 للاستخدام', '500 رصيد للاستخدام') THEN jsonb_build_object('ar', feature, 'en', '500 credits to use', 'zh', '500 积分可用')
        WHEN feature IN ('رصيد 1,500 للاستخدام', '1,500 رصيد للاستخدام') THEN jsonb_build_object('ar', feature, 'en', '1,500 credits to use', 'zh', '1,500 积分可用')
        WHEN feature IN ('رصيد 3,500 للاستخدام', '3,500 رصيد للاستخدام') THEN jsonb_build_object('ar', feature, 'en', '3,500 credits to use', 'zh', '3,500 积分可用')
        WHEN feature = 'الوصول إلى جميع الخدمات المدعومة بالرصيد' THEN jsonb_build_object('ar', feature, 'en', 'Access to every credit-backed service', 'zh', '可使用所有消耗积分的服务')
        WHEN feature = 'بدون اشتراك شهري' THEN jsonb_build_object('ar', feature, 'en', 'No monthly subscription', 'zh', '无需月度订阅')
        WHEN feature = 'مناسبة للتجربة والاستخدام الخفيف' THEN jsonb_build_object('ar', feature, 'en', 'Suited to trying out and light use', 'zh', '适合试用与轻度使用')
        WHEN feature = 'ابدأ بكمية مناسبة' THEN jsonb_build_object('ar', feature, 'en', 'Start with a sensible amount', 'zh', '从合适的额度开始')
        WHEN feature = 'مناسبة للاستخدام المنتظم' THEN jsonb_build_object('ar', feature, 'en', 'Suited to regular use', 'zh', '适合日常使用')
        WHEN feature = 'كمية أكبر للاستخدام المستمر' THEN jsonb_build_object('ar', feature, 'en', 'A larger amount for ongoing use', 'zh', '更大额度，持续使用')
        WHEN feature = 'قيمة أفضل من الباقة الأساسية' THEN jsonb_build_object('ar', feature, 'en', 'Better value than the Starter Pack', 'zh', '比基础套餐更超值')
        WHEN feature = 'مناسبة للمشاريع الكبيرة والاستخدام المكثف' THEN jsonb_build_object('ar', feature, 'en', 'Suited to large projects and heavy use', 'zh', '适合大型项目与高强度使用')
        WHEN feature = 'أفضل سعر لكل رصيد' THEN jsonb_build_object('ar', feature, 'en', 'The best price per credit', 'zh', '每点积分价格最低')
        ELSE jsonb_build_object('ar', feature)
      END
      ORDER BY ordinality
    )
    FROM jsonb_array_elements_text("credit_packages"."features") WITH ORDINALITY AS t(feature, ordinality)
  ),
  '[]'::jsonb
);
