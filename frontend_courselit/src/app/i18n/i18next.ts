import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ChainedBackend from "i18next-chained-backend";
import HttpBackend from "i18next-http-backend";
import LocalStorageBackend from "i18next-localstorage-backend";
import { initReactI18next } from "react-i18next/initReactI18next";
import resourcesToBackend from "i18next-resources-to-backend";

const runsOnServerSide = typeof window === "undefined";
const languages = ["en-US", "kz", "ru"];
const defaultNS = "common";
const fallbackLng = "en-US";

i18next
  .use(ChainedBackend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      return import(`../../../public/locales/${language}/${namespace}.json`);
    }),
  )
  // .use(runsOnServerSide ? LocizeBackend : resourcesToBackend((language: string, namespace: string) => import(`../../../public/locales/${language}/${namespace}.json`))) // locize backend could be used, but prefer to keep it in sync with server side
  .init({
    // debug: true,
    supportedLngs: languages,
    fallbackLng,
    lng: undefined, // let detect the language on client side
    fallbackNS: defaultNS,
    defaultNS,
    preload: runsOnServerSide ? languages : [],
    backend: {
      backends: [LocalStorageBackend, HttpBackend],
    },
  });

export default i18next;
