const multer = require('multer');
const { AppError } = require('./errorHandler');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['audio', 'video', 'image'];

    if (allowedTypes.includes(file.mimetype.split('/')[0])) {
        cb(null, true);
    } else {
        cb(
            new AppError(
                'Invalid file type. Only audio, video and image files are allowed.',
                400
            ),
            false
        );
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

module.exports = upload;
