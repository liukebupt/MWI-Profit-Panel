import globals from './globals'
import { preFetchData } from './marketService';
import { waitForPannels, refreshProfitPanel } from './panelManager'
import { processingCategory } from './utils';
import LostTrackerExpectEstimate from './LostTrackerExpectEstimate'

function hookWS() {
    const dataProperty = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    const oriGet = dataProperty.get;

    dataProperty.get = hookedGet;
    Object.defineProperty(MessageEvent.prototype, "data", dataProperty);

    function hookedGet() {
        const socket = this.currentTarget;
        if (!(socket instanceof WebSocket)) {
            return oriGet.call(this);
        }
        if (socket.url.indexOf("api.milkywayidle.com/ws") <= -1 && socket.url.indexOf("api-test.milkywayidle.com/ws") <= -1) {
            return oriGet.call(this);
        }

        const message = oriGet.call(this);
        Object.defineProperty(this, "data", { value: message }); // Anti-loop

        return handleMessage(message);
    }
}

function handleMessage(message) {
    try {
        let obj = JSON.parse(message);
        if (obj && obj.type === "init_character_data") {
            globals.initCharacterData_characterSkills = obj.characterSkills;
            globals.initCharacterData_actionTypeDrinkSlotsMap = obj.actionTypeDrinkSlotsMap;
            globals.initCharacterData_characterHouseRoomMap = obj.characterHouseRoomMap;
            globals.initCharacterData_characterItems = obj.characterItems;
            globals.initCharacterData_communityActionTypeBuffsMap = obj.communityActionTypeBuffsMap;
            globals.initCharacterData_consumableActionTypeBuffsMap = obj.consumableActionTypeBuffsMap;
            globals.initCharacterData_houseActionTypeBuffsMap = obj.houseActionTypeBuffsMap;
            globals.initCharacterData_equipmentActionTypeBuffsMap = obj.equipmentActionTypeBuffsMap;
            waitForPannels();
        }
        else if (obj && obj.type === "init_client_data") {
            globals.initClientData_actionDetailMap = obj.actionDetailMap;
            globals.initClientData_itemDetailMap = obj.itemDetailMap;
            globals.initClientData_openableLootDropMap = obj.openableLootDropMap;
        }
        else if (obj && obj.type === "community_buffs_updated") {
            globals.initCharacterData_communityActionTypeBuffsMap = obj.communityActionTypeBuffsMap;
            refreshProfitPanel(true);
        }
        else if (obj && obj.type === "market_item_order_books_updated") {
            globals.hasMarketItemUpdate = true;
            console.log({ hasMarketItemUpdate: globals.hasMarketItemUpdate, obj });
        }
        else if (obj && obj.type === "loot_log_updated") {
            globals.lootLog = obj.lootLog;
            LostTrackerExpectEstimate();
        }
    }
    catch (err) { console.error(err); }
    return message;
}

globals.subscribe((key, value) => {
    if (key === "initClientData_actionDetailMap") {
        const processingMap = {};
        for (const [actionHrid, actionDetail] of Object.entries(value)) {
            const category = processingCategory[actionDetail.type];
            if (category && category == actionDetail.category) {
                const inputHrid = actionDetail.inputItems[0].itemHrid;
                processingMap[inputHrid] = actionDetail;
            }
        }
        globals.processingMap = processingMap;
    }
});

globals.isZHInGameSetting = localStorage.getItem("i18nextLng")?.toLowerCase()?.startsWith("zh"); // 获取游戏内设置语言


if (localStorage.getItem("initClientData")) {
    const obj = JSON.parse(localStorage.getItem("initClientData"));

    globals.initClientData_actionDetailMap = obj.actionDetailMap;
    globals.initClientData_itemDetailMap = obj.itemDetailMap;
    globals.initClientData_openableLootDropMap = obj.openableLootDropMap;
}

hookWS();
preFetchData();
addEventListener('MWICoreItemPriceUpdated', () => { globals.hasMarketItemUpdate = true; });