const path = require('path');
const fs = require('fs');
const { saveData } = require('../utils/db');
const { UPLOADS_ROOT } = require('../config/config');
const db = require('../models/database');

async function handlePurchaseRequest(req, res, body) {
    const { method, url } = req;

    if (url === '/' && method === 'POST') {
        return await createPurchase(req, res, body);
    }
    if (url === '/' && method === 'GET') {
        return await getPurchases(req, res);
    }
    if (url === '/update' && method === 'POST') {
        return await updatePurchase(req, res, body);
    }

    const deleteMatch = url.match(/^\/([0-9]+)$/);
    if (deleteMatch && method === 'DELETE') {
        return await deletePurchase(req, res, deleteMatch[1]);
    }

    const approveMatch = url.match(/^\/([0-9]+)\/approve$/);
    if (approveMatch && method === 'PUT') {
        return await approvePurchase(req, res, approveMatch[1]);
    }

    const statusMatch = url.match(/^\/(.+)\/status$/);
    if (statusMatch && method === 'PUT') {
        return await updateStatus(req, res, statusMatch[1], body);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
}

async function createPurchase(req, res, body) {
    try {
        const { team, purchase_desc, system_type, use, amount, total_cost, purchase_import, purchase_note, username } = body;
        const currentYear = new Date().getFullYear();
        const maxId = db.purchases.length > 0 ? Math.max(...db.purchases.map(purchase => purchase.id)) : 0;
        const newId = maxId + 1;
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
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '採購申請已提交', purchase: newPurchase }));
    } catch (err) {
        console.error('新增採購記錄錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

async function getPurchases(req, res) {
    try {
        let purchases = [...db.purchases];
        purchases.sort((a, b) => b.serial_number.localeCompare(a.serial_number));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(purchases));
    } catch (err) {
        console.error('獲取採購列表錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

async function updatePurchase(req, res, body) {
    try {
        const { id, team, purchase_desc, system_type, use, amount, total_cost, purchase_import, purchase_note } = body;
        const pid = parseInt(id, 10);
        const purchase = db.purchases.find(p => p.id === pid);
        if (!purchase) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到該筆申請' }));
        }
        if (purchase.status !== '待審核') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '僅能修改待審核的申請' }));
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
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '更新成功', data: purchase }));
    } catch (err) {
        console.error('更新採購申請錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

async function deletePurchase(req, res, id) {
    try {
        const purchaseIndex = db.purchases.findIndex(p => p.id === parseInt(id));
        if (purchaseIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到採購記錄' }));
        }
        db.purchases.splice(purchaseIndex, 1);
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '採購記錄已刪除' }));
    } catch (err) {
        console.error('刪除採購記錄錯誤:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '伺服器錯誤' }));
    }
}

async function approvePurchase(req, res, id) {
    try {
        const purchase = db.purchases.find(p => p.id === parseInt(id));
        if (!purchase) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到該申請' }));
        }
        purchase.status = '通過';
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '申請已通過', purchase }));
    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '資料庫錯誤' }));
    }
}

async function updateStatus(req, res, serial_number, body) {
    const { status } = body;
    try {
        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        if (!purchase) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '找不到該申請' }));
        }
        purchase.status = status;
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: '狀態更新成功', purchase }));
    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '資料庫錯誤' }));
    }
}

module.exports = handlePurchaseRequest;