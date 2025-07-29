import express from 'express';
import { getAllExaminations, getExaminationById, createExamination, updateExamination, deleteExamination } from '../controllers/examinationController.js';
const router = express.Router();

router.get('/', getAllExaminations);
router.get('/:school_id/:student_id/:subject_id/:exam_date', getExaminationById);
router.post('/', createExamination);
router.put('/:school_id/:student_id/:subject_id/:exam_date', updateExamination);
router.delete('/:school_id/:student_id/:subject_id/:exam_date', deleteExamination);

export default router; 