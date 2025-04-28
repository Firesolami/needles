const express = require('express');
const protect = require('../middleware/auth');

const {
    follow,
    unfollow,
    getFollowers,
    getFollowing,
    getFollowStatus,
    getFollowerCount,
    getFollowingCount,
} = require('../controllers/followController');

const router = express.Router();

router.use(protect);

router.post('/follow/:username', follow);
router.post('/unfollow/:username', unfollow);
router.get('/followers/:username', getFollowers);
router.get('/following/:username', getFollowing);
router.get('/follow-status/:username', getFollowStatus);
router.get('/follower-count/:username', getFollowerCount);
router.get('/following-count/:username', getFollowingCount);

module.exports = router;
