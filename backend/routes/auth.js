const express = require('express');
const app = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Auth route error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Register
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.log('Register request body:', req.body); // Log full request body
    console.log('Register request headers:', req.headers); // Log request headers
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields' 
      });
    }

    // Check if user already exists
    const [rows] = await req.db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await req.db.promise().query(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );

    // Create default settings
    await req.db.promise().query(
      'INSERT INTO settings (user_id, language, theme) VALUES (?, ?, ?)',
      [result.insertId, 'vi', 'light']
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Get created user
    const [users] = await req.db.promise().query(
      'SELECT id, email, name FROM users WHERE id = ?',
      [result.insertId]
    );

    const response = {
      success: true,
      token,
      user: users[0]
    };

    console.log('Register success response:', response); // Log full response
    res.status(201).json(response);
  } catch (error) {
    console.error('Register error:', error); // Log detailed error
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login request body:', req.body); // Log full request body
    console.log('Login request headers:', req.headers); // Log request headers

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email and password' 
      });
    }

    // Find user
    const [rows] = await req.db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const user = rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    };

    console.log('Login success response:', response); // Log full response
    res.json(response);
  } catch (error) {
    console.error('Login error:', error); // Log detailed error
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Change password
app.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user
    req.db.query(
      'SELECT password FROM users WHERE id = ?',
      [userId],
      async (err, results) => {
        if (err) {
          console.error('Change password error:', err);
          return res.status(500).json({ message: 'Lỗi server' });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const user = results[0];

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        req.db.query(
          'UPDATE users SET password = ? WHERE id = ?',
          [hashedPassword, userId],
          (err) => {
            if (err) {
              console.error('Change password error:', err);
              return res.status(500).json({ message: 'Lỗi server' });
            }

            res.json({ message: 'Đổi mật khẩu thành công' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Get current user
app.get('/me', authenticateToken, (req, res) => {
  req.db.query(
    'SELECT id, email, name, avatar_url, dateOfBirth FROM users WHERE id = ?',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('Get user error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      res.json(results[0]);
    }
  );
});

module.exports = app; 