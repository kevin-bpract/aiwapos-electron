import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

const resources = {
  en: { translation: en },
};

i18next.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
