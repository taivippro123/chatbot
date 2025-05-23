const express = require('express');
const app = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user settings
app.get('/', authenticateToken, (req, res) => {
  req.db.query(
    'SELECT * FROM settings WHERE user_id = ?',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('Get settings error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy cài đặt' });
      }

      res.json(results[0]);
    }
  );
});

// Update settings
app.put('/', authenticateToken, (req, res) => {
  const { language, theme } = req.body;

  // Validate language and theme values
  const validLanguages = ['vi', 'en'];
  const validThemes = ['light', 'dark'];

  if (language && !validLanguages.includes(language)) {
    return res.status(400).json({ message: 'Ngôn ngữ không hợp lệ' });
  }

  if (theme && !validThemes.includes(theme)) {
    return res.status(400).json({ message: 'Giao diện không hợp lệ' });
  }

  // Get current settings first
  req.db.query(
    'SELECT * FROM settings WHERE user_id = ?',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('Get settings error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy cài đặt' });
      }

      const currentSettings = results[0];
      const newLanguage = language || currentSettings.language;
      const newTheme = theme || currentSettings.theme;

      // Update settings
      req.db.query(
        'UPDATE settings SET language = ?, theme = ? WHERE user_id = ?',
        [newLanguage, newTheme, req.user.id],
        (err) => {
          if (err) {
            console.error('Update settings error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          res.json({
            message: 'Cập nhật cài đặt thành công',
            settings: {
              id: currentSettings.id,
              user_id: req.user.id,
              language: newLanguage,
              theme: newTheme
            }
          });
        }
      );
    }
  );
});

module.exports = app; 