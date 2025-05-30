const express = require('express');
const app = express.Router();
const multer = require('multer');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Get messages for a conversation
app.get('/conversation/:conversationId', authenticateToken, (req, res) => {
  // First verify conversation belongs to user
  req.db.query(
    'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    [req.params.conversationId, req.user.id],
    (err, conversations) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (conversations.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy cuộc hội thoại' });
      }

      // Then get messages
      req.db.query(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [req.params.conversationId],
        (err, messages) => {
          if (err) {
            console.error('Get messages error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          // Parse image_urls JSON for each message
          messages = messages.map(message => {
            if (message.image_urls) {
              try {
                message.images = JSON.parse(message.image_urls);
              } catch (e) {
                console.error('Error parsing image_urls:', e);
                message.images = [];
              }
            }
            return message;
          });

          res.json(messages);
        }
      );
    }
  );
});

// Create message with optional images
app.post('/', authenticateToken, upload.array('images'), (req, res) => {
  const { conversation_id, text } = req.body;

  // First verify conversation belongs to user
  req.db.query(
    'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    [conversation_id, req.user.id],
    async (err, conversations) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (conversations.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy cuộc hội thoại' });
      }

      try {
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
          // Upload all images to Cloudinary
          for (const file of req.files) {
            const result = await cloudinary.uploader.upload(
              `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            );
            imageUrls.push(result.secure_url);
          }
        }

        // Create message with JSON array of image URLs
        req.db.query(
          'INSERT INTO messages (conversation_id, sender, text, image_urls) VALUES (?, ?, ?, ?)',
          [conversation_id, 'user', text, imageUrls.length > 0 ? JSON.stringify(imageUrls) : null],
          (err, result) => {
            if (err) {
              console.error('Create message error:', err);
              return res.status(500).json({ message: 'Lỗi server' });
            }

            // Get created message
            req.db.query(
              'SELECT * FROM messages WHERE id = ?',
              [result.insertId],
              (err, messages) => {
                if (err) {
                  console.error('Get new message error:', err);
                  return res.status(500).json({ message: 'Lỗi server' });
                }

                const message = messages[0];
                // Parse image_urls JSON for response
                if (message.image_urls) {
                  try {
                    message.images = JSON.parse(message.image_urls);
                  } catch (e) {
                    console.error('Error parsing image_urls:', e);
                    message.images = [];
                  }
                }

                res.status(201).json(message);
              }
            );
          }
        );
      } catch (error) {
        console.error('Create message error:', error);
        res.status(500).json({ message: 'Lỗi server' });
      }
    }
  );
});

// Edit message
app.put('/:id', authenticateToken, upload.array('images'), async (req, res) => {
  const { text } = req.body;

  // First verify message belongs to user's conversation
  req.db.query(
    `SELECT m.* FROM messages m
     INNER JOIN conversations c ON m.conversation_id = c.id
     WHERE m.id = ? AND c.user_id = ?`,
    [req.params.id, req.user.id],
    async (err, messages) => {
      if (err) {
        console.error('Get message error:', err);
        return res.status(500).json({ message: 'Lỗi server' });
      }

      if (messages.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
      }

      const message = messages[0];
      if (message.sender !== 'user') {
        return res.status(403).json({ message: 'Không thể chỉnh sửa tin nhắn của AI' });
      }

      try {
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
          // Upload new images to Cloudinary
          for (const file of req.files) {
            const result = await cloudinary.uploader.upload(
              `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            );
            imageUrls.push(result.secure_url);
          }
        }

        // Update message with new text and/or images
        const updateQuery = imageUrls.length > 0
          ? 'UPDATE messages SET text = ?, image_urls = ?, is_edited = true WHERE id = ?'
          : 'UPDATE messages SET text = ?, is_edited = true WHERE id = ?';
        
        const updateParams = imageUrls.length > 0
          ? [text, JSON.stringify(imageUrls), req.params.id]
          : [text, req.params.id];

        req.db.query(updateQuery, updateParams, (err) => {
          if (err) {
            console.error('Update message error:', err);
            return res.status(500).json({ message: 'Lỗi server' });
          }

          // Get updated message
          req.db.query(
            'SELECT * FROM messages WHERE id = ?',
            [req.params.id],
            (err, messages) => {
              if (err) {
                console.error('Get updated message error:', err);
                return res.status(500).json({ message: 'Lỗi server' });
              }

              const updatedMessage = messages[0];
              // Parse image_urls JSON for response
              if (updatedMessage.image_urls) {
                try {
                  updatedMessage.images = JSON.parse(updatedMessage.image_urls);
                } catch (e) {
                  console.error('Error parsing image_urls:', e);
                  updatedMessage.images = [];
                }
              }

              res.json({
                message: 'Cập nhật tin nhắn thành công',
                updatedMessage
              });
            }
          );
        });
      } catch (error) {
        console.error('Update message error:', error);
        res.status(500).json({ message: 'Lỗi server' });
      }
    }
  );
});

// Generate speech from text using Google TTS API
app.post('/text-to-speech', authenticateToken, async (req, res) => {
  try {
    const { text, language = 'vi-VN' } = req.body;

    // Prepare data for Google TTS API
    const ttsData = {
      input: {
        text: text
      },
      voice: {
        languageCode: language,
        name: language === 'vi-VN' ? 'vi-VN-Standard-A' : 'en-US-Standard-A',
        ssmlGender: 'FEMALE'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    };

    // Call Google TTS API
    const response = await axios({
      method: 'POST',
      url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: ttsData
    });

    // Convert response to audio buffer
    const audioContent = Buffer.from(response.data.audioContent, 'base64');

    // Upload audio to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:audio/mp3;base64,${audioContent.toString('base64')}`,
      { resource_type: 'video' }
    );

    res.json({ audio_url: result.secure_url });
  } catch (error) {
    console.error('Text-to-speech error:', error);
    res.status(500).json({ message: 'Lỗi chuyển đổi văn bản thành giọng nói' });
  }
});

module.exports = app; 