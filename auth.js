const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { db } = require('./db');

const router = express.Router();

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    error: 'Too many attempts. Try again later.'
  }
});

function createSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);

      req.session.user = {
        id: user.id,
        username: user.username
      };

      // Create a fresh CSRF token
      req.session.csrfToken =
        crypto.randomBytes(32).toString('hex');

      resolve();
    });
  });
}

// Registration
router.post('/register', authLimit, async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length < 2 ||
      username.trim().length > 50 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        error: 'Invalid input. Password must be at least 12 characters and no more than 72 bytes.'
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const hash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (username, email, password)
      VALUES (?, ?, ?)
    `).run(cleanUsername, cleanEmail, hash);

    const user = {
      id: result.lastInsertRowid,
      username: cleanUsername
    };

    await createSession(req, user);

    res.json({
      success: true,
      user
    });

  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'Email already registered.'
      });
    }

    next(err);
  }
});

// Login
router.post('/login', authLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 254 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        error: 'Invalid email or password.'
      });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    await createSession(req, user);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (err) {
    next(err);
  }
});

// Current user
router.get('/me', (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

// Logout
router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);

    res.clearCookie('guestbook.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.json({ success: true });
  });
});

module.exports = router;
