export interface Policy {
  id?: string;
  name: string;
  description: string;
  version: string;
  rules: string;
  createdBy?: string;
  editors?: string[];
  invitations?: PolicyInvitation[];
  currentPublishedVersionId?: string | null;
  status: 'BORRADOR' | 'EN_REVISION' | 'PUBLICADA' | 'ARCHIVADA' | 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyEditorCandidate {
  id: string;
  username: string;
  role: 'ADMIN' | 'DESIGNER';
}

export interface PolicyInvitation {
  username: string;
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  invitedAt?: string;
  respondedAt?: string | null;
}

export interface PolicyInvitationNotification {
  policyId: string;
  policyName: string;
  invitedBy: string;
  invitedAt: string;
}

export interface PolicyVersionItem {
  id: string;
  revision: number;
  versionNumber: number;
  name: string;
  description?: string;
  version?: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  publishedAt?: string;
  published: boolean;
  changelogSummary?: string;
  diagramSnapshotJson?: string;
}

export interface PolicyAutosave {
  id: string;
  policyId: string;
  username: string;
  sessionId: string;
  diagramDraftJson: string;
  name?: string;
  description?: string;
  savedAt: string;
}

export interface PolicyChangeLog {
  id: string;
  policyId: string;
  policyVersionId?: string;
  username: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  beforeValue?: string;
  afterValue?: string;
  createdAt: string;
}
