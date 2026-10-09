const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const address = '8WZiguAp8NyFnwm8Z97k6sCbSRCWaW1YYXKeCTpupump';
function service(fetch, extraGlobals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
    const context = vm.createContext({ fetch, AbortSignal, console: { log() {}, error() {} }, ...extraGlobals });
    vm.runInContext(source.slice(0, source.indexOf('// Инициализируем background service')), context);
    return vm.runInContext('BackgroundService.prototype.init = function() {}; new BackgroundService()', context);
}
function pair(price, liquidity, extra = {}) {
    return { chainId: 'solana', baseToken: { address }, priceUsd: price,
        liquidity: { usd: liquidity }, priceChange: { h24: -2.5 }, ...extra };
}

test('uses the most liquid matching Solana market and reports the API change', async () => {
    let requested;
    const tracker = service(async (url, options) => {
        requested = url;
        assert.ok(options.signal);
        return { ok: true, json: async () => [
            pair('1', 1000000, { baseToken: { address: 'other-token' } }),
            pair('2', 1000000, { chainId: 'ethereum' }),
            pair('0.000004', 100), pair('0.000003', 1000)
        ] };
    });
    const result = await tracker.fetchPriceData();
    assert.equal(requested, `https://api.dexscreener.com/token-pairs/v1/solana/${address}`);
    assert.equal(result.price, 0.000003);
    assert.equal(result.change, -2.5);
    assert.equal(result.source, 'DexScreener');
    assert.ok(result.timestamp > 0);
});

test('rejects unavailable, invalid and nonpositive prices', async () => {
    for (const data of [null, {}, [], [pair('NaN', 100)], [pair(null, 100)], [pair('0', 100)]]) {
        const tracker = service(async () => ({ ok: true, json: async () => data }));
        await assert.rejects(tracker.fetchPriceData());
    }
});

test('failed API request is surfaced and never saves or broadcasts a fabricated price', async () => {
    const tracker = service(async () => ({ ok: false, status: 429 }));
    let changes = 0;
    tracker.savePriceData = async () => { changes++; };
    tracker.broadcastPriceUpdate = () => { changes++; };
    tracker.updateBadge = () => { changes++; };
    await assert.rejects(tracker.updatePrice(), /HTTP 429/);
    assert.equal(changes, 0);
});

test('refresh returns the same price saved and broadcast to other views', async () => {
    const tracker = service(async () => ({ ok: true, json: async () => [pair('0.000004', 100)] }));
    let saved, broadcast, badge;
    tracker.savePriceData = async data => { saved = data; };
    tracker.broadcastPriceUpdate = data => { broadcast = data; };
    tracker.updateBadge = price => { badge = price; };
    const result = await tracker.updatePrice();
    assert.equal(result, saved);
    assert.equal(result, broadcast);
    assert.equal(badge, result.price);
});

test('tracking uses persistent alarms and stop preference survives worker restoration', async () => {
    const state = {};
    let schedule, cleared;
    const chrome = {
        alarms: { create(name, options) { schedule = options; }, async clear(name) { cleared = name; } },
        storage: {
            local: { async set(values) { Object.assign(state, values); }, async get() { return state; } },
            sync: { get(keys, callback) { callback({ 'robotcyb-settings': { updateInterval: 60000 } }); } }
        }
    };
    const tracker = service(() => { throw new Error('Unexpected API call'); }, { chrome });
    tracker.updatePrice = async () => {};
    await tracker.restoreTracking();
    assert.equal(schedule.periodInMinutes, 1);
    assert.equal(state.trackingEnabled, true);
    await tracker.stopPriceTracking();
    assert.equal(cleared, 'priceUpdate');
    assert.equal(state.trackingEnabled, false);
    const restored = service(() => {}, { chrome });
    restored.startPriceTracking = () => { throw new Error('Must preserve stopped preference'); };
    await restored.restoreTracking();
    assert.equal(restored.isRunning, false);
});

test('badge represents a micro-priced token instead of truncating it to zero', () => {
    let text;
    const chrome = {
        storage: { sync: { get(keys, callback) { callback({}); } } },
        action: { setBadgeText(value) { text = value.text; }, setBadgeBackgroundColor() {} }
    };
    service(() => {}, { chrome }).updateBadge(0.000004);
    assert.equal(text, '4e-6');
});
