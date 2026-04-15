export type SupportThreadStatus = 'new' | 'read' | 'resolved';

export interface SupportThread {
  id: number;
  type: string;
  reason: string;
  details: string;
  status: SupportThreadStatus;
  created_at: string;
  reply_count?: number;
}

export interface SupportReply {
  id: number;
  user_id: string;
  details: string;
  created_at: string;
}

export interface CreateSupportThreadInput {
  type: string;
  reason: string;
  details: string;
  parent_id?: number;
}

export interface CreatedSupportThreadResult {
  id: number;
  type: string;
  parent_id: number | null;
}
