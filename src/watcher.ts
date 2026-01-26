// File watching for live updates

import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { determineSessionStatus, type Message, parseSessionFile } from './parser';

export interface WatcherEvent {
  type: 'message' | 'status';
  sessionId: string;
  data: Message | { status: 'awaiting' | 'working' | 'idle' };
}

type EventCallback = (event: WatcherEvent) => void;

export class SessionWatcher {
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();
  private lastSizes: Map<string, number> = new Map();
  private callbacks: Set<EventCallback> = new Set();
  private lastStatus: Map<string, string> = new Map();
  private statusDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingStatus: Map<string, 'awaiting' | 'working' | 'idle'> = new Map();

  private static STATUS_DEBOUNCE_MS = 1000;

  subscribe(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private emit(event: WatcherEvent): void {
    for (const callback of this.callbacks) {
      callback(event);
    }
  }

  private debouncedStatusEmit(sessionId: string, newStatus: 'awaiting' | 'working' | 'idle'): void {
    const existingTimer = this.statusDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.pendingStatus.set(sessionId, newStatus);

    const timer = setTimeout(() => {
      const status = this.pendingStatus.get(sessionId);
      if (status && this.lastStatus.get(sessionId) !== status) {
        this.lastStatus.set(sessionId, status);
        this.emit({
          type: 'status',
          sessionId,
          data: { status },
        });
      }
      this.pendingStatus.delete(sessionId);
      this.statusDebounceTimers.delete(sessionId);
    }, SessionWatcher.STATUS_DEBOUNCE_MS);

    this.statusDebounceTimers.set(sessionId, timer);
  }

  async watchSession(sessionId: string, filePath: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;

    try {
      const fileStat = await stat(filePath);
      this.lastSizes.set(sessionId, fileStat.size);

      const watcher = watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          await this.handleFileChange(sessionId, filePath);
        }
      });

      this.watchers.set(sessionId, watcher);
    } catch (error) {
      console.error(`Failed to watch session ${sessionId}:`, error);
    }
  }

  private async handleFileChange(sessionId: string, filePath: string): Promise<void> {
    try {
      const fileStat = await stat(filePath);
      const lastSize = this.lastSizes.get(sessionId) || 0;

      if (fileStat.size <= lastSize) return;

      const content = await readFile(filePath, 'utf-8');
      const messages = parseSessionFile(content);

      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        this.emit({
          type: 'message',
          sessionId,
          data: lastMessage,
        });

        const newStatus = determineSessionStatus(messages);
        const oldStatus = this.lastStatus.get(sessionId);

        if (oldStatus !== newStatus) {
          this.debouncedStatusEmit(sessionId, newStatus);
        }
      }

      this.lastSizes.set(sessionId, fileStat.size);
    } catch (error) {
      console.error(`Error handling file change for ${sessionId}:`, error);
    }
  }

  unwatchSession(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
      this.lastSizes.delete(sessionId);
      this.lastStatus.delete(sessionId);
    }

    const timer = this.statusDebounceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.statusDebounceTimers.delete(sessionId);
    }
    this.pendingStatus.delete(sessionId);
  }

  unwatchAll(): void {
    for (const [sessionId] of this.watchers) {
      this.unwatchSession(sessionId);
    }
  }
}

// Singleton instance
export const sessionWatcher = new SessionWatcher();
