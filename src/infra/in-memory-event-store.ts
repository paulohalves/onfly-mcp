import type { EventStore, StreamId } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

type StoredEvent = { streamId: StreamId; message: JSONRPCMessage };

/**
 * Minimal EventStore for MCP stream resumability (suitable for dev / single instance).
 */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, StoredEvent>();

  private generateEventId(streamId: StreamId): string {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private streamIdFromEventId(eventId: string): StreamId {
    const first = eventId.split('_')[0];
    return (first ?? '') as StreamId;
  }

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<string> {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: string,
    {
      send,
    }: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> },
  ): Promise<StreamId> {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return '' as StreamId;
    }

    const streamId = this.streamIdFromEventId(lastEventId);
    if (!streamId) {
      return '' as StreamId;
    }

    let foundLast = false;
    const sorted = [...this.events.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [eventId, { streamId: sid, message }] of sorted) {
      if (sid !== streamId) {
        continue;
      }
      if (eventId === lastEventId) {
        foundLast = true;
        continue;
      }
      if (foundLast) {
        await send(eventId, message);
      }
    }

    return streamId;
  }
}
