const express = require('express');
const protect = require('../middleware/auth');
const upload = require('../middleware/mediaUpload');

const {
    setupProfile,
    getProfile,
    updateProfile
} = require('../controllers/profileController');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('profile_pic'), setupProfile);
router.patch('/:username', upload.single('profile_pic'), updateProfile);
router.get('/:username', getProfile);

module.exports = router;
