document.addEventListener('DOMContentLoaded', () => {
    UI.showInventory();

    document.getElementById('nav-inventory').onclick = () => UI.showInventory();
    document.getElementById('nav-records').onclick = () => UI.showRecords();
    document.getElementById('nav-statistics').onclick = () => UI.showStatistics();
    document.getElementById('nav-excel').onclick = () => UI.showExcel();
    document.getElementById('nav-backup').onclick = () => UI.showBackup();
});