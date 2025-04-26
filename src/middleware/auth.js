const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

module.exports = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('You are not logged in', 401));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findUnique({
            where: { id: decoded.id },
            select: { password_changed_at: true }
        });

        if (!user) {
            return next(
                new AppError(
                    'This user does not exist or has been deleted',
                    401
                )
            );
        }

        if (user.password_changed_at) {
            const changedTimeStamp = parseInt(
                user.password_changed_at.getTime() / 1000,
                10
            );
            if (changedTimeStamp > decoded.iat) {
                return next(
                    new AppError(
                        'User recently changed password. Please log in again',
                        401
                    )
                );
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        next(new AppError('Invalid token', 401));
    }
};
