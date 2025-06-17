const Backup = {
    async exportAll() {
        const inventory = await Inventory.list();
        const records = await Records.list();
        const data = { inventory, records };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ct4_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    },
    async importAll(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    await DB.clear('inventory');
                    await DB.clear('records');
                    for (const item of data.inventory) await Inventory.add(item);
                    for (const rec of data.records) await Records.add(rec);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};
