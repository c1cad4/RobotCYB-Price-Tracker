class RobotCYBPriceTracker {
    constructor() {
        this.tokenAddress = '8WZiguAp8NyFnwm8Z97k6sCbSRCWaW1YYXKeCTpupump';
        this.chain = 'sol';
        this.chartUrl = `https://www.gmgn.cc/kline/${this.chain}/${this.tokenAddress}?theme=dark&interval=15`;
        this.lastPrice = 0;
        this.updateInterval = 30000; // 30 секунд
        
        this.init();
    }
    
    init() {
        this.loadTheme();
        this.loadPriceData();
        this.setupEventListeners();
        this.startAutoUpdate();
    }
    
    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadPriceData();
        });
        
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });
        
        // Переключатель темы
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
    }
    
    async loadPriceData() {
        try {
            this.showLoading(true);
            
            // Обновляем iframe с актуальным URL
            const chartIframe = document.getElementById('priceChart');
            chartIframe.src = this.chartUrl;
            
            const response = await chrome.runtime.sendMessage({ type: 'REFRESH_PRICE' });
            if (response?.error) throw new Error(response.error);
            if (!response?.data) throw new Error('Price data is unavailable');
            this.updatePriceDisplay(response.data);
            
            // Обновляем время последнего обновления
            this.updateLastUpdateTime(response.data.timestamp);
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showError('Ошибка загрузки данных');
        } finally {
            this.showLoading(false);
        }
    }
    
    updatePriceDisplay(priceData) {
        const priceElement = document.getElementById('currentPrice');
        const changeElement = document.getElementById('priceChange');
        const changeValueElement = changeElement.querySelector('.change-value');
        const changeArrowElement = changeElement.querySelector('.change-arrow');
        const isPinkTheme = document.body.classList.contains('pink-theme');
        
        // Форматируем цену
        const formattedPrice = `$${priceData.price.toFixed(8)}`;
        priceElement.textContent = formattedPrice;
        
        // Обновляем изменение цены
        const changePercent = priceData.change.toFixed(2);
        changeValueElement.textContent = `${changePercent}%`;
        
        // Определяем направление изменения и цвет
        const greenColor = isPinkTheme ? '#ff0080' : '#00ff41';
        const redColor = '#ff0040';
        
        if (priceData.change > 0) {
            changeArrowElement.textContent = '↗';
            changeArrowElement.style.color = greenColor;
            changeValueElement.style.color = greenColor;
        } else if (priceData.change < 0) {
            changeArrowElement.textContent = '↘';
            changeArrowElement.style.color = redColor;
            changeValueElement.style.color = redColor;
        } else {
            changeArrowElement.textContent = '→';
            changeArrowElement.style.color = greenColor;
            changeValueElement.style.color = greenColor;
        }
        
        // Анимация обновления
        priceElement.style.animation = 'none';
        priceElement.offsetHeight; // Trigger reflow
        priceElement.style.animation = 'priceUpdate 0.5s ease-in-out';
    }
    
    updateLastUpdateTime(timestamp) {
        const now = new Date(timestamp);
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('lastUpdate').textContent = timeString;
    }
    
    showLoading(show) {
        const container = document.querySelector('.container');
        if (show) {
            container.classList.add('loading');
        } else {
            container.classList.remove('loading');
        }
    }
    
    showError(message) {
        const priceElement = document.getElementById('currentPrice');
        priceElement.textContent = message;
        priceElement.style.color = '#ff0040';
        
        setTimeout(() => {
            priceElement.style.color = '#00ff41';
        }, 3000);
    }
    
    startAutoUpdate() {
        setInterval(() => {
            this.loadPriceData();
        }, this.updateInterval);
    }
    
    openSettings() {
        // Открываем настройки в новом окне
        chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html')
        });
    }
    
    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');
        const logoImg = document.querySelector('.logo-img');
        
        if (body.classList.contains('pink-theme')) {
            // Переключаем на зеленую тему
            body.classList.remove('pink-theme');
            themeToggle.classList.remove('pink');
            logoImg.src = 'icons/icon48.svg';
            localStorage.setItem('robotcyb-theme', 'green');
        } else {
            // Переключаем на розовую тему
            body.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = 'icons/icon48-pink.svg';
            localStorage.setItem('robotcyb-theme', 'pink');
        }
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('robotcyb-theme');
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');
        const logoImg = document.querySelector('.logo-img');
        
        if (savedTheme === 'pink') {
            body.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = 'icons/icon48-pink.svg';
        }
    }
}

// Добавляем CSS анимацию для обновления цены
const style = document.createElement('style');
style.textContent = `
    @keyframes priceUpdate {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Инициализируем приложение
document.addEventListener('DOMContentLoaded', () => {
    window.priceTracker = new RobotCYBPriceTracker();
});

// Обработка сообщений от background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PRICE_UPDATE') {
        // Обновляем цену при получении сообщения
        const tracker = window.priceTracker;
        if (tracker) {
            tracker.updatePriceDisplay(message.data);
            tracker.updateLastUpdateTime(message.data.timestamp);
        }
    }
});
