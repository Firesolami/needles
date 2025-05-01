const express = require('express');
const protect = require('../middleware/auth');
const upload = require('../middleware/mediaUpload');

const {
    createPost,
    createDraft,
    getPostsByUser,
    getPostById,
    deletePost,
    getPostCountByUser,
    getDraftsByUser,
    getDraftCountByUser,
    createPostFromDraft,
    createQuote,
    getQuotesForPost,
    createComment,
    getCommentsForPost,
    createRepost,
    getRepliesByUser,
    toggleLike,
    toggleDislike,
    createBookmark,
    getBookmarksByUser,
    deleteBookmark,
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
router.delete('/posts/:id', deletePost);

router.post('/posts/:id/toggle-like', toggleLike);
router.post('/posts/:id/toggle-dislike', toggleDislike);

router.get('/drafts', getDraftsByUser);
router.post('/drafts/:username/:id/post', createPostFromDraft);
router.get('/drafts/:username/count', getDraftCountByUser);

router.post('/posts/:id/quotes', createQuote);
router.get('/posts/:id/quotes', getQuotesForPost);

router.post('/posts/:id/comments', createComment);
router.get('/posts/:id/comments', getCommentsForPost);

router.post('/posts/:id/reposts', createRepost);

router.post('/bookmarks', createBookmark);
router.get('/bookmarks', getBookmarksByUser);
router.delete('/bookmarks/:id', deleteBookmark);

router.get('/posts/:username/replies', getRepliesByUser);

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
// comment on post ✅
// repost post ✅
////// IMPORTANT //////
// like logic for reposts, create quote from reposts, comment on reposts ✅
// scratch that. ensure post is not repost before performing like, dislike, repost, quote, comment ✅
///////////////////////
// get comments, quotes by post id ✅
// get post metrics: comments, likes, quotes, reposts count ✅
// get reposts, comments (replies) by user ✅
// delete post ✅
// add fields like liked by user, disliked by user, reposted by user, quoted by user, commented by user ✅
// bookmark crd ✅

///////////////////// TODO /////////////////////
// NEXT
// feed
// feed algorithm
// rank by following then by if youve interacted with the user before
// score for days since post (reduces total score), interactions, prev interactions, follower count, similarity to tags,
// ensure multiple posts from the same user dont follow each other
// graph plotting software for conversion functions
// share post
// generic search

// add proper error handling for when post action cannot be performed because post is repost
// CACHING AND OPTIMIZATION
// caching

// clean up bulky controller file