const express = require('express');
const { getDashboardStats, getAllUsers, toggleUserStatus, deleteProduct } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect, adminOnly); // All admin routes require admin role

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/toggle', toggleUserStatus);
router.delete('/products/:id', deleteProduct);

module.exports = router;
