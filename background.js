// Background script для RobotCYB Price Tracker

class BackgroundService {
    constructor() {
        this.tokenAddress = '8WZiguAp8NyFnwm8Z97k6sCbSRCWaW1YYXKeCTpupump';
        this.chain = 'sol';
        this.updateInterval = 30000; // 30 секунд
        this.isRunning = false;
        
        this.init();
    }
    
    init() {
        this.setupAlarms();
        this.setupMessageListeners();
        this.startPriceTracking();
    }
    
    setupAlarms() {
        // Создаем периодическое обновление через chrome.alarms
        chrome.alarms.create('priceUpdate', {
            delayInMinutes: 0.5, // 30 секунд
            periodInMinutes: 0.5
        });
        
        // Слушаем срабатывание будильника
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'priceUpdate') {
                this.updatePrice();
            }
        });
    }
    
    setupMessageListeners() {
        // Слушаем сообщения от popup и content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'GET_PRICE':
                    this.getCurrentPrice().then(sendResponse);
                    return true; // Асинхронный ответ
                    
                case 'START_TRACKING':
                    this.startPriceTracking();
                    sendResponse({ success: true });
                    break;
                    
                case 'STOP_TRACKING':
                    this.stopPriceTracking();
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_INTERVAL':
                    this.updateInterval = message.interval;
                    this.restartTracking();
                    sendResponse({ success: true });
                    break;
            }
        });
    }
    
    async startPriceTracking() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('RobotCYB Price Tracker: Отслеживание цен запущено');
        
        // Первоначальное обновление
        await this.updatePrice();
        
        // Запускаем периодическое обновление
        this.intervalId = setInterval(() => {
            this.updatePrice();
        }, this.updateInterval);
    }
    
    stopPriceTracking() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        console.log('RobotCYB Price Tracker: Отслеживание цен остановлено');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    restartTracking() {
        this.stopPriceTracking();
        setTimeout(() => {
            this.startPriceTracking();
        }, 1000);
    }
    
    async updatePrice() {
        try {
            const priceData = await this.fetchPriceData();
            
            // Сохраняем данные в storage
            await this.savePriceData(priceData);
            
            // Отправляем обновление всем активным popup'ам
            this.broadcastPriceUpdate(priceData);
            
            // Обновляем badge с ценой
            this.updateBadge(priceData.price);
            
        } catch (error) {
            console.error('Ошибка обновления цены:', error);
        }
    }
    
    async fetchPriceData() {
        // В реальном приложении здесь был бы запрос к API
        // Для демонстрации используем симуляцию
        const basePrice = 0.00012345;
        const variation = (Math.random() - 0.5) * 0.00001;
        const price = basePrice + variation;
        
        return {
            price: price,
            change: (Math.random() - 0.5) * 10, // Изменение от -5% до +5%
            timestamp: Date.now(),
            tokenAddress: this.tokenAddress,
            chain: this.chain
        };
    }
    
    async savePriceData(priceData) {
        try {
            await chrome.storage.local.set({
                lastPriceData: priceData,
                lastUpdate: Date.now()
            });
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
        }
    }
    
    async getCurrentPrice() {
        try {
            const data = await chrome.storage.local.get(['lastPriceData']);
            return data.lastPriceData || null;
        } catch (error) {
            console.error('Ошибка получения цены:', error);
            return null;
        }
    }
    
    broadcastPriceUpdate(priceData) {
        // Отправляем обновление всем активным popup'ам
        chrome.runtime.sendMessage({
            type: 'PRICE_UPDATE',
            data: priceData
        }).catch(() => {
            // Игнорируем ошибки, если нет активных popup'ов
        });
    }
    
    updateBadge(price) {
        // Обновляем badge в иконке расширения
        const priceText = price.toFixed(6).replace(/\.?0+$/, '');
        
        chrome.action.setBadgeText({
            text: priceText.length > 4 ? priceText.substring(0, 4) : priceText
        });
        
        chrome.action.setBadgeBackgroundColor({
            color: '#00ff41'
        });
    }
    
    // Обработка установки расширения
    onInstalled(details) {
        if (details.reason === 'install') {
            console.log('RobotCYB Price Tracker установлен');
            this.startPriceTracking();
        } else if (details.reason === 'update') {
            console.log('RobotCYB Price Tracker обновлен');
        }
    }
    
    // Обработка активации расширения
    onStartup() {
        console.log('RobotCYB Price Tracker запущен при старте браузера');
        this.startPriceTracking();
    }
}

// Инициализируем background service
const backgroundService = new BackgroundService();

// Обработчики событий расширения
chrome.runtime.onInstalled.addListener((details) => {
    backgroundService.onInstalled(details);
});

chrome.runtime.onStartup.addListener(() => {
    backgroundService.onStartup();
});

// Обработка закрытия браузера
chrome.runtime.onSuspend.addListener(() => {
    backgroundService.stopPriceTracking();
}); 