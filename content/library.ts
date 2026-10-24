export type LibraryBook = {
  slug: string;
  title: string;
  author: string;
  category: string;
  level: string;
  audience: string;
  description: string;
  cover?: string;
  access: {
    type: "metadata" | "publisher";
    label: string;
    href?: string;
  };
};

export const libraryBooks: LibraryBook[] = [
  {
    slug: "arabic-stories-for-beginners",
    title: "قصص عربية للمبتدئين",
    author: "مبادرة فُصحاء التعليمية",
    category: "قصص وقراءة",
    level: "مبتدئ",
    audience: "المتعلمون",
    description: "مجموعة نصوص قصيرة بلغة عربية واضحة، تساعد المتعلم على بناء الثروة اللغوية والاستمتاع بالقراءة.",
    cover: "/images/fusaha-library.png",
    access: { type: "metadata", label: "بيانات الكتاب فقط" },
  },
  {
    slug: "arabic-teaching-guide",
    title: "دليل تعليم العربية للمعلمين",
    author: "فريق فُصحاء التربوي",
    category: "أدلة تعليمية",
    level: "متوسط",
    audience: "المعلمون",
    description: "أفكار عملية لتنظيم درس اللغة العربية، واختيار الأنشطة، وبناء تجربة تعلم مناسبة لمستويات مختلفة.",
    cover: "/images/fusaha-writing.png",
    access: { type: "metadata", label: "بيانات الكتاب فقط" },
  },
  {
    slug: "arabic-language-skills",
    title: "مهارات اللغة العربية خطوة بخطوة",
    author: "المركز العربي للتعلم المفتوح",
    category: "مهارات لغوية",
    level: "متقدم",
    audience: "المتعلمون",
    description: "مادة مرجعية للتدرب على القراءة والكتابة والتعبير، مع أمثلة تساعد على التعلم الذاتي.",
    cover: "/images/fusaha-hero.png",
    access: { type: "metadata", label: "بيانات الكتاب فقط" },
  },
];

export const libraryCategories = [...new Set(libraryBooks.map((book) => book.category))];
export const libraryLevels = [...new Set(libraryBooks.map((book) => book.level))];

export function getLibraryBook(slug: string) {
  return libraryBooks.find((book) => book.slug === slug);
}
