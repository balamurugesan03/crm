import { EventEmitter } from 'events';

// In-process domain event bus. Controllers emit after a write succeeds;
// subscribers (automations, realtime fan-out) react without coupling to controllers.
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export function emitDomainEvent(name, { organization, record, actor }) {
  eventBus.emit('domain', { name, organization: String(organization), record, actor });
}
