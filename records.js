const Records = {
    async list() {
        return await DB.getAll('records');
    },
    async add(record) {
        // record: { type: 'in'|'out', name, quantity, price, time, remark }
        return await DB.put('records', record);
    },
    async filterByDate(start, end) {
        const all = await this.list();
        return all.filter(r => {
            const t = new Date(r.time).getTime();
            return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
        });
    }
};
