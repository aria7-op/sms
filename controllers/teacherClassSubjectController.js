import teacherClassSubjectService from '../services/teacherClassSubjectService.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { convertBigIntToString } from '../utils/responseUtils.js';

const prisma = new PrismaClient();

class TeacherClassSubjectController {

  /**
   * Assign a teacher to teach a subject in a specific class
   * POST /api/teacher-class-subjects
   */
  async assignTeacher(req, res) {
    try {
      const { teacherId, classId, subjectId } = req.body;
      const schoolId = req.user.schoolId;
      const assignedBy = req.user.id;

      if (!teacherId || !classId || !subjectId) {
        return res.status(400).json({
          success: false,
          message: 'teacherId, classId, and subjectId are required'
        });
      }

      const assignment = await teacherClassSubjectService.assignTeacherToClassSubject({
        teacherId,
        classId,
        subjectId,
        schoolId,
        assignedBy
      });

      const safeAssignment = convertBigIntToString(assignment);

      res.status(201).json({
        success: true,
        message: 'Teacher assigned successfully',
        data: safeAssignment
      });
    } catch (error) {
      console.error('Error assigning teacher:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all teacher-class-subject assignments for a school
   * GET /api/teacher-class-subjects
   */
  async getAssignments(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { 
        teacherId, 
        classId, 
        subjectId, 
        isActive,
        page = 1,
        limit = 10
      } = req.query;

      const options = {
        teacherId: teacherId ? parseInt(teacherId) : undefined,
        classId: classId ? parseInt(classId) : undefined,
        subjectId: subjectId ? parseInt(subjectId) : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : true,
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await teacherClassSubjectService.getAssignmentsBySchool(schoolId, options);

      res.json({
        success: true,
        message: 'Assignments retrieved successfully',
        data: convertBigIntToString(result.assignments),
        pagination: convertBigIntToString(result.pagination)
      });
    } catch (error) {
      console.error('Error getting assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignments'
      });
    }
  }

  /**
   * Get assignments by teacher
   * GET /api/teacher-class-subjects/teacher/:teacherId
   */
  async getAssignmentsByTeacher(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { teacherId } = req.params;

      if (!teacherId) {
        return res.status(400).json({
          success: false,
          message: 'Teacher ID is required'
        });
      }

      const assignments = await teacherClassSubjectService.getAssignmentsByTeacher(
        parseInt(teacherId),
        schoolId
      );

      res.json({
        success: true,
        message: 'Teacher assignments retrieved successfully',
        data: convertBigIntToString(assignments)
      });
    } catch (error) {
      console.error('Error getting teacher assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve teacher assignments'
      });
    }
  }

  /**
   * Get assignments by class
   * GET /api/teacher-class-subjects/class/:classId
   */
  async getAssignmentsByClass(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { classId } = req.params;

      if (!classId) {
        return res.status(400).json({
          success: false,
          message: 'Class ID is required'
        });
      }

      const assignments = await teacherClassSubjectService.getAssignmentsByClass(
        parseInt(classId),
        schoolId
      );

      res.json({
        success: true,
        message: 'Class assignments retrieved successfully',
        data: convertBigIntToString(assignments)
      });
    } catch (error) {
      console.error('Error getting class assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve class assignments'
      });
    }
  }

  /**
   * Get assignments by subject
   * GET /api/teacher-class-subjects/subject/:subjectId
   */
  async getAssignmentsBySubject(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { subjectId } = req.params;

      if (!subjectId) {
        return res.status(400).json({
          success: false,
          message: 'Subject ID is required'
        });
      }

      const assignments = await teacherClassSubjectService.getAssignmentsBySubject(
        parseInt(subjectId),
        schoolId
      );

      res.json({
        success: true,
        message: 'Subject assignments retrieved successfully',
        data: convertBigIntToString(assignments)
      });
    } catch (error) {
      console.error('Error getting subject assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve subject assignments'
      });
    }
  }

  /**
   * Get assignment by ID
   * GET /api/teacher-class-subjects/:id
   */
  async getAssignmentById(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Assignment ID is required'
        });
      }

      const assignment = await teacherClassSubjectService.getAssignmentById(
        parseInt(id),
        schoolId
      );

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      res.json({
        success: true,
        message: 'Assignment retrieved successfully',
        data: convertBigIntToString(assignment)
      });
    } catch (error) {
      console.error('Error getting assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment'
      });
    }
  }

  /**
   * Update assignment status
   * PATCH /api/teacher-class-subjects/:id/status
   */
  async updateAssignmentStatus(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const { isActive } = req.body;
      const updatedBy = req.user.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Assignment ID is required'
        });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value'
        });
      }

      const assignment = await teacherClassSubjectService.updateAssignmentStatus(
        parseInt(id),
        schoolId,
        isActive,
        updatedBy
      );

      res.json({
        success: true,
        message: `Assignment ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: assignment
      });
    } catch (error) {
      console.error('Error updating assignment status:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Remove assignment (soft delete)
   * DELETE /api/teacher-class-subjects/:id
   */
  async removeAssignment(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const updatedBy = req.user.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Assignment ID is required'
        });
      }

      await teacherClassSubjectService.removeAssignment(
        parseInt(id),
        schoolId,
        updatedBy
      );

      res.json({
        success: true,
        message: 'Assignment removed successfully'
      });
    } catch (error) {
      console.error('Error removing assignment:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Bulk assign teachers to classes and subjects
   * POST /api/teacher-class-subjects/bulk
   */
  async bulkAssign(req, res) {
    try {
      const { assignments } = req.body;
      const schoolId = req.user.schoolId;
      const assignedBy = req.user.id;

      if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'assignments array is required and must not be empty'
        });
      }

      const result = await teacherClassSubjectService.bulkAssign({
        assignments,
        schoolId,
        assignedBy
      });

      res.status(201).json({
        success: true,
        message: 'Bulk assignment completed',
        data: {
          success: result.success,
          errors: result.errors
        }
      });
    } catch (error) {
      console.error('Error bulk assigning:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk assignment'
      });
    }
  }
}

export default new TeacherClassSubjectController(); 