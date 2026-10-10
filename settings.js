class SettingsManager {
    constructor() {
        this.settings = {
            updateInterval: 30000,
            showWidget: true,
            showBadge: true,
            enableNotifications: false,
            defaultTheme: 'green'
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.loadTheme();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Переключатель темы
        document.getElementById('settingsThemeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Кнопки сохранения и сброса
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });
        
        // Кнопки выбора темы
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTheme(btn.dataset.theme);
            });
        });
        
        // Обработка изменений в настройках
        document.getElementById('updateInterval').addEventListener('change', (e) => {
            this.settings.updateInterval = parseInt(e.target.value);
        });
        
        document.getElementById('showWidget').addEventListener('change', (e) => {
            this.settings.showWidget = e.target.checked;
        });
        
        document.getElementById('showBadge').addEventListener('change', (e) => {
            this.settings.showBadge = e.target.checked;
        });
        
        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.settings.enableNotifications = e.target.checked;
        });
    }
    
    loadSettings() {
        chrome.storage.sync.get(['robotcyb-settings'], (result) => {
            if (result['robotcyb-settings']) {
                this.settings = { ...this.settings, ...result['robotcyb-settings'] };
            }
            this.updateUI();
        });
    }
    
    saveSettings() {
        chrome.storage.sync.set({
            'robotcyb-settings': this.settings
        }, () => {
            this.showNotification('Settings saved successfully!', 'success');
            
            // Отправляем сообщение в background script для обновления настроек
            chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: this.settings
            });
        });
    }
    
    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            this.settings = {
                updateInterval: 30000,
                showWidget: true,
                showBadge: true,
                enableNotifications: false,
                defaultTheme: 'green'
            };
            
            chrome.storage.sync.set({
                'robotcyb-settings': this.settings
            }, () => {
                this.updateUI();
                this.showNotification('Settings reset to default!', 'success');
                
                // Отправляем сообщение в background script
                chrome.runtime.sendMessage({
                    type: 'UPDATE_SETTINGS',
                    settings: this.settings
                });
            });
        }
    }
    
    updateUI() {
        // Обновляем значения в UI
        document.getElementById('updateInterval').value = this.settings.updateInterval;
        document.getElementById('showWidget').checked = this.settings.showWidget;
        document.getElementById('showBadge').checked = this.settings.showBadge;
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
        
        // Обновляем кнопки темы
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === this.settings.defaultTheme) {
                btn.classList.add('active');
            }
        });
    }
    
    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('settingsThemeToggle');
        const logoImg = document.getElementById('settingsLogo');
        
        if (body.classList.contains('pink-theme')) {
            // Переключаем на зеленую тему
            body.classList.remove('pink-theme');
            themeToggle.classList.remove('pink');
            logoImg.src = 'icons/icon48.svg';
        } else {
            // Переключаем на розовую тему
            body.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = 'icons/icon48-pink.svg';
        }
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('robotcyb-theme');
        const body = document.body;
        const themeToggle = document.getElementById('settingsThemeToggle');
        const logoImg = document.getElementById('settingsLogo');
        
        if (savedTheme === 'pink') {
            body.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = 'icons/icon48-pink.svg';
        }
    }
    
    selectTheme(theme) {
        this.settings.defaultTheme = theme;
        
        // Обновляем кнопки
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
        
        // Применяем тему
        const body = document.body;
        const themeToggle = document.getElementById('settingsThemeToggle');
        const logoImg = document.getElementById('settingsLogo');
        
        if (theme === 'pink') {
            body.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = 'icons/icon48-pink.svg';
        } else {
            body.classList.remove('pink-theme');
            themeToggle.classList.remove('pink');
            logoImg.src = 'icons/icon48.svg';
        }
    }
    
    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid ${type === 'success' ? '#00ff41' : '#ff0080'};
            border-radius: 8px;
            color: ${type === 'success' ? '#00ff41' : '#ff0080'};
            font-family: 'Courier New', monospace;
            font-weight: bold;
            box-shadow: 0 0 20px ${type === 'success' ? 'rgba(0, 255, 65, 0.3)' : 'rgba(255, 0, 128, 0.3)'};
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Инициализируем менеджер настроек
const settingsManager = new SettingsManager();

// Обработка сообщений от других частей расширения
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SETTINGS') {
        sendResponse(settingsManager.settings);
    }
}); 
