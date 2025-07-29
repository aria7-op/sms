import { eventStore } from '../eventstore/index.js';

const teachers = new Map();

function apply(event) {
  switch (event.type) {
    case 'TeacherCreated':
      teachers.set(event.aggregateId, { ...event.payload });
      break;
    case 'TeacherNameUpdated':
      if (teachers.has(event.aggregateId)) {
        teachers.get(event.aggregateId).name = event.payload.name;
      }
      break;
    // Add more event types as needed
  }
}

eventStore.subscribe('teacher', apply);

export function getTeacherById(id) {
  return teachers.get(id);
}

export function getAllTeachers() {
  return Array.from(teachers.values());
} 