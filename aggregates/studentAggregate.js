import { eventStore } from '../eventstore/index.js';

export class StudentAggregate {
  constructor(id) {
    this.id = id;
    this.state = {};
    this.loadFromHistory(eventStore.getEvents('student', id));
  }

  loadFromHistory(events) {
    events.forEach(event => this.apply(event));
  }

  apply(event) {
    switch (event.type) {
      case 'StudentCreated':
        this.state = { ...event.payload };
        break;
      case 'StudentNameUpdated':
        this.state.name = event.payload.name;
        break;
      // Add more event types as needed
    }
  }

  handle(command) {
    switch (command.type) {
      case 'CreateStudent':
        if (this.state.id) throw new Error('Student already exists');
        return [{
          type: 'StudentCreated',
          aggregateId: this.id,
          payload: { id: this.id, ...command.payload },
          timestamp: Date.now()
        }];
      case 'UpdateStudentName':
        if (!this.state.id) throw new Error('Student does not exist');
        return [{
          type: 'StudentNameUpdated',
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