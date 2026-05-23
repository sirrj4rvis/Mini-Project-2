'use strict';

/**
 * forumController.js — PriceLens Community Forum
 *
 * All write operations require JWT auth (protect middleware).
 * Read operations (getPosts, getPost) are public.
 *
 * Feature set:
 *   Posts   — create, list (paginated + search + sort), get, update, soft-delete
 *   Comments— create, list (paginated + threaded replies), edit, soft-delete
 *   Votes   — upvote / downvote posts and comments (mutual exclusion, toggle off)
 *   Own     — users can only edit/delete their own content (or admin)
 */

const ForumPost = require('../models/ForumPost');
const Comment   = require('../models/Comment');
const logger    = require('../config/logger');

// ── Shared utility ────────────────────────────────────────────────────────────
const isOwnerOrAdmin = (doc, userId) =>
  doc.userId.toString() === userId.toString() || false;

// Mutual-exclusion vote helper:
// Removes the userId from the opposite array before applying the desired vote.
// Returns { added: bool } — true if the vote was added, false if toggled off.
const applyVote = (doc, userId, voteType) => {
  const uid      = userId.toString();
  const opposite = voteType === 'upvotes' ? 'downvotes' : 'upvotes';

  // Remove from opposite list (mutual exclusion)
  doc[opposite] = doc[opposite].filter((id) => id.toString() !== uid);

  const alreadyVoted = doc[voteType].some((id) => id.toString() === uid);
  if (alreadyVoted) {
    // Toggle off
    doc[voteType] = doc[voteType].filter((id) => id.toString() !== uid);
    return false;
  } else {
    doc[voteType].push(userId);
    return true;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/forum
 * List posts with pagination, full-text search, tag filter, sort.
 *
 * Query params:
 *   page       int    (default 1)
 *   limit      int    (default 15, max 50)
 *   q          string (full-text search)
 *   tag        string (filter by tag)
 *   productId  string (filter by linked product)
 *   sort       string (new|top|trending)  default: new
 */
const getPosts = async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit     = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const q         = req.query.q ? String(req.query.q) : undefined;
    const tag       = req.query.tag ? String(req.query.tag) : undefined;
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const sort      = req.query.sort ? String(req.query.sort) : 'new';

    const filter = { isDeleted: false };
    if (tag)       filter.tags      = tag.toLowerCase().trim();
    if (productId) filter.productId = productId;
    if (q)         filter.$text     = { $search: q };

    const sortMap = {
      new:      { isPinned: -1, createdAt: -1 },
      top:      { isPinned: -1, 'upvotes.length': -1, createdAt: -1 },
      trending: { isPinned: -1, views: -1, commentCount: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[sort] || sortMap.new;

    const [posts, total] = await Promise.all([
      ForumPost.find(filter)
        .populate('userId',    'name')
        .populate('productId', 'title imageUrl lowestPrice')
        .sort(sortQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-downvotes -upvotes') // don't send full voter arrays in list view
        .lean({ virtuals: true }),
      ForumPost.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page,
      pages:  Math.ceil(total / limit),
      count:  posts.length,
      posts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/forum/:id
 * Single post with full author info. Increments view counter.
 * Attaches viewer's vote status if authenticated.
 */
const getPost = async (req, res, next) => {
  try {
    const post = await ForumPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('userId',    'name createdAt')
      .populate('productId', 'title imageUrl lowestPrice category')
      .lean({ virtuals: true });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Attach viewer's vote status (only if authenticated)
    let viewerVote = null;
    const viewerId = req.user?._id?.toString();
    if (viewerId) {
      if (post.upvotes?.some((id) => id.toString() === viewerId))   viewerVote = 'up';
      if (post.downvotes?.some((id) => id.toString() === viewerId)) viewerVote = 'down';
    }

    // Strip raw vote arrays from response
    const { upvotes, downvotes, ...postData } = post;

    res.json({ success: true, post: { ...postData, viewerVote } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/forum  [auth required]
 * Create a new discussion post.
 *
 * Body: { title, body, productId?, tags? }
 */
const createPost = async (req, res, next) => {
  try {
    const { title, body, productId, tags } = req.body;

    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!body?.trim())  return res.status(400).json({ success: false, message: 'Body is required' });

    const post = await ForumPost.create({
      userId:    req.user._id,
      productId: productId || null,
      title:     title.trim(),
      body:      body.trim(),
      tags:      (tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 10),
    });

    await post.populate('userId', 'name');
    logger.info(`[Forum] Post created: ${post._id} by user ${req.user._id}`);

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/forum/:id  [auth required — own post only]
 * Edit a post's title, body, or tags.
 */
const updatePost = async (req, res, next) => {
  try {
    const post = await ForumPost.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (!isOwnerOrAdmin(post, req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own posts' });
    }

    const { title, body, tags } = req.body;
    if (title) post.title = title.trim();
    if (body)  post.body  = body.trim();
    if (tags)  post.tags  = tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 10);

    await post.save();
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/forum/:id  [auth required — own post only]
 * Soft-delete a post (preserves data, hides from public feed).
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await ForumPost.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (!isOwnerOrAdmin(post, req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    logger.info(`[Forum] Post soft-deleted: ${post._id}`);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/forum/:id/vote  [auth required]
 * Upvote or downvote a post. Mutual exclusion — switching vote removes previous.
 * Voting the same direction again toggles it off.
 *
 * Body: { vote: 'up' | 'down' }
 */
const votePost = async (req, res, next) => {
  try {
    const { vote } = req.body;
    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ success: false, message: "vote must be 'up' or 'down'" });
    }

    const post = await ForumPost.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const voteField = vote === 'up' ? 'upvotes' : 'downvotes';
    const added     = applyVote(post, req.user._id, voteField);
    await post.save();

    res.json({
      success:      true,
      voted:        added,
      voteType:     added ? vote : null,
      upvoteCount:  post.upvotes.length,
      downvoteCount: post.downvotes.length,
      score:        post.upvotes.length - post.downvotes.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/forum/:id/comments
 * Paginated comments for a post. Supports threaded replies via parentId.
 *
 * Query: page, limit, parentId (null = top-level)
 */
const getComments = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit    = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const parentId = req.query.parentId || null;

    const filter = {
      postId:    req.params.id,
      isDeleted: false,
      parentId,
    };

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate('userId', 'name')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      Comment.countDocuments(filter),
    ]);

    // Attach viewer vote status
    const viewerId = req.user?._id?.toString();
    const enriched = comments.map(({ upvotes, downvotes, ...c }) => ({
      ...c,
      viewerVote: !viewerId ? null
        : upvotes?.some((id) => id.toString() === viewerId)   ? 'up'
        : downvotes?.some((id) => id.toString() === viewerId) ? 'down'
        : null,
    }));

    res.json({ success: true, total, page, pages: Math.ceil(total / limit), comments: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/forum/:id/comments  [auth required]
 * Add a comment (or reply) to a post.
 *
 * Body: { text, parentId? }
 */
const addComment = async (req, res, next) => {
  try {
    const { text, parentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text required' });

    const post = await ForumPost.findOne({ _id: req.params.id, isDeleted: false, isLocked: false });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: post?.isLocked ? 'This post is locked and cannot receive new comments' : 'Post not found',
      });
    }

    // If replying, validate parent exists in this post
    if (parentId) {
      const parent = await Comment.findOne({ _id: parentId, postId: req.params.id, isDeleted: false });
      if (!parent) return res.status(404).json({ success: false, message: 'Parent comment not found' });
    }

    const [comment] = await Promise.all([
      Comment.create({
        postId:   req.params.id,
        userId:   req.user._id,
        parentId: parentId || null,
        text:     text.trim(),
      }),
      // Increment cached counter on the post
      ForumPost.updateOne({ _id: req.params.id }, { $inc: { commentCount: 1 } }),
    ]);

    await comment.populate('userId', 'name');
    res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/forum/:postId/comments/:commentId  [auth required — own comment]
 * Edit a comment's text.
 */
const editComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Text required' });

    const comment = await Comment.findOne({
      _id:       req.params.commentId,
      postId:    req.params.id,
      isDeleted: false,
    });
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    if (!isOwnerOrAdmin(comment, req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    comment.text     = text.trim();
    comment.isEdited = true;
    await comment.save();
    res.json({ success: true, comment });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/forum/:postId/comments/:commentId  [auth required — own comment]
 * Soft-delete a comment (content replaced with "[deleted]", userId cleared).
 */
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findOne({
      _id:       req.params.commentId,
      postId:    req.params.id,
      isDeleted: false,
    });
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    if (!isOwnerOrAdmin(comment, req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.text      = '[deleted]';  // Reddit-style: preserve thread structure
    await Promise.all([
      comment.save(),
      ForumPost.updateOne({ _id: req.params.id }, { $inc: { commentCount: -1 } }),
    ]);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/forum/:id/comments/:commentId/vote  [auth required]
 * Upvote or downvote a comment with mutual exclusion.
 *
 * Body: { vote: 'up' | 'down' }
 */
const voteComment = async (req, res, next) => {
  try {
    const { vote } = req.body;
    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ success: false, message: "vote must be 'up' or 'down'" });
    }

    const comment = await Comment.findOne({
      _id:       req.params.commentId,
      postId:    req.params.id,
      isDeleted: false,
    });
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const voteField = vote === 'up' ? 'upvotes' : 'downvotes';
    const added     = applyVote(comment, req.user._id, voteField);
    await comment.save();

    res.json({
      success:       true,
      voted:         added,
      voteType:      added ? vote : null,
      upvoteCount:   comment.upvotes.length,
      downvoteCount: comment.downvotes.length,
      score:         comment.upvotes.length - comment.downvotes.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/forum/user/:userId
 * Public profile view — all posts by a specific user.
 */
const getUserPosts = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);

    const [posts, total] = await Promise.all([
      ForumPost.find({ userId: req.params.userId, isDeleted: false })
        .populate('productId', 'title imageUrl')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title tags commentCount views upvotes downvotes createdAt')
        .lean({ virtuals: true }),
      ForumPost.countDocuments({ userId: req.params.userId, isDeleted: false }),
    ]);

    res.json({ success: true, total, page, pages: Math.ceil(total / limit), posts });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Posts
  getPosts, getPost, createPost, updatePost, deletePost, votePost,
  // Comments
  getComments, addComment, editComment, deleteComment, voteComment,
  // User
  getUserPosts,
};
