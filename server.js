const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const app = express();
const port = 5001;
const secretKey = 'your_secret_key'; // 請用環境變數


// 建立 PostgreSQL 連線池
const pool = new Pool({
    user: 'yang',
    host: 'localhost',
    database: 'yang',
    password: '',
    port: 5000, // PostgreSQL 端口
    max: 20, // 連接池最大連接數
    idleTimeoutMillis: 30000, // 連接最大空閒時間
    connectionTimeoutMillis: 2000, // 連接超時時間
});

// 初始化資料庫：若不存在則建立資料表
async function initDB() {
    try {
        // 建立 users 資料表
        await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        email VARCHAR(255),
        bank VARCHAR(255),
        bank_account VARCHAR(255), 
        status VARCHAR(50) DEFAULT 'pending',
        regist_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Users table is ready.');

        // 建立 purchases 資料表
        await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        team VARCHAR(100),
        purchase_desc TEXT,
        system_type VARCHAR(100),
        "use" VARCHAR(100),
        amount TEXT,
        total_cost NUMERIC,
        purchase_import VARCHAR(10),
        purchase_note TEXT,
        status VARCHAR(50) DEFAULT '待審核',
        username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        purchase_date TIMESTAMP,
        actual_price NUMERIC,
        serial_number VARCHAR(20),
        invoice_files TEXT[],
        school_reimbursement_id VARCHAR(50),
        school_reimbursement_status VARCHAR(50) DEFAULT '未報帳'
      );
    `);
        console.log('Purchases table is ready.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

// 提供前端靜態檔案
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

// 提供上傳檔案的靜態存取
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 修改 Multer 設定為記憶體存儲
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 限制檔案大小為 5MB
        files: 10 // 限制最多 10 個檔案
    },
    fileFilter: function(req, file, cb) {
        // 只允許圖片檔案
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允許上傳圖片檔案'), false);
        }
        cb(null, true);
    }
});

// JWT 產生器
function generateToken(user) {
    return jwt.sign({ username: user.username, role: user.role }, secretKey, { expiresIn: '1h' });
}

// 驗證 JWT 的中介軟體
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '存取權杖缺失' });

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.status(403).json({ message: '無效的存取權杖' });
        req.user = user;
        next();
    });
}

// 【註冊】POST /api/auth/register
app.post('/api/auth/register', async(req, res) => {
    const { username, password, role, email, bank, bank_account } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: '使用者名稱已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role && role === 'finance' ? 'finance' : 'user';

        await pool.query(
            'INSERT INTO users (username, password, role, email, bank, bank_account, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [username, hashedPassword, userRole, email, bank, bank_account, 'pending']
        );

        res.json({ message: '註冊成功，請等待審核', role: userRole });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【登入】POST /api/auth/login
app.post('/api/auth/login', async(req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(400).json({ message: '使用者名稱或密碼錯誤' });
        }
        const user = result.rows[0];

        // 檢查用戶狀態
        if (user.status === 'pending') {
            return res.status(403).json({ message: '您的帳號正在審核中，請等待審核通過後再登入' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: '您的註冊申請已被拒絕' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ message: '使用者名稱或密碼錯誤' });
        }
        const token = generateToken(user);
        res.json({ token, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【提交採購申請】POST /api/purchase
app.post('/api/purchase', authenticateToken, async(req, res) => {
    const { team, purchase_desc, system_type, use, amount, total_cost, purchase_import, purchase_note } = req.body;
    const { username } = req.user; // 從 token 中獲取使用者名稱
    try {
        // 開始交易
        await pool.query('BEGIN');
        // 取得當前年份
        const currentYear = new Date().getFullYear();
        // 取得該年度的最新序號
        const lastSerialResult = await pool.query(
            `SELECT serial_number 
             FROM purchases 
             WHERE serial_number LIKE $1 
             ORDER BY serial_number DESC 
             LIMIT 1`, [`${currentYear}%`]
        );
        // 產生新的序號
        let newSerial;
        if (lastSerialResult.rows.length === 0) {
            // 該年度第一筆
            newSerial = `${currentYear}0001`;
        } else {
            // 取得最後一筆序號的數字部分並加1
            const lastNumber = parseInt(lastSerialResult.rows[0].serial_number.slice(4));
            newSerial = `${currentYear}${(lastNumber + 1).toString().padStart(4, '0')}`;
        }
        // 建立資料夾
        const purchaseDir = path.join(__dirname, 'uploads', newSerial);
        try {
            if (!fs.existsSync(purchaseDir)) {
                fs.mkdirSync(purchaseDir, { recursive: true });
                console.log(`已建立資料夾：${purchaseDir}`);
            }
        } catch (err) {
            console.error('建立資料夾時發生錯誤：', err);
            return res.status(500).json({ message: '資料夾建立失敗' });
        }
        // 插入新記錄
        const result = await pool.query(
            `INSERT INTO purchases (
                team, purchase_desc, system_type, "use", 
                amount, total_cost, purchase_import, purchase_note, 
                status, username, serial_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *`, [
                team, purchase_desc, system_type, use,
                amount, total_cost, purchase_import, purchase_note,
                '待審核', username, newSerial
            ]
        );
        // 提交交易
        await pool.query('COMMIT');
        res.json({
            message: '採購申請已提交',
            purchase: result.rows[0]
        });
    } catch (err) {
        // 發生錯誤時回滾交易
        await pool.query('ROLLBACK');
        console.error('Error creating purchase:', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【取得採購紀錄】GET /api/purchase
app.get('/api/purchase', authenticateToken, async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM purchases ORDER BY serial_number ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【審核採購申請】PUT /api/purchase/:id/approve
app.put('/api/purchase/:id/approve', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '您沒有審核權限' });
    }
    const id = req.params.id;
    try {
        const result = await pool.query(
            'UPDATE purchases SET status = $1 WHERE id = $2 RETURNING *', ['通過', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到該申請' });
        }
        res.json({ message: '申請已通過', purchase: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【上傳發票】POST /api/invoice/upload/:serial_number
app.post("/api/invoice/upload/:serial_number", authenticateToken, async(req, res) => {
    try {
        // 使用 multer 處理檔案上傳
        const uploadMiddleware = upload.array('files', 10);

        await new Promise((resolve, reject) => {
            uploadMiddleware(req, res, function(err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: '請選擇檔案' });
        }

        const serialNumber = req.params.serial_number;
        const uploadedFiles = [];

        // 上傳檔案到 Cloudinary
        for (const file of req.files) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({
                        folder: `expense-backend/${serialNumber}`,
                        resource_type: 'auto'
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                uploadStream.end(file.buffer);
            });

            uploadedFiles.push(result.secure_url);
        }

        // 更新資料庫中的檔案 URL
        const result = await pool.query(
            `UPDATE purchases 
             SET invoice_files = COALESCE(invoice_files, ARRAY[]::text[]) || $1::text[],
                 school_reimbursement_status = '1'
             WHERE serial_number = $2 
             RETURNING *`, [uploadedFiles, serialNumber]
        );

        if (result.rows.length === 0) {
            throw new Error('找不到對應的採購記錄');
        }

        res.json({
            message: '發票上傳成功',
            files: uploadedFiles
        });
    } catch (err) {
        console.error('發票上傳失敗：', err);
        res.status(500).json({
            message: '發票上傳失敗',
            error: err.message
        });
    }
});

// 【更新發票資訊】PUT /api/invoice/update/:id
app.put('/api/invoice/update/:id', authenticateToken, async(req, res) => {
    try {
        const id = req.params.id;
        const { purchaseDate, actualPrice } = req.body;

        // 驗證輸入
        if (!purchaseDate || !actualPrice) {
            return res.status(400).json({ message: '請提供採購日期和實際金額' });
        }

        const result = await pool.query(
            `UPDATE purchases 
             SET purchase_date = $1, 
                 actual_price = $2
             WHERE id = $3 
             RETURNING *`, [purchaseDate, actualPrice, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到該筆記錄' });
        }

        res.json({
            message: '更新成功',
            purchase: result.rows[0]
        });
    } catch (err) {
        console.error('更新失敗：', err);
        res.status(500).json({
            message: '更新失敗',
            error: err.message
        });
    }
});

// 【更新審核狀態】PUT /api/purchase/:id/status
app.put('/api/purchase/:id/status', authenticateToken, async(req, res) => {

    const id = req.params.id;
    const { status } = req.body;

    try {
        const result = await pool.query(
            'UPDATE purchases SET status = $1 WHERE id = $2 RETURNING *', [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到該申請' });
        }

        res.json({
            message: '狀態更新成功',
            purchase: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 更新採購申請
app.post('/api/purchase/update', authenticateToken, async(req, res) => {
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
            purchase_note,
            status
        } = req.body;

        // 檢查是否為申請人本人
        const result = await pool.query(
            'SELECT * FROM purchases WHERE id = $1 AND username = $2', [id, req.user.username]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: "無權限修改此申請" });
        }

        const purchase = result.rows[0];

        // 檢查申請狀態是否為待審核
        if (purchase.status !== "待審核") {
            return res.status(400).json({ message: "只能修改待審核的申請" });
        }

        // 更新資料
        const updateResult = await pool.query(
            `UPDATE purchases 
            SET team = $1, 
                purchase_desc = $2, 
                system_type = $3, 
                "use" = $4, 
                amount = $5, 
                total_cost = $6, 
                purchase_import = $7, 
                purchase_note = $8
            WHERE id = $9 AND username = $10
            RETURNING *`, [
                team,
                purchase_desc,
                system_type,
                use,
                amount,
                total_cost,
                purchase_import,
                purchase_note,
                id,
                req.user.username
            ]
        );

        res.json({
            message: "更新成功",
            data: updateResult.rows[0]
        });
    } catch (error) {
        console.error('Error updating purchase:', error);
        res.status(500).json({
            message: "更新失敗",
            error: error.message
        });
    }
});

// 【刪除採購申請】DELETE /api/purchase/:id
app.delete('/api/purchase/:id', authenticateToken, async(req, res) => {
    const id = req.params.id;
    const { username } = req.user;

    try {
        // 檢查是否為申請人本人且狀態為待審核
        const result = await pool.query(
            'SELECT * FROM purchases WHERE id = $1 AND username = $2', [id, username]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: "無權限刪除此申請" });
        }

        const purchase = result.rows[0];

        // 檢查狀態是否為待審核
        if (purchase.status !== "待審核") {
            return res.status(400).json({ message: "只能刪除待審核的申請" });
        }

        // 執行刪除
        await pool.query('DELETE FROM purchases WHERE id = $1', [id]);

        res.json({ message: "刪除成功" });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        res.status(500).json({ message: "刪除失敗", error: error.message });
    }
});

// 【取得待審核成員列表】GET /api/users/pending
app.get('/api/users/pending', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '無權限查看待審核成員' });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, email, bank, bank_account, regist_time FROM users WHERE status = $1', ['pending']
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【審核成員】PUT /api/users/:id/approve
app.put('/api/users/:id/approve', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '無權限審核成員' });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
        if (status === 'rejected') {
            // 如果拒絕，直接刪除該用戶資料
            await pool.query('DELETE FROM users WHERE id = $1', [id]);
            return res.json({ message: '已拒絕該用戶的註冊申請並刪除資料' });
        } else {
            // 如果通過，更新狀態
            const result = await pool.query(
                'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, email, status', [status, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: '找不到該成員' });
            }

            res.json({
                message: '成員審核完成',
                user: result.rows[0]
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【取得所有用戶】GET /api/users
app.get('/api/users', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '無權限查看用戶列表' });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, email, bank, bank_account, role, status, regist_time 
             FROM users 
             ORDER BY regist_time DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【刪除用戶】DELETE /api/users/:id
app.delete('/api/users/:id', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '無權限刪除用戶' });
    }

    const { id } = req.params;

    try {
        // 檢查用戶是否存在且不是財務人員
        const userCheck = await pool.query(
            'SELECT username, role FROM users WHERE id = $1', [id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: '找不到該用戶' });
        }

        if (userCheck.rows[0].role === 'finance') {
            return res.status(403).json({ message: '不能刪除財務人員帳號' });
        }

        // 刪除該用戶的所有相關採購記錄
        await pool.query('DELETE FROM purchases WHERE username = $1', [userCheck.rows[0].username]);

        // 刪除用戶
        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ message: '用戶已成功刪除' });
    } catch (err) {
        console.error('刪除用戶時發生錯誤：', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【獲取用戶資料】GET /api/users/profile
app.get('/api/users/profile', authenticateToken, async(req, res) => {
    try {
        const result = await pool.query(
            `SELECT username, role, email, bank, bank_account, status 
             FROM users 
             WHERE username = $1`, [req.user.username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到用戶資料' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('獲取用戶資料失敗：', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 【更新用戶資料】PUT /api/users/profile
app.put('/api/users/profile', authenticateToken, async(req, res) => {
    try {
        const { email, bank, bank_account, password } = req.body;
        const username = req.user.username;

        // 建立更新欄位的物件
        const updateFields = {};
        const values = [];
        let paramCount = 1;

        if (email) {
            updateFields.email = `$${paramCount}`;
            values.push(email);
            paramCount++;
        }
        if (bank) {
            updateFields.bank = `$${paramCount}`;
            values.push(bank);
            paramCount++;
        }
        if (bank_account) {
            updateFields.bank_account = `$${paramCount}`;
            values.push(bank_account);
            paramCount++;
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.password = `$${paramCount}`;
            values.push(hashedPassword);
            paramCount++;
        }

        // 如果沒有要更新的欄位
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: '沒有提供要更新的資料' });
        }

        // 建立 SQL 更新語句
        const setClause = Object.entries(updateFields)
            .map(([key, value]) => `${key} = ${value}`)
            .join(', ');

        values.push(username);
        const result = await pool.query(
            `UPDATE users 
             SET ${setClause}
             WHERE username = $${paramCount}
             RETURNING username, email, bank, bank_account, role`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到用戶' });
        }

        res.json({
            message: '資料更新成功',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('更新用戶資料失敗：', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 修改刪除發票照片的路由
app.delete('/api/invoice/delete/:serial_number/:filename', authenticateToken, async(req, res) => {
    try {
        const { serial_number, filename } = req.params;
        const decodedFilename = decodeURIComponent(filename);

        // 從 Cloudinary 刪除圖片
        const publicId = decodedFilename.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`expense-backend/${serial_number}/${publicId}`);

        // 從資料庫中移除檔案 URL
        const result = await pool.query(
            `UPDATE purchases 
             SET invoice_files = array_remove(invoice_files, $1)
             WHERE serial_number = $2 
             RETURNING *`, [decodedFilename, serial_number]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '找不到對應的採購記錄' });
        }

        res.json({
            message: '檔案已成功刪除',
            updatedFiles: result.rows[0].invoice_files
        });
    } catch (err) {
        console.error('刪除檔案失敗：', err);
        res.status(500).json({ message: '刪除檔案失敗', error: err.message });
    }
});

// 【更新學校報帳狀態】PUT /api/purchase/reimbursement
app.put('/api/purchase/reimbursement', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '只有財務人員可以進行學校報帳' });
    }

    const { purchaseIds, reimbursementId } = req.body;

    if (!purchaseIds || !Array.isArray(purchaseIds) || purchaseIds.length === 0 || purchaseIds.length > 5) {
        return res.status(400).json({ message: '請選擇1-5筆待報帳的記錄' });
    }

    if (!reimbursementId) {
        return res.status(400).json({ message: '請提供學校報帳編號' });
    }

    try {
        await pool.query('BEGIN');

        // 檢查所有選中的記錄是否都已經通過審核且有發票
        const checkResult = await pool.query(
            `SELECT id, serial_number, status, invoice_files 
             FROM purchases 
             WHERE id = ANY($1)`, [purchaseIds]
        );

        for (const record of checkResult.rows) {
            if (record.status !== '通過') {
                throw new Error(`序號 ${record.serial_number} 尚未通過審核`);
            }
            if (!record.invoice_files || record.invoice_files.length === 0) {
                throw new Error(`序號 ${record.serial_number} 尚未上傳發票`);
            }
        }

        // 更新選中的記錄
        const result = await pool.query(
            `UPDATE purchases 
             SET school_reimbursement_id = $1,
                 school_reimbursement_status = '已報帳'
             WHERE id = ANY($2)
             RETURNING *`, [reimbursementId, purchaseIds]
        );

        await pool.query('COMMIT');

        res.json({
            message: '學校報帳狀態更新成功',
            updatedRecords: result.rows
        });
    } catch (err) {
        // 發生錯誤時回滾交易
        await pool.query('ROLLBACK');
        console.error('更新學校報帳狀態失敗：', err);
        res.status(500).json({
            message: '更新學校報帳狀態失敗',
            error: err.message
        });
    }
});

// 【更新學校報帳狀態】PUT /api/purchase/:id/reimbursement-status
app.put('/api/purchase/:id/reimbursement-status', authenticateToken, async(req, res) => {
    if (req.user.role !== 'finance') {
        return res.status(403).json({ message: '只有財務人員可以更新學校報帳狀態' });
    }

    const id = req.params.id;
    const { status } = req.body;

    // 驗證狀態值
    const validStatuses = ['0', '1', '2', '3', '4'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: '無效的狀態值' });
    }

    try {
        // 檢查記錄是否存在
        const checkResult = await pool.query(
            'SELECT * FROM purchases WHERE id = $1', [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: '找不到該筆記錄' });
        }

        // 更新狀態
        const result = await pool.query(
            'UPDATE purchases SET school_reimbursement_status = $1 WHERE id = $2 RETURNING *', [status, id]
        );

        res.json({
            message: '學校報帳狀態更新成功',
            purchase: result.rows[0]
        });
    } catch (err) {
        console.error('更新學校報帳狀態失敗：', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 啟動伺服器之前先初始化資料庫，再啟動伺服器
initDB().then(() => {
    app.listen(port, () => {
        console.log(`伺服器運行中：http://localhost:${port}`);
    });
});