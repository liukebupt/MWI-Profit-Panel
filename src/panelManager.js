import globals from './globals.js';
import { GenerateDom } from './domGenerator.js';
import { createTooltip } from './tooltipManager.js';
import { initSettingsPanel } from './settingsPanel.js';
import { formatDuration, getMwiObj, getDuration, mooketStatus } from './utils.js';

export async function waitForPannels() {
    if (!globals.freshnessMarketJson?.market) {
        setTimeout(waitForPannels, 1000);
        return;
    }

    const rightPanelContainers = document.querySelectorAll("div.CharacterManagement_tabsComponentContainer__3oI5G");
    const leftPanelContainers = document.querySelectorAll("div.GamePage_middlePanel__ubts7 .MuiTabs-root");
    const targetNodes = [...rightPanelContainers, ...leftPanelContainers];
    targetNodes.forEach(container => {
        if (container.dataset.processed) return;

        // 添加标签按钮和面板容器
        const tabsContainer = container.querySelector('div.MuiTabs-flexContainer');
        const tabPanelsContainer =
            container.querySelector('div.TabsComponent_tabPanelsContainer__26mzo') ||
            container.querySelector('div.MuiTabPanel-root');

        if (!tabsContainer || !tabPanelsContainer) return;

        const newTabButton = document.createElement('button');
        newTabButton.className = 'MuiButtonBase-root MuiTab-root MuiTab-textColorPrimary css-1q2h7u5 income-tab';
        newTabButton.innerHTML = `<span class="MuiBadge-root TabsComponent_badge__1Du26 css-1rzb3uu">收益<span class="MuiBadge-badge MuiBadge-standard MuiBadge-invisible MuiBadge-anchorOriginTopRight MuiBadge-anchorOriginTopRightRectangular MuiBadge-overlapRectangular MuiBadge-colorWarning css-dpce5z"></span></span><span class="MuiTouchRipple-root css-w0pj6f"></span>`;
        newTabButton.classList.add('income-tab');
        tabsContainer.appendChild(newTabButton);

        // 创建收益面板
        const newPanel = document.createElement('div');
        newPanel.className = 'TabPanel_tabPanel__tXMJF TabPanel_hidden__26UM3 income-panel';
        newPanel.innerHTML = `
            <div class="Inventory_inventory__17CH2 profit-pannel">
            <h1 class="HousePanel_title__2fQ1U" style="position: relative; width: fit-content; margin: 4px auto 8px; font-size: 18px; font-weight: 600;">
                <div>生产收益详情</div>
                <div class="HousePanel_guideTooltipContainer__1lAt1" style="position: absolute; left: 100%; top: 0; margin-top: 1px; margin-left: 12px;">
                    <div class="GuideTooltip_guideTooltip__1tVq-" id="profitSettingsBtn" style="cursor: pointer">
                        <svg role="img" aria-label="Guide" class="Icon_icon__2LtL_" width="100%" height="100%">
                            <use href="/static/media/misc_sprite.6b3198dc.svg#settings"></use>
                        </svg>
                    </div>
                </div>
            </h1>
                <span style="color: green; font-size: 0.8em; margin-left: 10px;">数据更新于: ${formatDuration(Date.now() - globals.freshnessMarketJson.time * 1000)}</span>
                <div class="Inventory_items__6SXv0 script_buildScore_added script_invSort_added">
                ${GenerateDom(globals.freshnessMarketJson)}
                </div>
            </div>
        `;
        tabPanelsContainer.appendChild(newPanel);
        container.dataset.processed = "true";

        setupTabSwitching(newTabButton, newPanel, tabPanelsContainer, container);
        createTooltip();
        setupClickActions();

        initSettingsPanel();

        setInterval(() => refreshProfitPanel(), 1000);
    });

    // Check if income panel is missing
    const panelsExist = document.querySelectorAll(".income-panel").length >= 2;
    if (!panelsExist) {
        setTimeout(waitForPannels, 1000);
    }
}

function setupTabSwitching(newTabButton, newPanel, tabPanelsContainer, container) {
    newTabButton.addEventListener('click', () => {
        container.querySelectorAll('.MuiTab-root').forEach(btn => btn.classList.remove('Mui-selected'));
        newTabButton.classList.add('Mui-selected');
        tabPanelsContainer.querySelectorAll('.TabPanel_tabPanel__tXMJF').forEach(panel => {
            panel.classList.add('TabPanel_hidden__26UM3');
        });
        newPanel.classList.remove('TabPanel_hidden__26UM3');
    });

    container.querySelectorAll('.MuiTab-root:not(.income-tab)').forEach(btn => {
        btn.addEventListener('click', () => {
            newPanel.classList.add('TabPanel_hidden__26UM3');
            newTabButton.classList.remove('Mui-selected');

            // 添加选中状态并显示原标签面板
            btn.classList.add('Mui-selected');
            const tabIndex = Array.from(btn.parentNode.children)
                .filter(el => !el.classList.contains('income-tab'))
                .indexOf(btn);
            tabPanelsContainer.querySelectorAll('.TabPanel_tabPanel__tXMJF:not(.income-panel)').forEach((panel, index) => {
                panel.classList.toggle('TabPanel_hidden__26UM3', index !== tabIndex);
            });
        });
    });
}

function setupClickActions() {
    document.addEventListener('click', (e) => {
        const itemContainer = e.target.closest('.Item_item__2De2O.Profit-pannel');
        if (!itemContainer) return;

        const tooltipData = itemContainer.dataset.tooltip;
        if (!tooltipData) return;

        try {
            const data = JSON.parse(tooltipData);
            if (data?.actionHrid && getMwiObj()?.game?.handleGoToAction) {
                getMwiObj().game.handleGoToAction(data.actionHrid);
            }
        } catch (e) {
            console.error('Click action error:', e);
        }
    });
}

let profitRefreshTime = new Date();
export function refreshProfitPanel(force = false) {
    if (!globals.freshnessMarketJson?.market) return;

    const inventoryPanels = document.querySelectorAll('.Inventory_inventory__17CH2.profit-pannel');
    inventoryPanels.forEach(panel => {
        const timeSpan = panel.querySelector('span');
        if (timeSpan) {
            timeSpan.textContent = globals.freshnessMarketJson.stat();
            // timeSpan.textContent = `数据更新于：${getDuration(new Date(globals.freshnessMarketJson.time * 1000))}，收益刷新于：${getDuration(profitRefreshTime)}，mooket${mooketStatus()}，${getMwiObj()?.coreMarket ? "支持" : "不支持"}实时价格`;
        }

        if (force || globals.hasMarketItemUpdate) {
            const itemsContainer = panel.querySelector('.Inventory_items__6SXv0');
            if (itemsContainer) {
                itemsContainer.innerHTML = GenerateDom(globals.freshnessMarketJson);
                profitRefreshTime = new Date();
                globals.hasMarketItemUpdate = false;
            }
        }
    });
}