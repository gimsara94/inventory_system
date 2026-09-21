import { Router } from 'express';
import { getCurrentUser, login, logout } from '../controllers/authController.js';
import { authenticate, requireCsrf } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, requireCsrf, logout);

export default router;
