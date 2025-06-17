import globals from "./globals";
import ProfitCaculation from "./profitCalculation";
import { getItemValuation, formatNumber } from "./utils";

const supportActionType = [
    "/action_types/milking",
    "/action_types/foraging",
    "/action_types/woodcutting",
    "/action_types/cheesesmithing",
    "/action_types/crafting",
    "/action_types/tailoring",
    "/action_types/cooking",
    "/action_types/brewing",
    // "/action_types/alchemy",
    // "/action_types/enhancing",
    // "/action_types/combat",
];

export default function LostTrackerExpectEstimate() {
    setTimeout(() => {
        const lootLogList = document.querySelectorAll('.LootLogPanel_actionLoots__3oTid .LootLogPanel_actionLoot__32gl_');
        if (!lootLogList.length || !Array.isArray(globals.lootLog)) return;

        const lootLogData = [...globals.lootLog].reverse();
        lootLogList.forEach((lootElem, idx) => {
            const logData = lootLogData[idx];
            if (!logData) return;

            // 获取action数据
            const action = globals.initClientData_actionDetailMap[logData.actionHrid];
            if (!action) return;
            if (supportActionType.indexOf(action.type) === -1) return;

            // 计算预期收益
            const expected = ProfitCaculation(action, globals.medianMarketJson);

            // 计算实际收益
            let actualValue = 0;
            Object.entries(logData.drops).forEach(([itemHash, count]) => {
                const itemHrid = itemHash.split("::")[0];
                const valuation = getItemValuation(itemHrid, globals.medianMarketJson);
                actualValue += (valuation?.bid || 0) * count;
            });
            actualValue *= 0.98;

            // 计算持续时间（小时）
            const startTime = new Date(logData.startTime);
            const endTime = new Date(logData.endTime);
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);

            // 计算预期收益
            const expectedValue = expected.outputPerHour.bid * durationHours;
            const expendValue = expected.expendPerHour * durationHours;
            const profit = actualValue - expendValue;
            const diffValue = actualValue - expectedValue;
            const diffPercent = (diffValue / expectedValue * 100).toFixed(2);

            // 生成显示元素

            const content = diffPercent >= 0 ?
                `支出 ${formatNumber(expendValue)} 收入 ${formatNumber(actualValue)} 高于预期 ${Math.abs(diffPercent)}% 期望 ${formatNumber(expectedValue)} 多赚 ${formatNumber(Math.abs(diffValue))} 盈利 ${formatNumber(profit)}` :
                `支出 ${formatNumber(expendValue)} 收入 ${formatNumber(actualValue)} 低于预期 ${Math.abs(diffPercent)}% 期望 ${formatNumber(expectedValue)} 少赚 ${formatNumber(Math.abs(diffValue))} 盈利 ${formatNumber(profit)}`;

            const colorIntensity = Math.min(Math.abs(diffPercent) / 20, 1) * 0.3 + 0.7;
            const color = diffPercent >= 0
                ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)`  // 红色表示高于预期
                : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`; // 绿色表示低于预期
            const span = document.createElement('span');
            span.style.marginLeft = '8px';
            span.style.color = color;
            span.textContent = content;

            // 添加到动作名称后面
            const actionNameSpan = lootElem.querySelector('span:not(.loot-log-index)');
            if (actionNameSpan) {
                actionNameSpan.appendChild(span);
            }
        });
    }, 200);
}