const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Follower = prisma.follower;
const User = prisma.user;
const { AppError } = require('../middleware/errorHandler');

exports.follow = async (req, res, next) => {
    try {
        const { username } = req.params;

        const followedUser = await User.findUnique({
            where: { username }
        });

        if (!followedUser) {
            return next(new AppError('User not found', 404));
        }

        if (followedUser.id === req.user.id) {
            return next(new AppError('You cannot follow yourself', 400));
        }

        const existingFollow = await Follower.findFirst({
            where: {
                follower_id: req.user.id,
                following_id: followedUser.id
            }
        });

        if (existingFollow) {
            return next(
                new AppError('You are already following this user', 400)
            );
        }

        const follow = await Follower.create({
            data: {
                follower: { connect: { id: req.user.id } },
                following: { connect: { id: followedUser.id } }
            }
        });

        res.status(201).json({
            status: 'success',
            message: `User ${username} followed successfully.`
        });
    } catch (error) {
        next(error);
    }
};

exports.unfollow = async (req, res, next) => {
    try {
        const { username } = req.params;

        const unfollowedUser = await User.findUnique({
            where: { username }
        });

        if (!unfollowedUser) {
            return next(new AppError('User not found', 404));
        }

        if (unfollowedUser.id === req.user.id) {
            return next(new AppError('You cannot unfollow yourself', 400));
        }

        const existingFollow = await Follower.findFirst({
            where: {
                follower_id: req.user.id,
                following_id: unfollowedUser.id
            }
        });

        if (!existingFollow) {
            return next(new AppError('You are not following this user', 400));
        }

        const unfollow = await Follower.deleteMany({
            where: {
                follower_id: req.user.id,
                following_id: unfollowedUser.id
            }
        });

        res.status(200).json({
            status: 'success',
            message: `User ${username} unfollowed successfully.`
        });
    } catch (error) {
        next(error);
    }
};

exports.getFollowStatus = async (req, res, next) => {
    try {
        const { username } = req.params;

        const user = await User.findUnique({
            where: { username }
        });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (user.id === req.user.id) {
            res.status(200).json({
                status: 'success',
                data: {
                    is_user: true
                }
            });
            return;
        }

        const followed = await Follower.findFirst({
            where: {
                follower_id: user.id,
                following_id: req.user.id
            }
        });
        const follows = await Follower.findFirst({
            where: {
                follower_id: req.user.id,
                following_id: user.id
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                follows_you: !!followed,
                you_follow: !!follows
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getFollowers = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;
        const { username } = req.params;

        const user = await User.findUnique({
            where: { username }
        });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const followers = await Follower.findMany({
            where: {
                following_id: user.id
            },
            include: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                }
            },
            take: parseInt(count),
            skip: (parseInt(page) - 1) * parseInt(count),
        });

        res.status(200).json({
            status: 'success',
            data: {
                followers: followers.map((f) => f.follower)
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getFollowerCount = async (req, res, next) => {
    try {
        const { username } = req.params;

        const user = await User.findUnique({
            where: { username }
        });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const followerCount = await Follower.count({
            where: {
                following_id: user.id
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: followerCount
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getFollowing = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;
        const { username } = req.params;

        const user = await User.findUnique({
            where: { username }
        });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const following = await Follower.findMany({
            where: {
                follower_id: user.id
            },
            include: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                }
            },
            take: parseInt(count),
            skip: (parseInt(page) - 1) * parseInt(count),
        });

        res.status(200).json({
            status: 'success',
            data: {
                following: following.map((f) => f.following)
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getFollowingCount = async (req, res, next) => {
    try {
        const { username } = req.params;

        const user = await User.findUnique({
            where: { username }
        });

        if (!user) {
            return next(new AppError('User not found', 404));
        }
        const followingCount = await Follower.count({
            where: {
                follower_id: user.id
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: followingCount
            }
        });
    } catch (error) {
        next(error);
    }
};
