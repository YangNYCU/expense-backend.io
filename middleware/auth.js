const jwt = require('jsonwebtoken');
const { secretKey } = require('../config/config');

// JWT 驗證中間件
// 檢查請求標頭中的 Authorization token
// 如果驗證成功，將使用者資訊加入請求物件
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

//
// 產生 JWT 權杖
// 用於使用者登入成功後產生認證權杖
function generateToken(user) {
    return jwt.sign({ username: user.username, role: user.role },
        secretKey, { expiresIn: '1h' }
    );
}

module.exports = { authenticateToken, generateToken };