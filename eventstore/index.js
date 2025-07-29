import fs from 'fs';
import path from 'path';

// Utility function to convert BigInt values to strings for JSON serialization
function convertBigIntToString(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }
  
  return obj;
}

const eventFiles = {
  student: path.resolve('eventstore/student-events.log'),
  teacher: path.resolve('eventstore/teacher-events.log'),
};

const events = {
  student: [],
  teacher: [],
};

const subscribers = {
  student: [],
  teacher: [],
};

// Load events from file on startup
for (const type of Object.keys(eventFiles)) {
  if (fs.existsSync(eventFiles[type])) {
    const lines = fs.readFileSync(eventFiles[type], 'utf-8').split('\n').filter(Boolean);
    events[type] = lines.map(line => JSON.parse(line));
  }
}

export const eventStore = {
  append(type, event) {
    if (!eventFiles[type]) throw new Error('Unknown event type');
    events[type].push(event);
    // Convert BigInt values to strings before JSON serialization
    const serializableEvent = convertBigIntToString(event);
    
    // Ensure the directory exists
    const dir = path.dirname(eventFiles[type]);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(eventFiles[type], JSON.stringify(serializableEvent) + '\n');
    subscribers[type].forEach(fn => fn(event));
  },
  getEvents(type, aggregateId = null) {
    if (!eventFiles[type]) throw new Error('Unknown event type');
    return aggregateId ? events[type].filter(e => e.aggregateId === aggregateId) : [...events[type]];
  },
  subscribe(type, fn) {
    if (!eventFiles[type]) throw new Error('Unknown event type');
    subscribers[type].push(fn);
    return () => {
      const idx = subscribers[type].indexOf(fn);
      if (idx !== -1) subscribers[type].splice(idx, 1);
    };
  }
}; 