const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createId } = require('./helpers');

const productUploadDir = path.join(__dirname, '../../public/uploads/products');
const customOrderUploadDir = path.join(__dirname, '../../public/uploads/custom-orders');
fs.mkdirSync(productUploadDir, { recursive: true });
fs.mkdirSync(customOrderUploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const storage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, productUploadDir);
  },
  filename: function filename(req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${createId()}${extension}`);
  }
});

function imageFileFilter(req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error('Formato de imagen no permitido. Usa jpg, png, webp, gif o avif.'));
  }
  cb(null, true);
}

const uploadProductImage = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024)
  },
  fileFilter: imageFileFilter
});

const customOrderStorage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, customOrderUploadDir);
  },
  filename: function filename(req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${createId()}${extension}`);
  }
});

const uploadCustomReferenceImage = multer({
  storage: customOrderStorage,
  limits: {
    fileSize: Number(process.env.CUSTOM_ORDER_UPLOAD_MAX_BYTES || process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024)
  },
  fileFilter: imageFileFilter
});

function getUploadedImageUrl(file) {
  if (!file) return '';
  return `/uploads/products/${file.filename}`;
}

function getUploadedCustomReferenceUrl(file) {
  if (!file) return '';
  return `/uploads/custom-orders/${file.filename}`;
}

module.exports = {
  uploadProductImage,
  uploadCustomReferenceImage,
  getUploadedImageUrl,
  getUploadedCustomReferenceUrl
};
