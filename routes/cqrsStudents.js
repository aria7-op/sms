import express from 'express';
import { dispatchCommand, registerCommandHandler } from '../cqrs/commandBus.js';
import { dispatchQuery, registerQueryHandler } from '../cqrs/queryBus.js';
import { StudentAggregate } from '../aggregates/studentAggregate.js';
import { eventStore } from '../eventstore/index.js';
import { getStudentById, getAllStudents } from '../projections/studentProjection.js';

const router = express.Router();

// Command Handlers
registerCommandHandler('CreateStudent', async (command) => {
  const aggregate = new StudentAggregate(command.payload.id);
  const events = aggregate.handle(command);
  events.forEach(event => eventStore.append('student', event));
  return { success: true };
});

registerCommandHandler('UpdateStudentName', async (command) => {
  const aggregate = new StudentAggregate(command.payload.id);
  const events = aggregate.handle(command);
  events.forEach(event => eventStore.append('student', event));
  return { success: true };
});

// Query Handlers
registerQueryHandler('GetStudentById', async (query) => {
  return getStudentById(query.payload.id);
});

registerQueryHandler('GetAllStudents', async () => {
  return getAllStudents();
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