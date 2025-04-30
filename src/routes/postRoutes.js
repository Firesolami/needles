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
    createComment,
    getCommentsForPost,
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

router.post('/posts/:id/comments', createComment);
router.get('/posts/:id/comments', getCommentsForPost);

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
////// IMPORTANT ////// 
// like logic for reposts, creat quote from reposts, comment on reposts ✅
// scratch that. ensure post is not repost before performing like, dislike, repost, quote, comment ✅
///////////////////////

///////////////////// TODO /////////////////////
// NEXT
// get post metrics: comments, likes, quotes, reposts count
// get reposts, comments (replies) by user
// delete post
// share post
// add fields like liked by user, disliked by user, reposted by user, quoted by user, commented by user

///////////////////// FINALLY ////////////////////
// FEED
// feed
// feed from following
// feed algorithm

// CACHING AND OPTIMIZATION
// caching
