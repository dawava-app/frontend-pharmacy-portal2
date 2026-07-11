import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ChatApiService } from '../../features/chat/services/chat-api.service';

// Display-only aggregate of unread messages across all of the current user's
// conversations, used to badge the sidebar "Messages" nav item. Reuses the
// same list + per-conversation unread-count calls as the chat page itself —
// no chat business logic lives here.
@Injectable({ providedIn: 'root' })
export class ChatUnreadService {
  private readonly api = inject(ChatApiService);

  readonly totalUnread = signal(0);

  refresh(): void {
    this.api.listConversations({ limit: 50 })
      .pipe(
        switchMap(list => {
          if (!list.length) return of(0);
          return forkJoin(
            list.map(c => this.api.unreadCount(c._id).pipe(
              map(res => res.unreadCount ?? 0),
              catchError(() => of(0)),
            ))
          ).pipe(map(counts => counts.reduce((sum, n) => sum + n, 0)));
        }),
        catchError(() => of(0)),
      )
      .subscribe(total => this.totalUnread.set(total));
  }
}
