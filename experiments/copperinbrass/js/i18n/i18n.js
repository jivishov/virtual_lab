// i18n.js - Internationalization core module
import en from './en.js';

const translations = { en };
let currentLang = localStorage.getItem('brasslab-lang') || 'en';
let currentTranslations = translations[currentLang] || en;

// Dynamically load language
export async function setLanguage(lang) {
    if (!translations[lang]) {
        try {
            const module = await import(`./${lang}.js`);
            translations[lang] = module.default;
        } catch (e) {
            console.warn(`Language ${lang} not found, falling back to English`);
            lang = 'en';
        }
    }
    currentLang = lang;
    currentTranslations = translations[lang];
    localStorage.setItem('brasslab-lang', lang);
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

// Get translation with variable interpolation
export function t(key, vars = {}) {
    const keys = key.split('.');
    let value = currentTranslations;

    for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
            // Fallback to English
            value = en;
            for (const k2 of keys) {
                value = value?.[k2];
            }
            break;
        }
    }

    if (typeof value !== 'string') return key;

    // Interpolate variables: {varName}
    return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

// Get instruction by step index
export function getInstruction(stepIndex) {
    return currentTranslations.instructions?.[stepIndex]
        || en.instructions?.[stepIndex]
        || '';
}

export function getCurrentLang() {
    return currentLang;
}

export function getAvailableLanguages() {
    return [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
        { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
    ];
}

// Initialize language on module load
export async function initLanguage() {
    if (currentLang !== 'en' && !translations[currentLang]) {
        await setLanguage(currentLang);
    }
}
