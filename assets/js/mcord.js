// assets/js/mcord.js
const McordApp = {
    init() {
        this.loadSettings();
    },

    setTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('m_theme', themeName);
    },

    setColor(hexColor) {
        document.documentElement.style.setProperty('--accent-color', hexColor);
        localStorage.setItem('m_color', hexColor);
    },

    loadSettings() {
        const theme = localStorage.getItem('m_theme') || 'zeus';
        const color = localStorage.getItem('m_color') || '#5865f2';
        this.setTheme(theme);
        this.setColor(color);
    }
};

McordApp.init();
