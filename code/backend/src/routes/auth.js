const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_FULL_NAME_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (req) =>
  String(req.body && req.body.email ? req.body.email : '').trim().toLowerCase();

const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_SIGNUP_RATE_LIMIT_MAX) || 50,
  message: 'Too many requests. Please try again later.',
});

const loginEmailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_EMAIL_RATE_LIMIT_MAX) || 10,
  message: 'Too many login attempts for this account. Please try again later.',
  keyGenerator: (req) => {
    const email = normalizeEmail(req);
    return email ? `email:${email}` : `ip:${req.ip}`;
  },
});

const loginIpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_IP_RATE_LIMIT_MAX) || 100,
  message: 'Too many requests. Please try again later.',
  keyGenerator: (req) => `ip:${req.ip}`,
});

// POST /auth/signup — Create a new account (teacher or student)
router.post('/signup', signupRateLimit, async (req, res) => {
  try {
    const { email, password, full_name, role, teacher_invite_code } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields: email, password, full_name, role' });
    }

    const normalizedRole = String(role).toLowerCase().trim();
    if (!['teacher', 'student'].includes(normalizedRole)) {
      return res.status(400).json({ error: "Role must be either 'teacher' or 'student'" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const normalizedName = String(full_name).trim();
    if (normalizedName.length === 0 || normalizedName.length > MAX_FULL_NAME_LENGTH) {
      return res.status(400).json({ error: `Full name must be between 1 and ${MAX_FULL_NAME_LENGTH} characters` });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
    }

    // Teacher self-signup is gated by an invite code when one is configured.
    // In production an invite code must be configured; otherwise teacher
    // signup is closed. Development/test allows it for local convenience.
    if (normalizedRole === 'teacher') {
      const configuredInviteCode = process.env.TEACHER_INVITE_CODE;

      if (configuredInviteCode) {
        if (!teacher_invite_code || teacher_invite_code !== configuredInviteCode) {
          return res.status(403).json({ error: 'Invalid or missing teacher invite code' });
        }
      } else if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'Teacher accounts require an invite code. Contact your administrator.',
        });
      }
    }

    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUserResult = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [normalizedEmail, passwordHash, normalizedName, normalizedRole]
    );

    const user = newUserResult.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

// POST /auth/login — Authenticate user and issue JWT
router.post('/login', loginIpRateLimit, loginEmailRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /auth/me — Return current logged-in user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });
  } catch (err) {
    console.error('/auth/me error:', err);
    res.status(500).json({ error: 'Internal server error fetching user profile' });
  }
});

module.exports = router;
