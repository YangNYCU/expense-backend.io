const fs = require('fs');
const { saveData } = require('../utils/db');
const { DB_FILE_PATH } = require('../config/config');
const db = require('../models/database');

async function handleUserRequest(req, res, body) {
    const { method, url } = req;

    if (url === '/pending' && method === 'GET') {
        return getPendingUsers(req, res);
    }
    if (url === '/' && method === 'GET') {
        return getAllUsers(req, res);
    }

    const approveMatch = url.match(/^\/([0-9]+)\/approve$/);
    if (approveMatch && method === 'PUT') {
        return await approveUser(req, res, approveMatch[1], body);
    }

    const deleteMatch = url.match(/^\/([0-9]+)$/);
    if (deleteMatch && method === 'DELETE') {
        return await deleteUser(req, res, deleteMatch[1]);
    }

    const profileMatch = url.match(/^\/profile\/(.+)$/);
    if (profileMatch && method === 'GET') {
        return await getUserProfile(req, res, profileMatch[1]);
    }
    if (profileMatch && method === 'PUT') {
        return await updateUserProfile(req, res, profileMatch[1], body);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
}


async function approveUser(req, res, userIdStr, body) {
    try {
        const userId = parseInt(userIdStr);
        const { status } = body;
        console.log('正在更新用戶狀態:', { userId, status, currentTime: new Date().toISOString() });
        if (!['approved', 'rejected'].includes(status)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '無效的狀態值' }));
        }
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '找不到用戶' }));
        }
        db.users[userIndex].status = status;
        console.log('正在保存更改...');
        saveData(db);
        const savedData = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
        const savedUser = savedData.users.find(u => u.id === userId);
        if (savedUser && savedUser.status === status) {
            console.log('更改已成功保存到文件');
        } else {
            console.error('保存可能未成功，檢查文件內容:', {
                expectedStatus: status,
                savedStatus: savedUser ? savedUser.status : 'user not found'
            });
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            success: true,
            message: `用戶已${status === 'approved' ? '通過' : '拒絕'}`,
            data: {
                id: userId,
                username: db.users[userIndex].username,
                status: status
            }
        }));
    } catch (err) {
        console.error('審核用戶錯誤:', err);
        console.error('錯誤詳情:', { userId: userIdStr, status: body.status, error: err.message, stack: err.stack });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

function getPendingUsers(req, res) {
    try {
        const pendingUsers = db.users
            .filter(user => user.status === 'pending')
            .map(({ password, ...user }) => user);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: pendingUsers }));
    } catch (err) {
        console.error('獲取待審核用戶錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

function getAllUsers(req, res) {
    try {
        const users = db.users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: users }));
    } catch (err) {
        console.error('獲取用戶列表錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

function deleteUser(req, res, idStr) {
    try {
        const userId = parseInt(idStr, 10);
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到該用戶' }));
        }
        if (db.users[userIndex].role === 'finance') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '無法刪除財務人員帳號' }));
        }
        db.users.splice(userIndex, 1);
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '用戶與其採購紀錄已成功刪除' }));
    } catch (err) {
        console.error('刪除用戶時發生錯誤：', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

function getUserProfile(req, res, username) {
    try {
        const user = db.users.find(u => u.username === username);
        if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '找不到用戶資料' }));
        }
        const { password, ...userWithoutPassword } = user;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: userWithoutPassword }));
    } catch (err) {
        console.error('獲取用戶資料錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

async function updateUserProfile(req, res, username, body) {
    try {
        const { email, bank, bank_account, password } = body;
        const userIndex = db.users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '找不到用戶' }));
        }
        if (email) db.users[userIndex].email = email;
        if (bank) db.users[userIndex].bank = bank;
        if (bank_account) db.users[userIndex].bank_account = bank_account;
        if (password) {
            db.users[userIndex].password = password;
        }
        saveData(db);
        const { password: _, ...userWithoutPassword } = db.users[userIndex];
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: '更新成功', data: userWithoutPassword }));
    } catch (err) {
        console.error('更新用戶資料錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

module.exports = handleUserRequest;