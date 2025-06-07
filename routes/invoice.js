const path = require('path');
const fs = require('fs');
const { saveData } = require('../utils/db');
const { UPLOADS_ROOT } = require('../config/config');
const db = require('../models/database');

async function handleInvoiceRequest(req, res, body) {
    const { method, url } = req;

    const uploadMatch = url.match(/^\/upload\/(.+)$/);
    if (method === 'POST' && uploadMatch) {
        return await handleUpload(req, res, uploadMatch[1]);
    }

    const updateMatch = url.match(/^\/update\/(.+)$/);
    if (method === 'PUT' && updateMatch) {
        return await handleUpdate(req, res, updateMatch[1], body);
    }

    const deleteMatch = url.match(/^\/delete\/(.+)\/(.+)$/);
    if (method === 'DELETE' && deleteMatch) {
        return await handleDelete(req, res, deleteMatch[1], deleteMatch[2]);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
}

async function handleUpload(req, res, serial_number) {
    try {
        const dir = path.join(UPLOADS_ROOT, serial_number);
        fs.mkdirSync(dir, { recursive: true });

        const { fields, files } = await multipartBodyParser(req);

        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        if (!purchase) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到採購' }));
        }

        const filesStored = [];
        for (const file of files.files) {
            const newName = Date.now() + '_' + file.originalFilename;
            const newPath = path.join(dir, newName);
            fs.renameSync(file.path, newPath);
            filesStored.push(newName);
        }

        purchase.invoice_files = [...(purchase.invoice_files || []), ...filesStored];
        saveData(db);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: '發票上傳成功', files: filesStored }));

    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '上傳失敗' }));
    }
}

async function handleUpdate(req, res, idStr, body) {
    const id = parseInt(idStr, 10);
    const { purchaseDate, actualPrice } = body;
    if (!purchaseDate && !actualPrice) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '請提供採購日期和實際金額' }));
    }
    const purchase = db.purchases.find(p => p.id === id);
    if (!purchase) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: '找不到該筆記錄' }));
    }
    purchase.purchase_date = purchaseDate;
    purchase.actual_price = actualPrice;
    saveData(db);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
        message: '更新成功',
        purchase
    }));
}

async function handleDelete(req, res, serial_number, filename) {
    try {
        const decoded = decodeURIComponent(filename);
        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        if (!purchase) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: '找不到對應的採購記錄' }));
        }
        const filePath = path.join(UPLOADS_ROOT, serial_number, decoded);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('已刪除檔案：', filePath);
        }
        purchase.invoice_files = (purchase.invoice_files || []).filter(f => f !== decoded);
        saveData(db);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            message: '檔案已成功刪除',
            updatedFiles: purchase.invoice_files
        }));
    } catch (err) {
        console.error('刪除檔案失敗：', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: '刪除檔案失敗', error: err.message }));
    }
}

module.exports = handleInvoiceRequest;