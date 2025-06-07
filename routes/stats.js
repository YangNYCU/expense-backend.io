const express = require('express');
const db = require('../models/database');

const router = express.Router();

/*
 * 獲取統計數據 API
 * 端點：GET /api/stats
 */
router.get('/', (req, res) => {
    try {
        // Calculate statistics
        const totalPurchases = db.purchases.length;
        const totalCost = db.purchases.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
        const pendingApprovals = db.purchases.filter(p => p.status === '待審核').length;
        const reimbursedAmount = db.purchases
            .filter(p => ['已送出', '學校匯款', '已還款'].includes(p.school_reimbursement_status))
            .reduce((sum, p) => sum + (parseFloat(p.actual_price) || parseFloat(p.total_cost) || 0), 0);

        res.json({
            success: true,
            totalPurchases,
            totalCost,
            pendingApprovals,
            reimbursedAmount
        });
    } catch (err) {
        console.error('獲取統計數據錯誤:', err);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

module.exports = router;