import * as i18next from 'i18next';
import { initReactI18next } from "react-i18next";
import translationEn   from '../../translations/en';
import translationFr   from '../../translations/fr';
import translationEs   from '../../translations/es';
import translationKo   from '../../translations/ko';
import translationDe   from '../../translations/de';
import translationZhCN from '../../translations/zhcn';
import translationAr   from '../../translations/ar';
import translationHi   from '../../translations/hi';

const fallbackLng = "en";

const resources = {
    en:   {translation: translationEn},
    fr:   {translation: translationFr},
    ko:   {translation: translationKo},
    es:   {translation: translationEs},
    de:   {translation: translationDe},
    zhcn: {translation: translationZhCN},
    ar:   {translation: translationAr},
    hi:   {translation: translationHi},
};

const supportedLanguages = Object.keys(resources);

// Gets the first part of the language code (e.g., "en-US" becomes "en")
const getPrimaryLangCode = (lang: string) => lang.split('-')[0];

// 1. Get browser's preferred language
const browserLanguage = navigator.languages
    ? getPrimaryLangCode(navigator.languages[0])
    : getPrimaryLangCode(navigator.language || fallbackLng);

// 2. Check if it matches any of your app's supported languages
// Fallback to a default language if no match
const lng = supportedLanguages.includes(browserLanguage) ? browserLanguage : fallbackLng;

const i18n = i18next.createInstance();
const config = { resources, lng, fallbackLng, interpolation: { escapeValue: false} };

i18n.use(initReactI18next).init(config);
// console.log('i18n initialized with language:', i18n.language);


export default i18n;