import { eventStore } from '../eventstore/index.js';

const students = new Map();

function apply(event) {
  switch (event.type) {
    case 'StudentCreated':
      students.set(event.aggregateId, { ...event.payload });
      break;
    case 'StudentNameUpdated':
      if (students.has(event.aggregateId)) {
        students.get(event.aggregateId).name = event.payload.name;
      }
      break;
    // Add more event types as needed
  }
}

eventStore.subscribe('student', apply);

export function getStudentById(id) {
  return students.get(id);
}

export function getAllStudents() {
  return Array.from(students.values());
} 