import globals from "./globals";
import {
    ZHActionTypeNames,
    processingCategory,
    getSvg,
} from "./utils";
import ProfitCaculation from './profitCalculation'


export function GenerateDom(marketJson) {
    if (!marketJson?.market) throw new Error("Market data unavailable");
    const actionTypes = Object.keys(ZHActionTypeNames);
    const actionTypesHtml = [];
    for (const actionType of actionTypes) {
        const actions = [];
        Object.keys(globals.initClientData_actionDetailMap).filter(key => key.indexOf(`/actions/${actionType}/`) !== -1).forEach(key => actions.push(globals.initClientData_actionDetailMap[key]));
        const actionsHtmlResult = []
        for (const action of actions) {
            if (processingCategory[action.type]) {
                if (action?.category && action.category !== processingCategory[action.type]) continue;
            }
            const levelEngouth = globals.initCharacterData_characterSkills.some(skill => skill.skillHrid === action.levelRequirement.skillHrid && skill.level >= action.levelRequirement.level);
            const iconId = action.hrid.replace(`/actions/${actionType}/`, '');
            const result = ProfitCaculation(action, marketJson);

            const actionHtml =
                `
                <div class="Item_itemContainer__x7kH1" style="position: relative;">
                    <div>
                        <div class="Item_item__2De2O Item_clickable__3viV6" style="${levelEngouth ? "" : "background-color: var(--color-midnight-800);"}" data-tooltip='${JSON.stringify(result)}'>
                            <div class="Item_iconContainer__5z7j4"><svg role="img" aria-label="${action.name}"
                                    class="Icon_icon__2LtL_" width="100%" height="100%">
                                    <use href="/static/media/${getSvg(iconId)}"></use>
                                </svg></div>
                            
                            <div id="script_stack_price" style="z-index: 1; position: absolute; top: 2px; left: 2px; text-align: left;">${result.profitPerDayMillion}M</div>
                            <div class="Item_count__1HVvv">${result.ProfitMargin.toFixed(0)}%</div>
                        </div>
                    </div>
                </div>
            `;
            actionsHtmlResult.push({ profitPerHour: result.profitPerHour, actionHtml });
        }
        const actionHtml = [];
        actionsHtmlResult.sort((l, r) => r.profitPerHour - l.profitPerHour).forEach(v => actionHtml.push(v.actionHtml));

        const actionTypeHtml =
            `
            <div>
                <div class="Inventory_itemGrid__20YAH">
                    <div class="Inventory_label__XEOAx" >
                        <span class="Inventory_categoryButton__35s1x">${ZHActionTypeNames[actionType]}</span>
                    </div>
                    ${actionHtml.join('\n')}
                </div>
            </div>
        `;
        actionTypesHtml.push(actionTypeHtml);
    }
    const innerHtml = actionTypesHtml.join('\n');

    return innerHtml;
}