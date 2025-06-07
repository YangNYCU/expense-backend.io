const db = require('../models/database');

function handleStatsRequest(req, res) {
    try {
        // Calculate statistics
        const totalPurchases = db.purchases.length;
        const totalCost = db.purchases.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
        const pendingApprovals = db.purchases.filter(p => p.status === '待審核').length;
        const reimbursedAmount = db.purchases
            .filter(p => ['已送出', '學校匯款', '已還款'].includes(p.school_reimbursement_status))
            .reduce((sum, p) => sum + (parseFloat(p.actual_price) || parseFloat(p.total_cost) || 0), 0);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            success: true,
            totalPurchases,
            totalCost,
            pendingApprovals,
            reimbursedAmount
        }));
    } catch (err) {
        console.error('獲取統計數據錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: '伺服器錯誤'
        }));
    }
}

module.exports = handleStatsRequest;