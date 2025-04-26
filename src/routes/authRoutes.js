const express = require('express');
const {
    signup,
    login,
    verifyEmail,
    forgotPassword,
    resetPassword,
    resendVerification
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/signin', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerification);

module.exports = router;
