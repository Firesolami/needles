const { z } = require('zod');
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (err instanceof z.ZodError) {
        res.status(400).json({
            status: 'fail',
            message: err.errors.map(e => e.message).join(', '),
            errors: err.errors
        });
        return;
    }

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } else {
            console.error('ERROR', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went wrong'
            });
        }
    }
};

module.exports = { AppError, errorHandler };
