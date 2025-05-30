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
    const { message, conversation_id } = req.body;
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

          await processChat(req, res, conversationId, message);
        }
      );
    } else {
      // Tạo cuộc hội thoại mới
      req.db.query(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
        [req.user.id, message.substring(0, 50) + '...'],
        async (err, result) => {
          if (err) {
            console.error('Create conversation error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          conversationId = result.insertId;
          await processChat(req, res, conversationId, message);
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
async function processChat(req, res, conversationId, message) {
  try {
    let userImageUrls = [];
    let imageDataArray = [];

    // Get text from request body
    const text = req.body.text || '';

    if (req.files && req.files.length > 0) {
      // Process and upload multiple images to Cloudinary
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

    // Save user message with multiple images
    req.db.query(
      'INSERT INTO messages (conversation_id, sender, text, image_urls) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', text, userImageUrls.length > 0 ? JSON.stringify(userImageUrls) : null],
      async (err, result) => {
        if (err) {
          console.error('Create user message error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        const userMessageId = result.insertId;

        try {
          // Prepare request for Gemini API
          const parts = [];
          
          // Always add text part first if it exists
          if (text && text.trim()) {
            parts.push({ text: text.trim() });
          }

          // Add image parts if they exist
          imageDataArray.forEach(imageData => {
            parts.push({
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData
              }
            });
          });

          // Ensure there's at least one part
          if (parts.length === 0) {
            parts.push({ text: '' });
          }

          const contents = [{
            parts
          }];

          console.log('Sending to Gemini API:', JSON.stringify({
            ...contents[0],
            parts: contents[0].parts.map(part => ({
              ...part,
              inline_data: part.inline_data ? { mime_type: part.inline_data.mime_type } : undefined
            }))
          }, null, 2));

          // Call Gemini API
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('Gemini API Response:', JSON.stringify(response.data, null, 2));

          const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';

          // Save AI response
          req.db.query(
            'INSERT INTO messages (conversation_id, sender, text) VALUES (?, ?, ?)',
            [conversationId, 'ai', aiResponse],
            async (err, result) => {
              if (err) {
                console.error('Create AI message error:', err);
                return res.status(500).json({ message: 'Server error' });
              }

              const aiMessageId = result.insertId;

              // Get both messages to return
              req.db.query(
                'SELECT * FROM messages WHERE id IN (?, ?)',
                [userMessageId, aiMessageId],
                (err, messages) => {
                  if (err) {
                    console.error('Get messages error:', err);
                    return res.status(500).json({ message: 'Server error' });
                  }

                  const userMessage = messages.find(m => m.id === userMessageId);
                  const aiMessage = messages.find(m => m.id === aiMessageId);

                  // Parse image_urls for user message
                  if (userMessage && userMessage.image_urls) {
                    try {
                      if (Array.isArray(userMessage.image_urls)) {
                        userMessage.images = userMessage.image_urls;
                      } else if (typeof userMessage.image_urls === 'string' && userMessage.image_urls.startsWith('[')) {
                        userMessage.images = JSON.parse(userMessage.image_urls);
                      } else if (typeof userMessage.image_urls === 'string' && userMessage.image_urls.startsWith('http')) {
                        userMessage.images = [userMessage.image_urls];
                      } else {
                        userMessage.images = [];
                      }
                    } catch (e) {
                      console.error('Error parsing image_urls:', e);
                      userMessage.images = userImageUrls;
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
          console.error('Gemini API error:', error.response?.data || error);
          if (error.response?.status === 429) {
            return res.status(429).json({
              message: 'API quota exceeded. Please try again later.',
              error: 'QUOTA_EXCEEDED'
            });
          }
          res.status(500).json({
            message: 'Error calling Gemini API',
            error: error.message
          });
        }
      }
    );
  } catch (error) {
    console.error('Process chat error:', error);
    res.status(500).json({
      message: 'Error processing message',
      error: error.message
    });
  }
}

module.exports = app;
