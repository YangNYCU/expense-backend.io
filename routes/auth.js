const express = require('express');
const { saveData } = require('../utils/db');
const db = require('../models/database');

const router = express.Router();

/*
 * 使用者註冊 API
 * 端點：POST /api/auth/register
 */
router.post('/register', async(req, res) => {
    const { username, password, role, email, bank, bank_account } = req.body;
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: '使用者名稱已存在' });
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
        res.json({ message: '註冊成功，請等待審核', role: userRole });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

/*
 * 使用者登入 API
 * 端點：POST /api/auth/login
 */
router.post('/login', async(req, res) => {
    const { username, password } = req.body;
    try {
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(400).json({ success: false, message: '使用者名稱或密碼錯誤' });
        }
        if (user.status === 'pending') {
            return res.status(403).json({ success: false, message: '您的帳號正在審核中，請等待審核通過後再登入' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ success: false, message: '您的註冊申請已被拒絕' });
        }
        if (user.password !== password) {
            return res.status(400).json({ success: false, message: '使用者名稱或密碼錯誤' });
        }
        res.json({
            success: true,
            role: user.role,
            username: user.username,
            message: '登入成功'
        });
    } catch (err) {
        console.error('登入錯誤:', err);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});

module.exports = router;