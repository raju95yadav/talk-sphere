const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Dedicated staging directory for temporary document parsing [B-08]
const tempUploadDir = path.join(os.tmpdir(), 'talksphere-rag-temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `rag-${uniqueSuffix}${ext}`);
  }
});

const allowedMimes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/x-markdown'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isExtAllowed = ['pdf', 'docx', 'txt', 'md'].includes(ext);
  const isMimeAllowed = allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('text/');

  if (isExtAllowed && isMimeAllowed) {
    cb(null, true);
  } else {
    const err = new Error('Invalid document format. Allowed types: .pdf, .docx, .txt, .md');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const ragUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB cap [B-08]
  fileFilter
});

module.exports = { ragUpload, tempUploadDir };

