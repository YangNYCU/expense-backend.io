const { loadData } = require('../utils/db');

const db = {
    users: [
        {
            id: 1,
            username: 'admin',
            password: '$2b$10$8KvHKf.WKgkG5hGWzrVTxOEZ98P.3z6H8P1OUFsXCzF1bHrz3EKVi',
            role: 'finance',
            email: 'admin@example.com',
            status: 'approved',
            regist_time: new Date().toISOString()
        }
    ],
    purchases: [],
};

// 初始化資料庫
loadData(db);

module.exports = db;