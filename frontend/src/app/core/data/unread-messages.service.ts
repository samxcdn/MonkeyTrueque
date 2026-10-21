import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { MarketplaceApiService } from './marketplace-api.service';
import type { DirectConversation } from './marketplace-api.service';

@Injectable({ providedIn: 'root' })
export class UnreadMessagesService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private requestId = 0;
  readonly total = signal(0);

  constructor() {
    effect((onCleanup) => {
      const userId = this.auth.user()?.id;
      if (!userId) { this.total.set(0); return; }
      void this.refresh(userId);
      const timer = window.setInterval(() => void this.refresh(userId), 3000);
      onCleanup(() => window.clearInterval(timer));
    });
  }

  private async refresh(userId: string): Promise<void> {
    const requestId = ++this.requestId;
    try {
      const conversations = await this.api.conversations();
      if (requestId !== this.requestId || this.auth.user()?.id !== userId) return;
      const key = `monkeytrueque.readMessages.${userId}`;
      let cursors: Record<string, string> = {};
      let hasSavedCursors = false;
      try {
        const stored = localStorage.getItem(key);
        hasSavedCursors = stored !== null;
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          cursors = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        }
      } catch { /* Sigue mostrando el conteo de esta sesión aunque localStorage no esté disponible. */ }

      const total = conversations.reduce((sum, conversation) => sum + this.countUnread(conversation, userId, cursors, hasSavedCursors), 0);
      if (requestId === this.requestId && this.auth.user()?.id === userId) this.total.set(total);
    } catch { /* El contador conserva el último valor si el servicio de mensajes no responde. */ }
  }

  private countUnread(conversation: DirectConversation, userId: string, cursors: Record<string, string>, hasSavedCursors: boolean): number {
    let cursor = cursors[conversation.id];
    if (cursor === undefined && !hasSavedCursors) {
      for (let index = conversation.messages.length - 1; index >= 0; index--) {
        if (conversation.messages[index].senderId === userId) { cursor = conversation.messages[index].id; break; }
      }
    }
    const cursorIndex = cursor ? conversation.messages.findIndex((message) => message.id === cursor) : -1;
    return conversation.messages.reduce((count, message, index) => count + (index > cursorIndex && message.senderId !== userId ? 1 : 0), 0);
  }
}
