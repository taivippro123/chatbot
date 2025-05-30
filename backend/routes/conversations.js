const express = require('express');
const app = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get all conversations
app.get('/', authenticateToken, async (req, res) => {
  try {
    const [conversations] = await req.db.promise().query(
      `SELECT c.*, 
        (SELECT m.text FROM messages m 
         WHERE m.conversation_id = c.id 
         ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages m 
         WHERE m.conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get conversation messages
app.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    // Check if conversation belongs to user
    const [conversations] = await req.db.promise().query(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    // Get all messages from conversation with all fields
    const [messages] = await req.db.promise().query(
      `SELECT 
        id,
        conversation_id,
        sender,
        text,
        image_urls,
        audio_url,
        is_edited,
        created_at,
        updated_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    // Parse image_urls JSON for each message
    const parsedMessages = messages.map(message => {
      if (message.image_urls) {
        try {
          // Check if image_urls is already an array
          if (Array.isArray(message.image_urls)) {
            message.images = message.image_urls;
          } 
          // Check if it's a JSON string
          else if (typeof message.image_urls === 'string' && message.image_urls.startsWith('[')) {
            message.images = JSON.parse(message.image_urls);
          }
          // If it's a single URL string
          else if (typeof message.image_urls === 'string') {
            message.images = [message.image_urls];
          }
          // Default to empty array if none of the above
          else {
            message.images = [];
          }
        } catch (e) {
          console.error('Error parsing image_urls:', e);
          // If parsing fails, check if it's a URL string
          if (typeof message.image_urls === 'string' && message.image_urls.startsWith('http')) {
            message.images = [message.image_urls];
          } else {
            message.images = [];
          }
        }
      } else {
        message.images = [];
      }
      return message;
    });

    res.json({
      success: true,
      conversation: conversations[0],
      messages: parsedMessages
    });
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Create new conversation
app.post('/', authenticateToken, async (req, res) => {
  try {
    const [result] = await req.db.promise().query(
      'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [req.user.id, req.body.title || 'New Chat']
    );

    const [conversations] = await req.db.promise().query(
      'SELECT * FROM conversations WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      conversation: conversations[0]
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update conversation
app.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;

    const [result] = await req.db.promise().query(
      'UPDATE conversations SET title = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [title, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    const [conversations] = await req.db.promise().query(
      'SELECT * FROM conversations WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      conversation: conversations[0]
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Delete conversation
app.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await req.db.promise().query(
      'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = app; 