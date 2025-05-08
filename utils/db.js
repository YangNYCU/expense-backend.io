const fs = require('fs');
const { DB_FILE_PATH } = require('../config/config');

//將記憶體中的資料寫入資料庫檔案
function saveData(db) {
    try {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
        console.log('數據已保存到文件:', DB_FILE_PATH);
    } catch (err) {
        console.error('保存數據錯誤:', err);
        console.error('錯誤詳情:', {
            path: DB_FILE_PATH,
            error: err.message,
            stack: err.stack
        });
    }
}

//從資料庫檔案載入資料到記憶體
function loadData(db) {
    try {
        if (fs.existsSync(DB_FILE_PATH)) {
            const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
            Object.assign(db, JSON.parse(data));
            console.log('數據已從文件載入:', DB_FILE_PATH);
        } else {
            console.log('數據文件不存在，創建新文件');
            saveData(db);
        }
    } catch (err) {
        console.error('載入數據錯誤:', err);
        console.error('錯誤詳情:', {
            path: DB_FILE_PATH,
            error: err.message,
            stack: err.stack
        });
    }
}

module.exports = { saveData, loadData };