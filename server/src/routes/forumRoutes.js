'use strict';

/**
 * forumRoutes.js — Community Forum API
 * Mounted at: /api/forum
 *
 * Public  (no auth):  GET  /               list posts
 *                     GET  /:id            single post
 *                     GET  /:id/comments   list comments
 *                     GET  /user/:userId   user's posts
 *
 * Protected (JWT):    POST   /             create post
 *                     PATCH  /:id          edit own post
 *                     DELETE /:id          delete own post
 *                     POST   /:id/vote     vote post (up|down)
 *                     POST   /:id/comments              add comment
 *                     PATCH  /:id/comments/:commentId   edit comment
 *                     DELETE /:id/comments/:commentId   delete comment
 *                     POST   /:id/comments/:commentId/vote  vote comment
 */

const express = require('express');
const {
  // Posts
  getPosts, getPost, createPost, updatePost, deletePost, votePost,
  // Comments
  getComments, addComment, editComment, deleteComment, voteComment,
  // User
  getUserPosts,
} = require('../controllers/forumController');

const { protect, optionalProtect } = require('../middleware/auth');

const router = express.Router();

// ── User profile posts (no auth) ─────────────────────────────────────────────
// GET /api/forum/user/:userId
router.get('/user/:userId', getUserPosts);

// ── Post collection ───────────────────────────────────────────────────────────
// GET  /api/forum?page=1&limit=15&sort=new|top|trending&tag=deals&q=iphone
router.get('/',    optionalProtect, getPosts);
// POST /api/forum
router.post('/',   protect, createPost);

// ── Post member ───────────────────────────────────────────────────────────────
// GET    /api/forum/:id
router.get('/:id',          optionalProtect, getPost);
// PATCH  /api/forum/:id
router.patch('/:id',        protect, updatePost);
// DELETE /api/forum/:id
router.delete('/:id',       protect, deletePost);
// POST   /api/forum/:id/vote   body: { vote: 'up'|'down' }
router.post('/:id/vote',    protect, votePost);

// ── Comments ──────────────────────────────────────────────────────────────────
// GET  /api/forum/:id/comments?page=1&parentId=<id>
router.get('/:id/comments',                         optionalProtect, getComments);
// POST /api/forum/:id/comments    body: { text, parentId? }
router.post('/:id/comments',                        protect, addComment);
// PATCH  /api/forum/:id/comments/:commentId
router.patch('/:id/comments/:commentId',            protect, editComment);
// DELETE /api/forum/:id/comments/:commentId
router.delete('/:id/comments/:commentId',           protect, deleteComment);
// POST   /api/forum/:id/comments/:commentId/vote   body: { vote: 'up'|'down' }
router.post('/:id/comments/:commentId/vote',        protect, voteComment);

module.exports = router;
