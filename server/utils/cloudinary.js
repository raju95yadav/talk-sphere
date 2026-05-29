const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'talk-sphere-avatars',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  },
});

const upload = multer({ storage: storage });

const chatMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let resource_type = 'auto';
    // Cloudinary treats PDFs as images by default. We must force them to be 'raw' to prevent browser viewer errors.
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('document') ||
      file.mimetype.includes('zip') ||
      file.mimetype.includes('csv') ||
      file.mimetype.includes('sheet') ||
      file.mimetype.includes('msword')
    ) {
      resource_type = 'raw';
    }
    return {
      folder: 'talk-sphere-media',
      resource_type: resource_type,
    };
  },
});

const uploadMedia = multer({ storage: chatMediaStorage });

module.exports = { cloudinary, upload, uploadMedia, chatMediaStorage };
