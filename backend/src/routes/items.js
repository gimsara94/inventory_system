import { Router } from 'express';
import {
  adjustStock,
  archiveItem,
  createItem,
  getItem,
  getItems,
  getMovements,
  getSummary,
  updateItem,
} from '../controllers/itemController.js';

const router = Router();

router.get('/summary', getSummary);
router.get('/items', getItems);
router.get('/items/:id', getItem);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.post('/items/:id/adjust', adjustStock);
router.post('/items/:id/archive', archiveItem);
router.get('/movements', getMovements);

export default router;
