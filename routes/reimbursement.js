const express = require('express');
const { saveData } = require('../utils/db');
const db = require('../models/database');

const router = express.Router();


//更新學校報帳狀態 API
//端點：PUT /api/reimbursements

router.put('/', async(req, res) => {
    const { purchaseIds, reimbursementId } = req.body;
    if (!Array.isArray(purchaseIds) || purchaseIds.length === 0 || purchaseIds.length > 5) {
        return res.status(400).json({ message: '請選擇1-5筆待報帳的記錄' });
    }
    if (!reimbursementId) {
        return res.status(400).json({ message: '請提供學校報帳編號' });
    }
    const updated = [];
    for (const rawId of purchaseIds) {
        const id = parseInt(rawId, 10);
        const p = db.purchases.find(x => x.id === id);
        if (!p) {
            return res.status(404).json({ message: `找不到 id=${id} 的記錄` });
        }
        if (p.status !== '通過') {
            return res.status(400).json({ message: `序號 ${p.serial_number} 尚未通過審核` });
        }
        if (!p.invoice_files || p.invoice_files.length === 0) {
            return res.status(400).json({ message: `序號 ${p.serial_number} 尚未上傳發票` });
        }
        p.school_reimbursement_id = reimbursementId;
        p.school_reimbursement_status = '已報帳';
        updated.push(p);
    }
    saveData(db);
    res.json({ message: '報帳狀態更新成功', updatedRecords: updated });
});


//更新學校報帳狀態 API
//端點：PUT /api/reimbursements/:serial_number/reimbursement-status

router.put('/:serial_number/reimbursement-status', async(req, res) => {
    const serial_number = req.params.serial_number;
    const { status, repayment_date } = req.body;
    const validStatuses = ['無發票', '未送出', '已送出', '學校匯款', '已還款'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: '無效的狀態值' });
    }
    const p = db.purchases.find(x => x.serial_number === serial_number);
    if (!p) {
        return res.status(404).json({ message: '找不到該筆記錄' });
    }
    p.school_reimbursement_status = status;
    if (repayment_date) {
        p.repayment_date = repayment_date;
    }
    saveData(db);
    res.json({ message: '學校報帳狀態更新成功', purchase: p });
});


//獲取已向學校報帳列表 API
//端點：GET /api/reimbursements

router.get('/', (req, res) => {
    try {
        const reimbursementList = db.purchases
            .filter(p => ['已送出', '學校匯款', '已還款'].includes(p.school_reimbursement_status))
            .map(purchase => {
                const user = db.users.find(u => u.username === purchase.username) || {};
                return {
                    serial_number: purchase.serial_number,
                    purchase_date: purchase.purchase_date,
                    username: purchase.username,
                    email: user.email || '',
                    purchase_desc: purchase.purchase_desc,
                    actual_price: purchase.actual_price || purchase.total_cost,
                    bank: user.bank || '',
                    bank_account: user.bank_account || '',
                    school_reimbursement_status: purchase.school_reimbursement_status || '',
                    repayment_date: purchase.repayment_date || ''
                };
            });
        res.json({
            success: true,
            data: reimbursementList
        });
    } catch (err) {
        console.error('獲取報帳列表錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

module.exports = router;