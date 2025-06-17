const UI = {
    async showInventory() {
        const app = document.getElementById('app');
        const items = await Inventory.list();
        // 计算总库存金额
        const totalAmount = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.price), 0);
        // 移除自动备份下载按钮
        app.innerHTML = `
            <h2>库存管理</h2>
            <div style="margin-bottom:10px;">
                <b>现库存总金额：</b>￥${totalAmount.toFixed(2)}
            </div>
            <button id="add-item-btn">新增食材</button>
            <button id="export-inventory-btn">导出库存Excel</button>
            <input type="file" id="import-inventory-file" style="display:none" accept=".xlsx,.xls"/>
            <button id="import-inventory-btn">导入库存Excel</button>
            <select id="import-mode" style="margin-left:8px;">
                <option value="cover">覆盖导入</option>
                <option value="append">添加导入</option>
            </select>
            <table>
                <thead><tr><th>名称</th><th>数量</th><th>单位</th><th>单价</th><th>预警阈值</th><th>操作</th></tr></thead>
                <tbody>
                    ${items.map(i => `<tr${i.threshold !== undefined && i.threshold !== null && Number(i.quantity) <= Number(i.threshold) ? ' style="background:#fff3cd;"' : ''}>
                        <td>${i.name}</td>
                        <td>${i.quantity}</td>
                        <td>${i.unit || ''}</td>
                        <td>${i.price}</td>
                        <td>
                            <span>${i.threshold !== undefined && i.threshold !== null ? i.threshold : ''}</span>
                        </td>
                        <td>
                            <button class="in-btn" data-id="${i.id}">入库</button>
                            <button class="out-btn" data-id="${i.id}">出库</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('add-item-btn').onclick = () => UI.promptAddItem();
        document.getElementById('export-inventory-btn').onclick = () => Excel.exportInventory();
        document.getElementById('import-inventory-btn').onclick = () => document.getElementById('import-inventory-file').click();
        document.getElementById('import-inventory-file').onchange = async (e) => {
            if (e.target.files.length) {
                let adminPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
                const backupPwdHash = 'MDAwMzI0';
                // 使用带type=password的输入框
                const pwd = await new Promise(resolve => {
                    const modal = document.createElement('div');
                    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
                    modal.innerHTML = `
                        <div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:260px;">
                            <div style="margin-bottom:12px;">请输入管理员密码：</div>
                            <input id="pwd-input" type="password" style="width:100%;padding:6px 8px;font-size:16px;" autofocus />
                            <div style="margin-top:16px;text-align:right;">
                                <button id="pwd-ok">确定</button>
                                <button id="pwd-cancel" style="margin-left:10px;">取消</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    const input = modal.querySelector('#pwd-input');
                    input.focus();
                    modal.querySelector('#pwd-ok').onclick = () => {
                        resolve(input.value);
                        document.body.removeChild(modal);
                    };
                    modal.querySelector('#pwd-cancel').onclick = () => {
                        resolve('');
                        document.body.removeChild(modal);
                    };
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter') {
                            resolve(input.value);
                            document.body.removeChild(modal);
                        }
                    };
                });
                if (pwd !== adminPwd && btoa(pwd) !== backupPwdHash) {
                    alert('密码错误，导入取消');
                    e.target.value = '';
                    return;
                }
                const mode = document.getElementById('import-mode').value;
                await Excel.importInventory(e.target.files[0], mode);
                UI.showInventory();
            }
        };
        app.querySelectorAll('.in-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = Number(btn.dataset.id);
                const qty = Number(prompt('入库数量：'));
                if (qty > 0) {
                    const operator = prompt('请输入经办人：');
                    if (!operator) {
                        alert('经办人不能为空');
                        return;
                    }
                    const item = items.find(i=>i.id===id);
                    await Inventory.adjustStock(id, qty);
                    await Records.add({
                        type: 'in',
                        name: item.name,
                        quantity: qty,
                        price: item.price,
                        unit: item.unit || '',
                        time: new Date(),
                        operator,
                        remark: ''
                    });
                    UI.showInventory();
                }
            };
        });
        app.querySelectorAll('.out-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = Number(btn.dataset.id);
                const item = items.find(i => i.id === id);
                const qty = Number(prompt('出库数量：'));
                if (qty > 0) {
                    if (qty > item.quantity) {
                        alert('出库数量不能大于库存数量！');
                        return;
                    }
                    const operator = prompt('请输入经办人：');
                    if (!operator) {
                        alert('经办人不能为空');
                        return;
                    }
                    await Inventory.adjustStock(id, -qty);
                    await Records.add({
                        type: 'out',
                        name: item.name,
                        quantity: qty,
                        price: item.price,
                        unit: item.unit || '',
                        time: new Date(),
                        operator,
                        remark: ''
                    });
                    UI.showInventory();
                }
            };
        });
    },
    async promptAddItem() {
        const name = prompt('食材名称：');
        if (!name) return;
        const quantity = Number(prompt('数量：'));
        const unit = prompt('单位（如千克、斤、个等）：') || '';
        const price = Number(prompt('单价：'));
        const thresholdStr = prompt('预警阈值（可选）：');
        let threshold = undefined;
        if (thresholdStr !== null && thresholdStr !== '') {
            threshold = Number(thresholdStr);
            if (isNaN(threshold) || threshold < 0) threshold = undefined;
        }
        if (quantity >= 0 && price >= 0) {
            await Inventory.add({ name, quantity, price, threshold, unit });
            UI.showInventory();
        }
    },
    async showRecords() {
        const app = document.getElementById('app');
        let allRecords = await Records.list();
        let filterType = 'all';
        let filterStart = '';
        let filterEnd = '';
        let filterName = '';
        let filterOperator = '';

        function filterRecords() {
            let filtered = allRecords;
            if (filterType === 'in') filtered = filtered.filter(r => r.type === 'in');
            if (filterType === 'out') filtered = filtered.filter(r => r.type === 'out');
            if (filterStart) {
                const start = new Date(filterStart).getTime();
                filtered = filtered.filter(r => new Date(r.time).getTime() >= start);
            }
            if (filterEnd) {
                const end = new Date(filterEnd).getTime() + 86399999;
                filtered = filtered.filter(r => new Date(r.time).getTime() <= end);
            }
            if (filterName) {
                filtered = filtered.filter(r => {
                    if (typeof r.name === 'string') {
                        return r.name.toLowerCase().indexOf(filterName.toLowerCase()) !== -1;
                    }
                    if (r.name != null) {
                        return String(r.name).toLowerCase().indexOf(filterName.toLowerCase()) !== -1;
                    }
                    return false;
                });
            }
            if (filterOperator) {
                filtered = filtered.filter(r => {
                    if (typeof r.operator === 'string') {
                        return r.operator.toLowerCase().indexOf(filterOperator.toLowerCase()) !== -1;
                    }
                    if (r.operator != null) {
                        return String(r.operator).toLowerCase().indexOf(filterOperator.toLowerCase()) !== -1;
                    }
                    return false;
                });
            }
            return filtered;
        }

        function render(records) {
            const totalQty = records.reduce((sum, r) => sum + Number(r.quantity), 0);
            const totalAmount = records.reduce((sum, r) => sum + Number(r.quantity) * Number(r.price), 0);

            app.innerHTML = `
                <h2>出入库记录</h2>
                <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
                    <span>
                        <label><input type="radio" name="filterType" value="all" ${filterType==='all'?'checked':''}/>全部</label>
                        <label><input type="radio" name="filterType" value="in" ${filterType==='in'?'checked':''}/>仅入库</label>
                        <label><input type="radio" name="filterType" value="out" ${filterType==='out'?'checked':''}/>仅出库</label>
                    </span>
                    <span>
                        时间区间：
                        <input type="date" id="filter-start" value="${filterStart}" style="width:130px;">
                        -
                        <input type="date" id="filter-end" value="${filterEnd}" style="width:130px;">
                        <button id="filter-date-btn" style="padding:2px 8px;">筛选</button>
                        <button id="filter-reset-btn" style="padding:2px 8px;">重置</button>
                    </span>
                    <span>
                        名称筛选：
                        <input type="text" id="filter-name" value="${filterName}" placeholder="输入食材名称" style="width:110px;">
                        <button id="filter-name-btn" style="padding:2px 8px;">筛选</button>
                    </span>
                    <span>
                        经办人筛选：
                        <input type="text" id="filter-operator" value="${filterOperator}" placeholder="输入经办人" style="width:90px;">
                        <button id="filter-operator-btn" style="padding:2px 8px;">筛选</button>
                    </span>
                    <span style="flex:1 1 auto;"></span>
                    <button id="export-selected-records-btn" style="float:right;">导出选中记录Excel</button>
                </div>
                <div style="margin:10px 0;">
                    <b>总数量：</b>${totalQty}　
                    <b>总金额：</b>￥${totalAmount.toFixed(2)}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-records"></th>
                            <th>类型</th>
                            <th>名称</th>
                            <th>数量</th>
                            <th>单位</th>
                            <th>单价</th>
                            <th>金额</th>
                            <th>经办人</th>
                            <th>时间</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td><input type="checkbox" class="record-checkbox" data-id="${r.id}"></td>
                                <td>${r.type === 'in' ? '入库' : '出库'}</td>
                                <td>${r.name}</td>
                                <td>${r.quantity}</td>
                                <td>${r.unit || ''}</td>
                                <td>${r.price}</td>
                                <td>${(Number(r.quantity) * Number(r.price)).toFixed(2)}</td>
                                <td>${r.operator || ''}</td>
                                <td>${new Date(r.time).toLocaleString()}</td>
                                <td>${r.remark || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            // 选择全部
            const selectAll = document.getElementById('select-all-records');
            if (selectAll) {
                selectAll.onclick = () => {
                    app.querySelectorAll('.record-checkbox').forEach(cb => {
                        cb.checked = selectAll.checked;
                    });
                };
            }
            // 导出选中
            document.getElementById('export-selected-records-btn').onclick = async () => {
                const checkedIds = Array.from(app.querySelectorAll('.record-checkbox'))
                    .filter(cb => cb.checked)
                    .map(cb => Number(cb.dataset.id));
                const selected = records.filter(r => checkedIds.includes(r.id));
                if (selected.length === 0) {
                    alert('请至少选择一条记录');
                    return;
                }
                await Excel.exportSelectedRecords(selected);
            };
            // 类型筛选
            app.querySelectorAll('input[name="filterType"]').forEach(radio => {
                radio.onchange = () => {
                    filterType = radio.value;
                    render(filterRecords());
                };
            });
            // 时间筛选
            document.getElementById('filter-date-btn').onclick = () => {
                filterStart = document.getElementById('filter-start').value;
                filterEnd = document.getElementById('filter-end').value;
                render(filterRecords());
            };
            document.getElementById('filter-reset-btn').onclick = () => {
                filterType = 'all';
                filterStart = '';
                filterEnd = '';
                filterName = '';
                filterOperator = '';
                render(filterRecords());
            };
            // 名称筛选
            document.getElementById('filter-name-btn').onclick = () => {
                filterName = document.getElementById('filter-name').value.trim();
                render(filterRecords());
            };
            document.getElementById('filter-name').onkeydown = (e) => {
                if (e.key === 'Enter') {
                    filterName = document.getElementById('filter-name').value.trim();
                    render(filterRecords());
                }
            };
            // 经办人筛选
            document.getElementById('filter-operator-btn').onclick = () => {
                filterOperator = document.getElementById('filter-operator').value.trim();
                render(filterRecords());
            };
            document.getElementById('filter-operator').onkeydown = (e) => {
                if (e.key === 'Enter') {
                    filterOperator = document.getElementById('filter-operator').value.trim();
                    render(filterRecords());
                }
            };
        }

        render(filterRecords());
    },
    async showStatistics() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <h2>统计分析</h2>
            <div style="margin-bottom:12px;">
                <label>起始日期：<input type="date" id="stat-start"></label>
                <label>结束日期：<input type="date" id="stat-end"></label>
                <button id="stat-query-btn">查询</button>
                <button id="stat-reset-btn">重置</button>
            </div>
            <div id="stat-result"></div>
        `;

        document.getElementById('stat-reset-btn').onclick = () => {
            document.getElementById('stat-start').value = '';
            document.getElementById('stat-end').value = '';
            document.getElementById('stat-result').innerHTML = '';
        };

        document.getElementById('stat-query-btn').onclick = async () => {
            const start = document.getElementById('stat-start').value ? new Date(document.getElementById('stat-start').value) : null;
            const end = document.getElementById('stat-end').value ? new Date(document.getElementById('stat-end').value) : null;
            const records = await Records.filterByDate(start, end);

            // 按天分组
            const groupByDay = {};
            records.forEach(r => {
                const day = new Date(r.time).toISOString().slice(0, 10);
                if (!groupByDay[day]) groupByDay[day] = { in: { qty: 0, amount: 0 }, out: { qty: 0, amount: 0 } };
                if (r.type === 'in') {
                    groupByDay[day].in.qty += Number(r.quantity);
                    groupByDay[day].in.amount += Number(r.quantity) * Number(r.price);
                } else {
                    groupByDay[day].out.qty += Number(r.quantity);
                    groupByDay[day].out.amount += Number(r.quantity) * Number(r.price);
                }
            });
            const days = Object.keys(groupByDay).sort();

            // 入库表
            let inTable = `
                <h3>入库统计表</h3>
                <table>
                    <thead><tr><th>日期</th><th>入库数量</th><th>入库金额</th></tr></thead>
                    <tbody>
                        ${days.map(day => `
                            <tr>
                                <td>${day}</td>
                                <td>${groupByDay[day].in.qty}</td>
                                <td>￥${groupByDay[day].in.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            // 出库表
            let outTable = `
                <h3>出库统计表</h3>
                <table>
                    <thead><tr><th>日期</th><th>出库数量</th><th>出库金额</th></tr></thead>
                    <tbody>
                        ${days.map(day => `
                            <tr>
                                <td>${day}</td>
                                <td>${groupByDay[day].out.qty}</td>
                                <td>￥${groupByDay[day].out.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('stat-result').innerHTML = inTable + outTable;
        };
    },
    async showExcel() {
        // 管理员密码本地存储，默认 xdgxx
        let adminPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
        const backupPwdHash = 'MDAwMzI0'; // 备份密码的Base64编码
        // 弹窗输入密码（圆点遮住）
        const pwd = await new Promise(resolve => {
            const modal = document.createElement('div');
            modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:260px;">
                    <div style="margin-bottom:12px;">请输入管理员密码：</div>
                    <input id="pwd-input" type="password" style="width:100%;padding:6px 8px;font-size:16px;" autofocus />
                    <div style="margin-top:16px;text-align:right;">
                        <button id="pwd-ok">确定</button>
                        <button id="pwd-cancel" style="margin-left:10px;">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const input = modal.querySelector('#pwd-input');
            input.focus();
            modal.querySelector('#pwd-ok').onclick = () => {
                resolve(input.value);
                document.body.removeChild(modal);
            };
            modal.querySelector('#pwd-cancel').onclick = () => {
                resolve('');
                document.body.removeChild(modal);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    resolve(input.value);
                    document.body.removeChild(modal);
                }
            };
        });
        if (pwd !== adminPwd && btoa(pwd) !== backupPwdHash) {
            alert('密码错误');
            return;
        }
        // 密码正确后显示系统管理页面
        const app = document.getElementById('app');
        app.innerHTML = `
            <h2>系统管理</h2>
            <div style="margin:30px 0;text-align:center;">
                <button id="sys-change-pwd-btn">修改管理员密码</button>
            </div>
            <div style="margin:30px 0;text-align:center;">
                <button id="sys-set-threshold-btn">设置库存预警阈值</button>
            </div>
            <div style="margin:30px 0;text-align:center;">
                <button id="sys-del-item-btn">删除食材</button>
            </div>
            <div style="margin:30px 0;text-align:center;">
                <button id="sys-merge-btn">数据归并（合并重复食材）</button>
            </div>
            <div style="margin:30px 0;text-align:center;">
                <input type="file" id="backup-import-file" style="display:none" accept=".json"/>
                <button id="backup-import-btn">导入恢复（备份文件）</button>
            </div>
        `;
        document.getElementById('sys-change-pwd-btn').onclick = async () => {
            let currentPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
            const backupPwdHash = 'MDAwMzI0';
            const oldPwd = await new Promise(resolve => {
                const modal = document.createElement('div');
                modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
                modal.innerHTML = `
                    <div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:260px;">
                        <div style="margin-bottom:12px;">请输入当前管理员密码：</div>
                        <input id="pwd-input" type="password" style="width:100%;padding:6px 8px;font-size:16px;" autofocus />
                        <div style="margin-top:16px;text-align:right;">
                            <button id="pwd-ok">确定</button>
                            <button id="pwd-cancel" style="margin-left:10px;">取消</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                const input = modal.querySelector('#pwd-input');
                input.focus();
                modal.querySelector('#pwd-ok').onclick = () => {
                    resolve(input.value);
                    document.body.removeChild(modal);
                };
                modal.querySelector('#pwd-cancel').onclick = () => {
                    resolve('');
                    document.body.removeChild(modal);
                };
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        resolve(input.value);
                        document.body.removeChild(modal);
                    }
                };
            });
            if (oldPwd !== currentPwd && btoa(oldPwd) !== backupPwdHash) {
                alert('密码错误');
                return;
            }
            const newPwd = await new Promise(resolve => {
                const modal = document.createElement('div');
                modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
                modal.innerHTML = `
                    <div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:260px;">
                        <div style="margin-bottom:12px;">请输入新密码：</div>
                        <input id="pwd-input" type="password" style="width:100%;padding:6px 8px;font-size:16px;" autofocus />
                        <div style="margin-top:16px;text-align:right;">
                            <button id="pwd-ok">确定</button>
                            <button id="pwd-cancel" style="margin-left:10px;">取消</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                const input = modal.querySelector('#pwd-input');
                input.focus();
                modal.querySelector('#pwd-ok').onclick = () => {
                    resolve(input.value);
                    document.body.removeChild(modal);
                };
                modal.querySelector('#pwd-cancel').onclick = () => {
                    resolve('');
                    document.body.removeChild(modal);
                };
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        resolve(input.value);
                        document.body.removeChild(modal);
                    }
                };
            });
            if (!newPwd) {
                alert('新密码不能为空');
                return;
            }
            localStorage.setItem('ct4_admin_pwd', newPwd);
            alert('密码修改成功');
        };
        document.getElementById('sys-set-threshold-btn').onclick = async () => {
            // 单个设置库存预警阈值
            const items = await Inventory.list();
            let html = `<h3>设置库存预警阈值</h3>
                <div style="max-height:340px;overflow:auto;">
                <table style="margin:0 auto;">
                    <thead><tr><th>名称</th><th>当前阈值</th><th>操作</th></tr></thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${i.threshold !== undefined && i.threshold !== null ? i.threshold : ''}</td>
                                <td>
                                    <button class="set-threshold-btn" data-id="${i.id}">设置</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin-top:18px;text-align:center;">
                    <button id="thresholds-cancel-btn">关闭</button>
                </div>
            `;
            const modal = document.createElement('div');
            modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `<div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:360px;">${html}</div>`;
            document.body.appendChild(modal);
            modal.querySelectorAll('.set-threshold-btn').forEach(btn => {
                btn.onclick = async () => {
                    const id = Number(btn.dataset.id);
                    const item = items.find(i => i.id === id);
                    const val = prompt('设置库存预警阈值（数量）：', item.threshold !== undefined && item.threshold !== null ? item.threshold : '');
                    if (val !== null && val !== '') {
                        const threshold = Number(val);
                        if (isNaN(threshold) || threshold < 0) {
                            alert('请输入有效的非负数字');
                            return;
                        }
                        await Inventory.setThreshold(id, threshold);
                        // 刷新弹窗内容
                        document.body.removeChild(modal);
                        document.getElementById('sys-set-threshold-btn').click();
                    }
                };
            });
            modal.querySelector('#thresholds-cancel-btn').onclick = () => {
                document.body.removeChild(modal);
            };
        };
        document.getElementById('sys-del-item-btn').onclick = async () => {
            // 高权限删除食材
            const items = await Inventory.list();
            let html = `<h3>删除食材</h3>
                <div style="max-height:340px;overflow:auto;">
                <table style="margin:0 auto;">
                    <thead><tr><th>名称</th><th>数量</th><th>单位</th><th>操作</th></tr></thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${i.quantity}</td>
                                <td>${i.unit || ''}</td>
                                <td>
                                    <button class="del-item-btn" data-id="${i.id}">删除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin-top:18px;text-align:center;">
                    <button id="delitem-cancel-btn">关闭</button>
                </div>
            `;
            const modal = document.createElement('div');
            modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.15);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `<div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);min-width:360px;">${html}</div>`;
            document.body.appendChild(modal);
            modal.querySelectorAll('.del-item-btn').forEach(btn => {
                btn.onclick = async () => {
                    const id = Number(btn.dataset.id);
                    if (confirm('确定删除该食材？')) {
                        await Inventory.remove(id);
                        // 刷新弹窗内容
                        document.body.removeChild(modal);
                        document.getElementById('sys-del-item-btn').click();
                    }
                };
            });
            modal.querySelector('#delitem-cancel-btn').onclick = () => {
                document.body.removeChild(modal);
            };
        };
        // 数据归并功能
        document.getElementById('sys-merge-btn').onclick = async () => {
            const items = await Inventory.list();
            // 以 name, unit, price, threshold 作为唯一键
            const map = new Map();
            for (const item of items) {
                const key = [
                    item.name || '',
                    item.unit || '',
                    String(item.price),
                    item.threshold !== undefined && item.threshold !== null ? String(item.threshold) : ''
                ].join('||');
                if (!map.has(key)) {
                    map.set(key, { ...item });
                } else {
                    // 数量相加
                    map.get(key).quantity += Number(item.quantity);
                }
            }
            // 检查是否有需要合并的项
            if (map.size === items.length) {
                alert('没有可合并的重复食材项。');
                return;
            }
            if (!confirm('检测到有重复的食材项，是否进行合并？（数量将相加，其他属性保持不变）')) {
                return;
            }
            // 清空原有库存，重新写入合并后的
            await DB.clear('inventory');
            for (const merged of map.values()) {
                // 移除id，避免主键冲突，由DB自动分配
                const { id, ...rest } = merged;
                await Inventory.add(rest);
            }
            alert('数据归并完成！');
            UI.showInventory();
        };
        // 恢复备份功能
        document.getElementById('backup-import-btn').onclick = () => document.getElementById('backup-import-file').click();
        document.getElementById('backup-import-file').onchange = async (e) => {
            if (e.target.files.length) {
                try {
                    const file = e.target.files[0];
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (data.inventory && data.records) {
                        await DB.clear('inventory');
                        await DB.clear('records');
                        for (const item of data.inventory) await Inventory.add(item);
                        for (const rec of data.records) await Records.add(rec);
                        // 恢复管理员密码
                        if (data.adminPwd) {
                            localStorage.setItem('ct4_admin_pwd', data.adminPwd);
                        }
                        alert('恢复成功');
                        UI.showInventory();
                    } else {
                        throw new Error('备份文件格式不正确');
                    }
                } catch (err) {
                    alert('恢复失败：' + err.message);
                }
            }
        };
    },
    async showBackup() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <h2>数据备份与恢复</h2>
            <button id="backup-export-btn">导出备份</button>
            <button id="backup-export-manual-btn" style="margin-left:16px;">手动备份（带日期时间）</button>
        `;
        document.getElementById('backup-export-btn').onclick = async () => {
            // 备份时包含管理员密码
            let adminPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
            const inventory = await Inventory.list();
            const records = await Records.list();
            const backupData = {
                inventory,
                records,
                adminPwd
            };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ct4-backup.json';
            a.click();
        };
        // 新增：手动备份（带日期时间）
        document.getElementById('backup-export-manual-btn').onclick = async () => {
            let adminPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
            const inventory = await Inventory.list();
            const records = await Records.list();
            const backupData = {
                inventory,
                records,
                adminPwd,
                manualBackup: true,
                backupTime: new Date().toISOString()
            };
            // 生成带日期时间的文件名
            const now = new Date();
            const pad = n => n.toString().padStart(2, '0');
            const fileName = `ct4-backup-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(a.href);
            }, 100);
        };
    },
    renderDebugClearButton() {
        if (document.getElementById('debug-clear-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'debug-clear-btn';
        btn.textContent = '清空所有数据（调试用）';
        btn.style = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#f56c6c;color:#fff;border:none;padding:10px 18px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.08);display:none;';
        btn.onclick = async () => {
            if (confirm('确定要清空所有库存和记录数据吗？此操作不可恢复！')) {
                await DB.clear('inventory');
                await DB.clear('records');
                // 恢复默认管理员密码
                localStorage.setItem('ct4_admin_pwd', 'xdgxx');
                alert('所有数据已清空，管理员密码已恢复为默认：xdgxx');
                location.reload();
            }
        };
        document.body.appendChild(btn);

        // 控制台输入BNM后显示按钮
        window.showDebugClearButton = function() {
            btn.style.display = '';
        };
        // 控制台提示
        if (window.console) {
            setTimeout(() => {
                console.log('%c输入 showDebugClearButton() 并回车可显示清空所有数据按钮', 'color:#f56c6c;font-size:16px;');
                console.log('%c或者直接在控制台输入: BNM', 'color:#409eff;font-size:14px;');
            }, 1000);
        }
        // 监听控制台输入BNM
        if (!window._ct4_bnm_listener) {
            window._ct4_bnm_listener = true;
            Object.defineProperty(window, 'BNM', {
                configurable: true,
                get() {
                    btn.style.display = '';
                    return '已显示清空所有数据按钮';
                }
            });
        }
    },
    // 自动备份功能
    setupAutoBackup() {
        // 自动备份间隔（毫秒），默认每24小时
        const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
        const LAST_BACKUP_KEY = 'ct4_last_auto_backup';
        const AUTO_BACKUP_FILE = 'ct4-auto-backup.json';

        async function doAutoBackup() {
            let adminPwd = localStorage.getItem('ct4_admin_pwd') || 'xdgxx';
            const inventory = await Inventory.list();
            const records = await Records.list();
            const backupData = {
                inventory,
                records,
                adminPwd,
                autoBackup: true,
                backupTime: new Date().toISOString()
            };
            try {
                // 保存到本地文件系统（浏览器环境只能触发下载，或存localStorage）
                // 这里采用localStorage存储
                localStorage.setItem('ct4_auto_backup', JSON.stringify(backupData));
                localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
            } catch (e) {
                // 忽略本地存储溢出等异常
            }
        }

        // 检查是否需要自动备份
        function checkAndBackup() {
            const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
            if (Date.now() - last > BACKUP_INTERVAL) {
                doAutoBackup();
            }
        }

        // 页面加载时检查
        checkAndBackup();
        // 定时器定期备份
        setInterval(doAutoBackup, BACKUP_INTERVAL);
    },
};

// 在页面加载时自动渲染调试按钮和自动备份
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (UI.renderDebugClearButton) UI.renderDebugClearButton();
        if (UI.setupAutoBackup) UI.setupAutoBackup();
    });
}