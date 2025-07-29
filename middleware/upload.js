import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createErrorResponse } from '../utils/responseUtils.js';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../config/uploadConfig.js';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/equipment/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, `${Date.now()}-${uniqueSuffix}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (ALLOWED_FILE_TYPES.includes(mimetype) || 
      ALLOWED_FILE_EXTENSIONS.includes(extname)) {
    return cb(null, true);
  }

  const error = new Error(`File type not allowed: ${file.originalname}`);
  error.status = 400;
  cb(error);
};

// Configure multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // Defined in config
    files: 1 // Limit to single file upload
  }
});

// Middleware to handle upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(
        createErrorResponse('File too large', 'File size exceeds the maximum allowed limit')
      );
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json(
        createErrorResponse('Too many files', 'Only single file uploads are allowed')
      );
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json(
        createErrorResponse('Unexpected file', 'Unexpected field in file upload')
      );
    }
  } else if (err) {
    // An unknown error occurred when uploading
    return res.status(400).json(
      createErrorResponse('Upload error', err.message)
    );
  }
  next();
};

// Middleware to validate file presence after upload
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
    // Add file info to request object for controller to use
    req.uploadedFile = {
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename
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