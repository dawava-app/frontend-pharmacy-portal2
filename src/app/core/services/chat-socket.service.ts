import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage, Conversation, PresenceState } from '../../features/chat/models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private socket?: Socket;

  readonly connected$          = new BehaviorSubject<boolean>(false);
  readonly messageNew$         = new Subject<ChatMessage>();
  readonly messageUpdated$     = new Subject<{ messageId: string; content: string; isEdited: boolean; updatedAt: string }>();
  readonly messageDeleted$     = new Subject<{ messageId: string; conversationId: string; deletedAt: string }>();
  readonly messageRead$        = new Subject<{ messageId: string; conversationId: string; userId: string; readAt: string }>();
  readonly typing$             = new Subject<{ conversationId: string; userId: string; isActive: boolean }>();
  readonly recording$          = new Subject<{ conversationId: string; userId: string; type?: string; isActive: boolean; timestamp?: string }>();
  readonly presence$           = new Subject<{ userId: string; status: PresenceState; conversationId?: string }>();
  readonly conversationRead$   = new Subject<{ conversationId: string; userId: string; count: number }>();
  readonly conversationNew$    = new Subject<Conversation>();
  readonly conversationJoined$ = new Subject<Conversation>();
  readonly reactionAdded$      = new Subject<{ messageId: string; conversationId: string; emoji: string; userId: string }>();
  readonly reactionRemoved$    = new Subject<{ messageId: string; conversationId: string; emoji: string; userId: string }>();

  connect(jwt: string): void {
    if (this.socket?.connected) return;

    // In dev, chatWsUrl is '' so we use window.location.origin (proxied via /ws).
    // In production, chatWsUrl is the full wss:// address.
    const wsUrl = environment.chatWsUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    this.socket = io(wsUrl, {
      path: environment.chatWsPath,
      auth: { token: jwt },
      query: { token: jwt },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connected',           ()  => this.connected$.next(true));
    this.socket.on('disconnect',          ()  => this.connected$.next(false));
    this.socket.on('error',               (e: unknown) => console.error('[Chat] socket error', e));
    this.socket.on('message:new',         (m: ChatMessage) => this.messageNew$.next(m));
    this.socket.on('message:updated',     (m: { messageId: string; content: string; isEdited: boolean; updatedAt: string }) => this.messageUpdated$.next(m));
    this.socket.on('message:deleted',     (m: { messageId: string; conversationId: string; deletedAt: string }) => this.messageDeleted$.next(m));
    this.socket.on('message:read',        (r: { messageId: string; conversationId: string; userId: string; readAt: string }) => this.messageRead$.next(r));
    this.socket.on('user:typing',         (t: { conversationId: string; userId: string; isActive: boolean }) => this.typing$.next(t));
    this.socket.on('user:recording',      (r: { conversationId: string; userId: string; type?: string; isActive: boolean; timestamp?: string }) => this.recording$.next(r));
    this.socket.on('user:online',         (p: { userId: string; conversationId?: string }) => this.presence$.next({ ...p, status: 'online' }));
    this.socket.on('user:offline',        (p: { userId: string; conversationId?: string }) => this.presence$.next({ ...p, status: 'offline' }));
    this.socket.on('conversation:read',   (r: { conversationId: string; userId: string; count: number }) => this.conversationRead$.next(r));
    this.socket.on('conversation:new',    (c: Conversation) => this.conversationNew$.next(c));
    this.socket.on('conversation:joined', (c: Conversation) => this.conversationJoined$.next(c));
    this.socket.on('reaction:added',      (r: { messageId: string; conversationId: string; emoji: string; userId: string }) => this.reactionAdded$.next(r));
    this.socket.on('reaction:removed',    (r: { messageId: string; conversationId: string; emoji: string; userId: string }) => this.reactionRemoved$.next(r));
  }

  joinRoom(conversationId: string): void    { this.socket?.emit('room:join',       { conversationId }); }
  leaveRoom(conversationId: string): void   { this.socket?.emit('room:leave',      { conversationId }); }
  startTyping(conversationId: string): void { this.socket?.emit('typing:start',    { conversationId }); }
  stopTyping(conversationId: string): void  { this.socket?.emit('typing:stop',     { conversationId }); }
  startRecording(conversationId: string): void { this.socket?.emit('recording:start', { conversationId }); }
  stopRecording(conversationId: string): void  { this.socket?.emit('recording:stop',  { conversationId }); }
  ping(): void                              { this.socket?.emit('activity:ping',   {}); }

  markMessageRead(messageId: string): void {
    this.socket?.emit('message:read', { messageId });
  }

  markConversationRead(conversationId: string, upToMessageId?: string): void {
    this.socket?.emit('conversation:read', { conversationId, ...(upToMessageId ? { upToMessageId } : {}) });
  }

  sync(conversationId: string, lastMessageId: string): void {
    this.socket?.emit('messages:sync', { conversationId, lastMessageId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.connected$.next(false);
  }
}
