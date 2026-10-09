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
        this.setupMessageListeners();
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'priceUpdate' && this.isRunning) {
                this.updatePrice().catch(error => console.error('Ошибка обновления цены:', error));
            }
        });
        this.restoreTracking().catch(error => console.error('Ошибка запуска:', error));
    }

    async restoreTracking() {
        const [state, settings] = await Promise.all([
            chrome.storage.local.get(['trackingEnabled']), this.getSettings()
        ]);
        this.updateInterval = settings.updateInterval || 30000;
        if (state.trackingEnabled !== false) await this.startPriceTracking();
    }
    
    setupAlarms() {
        // Alarms survive Manifest V3 service worker suspension; JS timers do not.
        const periodInMinutes = Math.max(0.5, this.updateInterval / 60000);
        chrome.alarms.create('priceUpdate', {
            delayInMinutes: periodInMinutes,
            periodInMinutes
        });
    }
    
    setupMessageListeners() {
        // Слушаем сообщения от popup и content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'GET_PRICE':
                    this.getCurrentPrice().then(sendResponse);
                    return true; // Асинхронный ответ

                case 'REFRESH_PRICE':
                    this.updatePrice().then(
                        data => sendResponse({ data }),
                        error => sendResponse({ error: error.message })
                    );
                    return true;
                    
                case 'START_TRACKING':
                    this.startPriceTracking().then(() => sendResponse({ success: true }),
                        error => sendResponse({ error: error.message }));
                    return true;
                    
                case 'STOP_TRACKING':
                    this.stopPriceTracking().then(() => sendResponse({ success: true }),
                        error => sendResponse({ error: error.message }));
                    return true;
                    
                case 'UPDATE_INTERVAL':
                    this.updateInterval = message.interval;
                    this.restartTracking();
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_SETTINGS':
                    this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;
                    
                case 'GET_SETTINGS':
                    this.getSettings().then(sendResponse);
                    return true;
            }
        });
    }
    
    async startPriceTracking() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        await chrome.storage.local.set({ trackingEnabled: true });
        this.setupAlarms();
        console.log('RobotCYB Price Tracker: Отслеживание цен запущено');
        
        // Первоначальное обновление
        await this.updatePrice().catch(error => console.error('Ошибка обновления цены:', error));
        
    }
    
    async stopPriceTracking() {
        this.isRunning = false;
        console.log('RobotCYB Price Tracker: Отслеживание цен остановлено');
        
        await chrome.alarms.clear('priceUpdate');
        await chrome.storage.local.set({ trackingEnabled: false });
    }
    
    restartTracking() {
        if (!this.isRunning) return;
        this.setupAlarms();
        this.updatePrice().catch(error => console.error('Ошибка обновления цены:', error));
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

            return priceData;
            
        } catch (error) {
            console.error('Ошибка обновления цены:', error);
            throw error;
        }
    }
    
    async fetchPriceData() {
        const response = await fetch(
            `https://api.dexscreener.com/token-pairs/v1/solana/${this.tokenAddress}`,
            { signal: AbortSignal.timeout(10000) }
        );
        if (!response.ok) throw new Error(`Price API returned HTTP ${response.status}`);
        const pairs = await response.json();
        if (!Array.isArray(pairs)) throw new Error('Invalid price API response');
        const pair = pairs.filter(p =>
            p.chainId === 'solana' && p.baseToken?.address === this.tokenAddress &&
            p.priceUsd !== null && p.priceUsd !== undefined &&
            Number.isFinite(Number(p.priceUsd)) && Number(p.priceUsd) > 0
        ).sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
        if (!pair) throw new Error('No USD market price is available for RobotCYB');
        
        return {
            price: Number(pair.priceUsd),
            change: Number.isFinite(Number(pair.priceChange?.h24)) ? Number(pair.priceChange.h24) : 0,
            timestamp: Date.now(),
            tokenAddress: this.tokenAddress,
            chain: this.chain,
            source: 'DexScreener',
            pairAddress: pair.pairAddress
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
        // Проверяем настройки для отображения badge
        chrome.storage.sync.get(['robotcyb-settings'], (result) => {
            const settings = result['robotcyb-settings'] || {};
            if (settings.showBadge !== false) {
                const priceText = price < 0.01 || price >= 1000
                    ? price.toExponential(0)
                    : price >= 100 ? price.toFixed(0)
                    : price >= 10 ? price.toFixed(1) : price.toFixed(2);
                
                chrome.action.setBadgeText({
                    text: priceText
                });
                
                chrome.action.setBadgeBackgroundColor({
                    color: '#00ff41'
                });
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        });
    }
    
    updateSettings(settings) {
        // Обновляем настройки
        this.updateInterval = settings.updateInterval || 30000;
        this.restartTracking();
    }
    
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['robotcyb-settings'], (result) => {
                resolve(result['robotcyb-settings'] || {
                    updateInterval: 30000,
                    showWidget: true,
                    showBadge: true,
                    enableNotifications: false,
                    defaultTheme: 'green'
                });
            });
        });
    }
    
    // Обработка установки расширения
    onInstalled(details) {
        if (details.reason === 'install') {
            console.log('RobotCYB Price Tracker установлен');
            this.startPriceTracking().catch(error => console.error('Ошибка запуска:', error));
        } else if (details.reason === 'update') {
            console.log('RobotCYB Price Tracker обновлен');
        }
    }
    
    // Обработка активации расширения
    onStartup() {
        console.log('RobotCYB Price Tracker запущен при старте браузера');
        this.restoreTracking().catch(error => console.error('Ошибка запуска:', error));
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

// Alarms and stored tracking preferences must survive worker suspension.
