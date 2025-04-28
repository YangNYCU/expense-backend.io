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
    purchases: [],
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
        const currentYear = new Date().getFullYear();
        const newId = Math.max(...db.purchases.map(purchase => purchase.id)) + 1;
        const newSerial = `${currentYear}${(newId).toString().padStart(4, '0')}`;
        const purchaseDir = path.join(UPLOADS_ROOT, newSerial);
        if (!fs.existsSync(purchaseDir)) {
            fs.mkdirSync(purchaseDir, { recursive: true });
            console.log('已建立發票資料夾：', purchaseDir);
        }
        // 確保 uploads 目錄存在
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
        res.json(purchases);
    } catch (err) {
        console.error('獲取採購列表錯誤:', err);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});
// 更新採購申請（僅限本人或財務，且狀態必須仍為「待審核」）
app.post('/api/purchase/update', authenticateToken, (req, res) => {
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
        // 1. 取得目標申請
        const pid = parseInt(id, 10);
        const purchase = db.purchases.find(p => p.id === pid);
        if (!purchase) {
            return res.status(404).json({ message: '找不到該筆申請' });
        }
        // 2. 權限檢查
        if (req.user.role !== 'finance' && purchase.username !== req.user.username) {
            return res.status(403).json({ message: '無權限修改此申請' });
        }
        // 3. 只能修改「待審核」狀態
        if (purchase.status !== '待審核') {
            return res.status(400).json({ message: '僅能修改待審核的申請' });
        }
        // 4. 更新欄位（如未傳入維持原值）
        if (team) purchase.team = team;
        if (purchase_desc) purchase.purchase_desc = purchase_desc;
        if (system_type) purchase.system_type = system_type;
        if (use) purchase.use = use;
        if (amount) purchase.amount = amount;
        if (total_cost) purchase.total_cost = total_cost;
        if (purchase_import) purchase.purchase_import = purchase_import;
        purchase.purchase_note = (purchase_note !== undefined) ? purchase_note : purchase.purchase_note;
        saveData(); // 寫回 database.json
        res.json({
            message: '更新成功',
            data: purchase
        });
    } catch (err) {
        console.error('更新採購申請錯誤：', err);
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
    if (!purchaseDate && !actualPrice) {
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

// 【更新審核狀態】PUT /api/purchase/:serial_number/status
app.put('/api/purchase/:serial_number/status', authenticateToken, async(req, res) => {
    const purchaseSerialNumber = req.params.serial_number;
    const { status } = req.body;
    try {
        // 從記憶體中找到對應採購資料
        const purchase = db.purchases.find(p => p.serial_number === purchaseSerialNumber);
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
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    try {
        // ▲▲ 1. 參數應該是 id，不是 username
        const userId = parseInt(req.params.id, 10);
        // ▲▲ 2. 找出使用者索引
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ message: '找不到該用戶' });
        }
        // ▲▲ 3. 禁止刪除財務人員
        if (db.users[userIndex].role === 'finance') {
            return res.status(403).json({ message: '無法刪除財務人員帳號' });
        }
        const username = db.users[userIndex].username; // 待會要用來找採購紀錄
        // ▲▲ 4. 砍掉使用者
        db.users.splice(userIndex, 1);
        saveData(); // ▲▲ 5. 寫回檔案
        res.json({ message: '用戶與其採購紀錄已成功刪除' });
    } catch (err) {
        console.error('刪除用戶時發生錯誤：', err);
        res.status(500).json({ message: '伺服器錯誤' });
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
        const decoded = decodeURIComponent(filename);
        const purchase = db.purchases.find(p => p.serial_number === serial_number);
        // 從資料庫中移除檔案 URL
        if (!purchase) {
            return res.status(404).json({ message: '找不到對應的採購記錄' });
        }
        const filePath = path.join(UPLOADS_ROOT, serial_number, decoded);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('已刪除檔案：', filePath);
        }
        purchase.invoice_files = (purchase.invoice_files || []).filter(f => f !== decoded);
        saveData();
        res.json({
            message: '檔案已成功刪除',
            updatedFiles: purchase.invoice_files
        });
    } catch (err) {
        console.error('刪除檔案失敗：', err);
        res.status(500).json({ message: '刪除檔案失敗', error: err.message });
    }
});

// 【更新學校報帳狀態】PUT /api/purchase/reimbursement
app.put('/api/purchase/reimbursement', authenticateToken, async(req, res) => {
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
        // 更新欄位
        p.school_reimbursement_id = reimbursementId;
        p.school_reimbursement_status = '已報帳';
        updated.push(p);
    }
    saveData();
    res.json({ message: '報帳狀態更新成功', updatedRecords: updated });
});

// 【更新學校報帳狀態】PUT /api/purchase/:serial_number/reimbursement-status
app.put('/api/purchase/:serial_number/reimbursement-status', authenticateToken, async(req, res) => {
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
    console.log(p);
    saveData();
    res.json({ message: '學校報帳狀態更新成功', purchase: p });
});

// 【獲取已向學校報帳列表】GET /api/reimbursements
app.get('/api/reimbursements', authenticateToken, (req, res) => {
    try {
        // 篩選已報帳的採購記錄
        const reimbursementList = db.purchases
            .filter(p => p.school_reimbursement_status === '已送出' || '學校匯款' || '已還款')
            .map(purchase => {
                // 查找對應的用戶信息
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

app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://0.0.0.0:${port}`);
    console.log('數據文件路徑:', DB_FILE_PATH);
    loadData();
});