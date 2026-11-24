const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// registration (OTP flow)

router.post('/register/options', authController.registerOptions);
router.post('/register/send-otp', authController.sendOtp);
router.post('/register/verify', authController.register);

// session
router.post('/login', authController.login);
router.post('/refreshToken', authController.refreshAccessToken);
router.post('/logout', authController.logout);

module.exports = router;
