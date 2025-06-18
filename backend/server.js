require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const cloudinary = require('cloudinary').v2;

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Tạo kết nối MySQL Pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatbot',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  charset: 'utf8mb4'
});


// Kiểm tra kết nối database
db.getConnection((err, connection) => {
  if (err) {
    console.error('Lỗi kết nối database:', err);
    return;
  }
  console.log('Đã kết nối thành công đến MySQL');
  connection.release();
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Thêm db vào request để sử dụng trong các route
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/speech', require('./routes/speech'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/news', require('./routes/news'));
app.use('/api/tts', require('./routes/tts'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
