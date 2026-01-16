import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'hi' : 'en';
        i18n.changeLanguage(newLang);
        document.documentElement.lang = newLang;
    };

    return (
        <button
            onClick={toggleLanguage}
            className="p-2 rounded-full hover:bg-bg-tertiary transition-all duration-300 border border-transparent hover:border-border text-text-primary flex items-center gap-2"
            title={i18n.language === 'en' ? 'Switch to Hindi' : 'अंग्रेजी में बदलें'}
        >
            <Icon icon="mdi:translate" width={20} />
            <span className="text-sm font-medium uppercase">{i18n.language}</span>
        </button>
    );
};

export default LanguageSwitcher;
