import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllExaminations = async (req, res) => {
  const examinations = await prisma.examination.findMany();
  res.json(examinations);
};

export const getExaminationById = async (req, res) => {
  const { school_id, student_id, subject_id, exam_date } = req.params;
  const examination = await prisma.examination.findUnique({
    where: {
      school_id_student_id_subject_id_exam_date: {
        school_id: parseInt(school_id),
        student_id: parseInt(student_id),
        subject_id: parseInt(subject_id),
        exam_date: new Date(exam_date)
      }
    }
  });
  if (!examination) return res.status(404).json({ error: 'Examination not found' });
  res.json(examination);
};

export const createExamination = async (req, res) => {
  const { school_id, student_id, subject_id, marks, max_marks, exam_type, academic_year, term_id, exam_date } = req.body;
  const examination = await prisma.examination.create({
    data: { school_id, student_id, subject_id, marks, max_marks, exam_type, academic_year, term_id, exam_date }
  });
  res.status(201).json(examination);
};

export const updateExamination = async (req, res) => {
  const { school_id, student_id, subject_id, exam_date } = req.params;
  const { marks, max_marks, exam_type, academic_year, term_id } = req.body;
  const examination = await prisma.examination.update({
    where: {
      school_id_student_id_subject_id_exam_date: {
        school_id: parseInt(school_id),
        student_id: parseInt(student_id),
        subject_id: parseInt(subject_id),
        exam_date: new Date(exam_date)
      }
    },
    data: { marks, max_marks, exam_type, academic_year, term_id }
  });
  res.json(examination);
};

export const deleteExamination = async (req, res) => {
  const { school_id, student_id, subject_id, exam_date } = req.params;
  await prisma.examination.delete({
    where: {
      school_id_student_id_subject_id_exam_date: {
        school_id: parseInt(school_id),
        student_id: parseInt(student_id),
        subject_id: parseInt(subject_id),
        exam_date: new Date(exam_date)
      }
    }
  });
  res.json({ message: 'Examination deleted' });
}; 