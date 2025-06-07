const { saveData } = require('../utils/db');
const db = require('../models/database');

async function handleReimbursementRequest(req, res, body) {
    const { method, url } = req;

    if (url === '/' && method === 'PUT') {
        return await updateReimbursement(req, res, body);
    }
    if (url === '/' && method === 'GET') {
        return await getReimbursements(req, res);
    }

    const statusMatch = url.match(/^\/(.+)\/reimbursement-status$/);
    if (statusMatch && method === 'PUT') {
        return await updateReimbursementStatus(req, res, statusMatch[1], body);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
}

async function updateReimbursement(req, res, body) {
    const { purchaseIds, reimbursementId } = body;
    if (!Array.isArray(purchaseIds) || purchaseIds.length === 0 || purchaseIds.length > 5) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '請選擇1-5筆待報帳的記錄' }));
    }
    if (!reimbursementId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '請提供學校報帳編號' }));
    }
    const updated = [];
    for (const rawId of purchaseIds) {
        const id = parseInt(rawId, 10);
        const p = db.purchases.find(x => x.id === id);
        if (!p) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: `找不到 id=${id} 的記錄` }));
        }
        if (p.status !== '通過') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: `序號 ${p.serial_number} 尚未通過審核` }));
        }
        if (!p.invoice_files || p.invoice_files.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: `序號 ${p.serial_number} 尚未上傳發票` }));
        }
        p.school_reimbursement_id = reimbursementId;
        p.school_reimbursement_status = '已報帳';
        updated.push(p);
    }
    saveData(db);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: '報帳狀態更新成功', updatedRecords: updated }));
}

async function updateReimbursementStatus(req, res, serial_number, body) {
    const { status, repayment_date } = body;
    const validStatuses = ['無發票', '未送出', '已送出', '學校匯款', '已還款'];
    if (!validStatuses.includes(status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '無效的狀態值' }));
    }
    const p = db.purchases.find(x => x.serial_number === serial_number);
    if (!p) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '找不到該筆記錄' }));
    }
    p.school_reimbursement_status = status;
    if (repayment_date) {
        p.repayment_date = repayment_date;
    }
    saveData(db);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: '學校報帳狀態更新成功', purchase: p }));
}

function getReimbursements(req, res) {
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
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: reimbursementList }));
    } catch (err) {
        console.error('獲取報帳列表錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '伺服器錯誤' }));
    }
}

module.exports = handleReimbursementRequest;