import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Conversation, ChatMessage, SenderProfile } from '../models/chat.models';

function toArray<T>(res: unknown, ...extraKeys: string[]): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = res as Record<string, unknown> | null;
  for (const key of ['data', ...extraKeys]) {
    if (Array.isArray(r?.[key])) return r![key] as T[];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http    = inject(HttpClient);
  private readonly base    = environment.chatApiBase;
  private readonly apiBase = environment.apiBaseUrl;

  listConversations(
    opts: { limit?: number; cursor?: string; type?: string; with?: string } = {},
  ): Observable<Conversation[]> {
    let p = new HttpParams();
    Object.entries(opts).forEach(([k, v]) => { if (v != null) p = p.set(k, String(v)); });
    return this.http.get<unknown>(`${this.base}/conversations`, { params: p }).pipe(
      map(res => toArray<Conversation>(res, 'conversations')),
    );
  }

  getConversation(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.base}/conversations/${id}`);
  }

  listMessages(
    conversationId: string,
    opts: { limit?: number; before?: string; after?: string; includeDeleted?: boolean } = {},
  ): Observable<ChatMessage[]> {
    let p = new HttpParams();
    Object.entries(opts).forEach(([k, v]) => { if (v != null) p = p.set(k, String(v)); });
    return this.http.get<unknown>(
      `${this.base}/conversations/${conversationId}/messages`,
      { params: p },
    ).pipe(
      map(res => toArray<ChatMessage>(res, 'messages')),
    );
  }

  sendMessage(
    conversationId: string,
    body: { content: string; attachments?: unknown[]; replyTo?: string; metadata?: Record<string, unknown> },
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.base}/conversations/${conversationId}/messages`, body);
  }

  editMessage(id: string, content: string): Observable<ChatMessage> {
    return this.http.patch<ChatMessage>(`${this.base}/messages/${id}`, { content });
  }

  deleteMessage(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/messages/${id}`);
  }

  addReaction(messageId: string, emoji: string): Observable<unknown> {
    return this.http.post(`${this.base}/messages/${messageId}/reactions`, { emoji });
  }

  removeReaction(messageId: string, emoji: string): Observable<unknown> {
    return this.http.delete(`${this.base}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  }

  markConversationRead(conversationId: string, upToMessageId?: string): Observable<unknown> {
    return this.http.put(`${this.base}/conversations/${conversationId}/read`, { upToMessageId: upToMessageId ?? '' });
  }

  markMessageRead(messageId: string): Observable<unknown> {
    return this.http.post(`${this.base}/messages/${messageId}/read`, {});
  }

  // API returns { conversationId, unreadCount } — previously typed as { count } which was wrong
  unreadCount(conversationId: string): Observable<{ unreadCount: number }> {
    return this.http.get<{ conversationId: string; unreadCount: number }>(
      `${this.base}/conversations/${conversationId}/unread-count`,
    );
  }

  getUserProfile(userId: string): Observable<{ fullName: string; imageId?: string }> {
    return this.http.get<Record<string, unknown>>(`${this.apiBase}/users/profile/${userId}`).pipe(
      map(r => {
        const data = (r['data'] as Record<string, unknown> | undefined) ?? r;
        const name = (
          data['fullName'] ?? data['full_name'] ?? data['name'] ?? data['username'] ?? data['displayName']
        ) as string | undefined;
        return { fullName: name ?? userId, imageId: data['imageId'] as string | undefined };
      }),
      catchError(() => of({ fullName: userId, imageId: undefined })),
    );
  }

  getOriginalSenderProfile(userId: string): Observable<SenderProfile> {
    return this.http.get<Record<string, unknown>>(`${this.apiBase}/users/profile/${userId}`).pipe(
      map(r => {
        const data = (r['data'] as Record<string, unknown> | undefined) ?? r;
        return {
          id:       (data['id']       as string)  ?? userId,
          username: (data['username'] as string)  ?? '',
          fullName: (data['fullName'] as string)  ?? (data['full_name'] as string) ?? '',
          email:    (data['email']    as string)  ?? '',
          isActive: (data['isActive'] as boolean) ?? true,
        };
      }),
      catchError(() => of({ id: userId, username: '', fullName: userId, email: '', isActive: false })),
    );
  }

  conversationPresence(conversationId: string): Observable<unknown> {
    return this.http.get(`${this.base}/conversations/${conversationId}/presence`);
  }
}
