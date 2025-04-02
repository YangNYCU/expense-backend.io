# 報帳系統

這是一個專為團隊設計的報帳系統，用於管理採購申請、發票上傳和學校報帳流程。

## 功能特點

### 用戶管理
- 用戶註冊與登入
- 角色分為一般用戶和財務人員
- 個人資料管理（Email、銀行資訊等）

### 採購申請
- 新增採購申請
- 修改待審核的採購申請
- 刪除待審核的採購申請
- 匯出採購資料為 Excel

### 發票上傳
- 上傳發票照片
- 更新採購日期和實際金額
- 查看已上傳的發票

### 財務審核
- 審核採購申請（通過/未通過）
- 審核新成員註冊
- 管理用戶列表
- 學校報帳處理

### 學校報帳狀態追蹤
- 無發票
- 未送出
- 已送出
- 學校匯款
- 已還款

## 技術架構

### 前端
- HTML/CSS/JavaScript
- 使用原生 JavaScript 實現前端功能
- 響應式設計，支援不同設備

### 後端
- Node.js + Express
- PostgreSQL 資料庫
- JWT 身份驗證
- 檔案上傳功能

## 安裝與設定

### 前置需求
- Node.js
- PostgreSQL 資料庫

### 安裝步驟
1. 克隆專案到本地
   ```
   git clone [專案網址]
   cd expense-backend
   ```

2. 安裝依賴套件
   ```
   npm install
   ```

3. 設定資料庫連線
   - 在 `server.js` 中修改 PostgreSQL 連線設定

4. 啟動伺服器
   ```
   node server.js
   ```

5. 開啟瀏覽器訪問
   ```
   http://localhost:5001
   ```

## 使用指南

### 一般用戶
1. 註冊帳號並等待財務人員審核
2. 登入系統後，可以：
   - 提交採購申請
   - 修改待審核的申請
   - 上傳發票
   - 查看個人資料

### 財務人員
1. 登入系統後，可以：
   - 審核採購申請
   - 審核新成員註冊
   - 管理用戶列表
   - 處理學校報帳
   - 更新報帳狀態

## 資料庫結構

### users 表
- id: 用戶 ID
- username: 用戶名稱
- password: 密碼（加密儲存）
- role: 角色（user/finance）
- email: 電子郵件
- bank: 銀行名稱
- bank_account: 銀行帳號
- status: 狀態（pending/approved/rejected）
- regist_time: 註冊時間

### purchases 表
- id: 採購 ID
- team: 組別
- purchase_desc: 品名
- system_type: 系統類別
- use: 用途類別
- amount: 預計數量和單價
- total_cost: 預計總價
- purchase_import: 是否進口物品
- purchase_note: 備註
- status: 狀態（待審核/通過/未通過）
- username: 申請人
- created_at: 建立時間
- purchase_date: 採購日期
- actual_price: 實際金額
- serial_number: 申請編號
- invoice_files: 發票檔案
- school_reimbursement_id: 學校報帳編號
- school_reimbursement_status: 學校報帳狀態

## 注意事項

- 採購前需填寫採購需求申請表單
- 發票需載明「國立陽明交通大學」為買受人，統一編號「87557573」
- 發票需包含買受人簽名、日期、品項、合計金額和收據專用印章
- 發票品項應盡量詳細，避免只寫「電子材料」或「五金材料」
- 學校核銷後會將款項匯回

## 開發者

- 國立陽明交通大學賽車隊 
- 黃奕揚