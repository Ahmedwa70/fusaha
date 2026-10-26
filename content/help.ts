import { ROUTES } from "@/constants/routes";

export type HelpCategory = "guides" | "faq" | "troubleshooting" | "contact";

export type HelpArticle = {
  id: string;
  category: Exclude<HelpCategory, "contact">;
  question: string;
  answer: string;
  href?: string;
};

export const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    category: "guides",
    question: "كيف أبدأ باستخدام فُصحاء؟",
    answer: "يمكنك استكشاف المنتجات المتاحة أولًا، ثم فتح مولّد الدروس التفاعلية من صفحة المنتجات أو زر البدء. استوديو الكتابة العربية متاح أيضًا من صفحة المنتجات للتعرّف على تجربته الحالية.",
    href: ROUTES.products,
  },
  {
    id: "interactive-lessons",
    category: "guides",
    question: "كيف أستخدم مولّد الدروس التفاعلية؟",
    answer: "افتح مولّد الدروس من صفحة المنتجات أو من زر البدء، ثم استخدم مساحة إنشاء الدرس المتاحة في حسابك. تفاصيل الدرس ومراجعته تتم من مساحة العمل عند توفرها.",
    href: ROUTES.dashboardCreate,
  },
  {
    id: "writing-studio",
    category: "guides",
    question: "كيف أستخدم استوديو الكتابة العربية؟",
    answer: "افتح استوديو الكتابة العربية من صفحة المنتجات. الصفحة الحالية تعريفية، ويمكنك استخدامها لاستكشاف التجربة المتاحة دون افتراض خطوات أو إعدادات غير موثقة.",
    href: ROUTES.lessonStudio,
  },
  {
    id: "login-problem",
    category: "troubleshooting",
    question: "ماذا أفعل إذا واجهت مشكلة في تسجيل الدخول؟",
    answer: "تحقق من استخدام بيانات الحساب الصحيحة، ثم جرّب مسار استعادة كلمة المرور من صفحة تسجيل الدخول. إذا استمرت المشكلة، استخدم وسيلة التواصل الرسمية عندما تُحدّدها فُصحاء.",
    href: ROUTES.forgotPassword,
  },
  {
    id: "page-error",
    category: "troubleshooting",
    question: "ماذا أفعل إذا لم تفتح صفحة أو أداة؟",
    answer: "أعد تحميل الصفحة وتحقق من الرابط، ثم جرّب فتح الأداة من صفحة المنتجات. إذا ظهرت رسالة خطأ مستمرة، احتفظ بنصها لتقديم وصف دقيق عند التواصل مع فريق فُصحاء.",
    href: ROUTES.products,
  },
  {
    id: "account-required",
    category: "faq",
    question: "هل أحتاج إلى تسجيل الدخول لاستخدام الأدوات؟",
    answer: "بعض وجهات الأدوات مرتبطة بمساحة العمل وتطلب تسجيل الدخول. يمكنك استكشاف المنتجات والصفحات التعريفية دون تسجيل الدخول، ثم تسجيل الدخول عند الانتقال إلى الوجهة التي تتطلب حسابًا.",
    href: ROUTES.login,
  },
];

export const helpCategories = [
  { id: "guides" as const, title: "أدلة الاستخدام", description: "تعلّم استخدام أدوات فُصحاء.", icon: "book" },
  { id: "faq" as const, title: "الأسئلة الشائعة", description: "إجابات سريعة عن الأسئلة المتكررة.", icon: "messages" },
  { id: "troubleshooting" as const, title: "حل المشكلات", description: "خطوات عملية لمعالجة الأعطال.", icon: "wrench" },
  { id: "contact" as const, title: "تواصل معنا", description: "معلومات التواصل الرسمية عند توفرها.", icon: "headphones" },
];
