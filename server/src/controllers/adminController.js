const User = require('../models/User');
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const ForumPost = require('../models/ForumPost');
const PriceHistory = require('../models/PriceHistory');

// ─── Platform Stats Dashboard ─────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalProducts, totalAlerts, totalPosts, recentUsers] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Alert.countDocuments({ isActive: true }),
      ForumPost.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
    ]);

    const topProducts = await Product.find()
      .sort({ searchCount: -1 })
      .limit(5)
      .select('title searchCount lowestPrice category');

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        activeAlerts: totalAlerts,
        totalForumPosts: totalPosts,
      },
      recentUsers,
      topProducts,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get All Users ────────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const search = req.query.search ? String(req.query.search) : '';
    const query = search ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-password -refreshToken'),
      User.countDocuments(query),
    ]);

    res.json({ success: true, users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle User Active Status ────────────────────────────────────────────────
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot deactivate an admin' });

    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Product ────────────────────────────────────────────────────────────
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    // Clean up related data
    await Promise.all([
      PriceHistory.deleteMany({ productId: req.params.id }),
      Alert.deleteMany({ productId: req.params.id }),
    ]);
    res.json({ success: true, message: 'Product and all related data deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats, getAllUsers, toggleUserStatus, deleteProduct };
