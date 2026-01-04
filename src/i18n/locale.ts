import { Pathnames } from "next-intl/routing";

export const locales = ["en"];

export const localeNames: any = {
  en: "English",
};

export const defaultLocale = "en";

export const localePrefix = "as-needed";

export const localeDetection =
  process.env.NEXT_PUBLIC_LOCALE_DETECTION === "true";
