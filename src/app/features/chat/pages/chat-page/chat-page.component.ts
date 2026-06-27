import {
  Component, OnInit, OnDestroy, AfterViewChecked,
  HostListener,
  inject, signal, computed, ViewChild, ElementRef, DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { TokenService } from '../../../../core/auth/token.service';
import { ChatSocketService } from '../../../../core/services/chat-socket.service';
import { ChatApiService } from '../../services/chat-api.service';
import { FileService } from '../../../../core/services/file.service';
import { Conversation, ChatMessage, PresenceState } from '../../models/chat.models';

// Fixed tenant/entity for file uploads (pharmacy platform default)
const UPLOAD_TENANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

interface PendingAttachment {
  externalFileId: string;
  label: string;
  mimeType: string;
}

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
})
export class ChatPageComponent implements OnInit, AfterViewChecked, OnDestroy {
  private readonly auth        = inject(AuthService);
  private readonly tokens      = inject(TokenService);
  private readonly socket      = inject(ChatSocketService);
  private readonly api         = inject(ChatApiService);
  private readonly fileService = inject(FileService);
  private readonly destroyRef  = inject(DestroyRef);

  @ViewChild('messagesArea') private messagesArea?: ElementRef<HTMLElement>;
  @ViewChild('fileInput')    private fileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('editInput')    private editInputRef?: ElementRef<HTMLInputElement>;

  // ── Reactive state ──────────────────────────────────────────────────────
  readonly conversations        = signal<Conversation[]>([]);
  readonly messages             = signal<ChatMessage[]>([]);
  readonly selectedConversation = signal<Conversation | null>(null);
  readonly loading              = signal(false);
  readonly messagesLoading      = signal(false);
  readonly sending              = signal(false);
  readonly typingUserIds        = signal<string[]>([]);
  readonly presenceMap          = signal<Record<string, PresenceState>>({});
  readonly canLoadMore          = signal(false);
  readonly replyToMessage       = signal<ChatMessage | null>(null);
  readonly searchQuery          = signal('');
  readonly profileNames         = signal<Record<string, string>>({});
  readonly attachmentUrls       = signal<Record<string, string>>({});
  readonly pendingAttachment    = signal<PendingAttachment | null>(null);
  readonly uploadingFile        = signal(false);
  readonly emojiPickerForMsg    = signal<string | null>(null);
  // Message action menu (Edit / Delete / React)
  readonly selectedMsgForAction = signal<string | null>(null);
  // Inline edit state
  readonly editingMsgId         = signal<string | null>(null);
  // Conversation context menu
  readonly convMenuOpen         = signal<string | null>(null);

  // ── Local state ─────────────────────────────────────────────────────────
  messageText = '';
  editText    = '';
  readonly skeletons     = [1, 2, 3, 4, 5];
  readonly COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '✅', '🙌', '🎉', '😊', '🤔'];

  private readonly profileFetchAttempted = new Set<string>();
  private isTypingActive = false;
  private typingTimeout?: ReturnType<typeof setTimeout>;
  private pingInterval?: ReturnType<typeof setInterval>;
  private oldestMessageId?: string;
  private shouldScrollBottom = false;

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly isManager = computed(() => this.auth.userRole() === 'manager');

  readonly filteredConversations = computed(() => {
    const q     = this.searchQuery().toLowerCase().trim();
    const convs = this.conversations();
    if (!q) return convs;
    return convs.filter(c => this.getConvName(c).toLowerCase().includes(q));
  });

  // ── Close all floating menus on outside click ─────────────────────────────
  @HostListener('document:click')
  onDocumentClick(): void {
    this.emojiPickerForMsg.set(null);
    this.selectedMsgForAction.set(null);
    this.convMenuOpen.set(null);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
    this.registerSocketListeners();
    this.pingInterval = setInterval(() => this.socket.ping(), 30_000);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.pingInterval);
    clearTimeout(this.typingTimeout);
    const sel = this.selectedConversation();
    if (sel) this.socket.leaveRoom(sel._id);
    this.socket.disconnect();
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  private loadConversations(): void {
    this.loading.set(true);
    this.api.listConversations({ limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          const jwt = this.tokens.getAccessToken();
          if (jwt) this.socket.connect(jwt);
          this.conversations.set(list);
          this.loading.set(false);
          list.forEach(c => {
            this.fetchUnreadCount(c._id);
            this.preloadConvProfiles(c);
          });
        },
        error: () => this.loading.set(false),
      });
  }

  private fetchUnreadCount(conversationId: string): void {
    this.api.unreadCount(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.conversations.update(list =>
            list.map(c => c._id === conversationId ? { ...c, unreadCount: res.unreadCount } : c)
          );
        },
        error: () => {},
      });
  }

  private preloadConvProfiles(conv: Conversation): void {
    const myId     = this.auth.getUserId();
    const branchId = this.auth.currentBranchId();
    conv.participants
      .filter(p => p.externalUserId !== myId && p.externalUserId !== branchId)
      .forEach(p => this.fetchAndCacheProfile(p.externalUserId));
  }

  private fetchAndCacheProfile(userId: string): void {
    if (this.profileNames()[userId] || this.profileFetchAttempted.has(userId)) return;
    this.profileFetchAttempted.add(userId);
    this.api.getUserProfile(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profile => {
        this.profileNames.update(names => ({ ...names, [userId]: profile.fullName }));
      });
  }

  selectConversation(conv: Conversation): void {
    const prev = this.selectedConversation();
    if (prev?._id === conv._id) return;
    if (prev) this.socket.leaveRoom(prev._id);

    this.selectedConversation.set(conv);
    this.messages.set([]);
    this.typingUserIds.set([]);
    this.canLoadMore.set(false);
    this.replyToMessage.set(null);
    this.pendingAttachment.set(null);
    this.emojiPickerForMsg.set(null);
    this.selectedMsgForAction.set(null);
    this.editingMsgId.set(null);
    this.oldestMessageId = undefined;

    this.socket.joinRoom(conv._id);
    this.fetchMessages(conv._id);
    this.preloadConvProfiles(conv);

    this.conversations.update(list =>
      list.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
    );
  }

  private fetchMessages(conversationId: string, before?: string): void {
    this.messagesLoading.set(true);
    this.api.listMessages(conversationId, { limit: 30, ...(before ? { before } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: msgs => {
          // Always sort ascending so today's messages appear at the bottom
          const sorted = [...(msgs ?? [])].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          if (before) {
            this.messages.update(existing => [...sorted, ...existing]);
          } else {
            this.messages.set(sorted);
            this.shouldScrollBottom = true;
            if (sorted.length > 0) {
              const lastMsg = sorted[sorted.length - 1];
              this.api.markConversationRead(conversationId, lastMsg._id)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe();
              this.socket.markConversationRead(conversationId, lastMsg._id);
            }
          }
          if (sorted.length > 0) this.oldestMessageId = sorted[0]._id;
          this.canLoadMore.set(sorted.length >= 30);
          this.messagesLoading.set(false);
          this.preloadMessageSenderProfiles(sorted);
        },
        error: () => this.messagesLoading.set(false),
      });
  }

  private preloadMessageSenderProfiles(msgs: ChatMessage[]): void {
    const myId     = this.auth.getUserId();
    const branchId = this.auth.currentBranchId();
    const unique   = [...new Set(
      msgs
        .filter(m => m.senderId !== myId && m.senderId !== branchId)
        .map(m => m.senderId)
    )];
    unique.forEach(id => this.fetchAndCacheProfile(id));
  }

  loadMoreMessages(): void {
    const sel = this.selectedConversation();
    if (!sel || !this.oldestMessageId) return;
    this.fetchMessages(sel._id, this.oldestMessageId);
  }

  // ── Send message ──────────────────────────────────────────────────────────
  sendMessage(): void {
    const text       = this.messageText.trim();
    const sel        = this.selectedConversation();
    const attachment = this.pendingAttachment();
    if ((!text && !attachment) || !sel || this.sending()) return;

    const user     = this.auth.currentUser();
    const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replyTo  = this.replyToMessage()?._id;

    const optimistic: ChatMessage = {
      _id: clientId,
      conversationId: sel._id,
      senderId: this.auth.getUserId() ?? 'local',
      content: text,
      replyTo,
      attachments: attachment
        ? [{ externalFileId: attachment.externalFileId, label: attachment.label }]
        : undefined,
      metadata: {
        clientId,
        staffId:   user?.id ?? '',
        staffName: user?.fullName ?? '',
        staffRole: this.auth.userRole() ?? '',
      },
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    this.messages.update(list => [...list, optimistic]);
    this.messageText = '';
    this.replyToMessage.set(null);
    this.pendingAttachment.set(null);
    this.shouldScrollBottom = true;
    this.stopTypingIfIdle();

    this.sending.set(true);
    this.api.sendMessage(sel._id, {
      content: text,
      ...(replyTo    ? { replyTo }    : {}),
      ...(attachment ? { attachments: [{ externalFileId: attachment.externalFileId, label: attachment.label, metadata: {} }] } : {}),
      metadata: {
        clientId,
        staffId:   user?.id,
        staffName: user?.fullName,
        staffRole: this.auth.userRole(),
      },
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: msg => {
        this.sending.set(false);
        this.messages.update(list => {
          const idx = list.findIndex(m => m._id === clientId);
          if (idx !== -1) {
            const updated = [...list];
            updated[idx] = msg;
            return updated;
          }
          return list.some(m => m._id === msg._id) ? list : [...list, msg];
        });
        this.conversations.update(list =>
          list.map(c => c._id === sel._id ? { ...c, lastMessage: msg } : c)
        );
      },
      error: () => {
        this.sending.set(false);
        this.messages.update(list => list.filter(m => m._id !== clientId));
      },
    });
  }

  // ── File upload ───────────────────────────────────────────────────────────
  triggerFileInput(): void {
    this.fileInputRef?.nativeElement.click();
  }

  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = '';

    const ownerId = this.auth.currentUser()?.id ?? this.auth.getUserId() ?? '';
    this.uploadingFile.set(true);

    const formData = new FormData();
    formData.append('TenantId',           UPLOAD_TENANT_ID);
    formData.append('OwnerId',            ownerId);
    formData.append('Purpose',            'license');
    formData.append('EntityType',         'pharmacy');
    formData.append('EntityId',           UPLOAD_TENANT_ID);
    formData.append('Provider',           'AmazonS3');
    formData.append('StagingTtlMinutes',  '60');
    formData.append('File',               file);

    this.fileService.stageFile(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: staged => {
          this.uploadingFile.set(false);
          this.pendingAttachment.set({
            externalFileId: staged.id,
            label:    staged.originalFilename || file.name,
            mimeType: staged.mimeType || file.type,
          });
        },
        error: () => this.uploadingFile.set(false),
      });
  }

  clearAttachment(): void { this.pendingAttachment.set(null); }

  openAttachment(externalFileId: string): void {
    const cached = this.attachmentUrls()[externalFileId];
    if (cached) { window.open(cached, '_blank'); return; }

    this.fileService.getFile(externalFileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.fileLink) {
            this.attachmentUrls.update(urls => ({ ...urls, [externalFileId]: res.fileLink }));
            window.open(res.fileLink, '_blank');
          }
        },
        error: () => {},
      });
  }

  // ── Message action menu ───────────────────────────────────────────────────
  onMessageClick(msg: ChatMessage, event: MouseEvent): void {
    event.stopPropagation();
    if (msg.deletedAt) return;
    this.selectedMsgForAction.set(this.selectedMsgForAction() === msg._id ? null : msg._id);
    this.emojiPickerForMsg.set(null);
  }

  startReply(msg: ChatMessage): void {
    this.replyToMessage.set(msg);
    this.selectedMsgForAction.set(null);
  }

  getReplyMessage(replyToId: string): ChatMessage | undefined {
    return this.messages().find(m => m._id === replyToId);
  }

  getReplyPreviewSender(msg: ChatMessage | undefined): string {
    if (!msg) return 'Message';
    if (this.isOwnMessage(msg)) return 'You';
    return this.getSenderName(msg.senderId) || 'Them';
  }

  startEdit(msg: ChatMessage): void {
    this.editText = msg.content;
    this.editingMsgId.set(msg._id);
    this.selectedMsgForAction.set(null);
    setTimeout(() => this.editInputRef?.nativeElement?.focus(), 50);
  }

  confirmEdit(): void {
    const id   = this.editingMsgId();
    const text = this.editText.trim();
    if (!id || !text) { this.cancelEdit(); return; }

    this.api.editMessage(id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.messages.update(list => list.map(m => m._id === id ? updated : m));
          this.editingMsgId.set(null);
          this.editText = '';
        },
        error: () => this.cancelEdit(),
      });
  }

  cancelEdit(): void {
    this.editingMsgId.set(null);
    this.editText = '';
  }

  doDeleteMessage(msg: ChatMessage): void {
    this.selectedMsgForAction.set(null);
    this.api.deleteMessage(msg._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update(list =>
            list.map(m => m._id === msg._id
              ? { ...m, deletedAt: new Date().toISOString() }
              : m
            )
          );
        },
        error: () => {},
      });
  }

  openEmojiFromAction(msg: ChatMessage, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedMsgForAction.set(null);
    this.emojiPickerForMsg.set(msg._id);
  }

  // ── Emoji picker ──────────────────────────────────────────────────────────
  toggleEmojiPicker(messageId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.emojiPickerForMsg.set(this.emojiPickerForMsg() === messageId ? null : messageId);
    this.selectedMsgForAction.set(null);
  }

  selectEmoji(msg: ChatMessage, emoji: string, event: MouseEvent): void {
    event.stopPropagation();
    this.toggleReaction(msg, emoji);
    this.emojiPickerForMsg.set(null);
  }

  // ── Conversation context menu ─────────────────────────────────────────────
  openConvMenu(conv: Conversation, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.convMenuOpen.set(this.convMenuOpen() === conv._id ? null : conv._id);
  }

  markConversationAsRead(conv: Conversation): void {
    const lastMsgId = conv.lastMessage?._id;
    this.api.markConversationRead(conv._id, lastMsgId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.socket.markConversationRead(conv._id, lastMsgId);
    this.conversations.update(list =>
      list.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
    );
    this.convMenuOpen.set(null);
  }

  markConversationUnread(conv: Conversation): void {
    // No server endpoint for "mark as unread" — update local state only
    this.conversations.update(list =>
      list.map(c => c._id === conv._id ? { ...c, unreadCount: 1 } : c)
    );
    this.convMenuOpen.set(null);
  }

  // ── Typing ────────────────────────────────────────────────────────────────
  onTyping(): void {
    const sel = this.selectedConversation();
    if (!sel) return;
    if (!this.isTypingActive) {
      this.isTypingActive = true;
      this.socket.startTyping(sel._id);
    }
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTypingActive = false;
      this.socket.stopTyping(sel._id);
    }, 3000);
  }

  stopTypingIfIdle(): void {
    const sel = this.selectedConversation();
    if (sel && this.isTypingActive) {
      this.isTypingActive = false;
      this.socket.stopTyping(sel._id);
    }
    clearTimeout(this.typingTimeout);
  }

  // ── Reactions (with optimistic update) ────────────────────────────────────
  toggleReaction(msg: ChatMessage, emoji: string): void {
    const myId      = this.auth.getUserId() ?? '';
    const existing  = msg.reactions?.find(r => r.emoji === emoji);
    const hasReacted = existing?.userIds.includes(myId) ?? false;

    // Optimistic UI update
    this.messages.update(list =>
      list.map(m => {
        if (m._id !== msg._id) return m;
        let reactions = [...(m.reactions ?? [])];
        if (hasReacted) {
          reactions = reactions
            .map(r => r.emoji === emoji
              ? { ...r, userIds: r.userIds.filter(id => id !== myId) }
              : r
            )
            .filter(r => r.userIds.length > 0);
        } else {
          const idx = reactions.findIndex(r => r.emoji === emoji);
          if (idx === -1) {
            reactions.push({ emoji, userIds: [myId] });
          } else {
            reactions[idx] = { ...reactions[idx], userIds: [...reactions[idx].userIds, myId] };
          }
        }
        return { ...m, reactions };
      })
    );

    // API call
    const obs = hasReacted
      ? this.api.removeReaction(msg._id, emoji)
      : this.api.addReaction(msg._id, emoji);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  // ── Socket listeners ──────────────────────────────────────────────────────
  private registerSocketListeners(): void {
    this.socket.messageNew$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(msg => this.handleNewMessage(msg));

    this.socket.messageUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.messages.update(list =>
          list.map(m => m._id === e.messageId
            ? { ...m, content: e.content, isEdited: e.isEdited, updatedAt: e.updatedAt }
            : m
          )
        );
      });

    this.socket.messageDeleted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.messages.update(list =>
          list.map(m => m._id === e.messageId ? { ...m, deletedAt: e.deletedAt } : m)
        );
      });

    // Update readBy when the other user reads our messages
    this.socket.messageRead$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.messages.update(list =>
          list.map(m => {
            if (m._id !== e.messageId) return m;
            const readBy = [...(m.readBy ?? [])];
            if (!readBy.find(r => r.userId === e.userId)) {
              readBy.push({ userId: e.userId, readAt: e.readAt });
            }
            return { ...m, readBy };
          })
        );
      });

    this.socket.typing$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        if (e.conversationId !== this.selectedConversation()?._id) return;
        if (e.isActive) {
          this.typingUserIds.update(ids => ids.includes(e.userId) ? ids : [...ids, e.userId]);
          setTimeout(() => {
            this.typingUserIds.update(ids => ids.filter(id => id !== e.userId));
          }, 6000);
        } else {
          this.typingUserIds.update(ids => ids.filter(id => id !== e.userId));
        }
      });

    this.socket.presence$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.presenceMap.update(map => ({ ...map, [e.userId]: e.status }));
      });

    this.socket.conversationNew$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(conv => {
        this.conversations.update(list =>
          list.some(c => c._id === conv._id) ? list : [conv, ...list]
        );
        this.preloadConvProfiles(conv);
      });

    this.socket.conversationJoined$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(conv => {
        this.conversations.update(list =>
          list.some(c => c._id === conv._id) ? list : [conv, ...list]
        );
        this.preloadConvProfiles(conv);
      });

    this.socket.conversationRead$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.conversations.update(list =>
          list.map(c => c._id === e.conversationId ? { ...c, unreadCount: 0 } : c)
        );
      });

    this.socket.reactionAdded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.messages.update(list =>
          list.map(m => {
            if (m._id !== e.messageId) return m;
            const reactions = [...(m.reactions ?? [])];
            const idx = reactions.findIndex(r => r.emoji === e.emoji);
            if (idx === -1) {
              reactions.push({ emoji: e.emoji, userIds: [e.userId] });
            } else if (!reactions[idx].userIds.includes(e.userId)) {
              reactions[idx] = { ...reactions[idx], userIds: [...reactions[idx].userIds, e.userId] };
            }
            return { ...m, reactions };
          })
        );
      });

    this.socket.reactionRemoved$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.messages.update(list =>
          list.map(m => {
            if (m._id !== e.messageId) return m;
            const reactions = (m.reactions ?? [])
              .map(r => r.emoji === e.emoji
                ? { ...r, userIds: r.userIds.filter(id => id !== e.userId) }
                : r
              )
              .filter(r => r.userIds.length > 0);
            return { ...m, reactions };
          })
        );
      });
  }

  private handleNewMessage(msg: ChatMessage): void {
    const sel = this.selectedConversation();

    if (sel && msg.conversationId === sel._id) {
      this.messages.update(list => {
        const clientId = msg.metadata?.['clientId'] as string | undefined;
        if (clientId) {
          const idx = list.findIndex(m => m._id === clientId && m._optimistic);
          if (idx !== -1) {
            const updated = [...list];
            updated[idx] = msg;
            return updated;
          }
        }
        return list.some(m => m._id === msg._id) ? list : [...list, msg];
      });
      this.shouldScrollBottom = true;
      this.api.markConversationRead(sel._id, msg._id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      this.socket.markConversationRead(sel._id, msg._id);

      if (!this.isOwnMessage(msg) && !this.profileNames()[msg.senderId]) {
        this.fetchAndCacheProfile(msg.senderId);
      }
    }

    this.conversations.update(list =>
      list.map(c => {
        if (c._id !== msg.conversationId) return c;
        const isActive = sel?._id === msg.conversationId;
        return { ...c, lastMessage: msg, unreadCount: isActive ? 0 : (c.unreadCount ?? 0) + 1 };
      })
    );
  }

  // ── Scroll ────────────────────────────────────────────────────────────────
  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop < 80 && this.canLoadMore() && !this.messagesLoading()) {
      this.loadMoreMessages();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesArea) {
        this.messagesArea.nativeElement.scrollTop = this.messagesArea.nativeElement.scrollHeight;
      }
    }, 0);
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  // Require #1: treat branchId-sender messages as "own"
  isOwnMessage(msg: ChatMessage): boolean {
    if (msg._optimistic) return true;
    if (msg.metadata?.['staffId']) return true;
    const myId     = this.auth.getUserId();
    const branchId = this.auth.currentBranchId();
    return (!!myId && msg.senderId === myId) ||
           (!!branchId && msg.senderId === branchId);
  }

  // Require #8: check if the other participant has read the message
  isMessageRead(msg: ChatMessage): boolean {
    const sel = this.selectedConversation();
    if (!sel || msg._optimistic) return false;
    const other = this.getOtherParticipant(sel);
    if (!other) return false;
    return !!msg.readBy?.some(r => r.userId === other.externalUserId);
  }

  getAttribution(msg: ChatMessage): string | null {
    if (!this.isManager()) return null;
    const meta = msg.metadata;
    if (!meta?.['staffName']) return null;
    return `${meta['staffName']} · ${meta['staffRole']}`;
  }

  getSenderName(senderId: string): string {
    return this.profileNames()[senderId] ?? '';
  }

  getConvName(conv: Conversation): string {
    if (conv.name) return conv.name;
    const other = this.getOtherParticipant(conv);
    if (!other) return 'Client';
    return this.profileNames()[other.externalUserId] ?? 'Client';
  }

  getConvInitials(conv: Conversation): string {
    const name = this.getConvName(conv);
    return name.split(/[\s_\-@.]/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'C';
  }

  getPresenceStatus(conv: Conversation): PresenceState {
    const other = this.getOtherParticipant(conv);
    if (!other) return 'offline';
    return this.presenceMap()[other.externalUserId] ?? 'offline';
  }

  // Require #1: exclude both myId AND branchId when finding the other participant
  private getOtherParticipant(conv: Conversation) {
    const myId     = this.auth.getUserId();
    const branchId = this.auth.currentBranchId();
    return (
      conv.participants.find(p =>
        p.externalUserId !== myId && p.externalUserId !== branchId
      ) ??
      conv.participants.find(p => p.externalUserId !== myId) ??
      conv.participants[0]
    );
  }

  shouldShowDateSeparator(msg: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages()[index - 1];
    return new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
  }

  getDateLabel(iso: string): string {
    const d   = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  formatTime(iso?: string): string {
    if (!iso) return '';
    const d   = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  formatMessageTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
