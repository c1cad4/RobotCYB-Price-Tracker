const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function settingsPage() {
    const elements = new Map();
    const classes = () => {
        const values = new Set();
        return { add: value => values.add(value), remove: value => values.delete(value),
            contains: value => values.has(value) };
    };
    const themes = ['green', 'pink'].map(theme => ({ dataset: { theme },
        classList: classes(), addEventListener() {} }));
    let loaded, saved;
    const document = {
        body: { classList: classes() },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, { classList: classes(), addEventListener() {} });
            return elements.get(id);
        },
        querySelectorAll() { return themes; }
    };
    const context = vm.createContext({ document, localStorage: { getItem() { return null; } },
        chrome: {
            storage: { sync: {
                get(keys, callback) { loaded = callback; },
                set(value, callback) { saved = value['robotcyb-settings']; callback(); }
            } },
            runtime: { onMessage: { addListener() {} }, sendMessage() {} }
        }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), context);
    const manager = vm.runInContext('settingsManager', context);
    manager.showNotification = () => {};
    return { manager, elements, themes, load: value => loaded({ 'robotcyb-settings': value }),
        saved: () => saved };
}

test('asynchronously loaded preferences appear in the settings form', () => {
    const page = settingsPage();
    page.load({ updateInterval: 60000, showWidget: false, showBadge: false,
        enableNotifications: true, defaultTheme: 'pink' });
    assert.equal(page.elements.get('updateInterval').value, 60000);
    assert.equal(page.elements.get('showWidget').checked, false);
    assert.equal(page.elements.get('showBadge').checked, false);
    assert.equal(page.elements.get('enableNotifications').checked, true);
    assert.equal(page.themes[1].classList.contains('active'), true);
    page.manager.saveSettings();
    assert.equal(page.saved().updateInterval, page.elements.get('updateInterval').value);
});

test('missing or partial stored preferences retain visible defaults', () => {
    for (const stored of [undefined, { showBadge: false }]) {
        const page = settingsPage();
        page.load(stored);
        assert.equal(page.elements.get('updateInterval').value, 30000);
        assert.equal(page.elements.get('showWidget').checked, true);
        assert.equal(page.elements.get('showBadge').checked, stored?.showBadge ?? true);
        assert.equal(page.themes[0].classList.contains('active'), true);
    }
});
