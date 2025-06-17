import { getItemName, } from './utils.js';
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

}

class UnifyMarketJson {
    constructor() {
        this.mwiApi = new MWIApiMarketJson(freshnessConfig);
        this.official = new MWIApiMarketJson(officialConfig);
        this.mooket = new MooketMarketJson();

        this.mergeMarket = new Proxy(this, {
            get(target, prop) {

            },
            set() { return true; }
        });

        return new Proxy(this, {
            get(target, prop) {
                if (prop == 'time') {
                    if (target.mwiApi?.time && target.official?.time) return Math.max(target.mwiApi.time, target.official.time);
                    return target.mwiApi?.time || target.official?.time;
                }
                if (prop == 'market') {
                    return target.mergeMarket;
                }
                return null;
            },
            set() { return true; }
        });
    }

    getItemByName(itemName) {
        
    }
}

export async function preFetchData() {
    globals.freshnessMarketJson = new MWIApiMarketJson(freshnessConfig);
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
                            if (config.dataTransfer) data = config.dataTransfer(data);
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
        return data;
    });
}

export function getItemValuation(hrid, marketJson, mwiObj = null) {
    const item = globals.initClientData_itemDetailMap[hrid];
    if (!item) {
        console.warn(`Item not found: ${hrid}`);
        return { bid: 0, ask: 0, medianBid: 0, medianAsk: 0 };
    }

    if (item?.isTradable) {
        let ret = marketJson.market[item.name];
        if (!ret) {
            console.warn(`Market data not found for item: ${item.name}`);
            return { bid: 0, ask: 0, medianBid: 0, medianAsk: 0 };
        }

        // 合并mooket市场数据
        if (mwiObj?.coreMarket) {
            const hridWithLevel = `${hrid}:0`;
            const mooketVal = mwiObj.coreMarket.marketData[hridWithLevel];
            if (mooketVal && mooketVal?.time > marketJson.time) {
                ret.bid = mooketVal.bid;
                ret.ask = mooketVal.ask;
            }
        }

        if (ret.bid == -1 && ret.ask == -1) ret.ask = ret.bid = 1e9;
        else if (ret.bid == -1 || ret.ask == -1) ret.ask = ret.bid = Math.max(ret.ask, ret.bid);

        return {
            ...ret,
            medianBid: ret.medianBid || 0,
            medianAsk: ret.medianAsk || 0
        };
    }

    if (item?.isOpenable) {
        const openedItems = globals.initClientData_openableLootDropMap[hrid];
        if (!openedItems) {
            console.warn(`Openable items not found for: ${hrid}`);
            return { bid: 0, ask: 0, medianBid: 0, medianAsk: 0 };
        }

        const valuation = { bid: 0, ask: 0, medianBid: 0, medianAsk: 0 };
        for (const openedItem of openedItems) {
            const openedValuation = getItemValuation(openedItem.itemHrid, marketJson, mwiObj);
            const avgCount = (openedItem.minCount + openedItem.maxCount) / 2;
            valuation.bid += openedItem.dropRate * avgCount * openedValuation.bid;
            valuation.ask += openedItem.dropRate * avgCount * openedValuation.ask;
            valuation.medianBid += openedItem.dropRate * avgCount * openedValuation.medianBid;
            valuation.medianAsk += openedItem.dropRate * avgCount * openedValuation.medianAsk;
        }
        return valuation;
    }

    if (hrid === "/items/coin") return { ask: 1, bid: 1, medianAsk: 1, medianBid: 1 };
    if (hrid === "/items/cowbell") {
        const pack = getItemValuation("/items/bag_of_10_cowbells", marketJson, mwiObj);
        return {
            ask: pack.ask / 10,
            bid: pack.bid / 10,
            medianAsk: pack.medianAsk / 10,
            medianBid: pack.medianBid / 10
        };
    }

    return { bid: 0, ask: 0, medianBid: 0, medianAsk: 0 };
}

export function getDropTableInformation(dropTable, marketJson, mwiObj = null) {
    const valuationResult = { ask: 0, bid: 0, medianAsk: 0, medianBid: 0 };
    const dropItems = [];

    for (const drop of dropTable) {
        const valuation = getItemValuation(drop.itemHrid, marketJson, mwiObj);
        const avgCount = (drop.minCount + drop.maxCount) / 2;
        valuationResult.ask += valuation.ask * avgCount * drop.dropRate;
        valuationResult.bid += valuation.bid * avgCount * drop.dropRate;
        valuationResult.medianAsk += valuation.medianAsk * avgCount * drop.dropRate;
        valuationResult.medianBid += valuation.medianBid * avgCount * drop.dropRate;

        dropItems.push({
            name: getItemName(drop.itemHrid),
            ...valuation,
            count: avgCount * drop.dropRate
        });
    }

    return { ...valuationResult, dropItems };
}