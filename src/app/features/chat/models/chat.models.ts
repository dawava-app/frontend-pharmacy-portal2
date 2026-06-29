export type ConversationType = 'direct' | 'group';
export type ParticipantRole  = 'admin' | 'member';
export type PresenceState    = 'online' | 'away' | 'offline';

export interface Attachment {
  externalFileId: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
  count?: number;
  hasReacted?: boolean;
}

export interface SenderProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

export interface ReadReceipt {
  userId: string;
  readAt: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: Attachment[];
  replyTo?: string;
  reactions?: Reaction[];
  readBy?: ReadReceipt[];
  isEdited?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  _optimistic?: boolean;
}

export interface Participant {
  externalUserId: string;
  role: ParticipantRole;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  name?: string;
  participants: Participant[];
  lastMessage?: ChatMessage;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  unreadCount?: number;
}

export interface Presence {
  userId: string;
  status: PresenceState;
  lastActivity?: string;
  lastSeen?: string;
}
