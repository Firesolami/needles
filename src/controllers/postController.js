const { PrismaClient, PostType, PostStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const Post = prisma.post;
const User = prisma.user;
const Like = prisma.like;
const Dislike = prisma.dislike;
const Bookmark = prisma.bookmark;
const { z } = require('zod');
const { AppError } = require('../middleware/errorHandler');
const {
    uploadToCloudinary,
    deleteFromCloudinary
} = require('../utils/cloudinary');

const postSchema = z.object({
    body: z
        .string()
        .min(1, 'Post body is required')
        .max(300, 'Post body cannot exceed 300 characters')
        .optional()
});

const postMetrics = {
    likes_count: true,
    dislikes_count: true,
    comments_count: true,
    reposts_count: true,
    quotes_count: true,
    bookmarks_count: true,
};

async function getPostMetricsByUser(userId, postId) {
    const like = await Like.findFirst({
        where: {
            user_id: userId,
            post_id: postId
        }
    });
    const dislike = await Dislike.findFirst({
        where: {
            user_id: userId,
            post_id: postId
        }
    });
    const repost = await Post.findFirst({
        where: {
            user_id: userId,
            parent_id: postId,
            type: PostType.REPOST
        }
    });
    return {
        is_liked_by_user: !!like,
        is_disliked_by_user: !!dislike,
        is_reposted_by_user: !!repost
    };
}

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
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'raw'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'audio',
                        public_id
                    })
                );
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'image'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'image',
                        public_id
                    })
                );
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'video'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'video',
                        public_id
                    })
                );
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
                ...postMetrics
            }
        });

        post.media_links = media_links.map((obj) => JSON.parse(obj));

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

exports.getPostById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const post = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED
                // type: PostType.ORIGINAL
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        likes_count: true,
                        dislikes_count: true
                    }
                }
            }
        });

        if (!post) {
            return next(new AppError('Post not found', 404));
        }

        post.media_links = post.media_links.map((link) => JSON.parse(link));
        if (post.parent) {
            post.parent.media_links = post.parent.media_links.map((link) =>
                JSON.parse(link)
            );
        }

        post.userMetrics = await getPostMetricsByUser(req.user.id, post.id);

        res.status(200).json({
            status: 'success',
            data: {
                post
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.toggleLike = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
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
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
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
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'raw'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'audio',
                        public_id
                    })
                );
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'image'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'image',
                        public_id
                    })
                );
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'video'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'video',
                        public_id
                    })
                );
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

        draft.media_links = media_links.map((obj) => JSON.parse(obj));

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
            return next(
                new AppError(
                    "You are not authorized to manage this user's drafts",
                    403
                )
            );
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
                ...postMetrics
            }
        });

        if (!draft) {
            return next(new AppError('Draft not found', 404));
        }

        await Post.update({
            where: { id: draft.id },
            data: {
                status: PostStatus.PUBLISHED
            }
        });

        draft.media_links = draft.media_links.map((link) => JSON.parse(link));
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
        const { username = '' } = req.query;

        const user = await User.findUnique({ where: { username } });

        if (!user && username) {
            return next(new AppError('User not found', 404));
        }

        const user_id = user ? user.id : req.user.id;

        const posts = await Post.findMany({
            where: {
                user_id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPOST]
                }
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
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                }
            }
        });

        for (const post of posts) {
            // Get metrics
            let userPostMetrics = {};
            if (post.type === PostType.REPOST) {
                userPostMetrics = await getPostMetricsByUser(
                    req.user.id,
                    post.parent.id
                );
            } else {
                userPostMetrics = await getPostMetricsByUser(
                    req.user.id,
                    post.id
                );
            }
            post.userMetrics = userPostMetrics;

            // Parse media links
            post.media_links = post.media_links.map((link) => JSON.parse(link));
            if (post.parent) {
                post.parent.media_links = post.parent.media_links.map((link) =>
                    JSON.parse(link)
                );
            }
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

exports.deletePost = async (req, res, next) => {
    try {
        const { id } = req.params;

        const ownedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED
            },
            select: {
                id: true,
                user_id: true
            }
        });

        if (!ownedPost) {
            return next(new AppError('Post not found', 404));
        }

        if (ownedPost.user_id !== req.user.id) {
            return next(
                new AppError('You are not authorized to delete this post', 403)
            );
        }

        ///////////////////// Reecursive ///////////////////////
        async function fetchPostWithChildren(postId) {
            const post = await Post.findFirst({
                where: { id: postId, status: PostStatus.PUBLISHED },
                select: {
                    id: true,
                    media_links: true,
                    children: {
                        select: {
                            id: true,
                            media_links: true
                        }
                    }
                }
            });

            if (post && post.children.length > 0) {
                for (const child of post.children) {
                    child.children = await fetchPostWithChildren(child.id);
                }
            }

            return post;
        }

        const post = await fetchPostWithChildren(id);

        async function deleteMediaFromPostsWithChildren(post) {
            if (post) {
                for (const media of post.media_links) {
                    await deleteFromCloudinary(media.public_id);
                    console.log(
                        `Deleted media of Post: ${post.id} with Public ID: ${media.public_id}`
                    );
                }

                post.children = Array.isArray(post.children)
                    ? post.children
                    : [];
                for (const child of post.children) {
                    await deleteMediaFromPostsWithChildren(child);
                }
            }
        }

        await deleteMediaFromPostsWithChildren(post);

        ///////////////////////////////////////////////////////

        await Post.delete({
            where: { id }
        });

        res.status(204);
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
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE]
                }
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
        const { username } = req.query;

        const user = await User.findUnique({ where: { username } });

        if (!user) {
            return next(new AppError('User not found', 404));
        }

        if (user.id !== req.user.id) {
            return next(
                new AppError(
                    "You are not authorized to view this user's drafts",
                    403
                )
            );
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
                type: true
            }
        });

        for (const draft of drafts) {
            draft.media_links = draft.media_links.map((link) =>
                JSON.parse(link)
            );
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
            return next(
                new AppError(
                    "You are not authorized to view this user's drafts",
                    403
                )
            );
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

exports.createQuote = async (req, res, next) => {
    try {
        const { id } = req.params;

        const quotedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            },
            select: {
                id: true,
                quotes_count: true
            }
        });
        if (!quotedPost) {
            return next(new AppError('Post not found', 404));
        }

        const validatedData = postSchema.parse(req.body);
        const { body } = validatedData;
        const audio = req.files?.audio || null;
        const images = req.files?.images || null;
        const video = req.files?.video || null;

        const media_links = [];
        if (audio) {
            for (const file of audio) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'raw'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'audio',
                        public_id
                    })
                );
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'image'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'image',
                        public_id
                    })
                );
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'video'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'video',
                        public_id
                    })
                );
            }
        }

        const quote = await Post.create({
            data: {
                body,
                user: { connect: { id: req.user.id } },
                status: PostStatus.PUBLISHED,
                type: PostType.QUOTE,
                media_links,
                parent: { connect: { id: quotedPost.id } }
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                ...postMetrics,
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                },
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

        quote.media_links = media_links.map((obj) => JSON.parse(obj));
        quote.parent.media_links = quote.parent.media_links.map((link) =>
            JSON.parse(link)
        );

        await Post.update({
            where: { id: quotedPost.id },
            data: {
                quotes_count: quotedPost.quotes_count + 1
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                quote
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getQuotesForPost = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;
        const { id } = req.params;

        const quotedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            }
        });
        if (!quotedPost) {
            return next(new AppError('Post not found', 404));
        }

        const quotes = await Post.findMany({
            where: {
                parent_id: id,
                status: PostStatus.PUBLISHED,
                type: PostType.QUOTE
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
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                }
            }
        });

        for (const quote of quotes) {
            quote.userMetrics = await getPostMetricsByUser(
                req.user.id,
                quote.id
            );

            quote.media_links = quote.media_links.map((link) =>
                JSON.parse(link)
            );
            if (quote.parent) {
                quote.parent.media_links = quote.parent.media_links.map(
                    (link) => JSON.parse(link)
                );
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                quotes
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createComment = async (req, res, next) => {
    try {
        const { id } = req.params;

        const repliedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            },
            select: {
                id: true,
                comments_count: true
            }
        });
        if (!repliedPost) {
            return next(new AppError('Post not found', 404));
        }

        const validatedData = postSchema.parse(req.body);
        const { body } = validatedData;
        const audio = req.files?.audio || null;
        const images = req.files?.images || null;
        const video = req.files?.video || null;

        const media_links = [];
        if (audio) {
            for (const file of audio) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'raw'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'audio',
                        public_id
                    })
                );
            }
        }
        if (images) {
            for (const file of images) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'image'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'image',
                        public_id
                    })
                );
            }
        }
        if (video) {
            for (const file of video) {
                const { originalname, buffer } = file;
                const { secure_url, public_id } = await uploadToCloudinary(
                    buffer,
                    originalname,
                    'video'
                );
                media_links.push(
                    JSON.stringify({
                        link: secure_url,
                        type: 'video',
                        public_id
                    })
                );
            }
        }

        const comment = await Post.create({
            data: {
                body,
                user: { connect: { id: req.user.id } },
                status: PostStatus.PUBLISHED,
                type: PostType.REPLY,
                media_links,
                parent: { connect: { id: repliedPost.id } }
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                ...postMetrics,
                parent: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                },
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

        comment.media_links = media_links.map((obj) => JSON.parse(obj));

        await Post.update({
            where: { id: repliedPost.id },
            data: {
                comments_count: repliedPost.comments_count + 1
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                comment
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getCommentsForPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { count = 10, page = 1 } = req.query;

        const repliedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            }
        });
        if (!repliedPost) {
            return next(new AppError('Post not found', 404));
        }

        const comments = await Post.findMany({
            where: {
                parent_id: id,
                status: PostStatus.PUBLISHED,
                type: PostType.REPLY
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
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                }
            }
        });

        for (const comment of comments) {
            comment.userMetrics = await getPostMetricsByUser(
                req.user.id,
                comment.id
            );
            comment.media_links = comment.media_links.map((link) =>
                JSON.parse(link)
            );
        }

        res.status(200).json({
            status: 'success',
            data: {
                comments
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createRepost = async (req, res, next) => {
    try {
        const { id } = req.params;

        const repostedPost = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            },
            select: {
                id: true,
                reposts_count: true
            }
        });
        if (!repostedPost) {
            return next(new AppError('Post not found', 404));
        }

        const repost = await Post.create({
            data: {
                user: { connect: { id: req.user.id } },
                status: PostStatus.PUBLISHED,
                type: PostType.REPOST,
                parent: { connect: { id: repostedPost.id } }
            },
            select: {
                id: true,
                created_at: true,
                type: true,
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                },
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

        repost.parent.media_links = repost.parent.media_links.map((link) =>
            JSON.parse(link)
        );
        repost.likes_count = repostedPost.likes_count;
        repost.dislikes_count = repostedPost.dislikes_count;

        await Post.update({
            where: { id: repostedPost.id },
            data: {
                reposts_count: repostedPost.reposts_count + 1
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                repost
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getRepliesByUser = async (req, res, next) => {
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
                type: {
                    in: [PostType.REPOST, PostType.REPLY]
                }
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
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                }
            }
        });

        for (const post of posts) {
            let userPostMetrics = {};
            if (post.type === PostType.REPOST) {
                userPostMetrics = await getPostMetricsByUser(
                    req.user.id,
                    post.parent.id
                );
            } else {
                userPostMetrics = await getPostMetricsByUser(
                    req.user.id,
                    post.id
                );
            }
            post.userMetrics = userPostMetrics;
            post.media_links = post.media_links.map((link) => JSON.parse(link));
            if (post.parent) {
                post.parent.media_links = post.parent.media_links.map((link) =>
                    JSON.parse(link)
                );
            }
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

exports.createBookmark = async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            return next(new AppError('Post ID is required', 400));
        }

        const post = await Post.findFirst({
            where: {
                id,
                status: PostStatus.PUBLISHED,
                type: {
                    in: [PostType.ORIGINAL, PostType.QUOTE, PostType.REPLY]
                }
            },
            select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                ...postMetrics,
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                },
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

        if (!post) {
            return next(new AppError('Post not found', 404));
        }

        post.userMetrics =  await getPostMetricsByUser(
            req.user.id,
            post.id
        );

        post.media_links = post.media_links.map((link) => JSON.parse(link));
        if (post.parent) {
            post.parent.media_links = post.parent.media_links.map((link) =>
                JSON.parse(link)
            );
        }

        const existingBookmark = await Bookmark.findFirst({
            where: {
                user_id: req.user.id,
                post_id: post.id
            }
        });

        if (existingBookmark) {
            return next(new AppError('Post already bookmarked', 400));
        }

        const bookmark = await Bookmark.create({
            data: {
                user: { connect: { id: req.user.id } },
                post: { connect: { id: post.id } }
            },
            select: {
                id: true,
                created_at: true
            }
        });

        await Post.update({
            where: { id: post.id },
            data: {
                bookmarks_count: post.bookmarks_count + 1
            }
        });

        post.bookmarks_count = post.bookmarks_count + 1;

        bookmark.post = post;

        res.status(201).json({
            status: 'success',
            data: {
                bookmark
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getBookmarksByUser = async (req, res, next) => {
    try {
        const { count = 10, page = 1 } = req.query;

        const bookmarks = await Bookmark.findMany({
            where: {
                user_id: req.user.id
            },
            take: parseInt(count),
            skip: (parseInt(page) - 1) * parseInt(count),
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                post: {select: {
                id: true,
                body: true,
                media_links: true,
                created_at: true,
                type: true,
                ...postMetrics,
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_pic_link: true
                    }
                },
                parent: {
                    select: {
                        id: true,
                        body: true,
                        media_links: true,
                        created_at: true,
                        type: true,
                        ...postMetrics,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_pic_link: true
                            }
                        }
                    }
                }
            }}}
        });

        for (const bookmark of bookmarks) {
            bookmark.post.userMetrics = await getPostMetricsByUser(
                req.user.id,
                bookmark.post.id
            );
            bookmark.post.media_links = bookmark.post.media_links.map((link) => JSON.parse(link));
            if (bookmark.post.parent) {
                bookmark.post.parent.media_links = bookmark.post.parent.media_links.map((link) =>
                    JSON.parse(link)
                );
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                bookmarks
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteBookmark = async (req, res, next) => {
    try {
        const { id } = req.params;

        const bookmark = await Bookmark.findFirst({
            where: {
                user_id: req.user.id,
                id
            },
            select: {
                id: true,
                post: {
                    select: {
                        id: true,
                        bookmarks_count: true
                    }
                }
            }
        });

        if (!bookmark) {
            return next(new AppError('Bookmark not found', 404));
        }

        await Post.update({
            where: { id: bookmark.post.id },
            data: {
                bookmarks_count: bookmark.post.bookmarks_count - 1
            }
        });

        await Bookmark.delete({
            where: {
                id: bookmark.id
            }
        });

        res.status(204);
    } catch (error) {
        next(error);
    }
};