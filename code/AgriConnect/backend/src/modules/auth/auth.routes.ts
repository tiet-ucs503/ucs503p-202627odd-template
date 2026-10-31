import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import {
  forgotPasswordController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  resetPasswordController,
} from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), registerController);
authRouter.post('/login', validate({ body: loginSchema }), loginController);
authRouter.post('/refresh', refreshController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  forgotPasswordController,
);
authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  resetPasswordController,
);
