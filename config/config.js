const path = require('path');
module.exports = {
    port: 5001,
    DB_FILE_PATH: path.join(__dirname, '../database.json'),
    UPLOADS_ROOT: path.join(__dirname, '../uploads'),
};