const { saveData } = require('../utils/db');
const db = require('../models/database');

async function handleAuthRequest(req, res, body) {
    const { url } = req;

    if (url === '/register') {
        await handleRegister(req, res, body);
    } else if (url === '/login') {
        await handleLogin(req, res, body);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
}

async function handleRegister(req, res, body) {
    const { username, password, role, email, bank, bank_account } = body;
    if (db.users.find(u => u.username === username)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '使用者名稱已存在' }));
    }
    try {
        const userRole = role && role === 'finance' ? 'finance' : 'user';
        const newUser = {
            id: db.users.length + 1,
            username,
            password: password,
            role: userRole,
            email,
            bank,
            bank_account,
            status: 'pending',
            regist_time: new Date().toISOString()
        };
        db.users.push(newUser);
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '註冊成功，請等待審核', role: userRole }));
    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

async function handleLogin(req, res, body) {
    const { username, password } = body;
    try {
        const user = db.users.find(u => u.username === username);
        if (!user) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '使用者名稱或密碼錯誤' }));
        }
        if (user.status === 'pending') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '您的帳號正在審核中，請等待審核通過後再登入' }));
        }
        if (user.status === 'rejected') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '您的註冊申請已被拒絕' }));
        }
        if (user.password !== password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '使用者名稱或密碼錯誤' }));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            success: true,
            role: user.role,
            username: user.username,
            message: '登入成功'
        }));
    } catch (err) {
        console.error('登入錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

module.exports = handleAuthRequest;