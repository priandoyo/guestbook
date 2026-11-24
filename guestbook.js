const express = require('express');
const { db } = require('./db');

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: 'Please login first.'
    });
  }

  next();
}

// Public: View messages
router.get('/messages', (req, res) => {
  const messages = db.prepare(`
    SELECT
      messages.id,
      messages.message,
      messages.created_at,
      users.username
    FROM messages
    JOIN users ON messages.user_id = users.id
    ORDER BY messages.id DESC
  `).all();

  res.json(messages);
});

// Protected: Post message
router.post('/messages', requireAuth, (req, res) => {
  const { message } = req.body;

  if (typeof message !== 'string' ||
      !message.trim() ||
      message.trim().length > 500) {
    return res.status(400).json({
      error: 'Message must contain 1-500 characters.'
    });
  }

  const result = db.prepare(`
    INSERT INTO messages (user_id, message)
    VALUES (?, ?)
  `).run(req.session.user.id, message.trim());

  res.status(201).json({
    success: true,
    message: {
      id: result.lastInsertRowid,
      username: req.session.user.username,
      message: message.trim()
    }
  });
});

module.exports = router;
