const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const User = prisma.user;
const { z } = require('zod');
const { AppError } = require('../middleware/errorHandler');
const {
    uploadToCloudinary,
    deleteFromCloudinary
} = require('../utils/cloudinary');

const profileSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(
            /^[a-zA-Z0-9_]+$/,
            'Username can only contain letters, numbers, and underscores'
        )
        .optional(),
    display_name: z
        .string()
        .min(3, 'Display name must be at least 3 characters')
        .max(30, 'Display name must be at most 30 characters')
        .optional(),
    bio: z.string().max(160, 'Bio must be at most 160 characters').optional()
});

exports.getProfile = async (req, res, next) => {
    try {
        const { username } = req.params;
        const user = await User.findFirst({
            where: { username },
            select: {
                id: true,
                email: true,
                username: true,
                display_name: true,
                bio: true,
                profile_pic_link: true,
                created_at: true
            }
        });

        if (user.id !== req.user.id) {
            user.email = undefined;
        }

        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

exports.setupProfile = async (req, res, next) => {
    try {
        const validatedData = profileSchema.parse(req.body);
        const profile_pic = req.file;

        if (profile_pic) {
            const { originalname, buffer } = profile_pic;
            const uploadResult = await uploadToCloudinary(
                buffer,
                originalname,
                'image'
            );
            validatedData.profile_pic_link = uploadResult.secure_url;
            validatedData.profile_pic_public_id = uploadResult.public_id;
        }

        const user = await User.update({
            where: { id: req.user.id },
            data: {
                bio: validatedData.bio,
                display_name: validatedData.display_name,
                profile_pic_link: validatedData.profile_pic_link,
                profile_pic_public_id: validatedData.profile_pic_public_id
            },
            select: {
                id: true,
                email: true,
                username: true,
                display_name: true,
                bio: true,
                profile_pic_link: true,
                created_at: true
            }
        });

        res.status(201).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const validatedData = profileSchema.parse(req.body);
        const profile_pic = req.file;

        const { username } = req.params;
        const previousUserDetails = await User.findUnique({
            where: { username },
            select: {
                id: true,
                profile_pic_link: true,
                profile_pic_public_id: true,
                username: true,
                username_changed_at: true,
                bio: true,
                display_name: true
            }
        });

        if (!previousUserDetails) {
            return next(new AppError('User not found', 404));
        }
        if (req.user.id !== previousUserDetails.id) {
            return next(
                new AppError('You can only update your own profile', 403)
            );
        }

        if (profile_pic) {
            const { originalname, buffer } = profile_pic;
            const uploadResult = await uploadToCloudinary(
                buffer,
                originalname,
                'image'
            );
            validatedData.profile_pic_link = uploadResult.secure_url;
            validatedData.profile_pic_public_id = uploadResult.public_id;
        }

        if (validatedData.username) {
            const lastUsernameChange = await User.findUnique({
                where: { id: req.user.id },
                select: { username_changed_at: true }
            });
            const lastChangeDate = new Date(
                lastUsernameChange.username_changed_at
            );
            const currentDate = new Date();
            const timeDifference = currentDate - lastChangeDate;
            const daysDifference = Math.floor(
                timeDifference / (1000 * 60 * 60 * 24)
            );

            if (daysDifference < 30) {
                return next(
                    new AppError(
                        'You can only change your username once every 30 days',
                        400
                    )
                );
            }

            const existingUsername = await User.findUnique({
                where: { username: validatedData.username }
            });

            if (existingUsername) {
                return next(new AppError('Username already exists', 400));
            }

            validatedData.username_changed_at = new Date();
        }

        const user = await User.update({
            where: { id: req.user.id },
            data: {
                bio: validatedData.bio || previousUserDetails.bio,
                display_name:
                    validatedData.display_name ||
                    previousUserDetails.display_name,
                profile_pic_link:
                    validatedData.profile_pic_link ||
                    previousUserDetails.profile_pic_link,
                profile_pic_public_id:
                    validatedData.profile_pic_public_id ||
                    previousUserDetails.profile_pic_public_id,
                username:
                    validatedData.username || previousUserDetails.username,
                username_changed_at:
                    validatedData.username_changed_at ||
                    previousUserDetails.username_changed_at
            },
            select: {
                id: true,
                email: true,
                username: true,
                display_name: true,
                bio: true,
                profile_pic_link: true,
                created_at: true
            }
        });

        if (validatedData.profile_pic_public_id) {
            await deleteFromCloudinary(
                previousUserDetails.profile_pic_public_id,
                'image'
            );
        }

        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        next(error);
    }
};
