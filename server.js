require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');

const { DATA_DIR } = require('./db');
const auth = require('./auth');
const guestbook = require('./guestbook');

const app = express();

const isProduction =
  process.env.NODE_ENV === 'production';

const PORT = process.env.PORT || 3000;

// Validate production configuration
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required.');
}

// Render runs behind a reverse proxy
if (isProduction) {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());

app.use(express.json({
  limit: '10kb'
}));

// Session configuration
app.use(session({
  name: 'guestbook.sid',

  store: new SQLiteStore({
    dir: DATA_DIR,
    db: 'sessions.sqlite'
  }),

  secret: process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString('hex'),

  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// CSRF protection
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken =
      crypto.randomBytes(32).toString('hex');
  }

  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (!safeMethods.includes(req.method)) {
    const token = req.get('X-CSRF-Token');

    if (
      typeof token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(req.session.csrfToken)
      )
    ) {
      return res.status(403).json({
        error: 'Invalid CSRF token.'
      });
    }
  }

  next();
});

// CSRF token endpoint
app.get('/api/csrf', (req, res) => {
  res.json({
    csrfToken: req.session.csrfToken
  });
});

// Application routes
app.use('/api/auth', auth);
app.use('/api', guestbook);

// Frontend
app.use(express.static(
  path.join(__dirname, 'public')
));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.message);

  res.status(500).json({
    error: 'Internal server error.'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Guestbook running on port ${PORT}`);
});
