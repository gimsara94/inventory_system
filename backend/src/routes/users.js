import { Router } from 'express';
import { createUser, getUsers, updateUser } from '../controllers/userController.js';

const router = Router();

router.get('/users', getUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);

export default router;
