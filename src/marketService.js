import { formatNumber, getDuration, getItemName, getMwiObj, TimeSpan, ZHitemNames, } from './utils.js';
import globals from './globals.js';

const freshnessConfig = {
    cacheKey: "refreshnessMarketDataCache",
    targetUrls: [
        "https://ghproxy.net/https://raw.githubusercontent.com/holychikenz/MWIApi/main/milkyapi.json",
        "https://raw.githubusercontent.com/holychikenz/MWIApi/main/milkyapi.json"
    ],
    refreshTimer: null,
    data: null,
};

const medianConfig = {
    cacheKey: "medianMarketDataCache",
    targetUrls: [
        "https://ghproxy.net/https://raw.githubusercontent.com/holychikenz/MWIApi/main/medianmarket.json",
        "https://raw.githubusercontent.com/holychikenz/MWIApi/main/medianmarket.json"
    ],
    refreshTimer: null,
    data: null,
};

const officialConfig = {
    cacheKey: "officialMarketDataCache",
    targetUrls: ["https://www.milkywayidle.com/game_data/marketplace.json"],
    refreshTimer: null,
    dataTransfer: data => {
        data.market = data.marketData;
        delete data.marketData;
        data.time = data.timestamp;
        delete data.timestamp;
    },
    data: null,
};

class MWIApiMarketJson {
    constructor(config) {
        FetchMarketJson(config);
        this.config = config;

        return new Proxy(this, {
            get(target, prop) {
                if (target.config.data) return target.config.data[prop];
                return null;
            },
            set(target, prop, value) {
                // Cant be set outside
                return true;
            }
        });
    }
}

class MooketMarketJson {
    constructor(parentData, cb) {
        this.mwi = getMwiObj();
        this.parentMarket = parentData;
        this.refreshInterval = globals.profitSettings.refreshInterval;
        this.updating = false;
        this.updateCallback = cb;
        this.lastFetch = {};
        this.loadCache();

        globals.subscribe((k, profitSettings) => {
            if (k === "profitSettings") {
                this.refreshInterval = profitSettings.refreshInterval;
            }
        });
        this.refreshTimer = setInterval(() => this.updatePrice(), TimeSpan.TEN_SECONDS);
        addEventListener('MWICoreItemPriceUpdated', (e) => {
            console.log({ detail: e.detail });
            this.updatePrice()
        });
    }

    loadCache() {
        const cacheLastFetch = JSON.parse(GM_getValue('MooketLastFetch', '{}'));
        Object.assign(this.lastFetch, cacheLastFetch);
    }

    dumpCache() {
        GM_setValue('MooketLastFetch', JSON.stringify(this.lastFetch));
    }

    async updatePrice() {
        if (this.updating) return;
        if (!this.mwi || !this.mwi.coreMarket) this.mwi = getMwiObj();
        if (!this.mwi || !this.mwi.coreMarket) return;

        this.updating = true;
        const refreshAtLeast = (Date.now() - this.refreshInterval) / 1000;
        const denyAheadTime = (Date.now() + TimeSpan.FIVE_MINUTES) / 1000;
        const updateItems = [];
        for (const [name, item] of Object.entries(this.parentMarket)) {
            if (item?.time && item.time > refreshAtLeast) continue;

            const price = this.mwi.coreMarket.getItemPrice(name, 0, true);
            if (price?.time && price?.time > refreshAtLeast) {
                if (item?.time && price.time > item.time && price.time < denyAheadTime) {
                    updateItems.push({ name, ...price });
                }
                continue;
            }
            if (this.lastFetch[name] > refreshAtLeast) continue;

            const refreshedPrice = this.mwi.coreMarket.getItemPrice(name);
            this.lastFetch[name] = Date.now() / 1000;
            if (refreshedPrice?.time > denyAheadTime) continue;
            updateItems.push({ name, ...refreshedPrice });
        }
        if (updateItems.length > 0) {
            console.log(updateItems);
            this.updateCallback(updateItems);
            this.dumpCache();
        }
        this.updating = false;
    }
}

const DataSourceKey = {
    MwiApi: "MwiApi",
    Official: "Official",
    Mooket: "Mooket",
    User: "User",
    init: "init",
};
class UnifyMarketData {
    constructor(itemDetailMap) {
        this.market = {};
        this.name2Hrid = {};
        this.statMap = {
            src: {},
            oldestItem: {},
            newestItem: {},
        };
        this.time = Date.now() / 1000;
        this.initMarketData(itemDetailMap);

        addEventListener(freshnessConfig.cacheKey, (e) => this.updateDataFromMwiApi(e.detail));
        addEventListener(officialConfig.cacheKey, (e) => this.updateDataFromOfficial(e.detail));
        this.freshnessMarketJson = new MWIApiMarketJson(freshnessConfig);
        this.officialMarketJson = new MWIApiMarketJson(officialConfig);
        this.mooket = new MooketMarketJson(this.market, items => this.partialUpdateFromMooket(items));
    }

    initMarketData(itemDetailMap) {
        for (const [hrid, item] of Object.entries(itemDetailMap)) {
            if (item?.isTradable) {
                this.market[item.name] = {
                    ask: item.sellPrice,
                    bid: item.sellPrice,
                    time: 0,
                    src: 'init',
                };
                this.name2Hrid[item.name] = hrid;
            }
        }
        this.mergeFromCache();

        this.postUpdate();
    }

    updateDataFromMwiApi(marketJson) {
        const time = marketJson.time;
        for (const [name, item] of Object.entries(this.market)) {
            if (item.time > time) continue;
            const newPrice = marketJson?.market[name];
            if (!newPrice) continue;
            Object.assign(item, { ...newPrice, time, src: DataSourceKey.MwiApi });
        }
        this.postUpdate();
    }

    updateDataFromOfficial(marketJson) {
        const time = marketJson.time;
        for (const [name, item] of Object.entries(this.market)) {
            if (item.time > time) continue;
            const hrid = this.name2Hrid[name];
            const newPrice = marketJson?.market[hrid];
            if (!newPrice || !newPrice["0"]) continue;
            const level0 = newPrice["0"];
            Object.assign(item, {
                ask: level0.a,
                bid: level0.b,
                src: DataSourceKey.Official,
                time
            });
        }
        this.postUpdate();
    }

    partialUpdateFromMooket(items) {
        items.forEach(item => {
            const targetItem = this.market[item.name];
            Object.assign(targetItem, {
                ask: item.ask,
                bid: item.bid,
                src: DataSourceKey.Mooket,
                time: item.time,
            });
        });
        this.postUpdate();
    }

    updateDataFromMarket(marketItemOrderBooks) {
        const itemHrid = marketItemOrderBooks?.itemHrid;
        if (itemHrid) {
            const item = globals.initClientData_itemDetailMap[itemHrid];
            const orderBook = marketItemOrderBooks?.orderBooks[0];
            const ask = orderBook?.asks?.length > 0 ? orderBook.asks[0].price : item.sellPrice;
            const bid = orderBook?.bids?.length > 0 ? orderBook.bids[0].price : item.sellPrice;
            const targetItem = this.market[item.name];
            Object.assign(targetItem, {
                ask,
                bid,
                src: DataSourceKey.User,
                time: Date.now() / 1000,
            });
        }
    }

    postUpdate() {
        const newStas = {};
        let oldestItem = {
            name: "",
            time: Date.now() / 1000,
        }
        let newestItem = {
            name: "",
            time: 0,
        }
        let total = 0;
        for (const [name, item] of Object.entries(this.market)) {
            if (!newStas[item.src]) newStas[item.src] = 0;
            newStas[item.src]++;
            if (item.time < oldestItem.time) oldestItem = {
                name,
                time: item.time,
            }
            if (item.time > newestItem.time) newestItem = {
                name,
                time: item.time,
            }
            ++total;
        }
        this.time = oldestItem.time;
        Object.assign(this.statMap, { src: { ...newStas, total }, oldestItem, newestItem });

        this.dumpToCache();
        globals.hasMarketItemUpdate = true;
    }

    mergeFromCache() {
        const cacheMarket = JSON.parse(GM_getValue('UnifyMarketData', '{}'));
        for (const [name, item] of Object.entries(this.market)) {
            const cacheItem = cacheMarket[name];
            if (cacheItem) {
                Object.assign(item, cacheItem);
            }
        }
    }

    dumpToCache() {
        GM_setValue('UnifyMarketData', JSON.stringify(this.market));
    }

    stat() {
        let dataSrcArr = [];
        if (this.statMap.src[DataSourceKey.Mooket]) dataSrcArr.push(`${DataSourceKey.Mooket} (${formatNumber(this.statMap.src[DataSourceKey.Mooket] * 100 / this.statMap.src.total)}%)`);
        if (this.statMap.src[DataSourceKey.User]) dataSrcArr.push(`${DataSourceKey.User} (${formatNumber(this.statMap.src[DataSourceKey.User] * 100 / this.statMap.src.total)}%)`);
        if (this.statMap.src[DataSourceKey.MwiApi]) dataSrcArr.push(`${DataSourceKey.MwiApi} (${formatNumber(this.statMap.src[DataSourceKey.MwiApi] * 100 / this.statMap.src.total)}%)`);
        if (this.statMap.src[DataSourceKey.Official]) dataSrcArr.push(`${DataSourceKey.Official} (${formatNumber(this.statMap.src[DataSourceKey.Official] * 100 / this.statMap.src.total)}%)`);

        const oldestStr = `${globals.en2ZhMap[this.statMap.oldestItem.name]}(${getDuration(new Date(this.statMap.oldestItem.time * 1000))})`;
        const newestStr = `${globals.en2ZhMap[this.statMap.newestItem.name]}(${getDuration(new Date(this.statMap.newestItem.time * 1000))})`;

        return `最旧：${oldestStr} 数据来源：[${dataSrcArr.join(',')}]`;
    }
}

export async function preFetchData() {
    globals.freshnessMarketJson = new UnifyMarketData(globals.initClientData_itemDetailMap);
    globals.medianMarketJson = new MWIApiMarketJson(medianConfig);
};

export async function FetchMarketJson(config) {
    const ONE_HOUR = 60 * 60 * 1000; // 1小时
    const FIVE_MINUTES = 5 * 60 * 1000; // 5分钟
    const TEN_SECONDS = 10 * 1000; // 10秒

    const schedualNextRefresh = ({ data, timestamp, config }) => {
        if (data) config.data = data;
        // 清理定时器
        const clearRefreshTimer = () => {
            if (config.refreshTimer) {
                clearTimeout(config.refreshTimer);
                config.refreshTimer = null;
            }
        };

        const now = Date.now();
        const cacheAge = now - timestamp;
        const dataAge = data?.time ? now - new Date(data.time * 1000).getTime() : ONE_HOUR;
        const nextRefreshTime = data ? Math.max(ONE_HOUR - dataAge, FIVE_MINUTES - cacheAge) : TEN_SECONDS;
        clearRefreshTimer();
        config.refreshTimer = setTimeout(async () => {
            clearRefreshTimer();
            await FetchMarketJson(config);
            globals.hasMarketItemUpdate = true; // 主动刷新数据
        }, nextRefreshTime);
    }

    // 检查缓存
    const cachedData = localStorage.getItem(config.cacheKey);
    if (cachedData) {
        try {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            const cacheAge = now - timestamp;
            const dataAge = data?.time ? now - new Date(data.time * 1000).getTime() : ONE_HOUR;

            // 如果数据未过期（1小时内）或 缓存足够新（5分钟内）
            if (dataAge < ONE_HOUR || cacheAge < FIVE_MINUTES) {
                schedualNextRefresh({ data, timestamp, config });
                dispatchEvent(new CustomEvent(config.cacheKey, { detail: data }));
                return data;
            }
        } catch (e) {
            console.error('Failed to parse cache:', e);
        }
    }

    return new Promise((resolve) => {
        const urls = config.targetUrls;

        let currentIndex = 0;

        const tryNextUrl = () => {
            if (currentIndex >= urls.length) {
                // 所有URL尝试失败，返回缓存或null
                if (cachedData) {
                    try {
                        const { data } = JSON.parse(cachedData);

                        resolve(data);
                    } catch (e) {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
                return;
            }

            try {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: urls[currentIndex],
                    onload: function (response) {
                        try {
                            let data = JSON.parse(response.responseText);
                            if (config.dataTransfer) config.dataTransfer(data);
                            if (!data?.market) {
                                throw new Error('Invalid market data structure');
                            }

                            // 更新缓存
                            localStorage.setItem(config.cacheKey, JSON.stringify({
                                data,
                                timestamp: Date.now(),
                            }));

                            resolve(data);
                        } catch (e) {
                            console.error('Failed to parse market data:', e);
                            currentIndex++;
                            tryNextUrl();
                        }
                    },
                    onerror: function (error) {
                        console.error(`Failed to fetch market data from ${urls[currentIndex]}:`, error);
                        currentIndex++;
                        tryNextUrl();
                    }
                });
            } catch (error) {
                console.error('Request setup failed:', error);
                currentIndex++;
                tryNextUrl();
            }
        };

        tryNextUrl();
    }).then(data => {
        schedualNextRefresh({ data, timestamp: Date.now(), config });
        dispatchEvent(new CustomEvent(config.cacheKey, { detail: data }));
        return data;
    });
}