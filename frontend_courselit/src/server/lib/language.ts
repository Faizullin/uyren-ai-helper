// import 'server-only'

// const dictionaries = {
//     "en": () => import('@/../dictionaries/en/common.json').then((module) => module.default),
//     // ru: () => import('@/../dictionaries/ru.json').then((module) => module.default),
// }

// export const getDictionary = async (locale: 'en-US' | "en" | 'ru') => {
//     const langLocale = ((locale === "en-US") ? "en" : locale) as keyof typeof dictionaries
//     const res = dictionaries[langLocale]!();
// }
