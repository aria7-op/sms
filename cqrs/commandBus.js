const handlers = {};

export function registerCommandHandler(commandType, handler) {
  handlers[commandType] = handler;
}

export async function dispatchCommand(command) {
  const handler = handlers[command.type];
  if (!handler) throw new Error(`No handler for command type: ${command.type}`);
  return handler(command);
} 