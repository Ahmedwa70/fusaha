import { ROUTES } from "@/constants/routes";

export type ResourceKind = "tool" | "educational";
export type ResourceAvailability = "available";

export type ResourceItem = {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string;
  availability: ResourceAvailability;
  href: string;
  action: string;
  image: string;
  imageAlt: string;
};

export const resourceCatalog: ResourceItem[] = [
  {
    id: "interactive-lesson-generator",
    kind: "tool",
    title: "مولّد الدروس التفاعلية",
    description: "حوّل مصدر الدرس إلى تجربة تفاعلية قابلة للمراجعة والاستخدام في الفصل.",
    availability: "available",
    href: ROUTES.dashboardCreate,
    action: "ابدأ إنشاء درس",
    image: "/images/fusaha-hero.png",
    imageAlt: "معاينة واجهة فُصحاء لإنشاء درس تفاعلي",
  },
  {
    id: "arabic-writing-studio",
    kind: "tool",
    title: "استوديو الكتابة العربية",
    description: "بيئة متخصصة تساعدك على تنظيم المحتوى العربي وتحويله إلى مادة تعليمية.",
    availability: "available",
    href: ROUTES.lessonStudio,
    action: "افتح الاستوديو",
    image: "/images/fusaha-writing.png",
    imageAlt: "معاينة استوديو الكتابة العربية في فُصحاء",
  },
];
