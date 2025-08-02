// Content script для RobotCYB Price Tracker

class ContentScript {
    constructor() {
        this.isInitialized = false;
        this.priceWidget = null;
        this.init();
    }
    
    init() {
        // Проверяем, не инициализирован ли уже скрипт
        if (this.isInitialized) return;
        
        this.isInitialized = true;
        this.setupMessageListener();
        this.injectPriceWidget();
        this.addKeyboardShortcuts();
    }
    
    setupMessageListener() {
        // Слушаем сообщения от background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'PRICE_UPDATE') {
                this.updatePriceWidget(message.data);
            }
        });
    }
    
    injectPriceWidget() {
        // Создаем виджет с ценой RobotCYB
        this.createPriceWidget();
        
        // Добавляем стили
        this.injectStyles();
        
        // Позиционируем виджет
        this.positionWidget();
    }
    
    createPriceWidget() {
        this.priceWidget = document.createElement('div');
        this.priceWidget.id = 'robotcyb-price-widget';
        this.priceWidget.className = 'robotcyb-widget';
        
        this.priceWidget.innerHTML = `
            <div class="widget-header">
                <div class="widget-logo">
                    <img src="${chrome.runtime.getURL('icons/icon16.svg')}" alt="RobotCYB">
                    <span class="widget-title">RobotCYB</span>
                    <div class="widget-theme-toggle" id="widget-theme-toggle">
                        <div class="widget-toggle-indicator"></div>
                    </div>
                </div>
                <div class="widget-close" id="widget-close">×</div>
            </div>
            <div class="widget-content">
                <div class="widget-price">
                    <span class="price-label">Price:</span>
                    <span class="price-value" id="widget-price-value">$0.00012345</span>
                </div>
                <div class="widget-change">
                    <span class="change-value" id="widget-change-value">+0.00%</span>
                    <span class="change-arrow" id="widget-change-arrow">→</span>
                </div>
            </div>
            <div class="widget-footer">
                <button class="widget-refresh" id="widget-refresh">Refresh</button>
                <button class="widget-chart" id="widget-chart">Chart</button>
            </div>
        `;
        
        // Добавляем обработчики событий
        this.addWidgetEventListeners();
        
        // Добавляем виджет на страницу
        document.body.appendChild(this.priceWidget);
    }
    
    addWidgetEventListeners() {
        // Кнопка закрытия
        const closeBtn = this.priceWidget.querySelector('#widget-close');
        closeBtn.addEventListener('click', () => {
            this.hideWidget();
        });
        
        // Кнопка обновления
        const refreshBtn = this.priceWidget.querySelector('#widget-refresh');
        refreshBtn.addEventListener('click', () => {
            this.refreshPrice();
        });
        
        // Кнопка графика
        const chartBtn = this.priceWidget.querySelector('#widget-chart');
        chartBtn.addEventListener('click', () => {
            this.openChart();
        });
        
        // Переключатель темы
        const themeToggle = this.priceWidget.querySelector('#widget-theme-toggle');
        themeToggle.addEventListener('click', () => {
            this.toggleWidgetTheme();
        });
        
        // Перетаскивание виджета
        this.makeWidgetDraggable();
    }
    
    makeWidgetDraggable() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        const header = this.priceWidget.querySelector('.widget-header');
        
        header.addEventListener('mousedown', (e) => {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                this.setTranslate(currentX, currentY, this.priceWidget);
            }
        });
        
        document.addEventListener('mouseup', () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        });
    }
    
    setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
    
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .robotcyb-widget {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 200px;
                background: rgba(0, 0, 0, 0.95);
                border: 2px solid #00ff41;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0, 255, 65, 0.4);
                z-index: 10000;
                font-family: 'Courier New', monospace;
                color: #00ff41;
                backdrop-filter: blur(10px);
                animation: widgetAppear 0.5s ease-out;
            }
            
            @keyframes widgetAppear {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #00ff41;
                cursor: move;
            }
            
            .widget-logo {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .widget-logo img {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 1px solid #00ff41;
            }
            
            .widget-title {
                font-size: 12px;
                font-weight: bold;
                text-shadow: 0 0 5px #00ff41;
            }
            
            .widget-close {
                cursor: pointer;
                font-size: 18px;
                color: #00ff41;
                transition: color 0.3s ease;
            }
            
            .widget-close:hover {
                color: #ff0040;
            }
            
            .widget-content {
                padding: 15px;
                text-align: center;
            }
            
            .widget-price {
                margin-bottom: 10px;
            }
            
            .price-label {
                font-size: 10px;
                color: #00cc33;
                text-transform: uppercase;
            }
            
            .price-value {
                display: block;
                font-size: 16px;
                font-weight: bold;
                color: #00ff41;
                text-shadow: 0 0 8px #00ff41;
                margin-top: 5px;
            }
            
            .widget-change {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 5px;
                font-size: 12px;
            }
            
            .change-value {
                color: #00ff41;
            }
            
            .change-arrow {
                color: #00ff41;
                animation: blink 1s ease-in-out infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .widget-footer {
                display: flex;
                gap: 5px;
                padding: 10px;
                border-top: 1px solid #00ff41;
            }
            
            .widget-refresh, .widget-chart {
                flex: 1;
                padding: 5px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid #00ff41;
                border-radius: 4px;
                color: #00ff41;
                font-size: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .widget-refresh:hover, .widget-chart:hover {
                background: rgba(0, 255, 65, 0.1);
                box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
            }
            
            .robotcyb-widget.hidden {
                display: none;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    positionWidget() {
        // Позиционируем виджет в правом верхнем углу
        this.priceWidget.style.top = '20px';
        this.priceWidget.style.right = '20px';
    }
    
    updatePriceWidget(priceData) {
        if (!this.priceWidget) return;
        
        const priceElement = this.priceWidget.querySelector('#widget-price-value');
        const changeElement = this.priceWidget.querySelector('#widget-change-value');
        const arrowElement = this.priceWidget.querySelector('#widget-change-arrow');
        const isPinkTheme = this.priceWidget.classList.contains('pink-theme');
        
        // Обновляем цену
        priceElement.textContent = `$${priceData.price.toFixed(8)}`;
        
        // Обновляем изменение
        const changePercent = priceData.change.toFixed(2);
        changeElement.textContent = `${changePercent}%`;
        
        // Определяем направление и цвет
        const greenColor = isPinkTheme ? '#ff0080' : '#00ff41';
        const redColor = '#ff0040';
        
        if (priceData.change > 0) {
            arrowElement.textContent = '↗';
            changeElement.style.color = greenColor;
            arrowElement.style.color = greenColor;
        } else if (priceData.change < 0) {
            arrowElement.textContent = '↘';
            changeElement.style.color = redColor;
            arrowElement.style.color = redColor;
        } else {
            arrowElement.textContent = '→';
            changeElement.style.color = greenColor;
            arrowElement.style.color = greenColor;
        }
        
        // Анимация обновления
        priceElement.style.animation = 'none';
        priceElement.offsetHeight;
        priceElement.style.animation = 'priceUpdate 0.5s ease-in-out';
    }
    
    hideWidget() {
        if (this.priceWidget) {
            this.priceWidget.classList.add('hidden');
        }
    }
    
    showWidget() {
        if (this.priceWidget) {
            this.priceWidget.classList.remove('hidden');
        }
    }
    
    refreshPrice() {
        // Запрашиваем обновление цены у background script
        chrome.runtime.sendMessage({ type: 'GET_PRICE' }, (response) => {
            if (response) {
                this.updatePriceWidget(response);
            }
        });
    }
    
    openChart() {
        // Открываем график в новой вкладке
        const tokenAddress = '8WZiguAp8NyFnwm8Z97k6sCbSRCWaW1YYXKeCTpupump';
        const chartUrl = `https://www.gmgn.cc/kline/sol/${tokenAddress}?theme=dark&interval=15`;
        window.open(chartUrl, '_blank');
    }
    
    toggleWidgetTheme() {
        const widget = this.priceWidget;
        const themeToggle = widget.querySelector('#widget-theme-toggle');
        const logoImg = widget.querySelector('.widget-logo img');
        
        if (widget.classList.contains('pink-theme')) {
            // Переключаем на зеленую тему
            widget.classList.remove('pink-theme');
            themeToggle.classList.remove('pink');
            logoImg.src = chrome.runtime.getURL('icons/icon16.svg');
        } else {
            // Переключаем на розовую тему
            widget.classList.add('pink-theme');
            themeToggle.classList.add('pink');
            logoImg.src = chrome.runtime.getURL('icons/icon16-pink.svg');
        }
    }
    
    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+R для показа/скрытия виджета
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                if (this.priceWidget.classList.contains('hidden')) {
                    this.showWidget();
                } else {
                    this.hideWidget();
                }
            }
        });
    }
}

// Инициализируем content script
const contentScript = new ContentScript();

// Экспортируем для доступа из других скриптов
window.RobotCYBContentScript = contentScript; 