// Test environment. Must be required before any backend module so that the
// auth/QR secrets are deterministic and no real .env values are used.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'classpulse-test-jwt-secret';
process.env.QR_HMAC_SECRET = 'classpulse-test-qr-secret';
