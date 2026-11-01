const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

/**
 * Pipes a readable file/media stream directly to Cloudinary storage.
 * Ensures zero buffering in Node.js V8 memory heap (constant O(1) memory overhead).
 *
 * @param {ReadableStream} readableStream - Node.js readable stream (from request or file)
 * @param {object} options - Cloudinary upload parameters (folder, resource_type, etc.)
 * @returns {Promise<object>} Cloudinary upload result
 */
const streamUploadToCloudinary = (readableStream, options = {}) => {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder: 'talk-sphere-media',
      resource_type: options.resource_type || 'auto'
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      { ...defaultOptions, ...options },
      (error, result) => {
        if (error) {
          logger.error('CLOUDINARY_STREAM_UPLOAD_ERROR', error.message || error);
          return reject(error);
        }
        resolve(result);
      }
    );

    readableStream.pipe(uploadStream);
  });
};

module.exports = {
  streamUploadToCloudinary
};

