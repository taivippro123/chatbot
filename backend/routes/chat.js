const express = require('express');
const app = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Chat với AI
app.post('/', authenticateToken, upload.array('images'), async (req, res) => {
  try {
    const { text, conversation_id } = req.body;
    let conversationId = conversation_id;

    // Lấy hoặc tạo cuộc hội thoại mới
    if (conversation_id) {
      // Kiểm tra cuộc hội thoại tồn tại
      req.db.query(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversation_id, req.user.id],
        async (err, conversations) => {
          if (err) {
            console.error('Get conversation error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          if (conversations.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc hội thoại' });
          }

          await processChat(req, res, conversationId, text);
        }
      );
    } else {
      // Tạo cuộc hội thoại mới
      req.db.query(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
        [req.user.id, text?.substring(0, 50) + '...' || 'New Chat'],
        async (err, result) => {
          if (err) {
            console.error('Create conversation error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          conversationId = result.insertId;
          await processChat(req, res, conversationId, text);
        }
      );
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      message: 'Lỗi xử lý tin nhắn',
      error: error.message 
    });
  }
});

// Hàm xử lý chat
async function processChat(req, res, conversationId, text) {
  try {
    let userImageUrls = [];
    let imageDataArray = [];

    if (req.files && req.files.length > 0) {
      // Xử lý và tải nhiều ảnh lên Cloudinary
      for (const file of req.files) {
        const processedImage = await sharp(file.buffer)
          .resize(512, 512, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();

        const cloudinaryResult = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${processedImage.toString('base64')}`
        );
        userImageUrls.push(cloudinaryResult.secure_url);
        imageDataArray.push(processedImage.toString('base64'));
      }
    }

    // Lưu tin nhắn người dùng với nhiều ảnh
    req.db.query(
      'INSERT INTO messages (conversation_id, sender, text, image_urls) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', text || '', userImageUrls.length > 0 ? JSON.stringify(userImageUrls) : null],
      async (err, result) => {
        if (err) {
          console.error('Create user message error:', err);
          return res.status(500).json({ message: 'Lỗi server' });
        }

        const userMessageId = result.insertId;

        // Chuẩn bị nội dung cho Gemini API
        const contents = [];
        if (imageDataArray.length > 0) {
          // Add text and all images to the content
          const parts = [{ text: text || '' }];
          imageDataArray.forEach(imageData => {
            parts.push({
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData
              }
            });
          });
          contents.push({ parts });
        } else {
          contents.push({
            parts: [{ text: text || '' }]
          });
        }

        try {
          // Gọi API Gemini
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có phản hồi từ AI.';

          // Lưu phản hồi của AI
          req.db.query(
            'INSERT INTO messages (conversation_id, sender, text) VALUES (?, ?, ?)',
            [conversationId, 'ai', aiResponse],
            async (err, result) => {
              if (err) {
                console.error('Create AI message error:', err);
                return res.status(500).json({ message: 'Lỗi server' });
              }

              const aiMessageId = result.insertId;

              // Lấy cả hai tin nhắn để trả về
              req.db.query(
                'SELECT * FROM messages WHERE id IN (?, ?)',
                [userMessageId, aiMessageId],
                (err, messages) => {
                  if (err) {
                    console.error('Get messages error:', err);
                    return res.status(500).json({ message: 'Lỗi server' });
                  }

                  const userMessage = messages.find(m => m.id === userMessageId);
                  const aiMessage = messages.find(m => m.id === aiMessageId);

                  // Parse image_urls back to array if it exists
                  if (userMessage && userMessage.image_urls) {
                    try {
                      userMessage.images = JSON.parse(userMessage.image_urls);
                    } catch (e) {
                      console.error('Error parsing image_urls:', e);
                      userMessage.images = [];
                    }
                  }

                  res.json({
                    conversation_id: conversationId,
                    userMessage,
                    aiMessage
                  });
                }
              );
            }
          );
        } catch (error) {
          console.error('Gemini API error:', error);
          res.status(500).json({ 
            message: 'Lỗi khi gọi API Gemini',
            error: error.message 
          });
        }
      }
    );
  } catch (error) {
    console.error('Process chat error:', error);
    res.status(500).json({ 
      message: 'Lỗi xử lý tin nhắn',
      error: error.message 
    });
  }
}

module.exports = app;
