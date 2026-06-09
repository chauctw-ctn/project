// Phần 1: Khai báo thư viện và Khởi tạo ứng dụng (Import & Init)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Phần 2: Kết nối đến Cơ sở dữ liệu (Database Connection)
const db = new sqlite3.Database('./data/mysql.db', (err) => {
    if (err) console.error('Lỗi kết nối DB:', err.message);
    else console.log('Đã kết nối tới SQLite Database.');
});

// Phần 3: Cấu hình thư mục chứa giao diện Web (Static Files Middleware)
app.use(express.static(path.join(__dirname, 'public')));

// Phần 4: Xử lý Logic API (API Endpoint Router)
app.get('/api/water-data', (req, res) => {
    const sql = `SELECT id, station_id, ts, parameter, value FROM station_readings ORDER BY ts DESC LIMIT 500`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Lỗi truy vấn DB:', err.message);
            res.status(500).json({ error: 'Lỗi truy vấn DB' });
        } else {
            res.json(rows);
        }
    });
});

// Phần 5: Khởi động Server (Start Server)
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});