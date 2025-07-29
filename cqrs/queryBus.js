const handlers = {};

export function registerQueryHandler(queryType, handler) {
  handlers[queryType] = handler;
}

export async function dispatchQuery(query) {
  const handler = handlers[query.type];
  if (!handler) throw new Error(`No handler for query type: ${query.type}`);
  return handler(query);
} 