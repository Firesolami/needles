const cloudinary = require('../config/cloudinary');
const stream = require('stream');

exports.uploadToCloudinary = async (buffer, originalname, type) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: type,
                folder: 'needles/media',
                public_id: `${Date.now()}-${originalname}`
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
    });
};

exports.deleteFromCloudinary = async (public_id, type) => {
    const deleteResult = await cloudinary.uploader.destroy(public_id, {
        resource_type: type
    });
    return deleteResult;
};
