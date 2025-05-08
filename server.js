const express = require('express');
const cors = require('cors');
const path = require('path');
const { port, UPLOADS_ROOT } = require('./config/config');
const authRoutes = require('./routes/auth');
const purchaseRoutes = require('./routes/purchase');
const invoiceRoutes = require('./routes/invoice');
const userRoutes = require('./routes/user');
const reimbursementRoutes = require('./routes/reimbursement');
const statsRoutes = require('./routes/stats');

const app = express();

// 中間件設定
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());
app.use('/Uploads', express.static(UPLOADS_ROOT));

// 路由設定
app.use('/api/auth', authRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/stats', statsRoutes);

app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://0.0.0.0:${port}`);
});