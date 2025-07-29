import { eventStore } from '../eventstore/index.js';

export class TeacherAggregate {
  constructor(id) {
    this.id = id;
    this.state = {};
    this.loadFromHistory(eventStore.getEvents('teacher', id));
  }

  loadFromHistory(events) {
    events.forEach(event => this.apply(event));
  }

  apply(event) {
    switch (event.type) {
      case 'TeacherCreated':
        this.state = { ...event.payload };
        break;
      case 'TeacherNameUpdated':
        this.state.name = event.payload.name;
        break;
      // Add more event types as needed
    }
  }

  handle(command) {
    switch (command.type) {
      case 'CreateTeacher':
        if (this.state.id) throw new Error('Teacher already exists');
        return [{
          type: 'TeacherCreated',
          aggregateId: this.id,
          payload: { id: this.id, ...command.payload },
          timestamp: Date.now()
        }];
      case 'UpdateTeacherName':
        if (!this.state.id) throw new Error('Teacher does not exist');
        return [{
          type: 'TeacherNameUpdated',
          aggregateId: this.id,
          payload: { name: command.payload.name },
          timestamp: Date.now()
        }];
      // Add more command types as needed
      default:
        throw new Error('Unknown command');
    }
  }
} 