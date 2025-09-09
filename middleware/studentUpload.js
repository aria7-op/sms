import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createErrorResponse } from '../utils/responseUtils.js';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../config/uploadConfig.js';

// Configure storage for student avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/students/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, `avatar-${Date.now()}-${uniqueSuffix}`);
  }
});

// File filter function for images only
const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  // Only allow image files
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  if (allowedImageTypes.includes(mimetype) || allowedImageExtensions.includes(extname)) {
    return cb(null, true);
  }

  const error = new Error(`Only image files are allowed. Received: ${file.originalname}`);
  error.status = 400;
  cb(error);
};

// Configure multer upload for student avatars
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 5MB max
    files: 1 // Single file only
  }
});

// Middleware to handle upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(
        createErrorResponse('File too large', 'Image size exceeds 5MB limit')
      );
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json(
        createErrorResponse('Too many files', 'Only one image file is allowed')
      );
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json(
        createErrorResponse('Unexpected file', 'Unexpected field in file upload')
      );
    }
  } else if (err) {
    return res.status(400).json(
      createErrorResponse('Upload error', err.message)
    );
  }
  next();
};

// Middleware to validate file presence
const validateFilePresence = (fieldName) => (req, res, next) => {
  if (!req.file) {
    return res.status(400).json(
      createErrorResponse('Missing file', `No ${fieldName} file was uploaded`)
    );
  }
  next();
};

// Middleware to process uploaded file
const processUploadedFile = (req, res, next) => {
  if (req.file) {
    // Add file info to request object
    req.uploadedFile = {
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      url: `/uploads/students/avatars/${req.file.filename}`
    };
  }
  next();
};

export {
  upload,
  handleUploadErrors,
  validateFilePresence,
  processUploadedFile
};
