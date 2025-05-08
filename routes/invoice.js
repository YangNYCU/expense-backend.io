const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { saveData } = require('../utils/db');
const { UPLOADS_ROOT } = require('../config/config');
const db = require('../models/database');

const router = express.Router();


//檔案上傳設定

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(UPLOADS_ROOT, req.params.serial_number);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});


//上傳發票 API
//端點：POST /api/invoice/upload/:serial_number

router.post('/upload/:serial_number', authenticateToken, upload.array('files'), (req, res) => {
    try {
        const { serial_number } = req.params;
        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        if (!purchase) return res.status(404).json({ message: '找不到採購' });
        const filesStored = req.files.map(f => f.filename);
        purchase.invoice_files = [...(purchase.invoice_files || []), ...filesStored];
        saveData(db);
        res.json({ message: '發票上傳成功', files: filesStored });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '上傳失敗' });
    }
});


//更新發票資訊 API
//端點：PUT /api/invoice/update/:id

router.put('/update/:id', authenticateToken, async(req, res) => {
    const id = parseInt(req.params.id, 10);
    const { purchaseDate, actualPrice } = req.body;
    if (!purchaseDate && !actualPrice) {
        return res.status(400).json({ message: '請提供採購日期和實際金額' });
    }
    const purchase = db.purchases.find(p => p.id === id);
    if (!purchase) {
        return res.status(404).json({ message: '找不到該筆記錄' });
    }
    purchase.purchase_date = purchaseDate;
    purchase.actual_price = actualPrice;
    saveData(db);
    return res.json({
        message: '更新成功',
        purchase
    });
});


//刪除發票照片 API
//端點：DELETE /api/invoice/delete/:serial_number/:filename

router.delete('/delete/:serial_number/:filename', authenticateToken, async(req, res) => {
    try {
        console.log(req.params);
        const { serial_number, filename } = req.params;
        const decoded = decodeURIComponent(filename);
        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        if (!purchase) {
            return res.status(404).json({ message: '找不到對應的採購記錄' });
        }
        const filePath = path.join(UPLOADS_ROOT, serial_number, decoded);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('已刪除檔案：', filePath);
        }
        purchase.invoice_files = (purchase.invoice_files || []).filter(f => f !== decoded);
        saveData(db);
        res.json({
            message: '檔案已成功刪除',
            updatedFiles: purchase.invoice_files
        });
    } catch (err) {
        console.error('刪除檔案失敗：', err);
        res.status(500).json({ message: '刪除檔案失敗', error: err.message });
    }
});

module.exports = router;