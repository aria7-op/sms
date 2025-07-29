import express from 'express';
import * as authController from '../controllers/authController.js';
const router = express.Router();

// Placeholder controllers
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-db', authController.loginDb); // New database-based login
router.get('/users', (req, res) => res.json({ message: 'Get users' }));

export default router; 