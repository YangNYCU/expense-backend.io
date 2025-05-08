const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

// 建立 readline 介面
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 提示輸入密碼的函數
function promptPassword() {
    return new Promise((resolve) => {
        rl.question('請輸入密碼以開啟資料庫: ', (password) => {
            resolve(password);
        });
    });
}

// 加密函數
function encrypt(text, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        encrypted: encrypted.toString('hex')
    };
}

// 解密函數
function decrypt(encryptedData, password) {
    try {
        const salt = Buffer.from(encryptedData.salt, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const key = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(Buffer.from(encryptedData.encrypted, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        throw new Error('密碼錯誤或檔案已損壞');
    }
}

// 加密檔案
async function encryptFile(inputPath, outputPath) {
    const password = await promptPassword();
    const data = fs.readFileSync(inputPath, 'utf8');
    const encryptedData = encrypt(data, password);
    fs.writeFileSync(outputPath, JSON.stringify(encryptedData));
    rl.close();
}

// 解密檔案
async function decryptFile(inputPath) {
    const password = await promptPassword();
    const encryptedData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const decryptedData = decrypt(encryptedData, password);
    rl.close();
    return decryptedData;
}

module.exports = {
    encryptFile,
    decryptFile
};