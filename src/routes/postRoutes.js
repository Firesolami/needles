const express = require('express');
const protect = require('../middleware/auth');
const upload = require('../middleware/mediaUpload');

const {
    createPost,
    createDraft,
    getPostsByUser,
    getPostCountByUser,
    getDraftsByUser,
    getDraftCountByUser,
    createPostFromDraft,
    toggleLike,
    toggleDislike,
} = require('../controllers/postController');

const router = express.Router();

router.use(protect);

router.post('/posts', upload.fields([
    { name: 'audio', maxCount: 4 },
    { name: 'images', maxCount: 4 },
    { name: 'video', maxCount: 4 }
]), createPost);
router.post('/drafts', upload.fields([
    { name: 'audio', maxCount: 4 },
    { name: 'images', maxCount: 4 },
    { name: 'video', maxCount: 4 }
]), createDraft);

router.get('/posts/:username', getPostsByUser);
router.get('/posts/:username/count', getPostCountByUser);

router.post('/posts/:id/toggle-like', toggleLike);
router.post('/posts/:id/toggle-dislike', toggleDislike);

router.get('/drafts/:username', getDraftsByUser);
router.post('/drafts/:username/:id/post', createPostFromDraft);
router.get('/drafts/:username/count', getDraftCountByUser);

module.exports = router;

// TODO

// POSTS

// IMPORTANT: specify post type and status when retrieving ✅
// get post count by user  ✅
// get own posts ✅
// get own drafts ✅
// get draft count by user  ✅
// post from drafts ✅

// like post ✅
// dislike post ✅

// like logic for reposts

// comment on post
// quote post
// share post
// repost post

// NEXT
// get post by id
// get post metrics: comments, likes, quotes, reposts count


// get comments, quotes, reposts by post id

// delete post

// MAKE SURE AS EFFICIENT AS POSSIBLE

// FEED

// feed
// feed from following
// feed algorithm

// CACHING AND OPTIMIZATION

// caching