import express from 'express';
import { getAllDocuments, getDocumentById, createDocument, updateDocument, deleteDocument } from '../controllers/documentController.js';
const router = express.Router();

router.get('/', getAllDocuments);
router.get('/:id', getDocumentById);
router.post('/', createDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router; 