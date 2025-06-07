const express = require('express');
const path = require('path');
const fs = require('fs');
const { saveData } = require('../utils/db');
const { UPLOADS_ROOT } = require('../config/config');
const db = require('../models/database');

const router = express.Router();

/*
 * 建立採購申請 API
 * 端點：POST /api/purchase
 */
router.post('/', async(req, res) => {
    try {
        const { team, purchase_desc, system_type, use, amount, total_cost, purchase_import, purchase_note, username } = req.body;
        const currentYear = new Date().getFullYear();
        const newId = Math.max(...db.purchases.map(purchase => purchase.id)) + 1;
        const newSerial = `${currentYear}${(newId).toString().padStart(4, '0')}`;
        const purchaseDir = path.join(UPLOADS_ROOT, newSerial);
        if (!fs.existsSync(purchaseDir)) {
            fs.mkdirSync(purchaseDir, { recursive: true });
            console.log('已建立發票資料夾：', purchaseDir);
        }
        const newPurchase = {
            id: newId,
            team,
            purchase_desc,
            system_type,
            use,
            amount,
            total_cost,
            purchase_import,
            purchase_note,
            status: '待審核',
            username,
            created_at: new Date().toISOString(),
            purchase_date: new Date().toISOString(),
            serial_number: newSerial,
            invoice_files: [],
            school_reimbursement_status: '未報帳',
            repayment_date: new Date().toISOString(),
        };
        db.purchases.push(newPurchase);
        saveData(db);
        res.json({ message: '採購申請已提交', purchase: newPurchase });
    } catch (err) {
        console.error('新增採購記錄錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

/*
 * 獲取採購列表 API
 * 端點：GET /api/purchase
 */
router.get('/', async(req, res) => {
    try {
        let purchases = [...db.purchases];
        purchases.sort((a, b) => b.serial_number.localeCompare(a.serial_number));
        res.json(purchases);
    } catch (err) {
        console.error('獲取採購列表錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

/*
 * 更新採購申請 API
 * 端點：POST /api/purchase/update
 */
router.post('/update', (req, res) => {
    try {
        const {
            id,
            team,
            purchase_desc,
            system_type,
            use,
            amount,
            total_cost,
            purchase_import,
            purchase_note
        } = req.body;
        const pid = parseInt(id, 10);
        const purchase = db.purchases.find(p => p.id === pid);
        if (!purchase) {
            return res.status(404).json({ message: '找不到該筆申請' });
        }
        if (purchase.status !== '待審核') {
            return res.status(400).json({ message: '僅能修改待審核的申請' });
        }
        if (team) purchase.team = team;
        if (purchase_desc) purchase.purchase_desc = purchase_desc;
        if (system_type) purchase.system_type = system_type;
        if (use) purchase.use = use;
        if (amount) purchase.amount = amount;
        if (total_cost !== undefined) purchase.total_cost = total_cost;
        if (purchase_import) purchase.purchase_import = purchase_import;
        purchase.purchase_note = (purchase_note !== undefined) ? purchase_note : purchase.purchase_note;
        saveData(db);
        res.json({
            message: '更新成功',
            data: purchase
        });
    } catch (err) {
        console.error('更新採購申請錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

/*
 * 刪除採購記錄 API
 * 端點：DELETE /api/purchase/:id
 */
router.delete('/:id', async(req, res) => {
    try {
        const { id } = req.params;
        const purchaseIndex = db.purchases.findIndex(p => p.id === parseInt(id));
        if (purchaseIndex === -1) {
            return res.status(404).json({ message: '找不到採購記錄' });
        }
        db.purchases.splice(purchaseIndex, 1);
        saveData(db);
        res.json({ message: '採購記錄已刪除' });
    } catch (err) {
        console.error('刪除採購記錄錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

/*
 * 審核採購申請 API
 * 端點：PUT /api/purchase/:id/approve
 */
router.put('/:id/approve', async(req, res) => {
    const id = req.params.id;
    try {
        const purchase = db.purchases.find(p => p.id === parseInt(id));
        if (!purchase) {
            return res.status(404).json({ message: '找不到該申請' });
        }
        purchase.status = '通過';
        saveData(db);
        res.json({ message: '申請已通過', purchase });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

/*
 * 更新審核狀態 API
 * 端點：PUT /api/purchase/:serial_number/status
 */
router.put('/:serial_number/status', async(req, res) => {
    const purchaseSerialNumber = req.params.serial_number;
    const { status } = req.body;
    try {
        const purchase = db.purchases.find(p => p.serial_number === purchaseSerialNumber);
        if (!purchase) {
            return res.status(404).json({ success: false, message: '找不到該申請' });
        }
        purchase.status = status;
        saveData(db);
        res.json({
            success: true,
            message: '狀態更新成功',
            purchase
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

module.exports = router;