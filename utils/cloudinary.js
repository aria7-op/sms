import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisify fs.unlink for async file deletion
const unlinkAsync = promisify(fs.unlink);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Uploads a file to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {string} folder - Cloudinary folder to upload to
 * @param {Object} options - Additional Cloudinary upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (filePath, folder, options = {}) => {
  try {
    // Set default options
    const uploadOptions = {
      folder: folder ? `${process.env.CLOUDINARY_ROOT_FOLDER || ''}${folder}` : undefined,
      resource_type: 'auto',
      overwrite: true,
      ...options
    };

    // Upload the file
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    // Delete the temporary file after upload
    try {
      await unlinkAsync(filePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }

    return result;
  } catch (error) {
    // Ensure temporary file is deleted even if upload fails
    try {
      await unlinkAsync(filePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary file after failed upload:', unlinkError);
    }
    throw error;
  }
};

/**
 * Uploads multiple files to Cloudinary
 * @param {Array} files - Array of file paths to upload
 * @param {string} folder - Cloudinary folder to upload to
 * @param {Object} options - Additional Cloudinary upload options
 * @returns {Promise<Array>} - Array of Cloudinary upload results
 */
const uploadMultipleToCloudinary = async (files, folder, options = {}) => {
  const uploadPromises = files.map(file => uploadToCloudinary(file.path, folder, options));
  return Promise.all(uploadPromises);
};

/**
 * Deletes a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file to delete
 * @param {Object} options - Additional Cloudinary delete options
 * @returns {Promise<Object>} - Cloudinary delete result
 */
const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    const deleteOptions = {
      resource_type: 'image', // default to image, can be overridden
      ...options
    };

    // If publicId includes file extension, remove it
    const cleanPublicId = publicId.replace(/\.[^/.]+$/, '');

    return await cloudinary.uploader.destroy(cleanPublicId, deleteOptions);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Gets Cloudinary resources in a folder
 * @param {string} folder - Folder to list resources from
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<Array>} - Array of Cloudinary resources
 */
const getCloudinaryResources = async (folder, options = {}) => {
  try {
    const listOptions = {
      type: 'upload',
      prefix: folder ? `${process.env.CLOUDINARY_ROOT_FOLDER || ''}${folder}` : undefined,
      max_results: 100,
      ...options
    };

    const result = await cloudinary.api.resources(listOptions);
    return result.resources;
  } catch (error) {
    console.error('Error getting Cloudinary resources:', error);
    throw error;
  }
};

/**
 * Generates a Cloudinary URL for a resource
 * @param {string} publicId - Public ID of the resource
 * @param {Object} options - Transformation options
 * @returns {string} - The generated URL
 */
const generateCloudinaryUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  const defaultOptions = {
    quality: 'auto',
    fetch_format: 'auto',
    ...options
  };

  return cloudinary.url(publicId, defaultOptions);
};

/**
 * Extracts public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} - Public ID
 */
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  // This regex matches Cloudinary URLs and extracts the public ID
  const regex = /upload\/(?:v\d+\/)?([^\.]+)/;
  const match = url.match(regex);
  
  return match ? match[1] : null;
};

export {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  getCloudinaryResources,
  generateCloudinaryUrl,
  extractPublicIdFromUrl,
  cloudinary
};