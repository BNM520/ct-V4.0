const Inventory = {
    async list() {
        return await DB.getAll('inventory');
    },
    async add(item) {
        // item: { name, quantity, price, threshold, unit }
        return await DB.put('inventory', item);
    },
    async update(item) {
        return await DB.put('inventory', item);
    },
    async remove(id) {
        return await DB.delete('inventory', id);
    },
    async adjustStock(id, delta) {
        const items = await this.list();
        const item = items.find(i => i.id === id);
        if (!item) throw new Error('未找到该食材');
        item.quantity += delta;
        if (item.quantity < 0) item.quantity = 0;
        await this.update(item);
        return item;
    },
    async setThreshold(id, threshold) {
        const items = await this.list();
        const item = items.find(i => i.id === id);
        if (!item) throw new Error('未找到该食材');
        item.threshold = threshold;
        await this.update(item);
        return item;
    }
};
