const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient, OtpType } = require('@prisma/client');
const prisma = new PrismaClient();
const User = prisma.user;
const { z } = require('zod');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');

const userSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[@$!%*?&]/, 'Password must contain at least one special character'),
});

exports.signup = async (req, res, next) => {
    try {
        const validatedData = userSchema.parse(req.body);
        const { email, username, password } = validatedData;

        const existingUserErrors = [];

        const existingEmail = await User.findUnique({
            where: { email }
        });
        const existingUsername = await User.findUnique({
            where: { username }
        });

        if (existingEmail) {
            existingUserErrors.push('Email already exists');
        }
        if (existingUsername) {
            existingUserErrors.push('Username already exists');
        }

        if (existingUserErrors.length > 0) {
            return next(new AppError(existingUserErrors.join(', '), 400));
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            data: {
                email,
                username,
                password: hashedPassword,
            }
        })

        const otp = await otpService.createOTP(user, OtpType.VERIFICATION);
        await emailService.sendVerificationEmail(email, otp);

        res.status(201).json({
            status: 'success',
            message:
                'Verification email sent. Please verify your email to continue.'
        });
    } catch (error) {
        next(error);
    }
};

exports.verifyEmail = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findUnique({ 
            where: { email },
            select: {
                id: true,
                email: true,
                username: true,
                created_at: true,
            }
        });
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const isValid = await otpService.verifyOTP(user, otp, OtpType.VERIFICATION);
        if (!isValid) {
            return next(new AppError('Invalid or expired OTP', 400));
        }

        await User.update({
            where: { email },
            data: { isVerified: true }
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(200).json({
            status: 'success',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            return next(new AppError('Please provide email or username and password', 400));
        }

        const userQuery = email ? { email } : { username };
        const user = await User.findFirst({
            where: userQuery,
            select: {
                id: true,
                profile_pic_link: true,
                display_name: true,
                bio: true,
                email: true,
                password: true,
                username: true,
                isVerified: true,
                created_at: true,
            }
        })

        if (!user || !(await bcrypt.compare(password, user.password))) {
            if (username) return next(new AppError('Invalid username or password', 401));
            return next(new AppError('Invalid email or password', 401));
        }

        if (!user.isVerified) {
            return next(new AppError('Please verify your email first', 401));
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        user.password = undefined;
        res.status(200).json({
            status: 'success',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findUnique({ where: { email } });
        if (!user) {
            return next(new AppError('No user found with this email', 404));
        }

        const otp = await otpService.createOTP(user, OtpType.PASSWORD_RESET);
        await emailService.sendPasswordResetEmail(email, otp);

        res.status(200).json({
            status: 'success',
            message: 'Password reset instructions sent to email'
        });
    } catch (error) {
        next(error);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findUnique({ where: { email } });
        if (!user) {
            return next(new AppError('User with this email not found', 404));
        }

        const isValid = await otpService.verifyOTP(
            user,
            otp,
            OtpType.PASSWORD_RESET
        );

        if (!isValid) {
            return next(new AppError('Invalid or expired OTP', 400));
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.update({
            where: { email },
            data: { password: hashedPassword, password_changed_at: new Date() }
        });

        res.status(200).json({
            status: 'success',
            message: 'Password reset successful'
        });
    } catch (error) {
        next(error);
    }
};

exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findUnique({ where: { email } });
        if (!user) {
            return next(new AppError('No user found with this email', 404));
        }

        if (user.isVerified) {
            return next(new AppError('Email is already verified', 400));
        }

        const otp = await otpService.createOTP(user, OtpType.VERIFICATION);
        await emailService.sendVerificationEmail(email, otp);

        res.status(200).json({
            status: 'success',
            message: 'Verification email sent successfully'
        });
    } catch (error) {
        next(error);
    }
};
