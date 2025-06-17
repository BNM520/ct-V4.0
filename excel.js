const Excel = {
    async exportInventory() {
        const items = await Inventory.list();
        const wsData = [
            ['名称', '数量', '单位', '单价', '预警阈值'],
            ...items.map(i => [
                i.name,
                i.quantity,
                i.unit || '',
                i.price,
                i.threshold !== undefined && i.threshold !== null ? i.threshold : ''
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '库存');
        XLSX.writeFile(wb, '库存导出.xlsx');
    },

    async importInventory(file, mode = 'cover') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    // rows[0] 是表头
                    const header = rows[0];
                    const nameIdx = header.indexOf('名称');
                    const qtyIdx = header.indexOf('数量');
                    const unitIdx = header.indexOf('单位');
                    const priceIdx = header.indexOf('单价');
                    const thresholdIdx = header.indexOf('预警阈值');
                    if (nameIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
                        alert('Excel表头必须包含：名称、数量、单价');
                        return reject();
                    }
                    const items = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row[nameIdx]) continue;
                        items.push({
                            name: row[nameIdx],
                            quantity: Number(row[qtyIdx]) || 0,
                            unit: row[unitIdx] || '',
                            price: Number(row[priceIdx]) || 0,
                            threshold: thresholdIdx !== -1 && row[thresholdIdx] !== undefined && row[thresholdIdx] !== '' ? Number(row[thresholdIdx]) : undefined
                        });
                    }
                    if (mode === 'cover') {
                        await DB.clear('inventory');
                        for (const item of items) await Inventory.add(item);
                    } else if (mode === 'append') {
                        for (const item of items) await Inventory.add(item);
                    }
                    alert('导入成功');
                    resolve();
                } catch (err) {
                    alert('导入失败: ' + err.message);
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    async exportSelectedRecords(records) {
        if (!records || !records.length) return;
        const wsData = [
            ['类型', '名称', '数量', '单位', '单价', '金额', '经办人', '时间', '备注'],
            ...records.map(r => [
                r.type === 'in' ? '入库' : '出库',
                r.name,
                r.quantity,
                r.unit || '',
                r.price,
                (Number(r.quantity) * Number(r.price)).toFixed(2),
                r.operator || '',
                new Date(r.time).toLocaleString(),
                r.remark || ''
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '出入库记录');
        XLSX.writeFile(wb, '出入库记录导出.xlsx');
    }
};
