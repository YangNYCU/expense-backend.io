const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { saveData } = require('../utils/db');
const { DB_FILE_PATH } = require('../config/config');
const db = require('../models/database');

const router = express.Router();


//審核用戶狀態 API
//端點：PUT /api/users/:userId/approve
router.put('/:userId/approve', authenticateToken, async(req, res) => {
    try {
        if (req.user.role !== 'finance') {
            return res.status(403).json({
                success: false,
                message: '權限不足'
            });
        }
        const userId = parseInt(req.params.userId);
        const { status } = req.body;
        console.log('正在更新用戶狀態:', {
            userId,
            status,
            currentTime: new Date().toISOString()
        });
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: '無效的狀態值'
            });
        }
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '找不到用戶'
            });
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
        res.json({
            success: true,
            message: `用戶已${status === 'approved' ? '通過' : '拒絕'}`,
            data: {
                id: userId,
                username: db.users[userIndex].username,
                status: status
            }
        });
    } catch (err) {
        console.error('審核用戶錯誤:', err);
        console.error('錯誤詳情:', {
            userId: req.params.userId,
            status: req.body.status,
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});


//獲取待審核用戶列表 API
//端點：GET /api/users/pending

router.get('/pending', authenticateToken, (req, res) => {
    try {
        const pendingUsers = db.users
            .filter(user => user.status === 'pending')
            .map(({ password, ...user }) => user);
        res.json({
            success: true,
            data: pendingUsers
        });
    } catch (err) {
        console.error('獲取待審核用戶錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});


//獲取所有用戶列表 API
//端點：GET /api/users

router.get('/', authenticateToken, (req, res) => {
    try {
        const users = db.users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        res.json({
            success: true,
            data: users
        });
    } catch (err) {
        console.error('獲取用戶列表錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});


//刪除用戶 API
//端點：DELETE /api/users/:id

router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ message: '找不到該用戶' });
        }
        if (db.users[userIndex].role === 'finance') {
            return res.status(403).json({ message: '無法刪除財務人員帳號' });
        }
        db.users.splice(userIndex, 1);
        saveData(db);
        res.json({ message: '用戶與其採購紀錄已成功刪除' });
    } catch (err) {
        console.error('刪除用戶時發生錯誤：', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});


//獲取用戶資料 API
//端點：GET /api/users/profile

router.get('/profile', authenticateToken, (req, res) => {
    try {
        const { username } = req.user;
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '找不到用戶資料'
            });
        }
        const { password, ...userWithoutPassword } = user;
        res.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (err) {
        console.error('獲取用戶資料錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});


//修改用戶資料 API
//端點：PUT /api/users/profile

router.put('/profile', authenticateToken, async(req, res) => {
    try {
        const { username } = req.user;
        const { email, bank, bank_account, password } = req.body;
        const userIndex = db.users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '找不到用戶'
            });
        }
        if (email) db.users[userIndex].email = email;
        if (bank) db.users[userIndex].bank = bank;
        if (bank_account) db.users[userIndex].bank_account = bank_account;
        if (password) {
            db.users[userIndex].password = await bcrypt.hash(password, 10);
        }
        saveData(db);
        const { password: _, ...userWithoutPassword } = db.users[userIndex];
        res.json({
            success: true,
            message: '更新成功',
            data: userWithoutPassword
        });
    } catch (err) {
        console.error('更新用戶資料錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

module.exports = router;