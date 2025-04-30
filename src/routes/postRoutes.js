const express = require('express');
const protect = require('../middleware/auth');
const upload = require('../middleware/mediaUpload');

const {
    createPost,
    createDraft,
    getPostsByUser,
    getPostById,
    getPostCountByUser,
    getDraftsByUser,
    getDraftCountByUser,
    createPostFromDraft,
    createQuote,
    getQuotesForPost,
    toggleLike,
    toggleDislike
} = require('../controllers/postController');

const router = express.Router();

router.use(protect);

router.post(
    '/posts',
    upload.fields([
        { name: 'audio', maxCount: 4 },
        { name: 'images', maxCount: 4 },
        { name: 'video', maxCount: 4 }
    ]),
    createPost
);
router.post(
    '/drafts',
    upload.fields([
        { name: 'audio', maxCount: 4 },
        { name: 'images', maxCount: 4 },
        { name: 'video', maxCount: 4 }
    ]),
    createDraft
);

router.get('/posts', getPostsByUser);
router.get('/posts/:username/count', getPostCountByUser);
router.get('/posts/:id', getPostById);

router.post('/posts/:id/toggle-like', toggleLike);
router.post('/posts/:id/toggle-dislike', toggleDislike);

router.get('/drafts', getDraftsByUser);
router.post('/drafts/:username/:id/post', createPostFromDraft);
router.get('/drafts/:username/count', getDraftCountByUser);

router.post('/posts/:id/quotes', createQuote);
router.get('/posts/:id/quotes', getQuotesForPost);

module.exports = router;

////////////////////// DONE //////////////////////
// get post count by user  ✅
// get own posts ✅
// get own drafts ✅
// get draft count by user  ✅
// post from drafts ✅
// like post ✅
// dislike post ✅
// get post by id ✅
// quote post ✅

///////////////////// TODO /////////////////////
// NEXT
// comment on post
// share post
// repost post
// get comments, quotes, reposts by post id
// get post metrics: comments, likes, quotes, reposts count
// delete post
// like logic for reposts

///////////////////// FINALLY ////////////////////
// FEED
// feed
// feed from following
// feed algorithm

// CACHING AND OPTIMIZATION
// caching
