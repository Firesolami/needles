require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');

const app = express();

const prisma = new PrismaClient();

app.set('trust proxy', 1);

app.use(
    cors({
        origin:
            process.env.NODE_ENV === 'production'
                ? process.env.FRONTEND_URL
                : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);

app.use(helmet());

app.options('/*wildcard', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, HEAD'
    );
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(204); // No Content
});

const limiter = rateLimit({
    max: 200,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour'
});

app.use('/api', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(compression());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);

app.use('/ping', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'pong'
    });
});

// 404 handler
app.all('/*wildcard', (req, res, next) => {
    res.status(404).json({
        status: 'fail',
        message: `${req.originalUrl} not found.`
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down server');
    await prisma.$disconnect();
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});

module.exports = app;
