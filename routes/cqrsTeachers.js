import express from 'express';
import { dispatchCommand, registerCommandHandler } from '../cqrs/commandBus.js';
import { dispatchQuery, registerQueryHandler } from '../cqrs/queryBus.js';
import { TeacherAggregate } from '../aggregates/teacherAggregate.js';
import { eventStore } from '../eventstore/index.js';
import { getTeacherById, getAllTeachers } from '../projections/teacherProjection.js';

const router = express.Router();

// Command Handlers
registerCommandHandler('CreateTeacher', async (command) => {
  const aggregate = new TeacherAggregate(command.payload.id);
  const events = aggregate.handle(command);
  events.forEach(event => eventStore.append('teacher', event));
  return { success: true };
});

registerCommandHandler('UpdateTeacherName', async (command) => {
  const aggregate = new TeacherAggregate(command.payload.id);
  const events = aggregate.handle(command);
  events.forEach(event => eventStore.append('teacher', event));
  return { success: true };
});

// Query Handlers
registerQueryHandler('GetTeacherById', async (query) => {
  return getTeacherById(query.payload.id);
});

registerQueryHandler('GetAllTeachers', async () => {
  return getAllTeachers();
});

// API Endpoints
router.post('/commands', async (req, res) => {
  try {
    const result = await dispatchCommand(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/queries', async (req, res) => {
  try {
    const result = await dispatchQuery(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router; 