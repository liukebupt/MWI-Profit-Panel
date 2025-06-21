import globals from './globals.js';
import { refreshProfitPanel } from './panelManager.js';

export function initSettingsPanel() {
    // 创建模态框HTML
    const modalHTML = `
    <div class="modal fade" id="profitSettingsModal" tabindex="-1" style="z-index: 100000;" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">收益设置</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">原料进货方式</label>
                        <select class="form-select" id="materialPriceMode">
                            <option value="ask">高买</option>
                            <option value="bid">低买</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">产品出货方式</label>
                        <select class="form-select" id="productPriceMode">
                            <option value="ask">高卖</option>
                            <option value="bid">低卖</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">显示的动作分类</label>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="milkingCheck" value="milking">
                            <label class="form-check-label" for="milkingCheck">挤奶</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="foragingCheck" value="foraging">
                            <label class="form-check-label" for="foragingCheck">采摘</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="woodcuttingCheck" value="woodcutting">
                            <label class="form-check-label" for="woodcuttingCheck">伐木</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="cheesesmithingCheck" value="cheesesmithing">
                            <label class="form-check-label" for="cheesesmithingCheck">奶锻制造</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="craftingCheck" value="crafting">
                            <label class="form-check-label" for="craftingCheck">制作</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="tailoringCheck" value="tailoring">
                            <label class="form-check-label" for="tailoringCheck">缝纫</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="cookingCheck" value="cooking">
                            <label class="form-check-label" for="cookingCheck">烹饪</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="brewingCheck" value="brewing">
                            <label class="form-check-label" for="brewingCheck">冲泡</label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Mooket数据主动刷新频率 (分钟)</label>
                        <select class="form-select" id="refreshInterval">
                            <option value="10">10分钟</option>
                            <option value="20">20分钟</option>
                            <option value="30">30分钟</option>
                            <option value="40">40分钟</option>
                            <option value="50">50分钟</option>
                            <option value="60">60分钟</option>
                            <option value="70">70分钟</option>
                            <option value="80">80分钟</option>
                            <option value="90">90分钟</option>
                            <option value="100">100分钟</option>
                            <option value="110">110分钟</option>
                            <option value="120">120分钟</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" id="saveSettingsBtn">保存设置</button>
                </div>
            </div>
        </div>
    </div>
    `;

    // 添加到body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 设置按钮点击事件
    document.addEventListener('click', (e) => {
        if (e.target.closest('#profitSettingsBtn')) {
            const modal = new bootstrap.Modal(document.getElementById('profitSettingsModal'));

            // 加载当前设置
            const settings = globals.profitSettings;
            document.getElementById('materialPriceMode').value = settings.materialPriceMode;
            document.getElementById('productPriceMode').value = settings.productPriceMode;
            document.getElementById('refreshInterval').value = settings.refreshInterval / (60 * 1000) || 10;
            
            // 设置默认分类选项
            const checkboxes = document.querySelectorAll('input[type="checkbox"][value]');
            if (settings.actionCategories) {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = settings.actionCategories.includes(checkbox.value);
                });
            } else {
                // 默认全选
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
            }
            modal.show();
        }
    });

    // 保存设置事件
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const actionCategories = Array.from(document.querySelectorAll('input[type="checkbox"][value]:checked'))
            .map(checkbox => checkbox.value);
            
        globals.profitSettings = {
            materialPriceMode: document.getElementById('materialPriceMode').value,
            productPriceMode: document.getElementById('productPriceMode').value,
            refreshInterval: parseInt(document.getElementById('refreshInterval').value) * 60 * 1000,
            actionCategories: actionCategories
        };

        bootstrap.Modal.getInstance(document.getElementById('profitSettingsModal')).hide();
    });


    globals.subscribe((key, value) => {
        if (key === "profitSettings") {
            refreshProfitPanel(true);
            GM_setValue("profitSettings", JSON.stringify(value));
        }
    });
}