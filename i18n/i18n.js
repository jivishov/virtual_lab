// ===== INTERNATIONALIZATION CORE LOGIC =====
// Handles language switching, storage, and translation application

const I18n = {
    // Default language
    defaultLanguage: 'en',

    // Current language
    currentLanguage: null,

    // Supported languages
    supportedLanguages: ['en', 'az', 'tr', 'de'],

    // Initialize i18n system
    init() {
        this.currentLanguage = this.getCurrentLanguage();
        this.applyTranslations();
    },

    // Get current language from localStorage or default
    getCurrentLanguage() {
        const saved = localStorage.getItem('virtuallab_language');
        if (saved && this.supportedLanguages.includes(saved)) {
            return saved;
        }
        return this.defaultLanguage;
    },

    // Set language and save to localStorage
    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`Language ${lang} not supported. Defaulting to ${this.defaultLanguage}`);
            lang = this.defaultLanguage;
        }

        this.currentLanguage = lang;
        localStorage.setItem('virtuallab_language', lang);
        this.applyTranslations();

        // Trigger custom event for other components
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    },

    // Get translation by key path (e.g., 'header.title')
    translate(keyPath, lang = null) {
        const language = lang || this.currentLanguage || this.defaultLanguage;
        const keys = keyPath.split('.');
        let value = translations[language];

        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            } else {
                // Fallback to English if translation not found
                value = translations[this.defaultLanguage];
                for (const fallbackKey of keys) {
                    if (value && typeof value === 'object') {
                        value = value[fallbackKey];
                    } else {
                        console.warn(`Translation not found for key: ${keyPath}`);
                        return keyPath;
                    }
                }
                break;
            }
        }

        return value !== undefined ? value : keyPath;
    },

    // Apply translations to all elements with data-i18n attribute
    applyTranslations() {
        // Update elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);

            if (typeof translation === 'string') {
                // Handle different element types
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLanguage;
    },

    // Get all translations for current language
    getAll(category = null) {
        const lang = this.currentLanguage || this.defaultLanguage;
        if (category) {
            return translations[lang][category] || {};
        }
        return translations[lang] || {};
    },

    // Get language name for display
    getLanguageName(lang = null) {
        const language = lang || this.currentLanguage || this.defaultLanguage;
        return translations[language]?.languageName || language.toUpperCase();
    }
};

// Auto-initialize on DOM load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        I18n.init();
    });
}
