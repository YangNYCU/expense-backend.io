const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 5001;
const secretKey = 'your_secret_key';

// 定義資料庫檔案的絕對路徑
const DB_FILE_PATH = path.join(__dirname, 'database.json');
const UPLOADS_ROOT = path.join(__dirname, 'uploads');

// 內存數據存儲
const db = {
    users: [
        // 添加一個預設管理員帳號
        {
            id: 1,
            username: 'admin',
            // 密碼為 'admin'，使用 bcrypt 加密
            password: '$2b$10$8KvHKf.WKgkG5hGWzrVTxOEZ98P.3z6H8P1OUFsXCzF1bHrz3EKVi',
            role: 'finance',
            email: 'admin@example.com',
            status: 'approved',
            regist_time: new Date().toISOString()
        }
    ],
    purchases: []
};

// 資料持久化
function saveData() {
    try {
        // 使用 sync 版本確保寫入完成
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
        console.log('數據已保存到文件:', DB_FILE_PATH);
    } catch (err) {
        console.error('保存數據錯誤:', err);
        // 添加更多錯誤信息
        console.error('錯誤詳情:', {
            path: DB_FILE_PATH,
            error: err.message,
            stack: err.stack
        });
    }
}

// 載入資料
function loadData() {
    try {
        if (fs.existsSync(DB_FILE_PATH)) {
            const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
            Object.assign(db, JSON.parse(data));
            console.log('數據已從文件載入:', DB_FILE_PATH);
        } else {
            console.log('數據文件不存在，創建新文件');
            saveData();
        }
    } catch (err) {
        console.error('載入數據錯誤:', err);
        // 添加更多錯誤信息
        console.error('錯誤詳情:', {
            path: DB_FILE_PATH,
            error: err.message,
            stack: err.stack
        });
    }
}

// 中間件設定
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JWT 驗證中間件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: '存取權杖缺失' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ message: '無效的存取權杖' });
        }
        req.user = user;
        next();
    });
}

// JWT 產生器
function generateToken(user) {
    return jwt.sign({ username: user.username, role: user.role },
        secretKey, { expiresIn: '1h' }
    );
}

// 註冊 API
app.post('/api/auth/register', async(req, res) => {
    const { username, password, role, email, bank, bank_account } = req.body;

    // 檢查使用者是否已存在
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: '使用者名稱已存在' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role && role === 'finance' ? 'finance' : 'user';

        const newUser = {
            id: db.users.length + 1,
            username,
            password: hashedPassword,
            role: userRole,
            email,
            bank,
            bank_account,
            status: 'pending',
            regist_time: new Date().toISOString()
        };

        db.users.push(newUser);
        saveData();

        res.json({ message: '註冊成功，請等待審核', role: userRole });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 登入 API
app.post('/api/auth/login', async(req, res) => {
    const { username, password } = req.body;

    try {
        // 在內存數據中查找用戶
        const user = db.users.find(u => u.username === username);

        if (!user) {
            return res.status(400).json({ message: '使用者名稱或密碼錯誤' });
        }

        // 檢查用戶狀態
        if (user.status === 'pending') {
            return res.status(403).json({ message: '您的帳號正在審核中，請等待審核通過後再登入' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: '您的註冊申請已被拒絕' });
        }

        // 驗證密碼
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ message: '使用者名稱或密碼錯誤' });
        }

        // 生成 JWT token
        const token = generateToken(user);

        // 返回成功響應
        res.json({
            token,
            role: user.role,
            message: '登入成功'
        });
    } catch (err) {
        console.error('登入錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 採購申請 API
app.post('/api/purchase', authenticateToken, async(req, res) => {
    try {
        const { team, purchase_desc, system_type, use, amount, total_cost, purchase_import, purchase_note } = req.body;
        const { username } = req.user;
        // 生成序號
        const currentYear = new Date().getFullYear();
        const purchases = db.purchases.filter(p => p.serial_number.startsWith(currentYear.toString()));
        const newSerial = `${currentYear}${(purchases.length + 1).toString().padStart(4, '0')}`;
        const purchaseDir = path.join(UPLOADS_ROOT, newSerial);
        if (!fs.existsSync(purchaseDir)) {
            fs.mkdirSync(purchaseDir, { recursive: true });
            console.log('已建立發票資料夾：', purchaseDir);
        }

        // 確保 uploads 目錄存在
        const newPurchase = {
            id: db.purchases.length + 1,
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
            school_reimbursement_status: '未報帳'
        };
        db.purchases.push(newPurchase);
        saveData();
        res.json({ message: '採購申請已提交', purchase: newPurchase });
    } catch (err) {
        console.error('新增採購記錄錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});
// 獲取採購列表
app.get('/api/purchase', authenticateToken, async(req, res) => {
    try {
        let purchases = [...db.purchases];

        // 排序
        purchases.sort((a, b) => b.serial_number.localeCompare(a.serial_number));

        // 如果不是財務人員，只顯示自己的採購記錄
        if (req.user.role !== 'finance') {
            purchases = purchases.filter(p => p.username === req.user.username);
        }

        res.json(purchases);
    } catch (err) {
        console.error('獲取採購列表錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 刪除採購記錄
app.delete('/api/purchase/:id', authenticateToken, async(req, res) => {
    try {
        const { id } = req.params;
        const purchaseIndex = db.purchases.findIndex(p => p.id === parseInt(id));

        if (purchaseIndex === -1) {
            return res.status(404).json({ message: '找不到採購記錄' });
        }

        // 檢查權限
        if (req.user.role !== 'finance' && db.purchases[purchaseIndex].username !== req.user.username) {
            return res.status(403).json({ message: '權限不足' });
        }

        // 刪除採購記錄
        db.purchases.splice(purchaseIndex, 1);
        saveData();

        res.json({ message: '採購記錄已刪除' });
    } catch (err) {
        console.error('刪除採購記錄錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 【審核採購申請】PUT /api/purchase/:id/approve
app.put('/api/purchase/:id/approve', authenticateToken, async(req, res) => {
    const id = req.params.id;
    try {
        const purchase = db.purchases.find(p => p.id === parseInt(id));
        if (!purchase) {
            return res.status(404).json({ message: '找不到該申請' });
        }
        res.json({ message: '申請已通過', purchase: purchase.rows[0] });
        saveData();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(UPLOADS_ROOT, req.params.serial_number);
            // 若使用者改了 serial 或手動刪資料夾，也能自動補
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            // 時間戳避免重名
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

app.post('/api/invoice/upload/:serial_number',
    authenticateToken,
    upload.array('files'),
    (req, res) => {
        try {
            const { serial_number } = req.params;
            const purchase = db.purchases.find(p => p.serial_number === serial_number);
            if (!purchase) return res.status(404).json({ message: '找不到採購' });

            // 把檔名存到資料庫
            const filesStored = req.files.map(f => f.filename);
            purchase.invoice_files = [...(purchase.invoice_files || []), ...filesStored];
            saveData();

            res.json({ message: '發票上傳成功', files: filesStored });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: '上傳失敗' });
        }
    });

// 【更新發票資訊】PUT /api/invoice/update/:id
app.put('/api/invoice/update/:id', authenticateToken, async(req, res) => {
    const id = parseInt(req.params.id, 10);
    const { purchaseDate, actualPrice } = req.body;
    if (!purchaseDate || !actualPrice) {
        return res.status(400).json({ message: '請提供採購日期和實際金額' });
    }
    const purchase = db.purchases.find(p => p.id === id);
    if (!purchase) {
        return res.status(404).json({ message: '找不到該筆記錄' });
    }
    purchase.purchase_date = purchaseDate;
    purchase.actual_price = actualPrice;
    saveData();
    return res.json({
        message: '更新成功',
        purchase
    });
});

// 【更新審核狀態】PUT /api/purchase/:id/status
app.put('/api/purchase/:id/status', authenticateToken, async(req, res) => {
    const purchaseId = parseInt(req.params.id, 10);
    const { status } = req.body;
    try {
        // 從記憶體中找到對應採購資料
        const purchase = db.purchases.find(p => p.id === purchaseId);
        if (!purchase) {
            return res.status(404).json({ success: false, message: '找不到該申請' });
        }
        // 更新狀態
        purchase.status = status;
        saveData();
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

// 【審核用戶狀態】PUT /api/users/:userId/approve
app.put('/api/users/:userId/approve', authenticateToken, async(req, res) => {
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

        // 更新狀態
        db.users[userIndex].status = status;

        // 保存更改並確認
        console.log('正在保存更改...');
        saveData();

        // 驗證更改是否已保存
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

// 獲取待審核用戶列表
app.get('/api/users/pending', authenticateToken, (req, res) => {
    try {
        // 過濾待審核用戶
        const pendingUsers = db.users
            .filter(user => user.status === 'pending')
            .map(({ password, ...user }) => user); // 移除密碼欄位
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

// 獲取所有用戶列表
app.get('/api/users', authenticateToken, (req, res) => {
    try {
        // 回傳不含密碼的用戶列表
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

// 【刪除用戶】DELETE /api/users/:id
app.delete('/api/users/:id', authenticateToken, async(req, res) => {

    const { id } = req.params;

    try {
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: '找不到該用戶' });
        }

        if (userCheck.rows[0].role === 'finance') {
            return res.status(403).json({ message: '不能刪除財務人員帳號' });
        }

        res.json({ message: '用戶已成功刪除' });
    } catch (err) {
        console.error('刪除用戶時發生錯誤：', err);
        res.status(500).json({ message: '資料庫錯誤' });
    }
});

// 用戶資料相關 API
app.get('/api/users/profile', authenticateToken, (req, res) => {
    try {
        const { username } = req.user;
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '找不到用戶資料'
            });
        }

        // 回傳不含密碼的用戶資料
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

// 修改用戶資料
app.put('/api/users/profile', authenticateToken, async(req, res) => {
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

        // 更新用戶資料
        if (email) db.users[userIndex].email = email;
        if (bank) db.users[userIndex].bank = bank;
        if (bank_account) db.users[userIndex].bank_account = bank_account;

        // 如果有提供新密碼，則更新密碼
        if (password) {
            db.users[userIndex].password = await bcrypt.hash(password, 10);
        }

        // 保存更改
        saveData();

        // 回傳更新後的用戶資料（不含密碼）
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

// 修改刪除發票照片的路由
app.delete('/api/invoice/delete/:serial_number/:filename', authenticateToken, async(req, res) => {
    try {
        const { serial_number, filename } = req.params;
        const decodedFilename = decodeURIComponent(filename);
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

app.listen(port, () => {
    console.log('伺服器運行在 http://localhost:' + port);
    console.log(`伺服器運行在 port ${port}`);
    console.log('數據文件路徑:', DB_FILE_PATH);
    loadData();
});