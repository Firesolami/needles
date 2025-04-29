const { PrismaClient, PostType, PostStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const Post = prisma.post;
const User = prisma.user;
const Like = prisma.like;
const Dislike = prisma.dislike;
const { z } = require('zod');
const { AppError } = require('../middleware/errorHandler');
const {
    uploadToCloudinary
} = require('../utils/cloudinary');

const postSchema = z.object({
    body: z.string().min(1, 'Post body is required').max(300, 'Post body cannot exceed 300 characters').optional(),
});

exports.createPost = async (req, res, next) => {
    try {
        const validatedData = postSchema.parse(req.body);
        const { body } = validatedData;
        const audio = req.files?.audio || null;
        const images = req.files?.images || null;
        const video = req.files?.video || null;
        
        const media_links = [];
        if (audio) {
            for (const file of audio) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'raw');
                media_links.push(JSON.stringify({ link: secure_url, type: 'audio', public_id }));
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'image');
                media_links.push(JSON.stringify({ link: secure_url, type: 'image', public_id }));
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'video');
                media_links.push(JSON.stringify({ link: secure_url, type: 'video', public_id }));
            }
        }

        const post = await Post.create({
            data: {
                body,
                user: { connect: { id: req.user.id } },
                status: PostStatus.PUBLISHED,
                type: PostType.ORIGINAL,
                media_links
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                likes_count: true,
                dislikes_count: true
            }
        });

        post.media_links = media_links.map(obj => JSON.parse(obj));

        res.status(201).json({
            status: 'success',
            data: {
                post
            }
        });
    } catch (error) {
        next(error);
    }
};

// TODO: Add like logic for is post is a repost

exports.toggleLike = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await Post.findFirst({
            where: { 
                id,
                status: PostStatus.PUBLISHED,
            },
            select: {
                id: true,
                dislikes_count: true,
                likes_count: true
            }
        });

        if (!post) {
            return next(new AppError('Post not found', 404));
        }

        const existingDislike = await Dislike.findFirst({
            where: {
                user_id: req.user.id,
                post_id: id
            }
        });
        const existingLike = await Like.findFirst({
            where: {
                user_id: req.user.id,
                post_id: id
            }
        });

        if (existingLike) {
            await Like.delete({ where: { id: existingLike.id } });
            post.likes_count -= 1;

            await Post.update({
                where: { id },
                data: {
                    likes_count: post.likes_count
                }
            });

            res.status(200).json({
                status: 'success',
                data: {
                    likes_count: post.likes_count,
                    dislikes_count: post.dislikes_count
                }
            });
            return;
        }

        if (existingDislike) {
            await Dislike.delete({ where: { id: existingDislike.id } });
            post.dislikes_count -= 1;
        }

        post.likes_count += 1;
        await Post.update({
            where: { id },
            data: {
                dislikes_count: post.dislikes_count,
                likes_count: post.likes_count
            }
        });

        await Like.create({
            data: {
                user: { connect: { id: req.user.id } },
                post: { connect: { id } }
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                likes_count: post.likes_count,
                dislikes_count: post.dislikes_count
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.toggleDislike = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await Post.findFirst({
            where: { 
                id,
                status: PostStatus.PUBLISHED,
            },
            select: {
                id: true,
                dislikes_count: true,
                likes_count: true
            }
        });

        if (!post) {
            return next(new AppError('Post not found', 404));
        }

        const existingDislike = await Dislike.findFirst({
            where: {
                user_id: req.user.id,
                post_id: id
            }
        });
        const existingLike = await Like.findFirst({
            where: {
                user_id: req.user.id,
                post_id: id
            }
        });
        if (existingDislike) {
            await Dislike.delete({ where: { id: existingDislike.id } });
            post.dislikes_count -= 1;

            await Post.update({
                where: { id },
                data: {
                    dislikes_count: post.dislikes_count
                }
            });

            res.status(200).json({
                status: 'success',
                data: {
                    likes_count: post.likes_count,
                    dislikes_count: post.dislikes_count
                }
            });
            return;
        }

        if (existingLike) {
            await Like.delete({ where: { id: existingLike.id } });
            post.likes_count -= 1;
        }

        post.dislikes_count += 1;
        await Post.update({
            where: { id },
            data: {
                dislikes_count: post.dislikes_count,
                likes_count: post.likes_count
            }
        });

        await Dislike.create({
            data: {
                user: { connect: { id: req.user.id } },
                post: { connect: { id } }
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                likes_count: post.likes_count,
                dislikes_count: post.dislikes_count
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createDraft = async (req, res, next) => {
    try {
        const validatedData = postSchema.parse(req.body);
        const { body } = validatedData;
        const audio = req.files?.audio || null;
        const images = req.files?.images || null;
        const video = req.files?.video || null;
        
        const media_links = [];
        if (audio) {
            for (const file of audio) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'raw');
                media_links.push(JSON.stringify({ link: secure_url, type: 'audio', public_id }));
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'image');
                media_links.push(JSON.stringify({ link: secure_url, type: 'image', public_id }));
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(buffer, originalname, 'video');
                media_links.push(JSON.stringify({ link: secure_url, type: 'video', public_id }));
            }
        }

        const draft = await Post.create({
            data: {
                body,
                user: { connect: { id: req.user.id } },
                status: PostStatus.DRAFT,
                type: PostType.ORIGINAL,
                media_links
            }
        });

        draft.media_links = media_links.map(obj => JSON.parse(obj));

        res.status(201).json({
            status: 'success',
            data: {
                draft
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createPostFromDraft = async (req, res, next) => {
    try {
        const { username, id } = req.params;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (user.id !== req.user.id) {
            return next(new AppError('You are not authorized to manage this user\'s drafts', 403));
        }

        const draft = await Post.findFirst({
            where: { 
                id,
                user_id: user.id,
                status: PostStatus.DRAFT,
                type: PostType.ORIGINAL
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                likes_count: true,
                dislikes_count: true
            }
        });

        if (!draft) {
            return next(new AppError('Draft not found', 404));
        }

        await Post.update({
            where: { id: draft.id },
            data: {
                status: PostStatus.PUBLISHED,
            }
        });

        draft.media_links = draft.media_links.map(link => JSON.parse(link));
        draft.status = PostStatus.PUBLISHED;

        res.status(201).json({
            status: 'success',
            data: {
                post: draft
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getPostsByUser = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;
        const { username } = req.params;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const posts = await Post.findMany({
            where: { 
                user_id: user.id,
                status: PostStatus.PUBLISHED,
                type: PostType.ORIGINAL
            },
            take: parseInt(count),
            skip: (parseInt(page) - 1) * parseInt(count),
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                likes_count: true,
                dislikes_count: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                }
            }
        });

        for (const post of posts) {
            post.media_links = post.media_links.map(link => JSON.parse(link));
        }

        res.status(200).json({
            status: 'success',
            data: {
                posts
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getPostCountByUser = async (req, res, next) => {
    try {
        const { username } = req.params;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        const posts = await Post.findMany({
            where: { 
                user_id: user.id,
                status: PostStatus.PUBLISHED,
                type: PostType.ORIGINAL
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: posts.length
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getDraftsByUser = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;
        const { username } = req.params;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (user.id !== req.user.id) {
            return next(new AppError('You are not authorized to view this user\'s drafts', 403));
        }

        const drafts = await Post.findMany({
            where: { 
                user_id: user.id,
                status: PostStatus.DRAFT,
                type: PostType.ORIGINAL
            },
            take: parseInt(count),
            skip: (parseInt(page) - 1) * parseInt(count),
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
            }
        });

        for (const draft of drafts) {
            draft.media_links = draft.media_links.map(link => JSON.parse(link));
        }

        res.status(200).json({
            status: 'success',
            data: {
                drafts
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getDraftCountByUser = async (req, res, next) => {
    try {
        const { username } = req.params;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (user.id !== req.user.id) {
            return next(new AppError('You are not authorized to view this user\'s drafts', 403));
        }

        const drafts = await Post.findMany({
            where: { 
                user_id: user.id,
                status: PostStatus.DRAFT,
                type: PostType.ORIGINAL
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: drafts.length
            }
        });
    } catch (error) {
        next(error);
    }
};