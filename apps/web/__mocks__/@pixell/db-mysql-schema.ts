// Mock schema exports
export const subscriptions = {
  id: 'id',
  orgId: 'orgId',
  stripeSubscriptionId: 'stripeSubscriptionId',
}

export const creditBalances = {
  orgId: 'orgId',
}

export const billableActions = {
  id: 'id',
  orgId: 'orgId',
}

export const creditPurchases = {
  id: 'id',
  orgId: 'orgId',
  stripePaymentIntentId: 'stripePaymentIntentId',
}

export const webhookEvents = {
  stripeEventId: 'stripeEventId',
}

export const organizations = {
  id: 'id',
  stripeCustomerId: 'stripeCustomerId',
}

// External accounts OAuth tables
export const externalAccounts = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  providerUsername: 'providerUsername',
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
  accessTokenEncrypted: 'accessTokenEncrypted',
  refreshTokenEncrypted: 'refreshTokenEncrypted',
  tokenExpiresAt: 'tokenExpiresAt',
  scopes: 'scopes',
  isDefault: 'isDefault',
  autoApprove: 'autoApprove',
  isActive: 'isActive',
  lastUsedAt: 'lastUsedAt',
  lastErrorAt: 'lastErrorAt',
  lastError: 'lastError',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

export const pendingActions = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  conversationId: 'conversationId',
  externalAccountId: 'externalAccountId',
  provider: 'provider',
  actionType: 'actionType',
  actionDescription: 'actionDescription',
  items: 'items',
  itemCount: 'itemCount',
  status: 'status',
  itemsApproved: 'itemsApproved',
  itemsRejected: 'itemsRejected',
  itemsExecuted: 'itemsExecuted',
  itemsFailed: 'itemsFailed',
  expiresAt: 'expiresAt',
  reviewedAt: 'reviewedAt',
  executionStartedAt: 'executionStartedAt',
  executionCompletedAt: 'executionCompletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

export const pendingActionItems = {
  id: 'id',
  pendingActionId: 'pendingActionId',
  itemIndex: 'itemIndex',
  payload: 'payload',
  previewText: 'previewText',
  isEdited: 'isEdited',
  editedPayload: 'editedPayload',
  status: 'status',
  executedAt: 'executedAt',
  result: 'result',
  error: 'error',
  createdAt: 'createdAt',
}

// Activities tables
export const activities = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  conversationId: 'conversationId',
  agentId: 'agentId',
  name: 'name',
  description: 'description',
  activityType: 'activityType',
  status: 'status',
  progress: 'progress',
  progressMessage: 'progressMessage',
  scheduleCron: 'scheduleCron',
  scheduleNextRun: 'scheduleNextRun',
  scheduleLastRun: 'scheduleLastRun',
  scheduleTimezone: 'scheduleTimezone',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  estimatedDurationMs: 'estimatedDurationMs',
  actualDurationMs: 'actualDurationMs',
  result: 'result',
  errorMessage: 'errorMessage',
  errorCode: 'errorCode',
  metadata: 'metadata',
  tags: 'tags',
  priority: 'priority',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  archivedAt: 'archivedAt',
}

export const activitySteps = {
  id: 'id',
  activityId: 'activityId',
  stepOrder: 'stepOrder',
  name: 'name',
  description: 'description',
  status: 'status',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  result: 'result',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
}

export const activityApprovalRequests = {
  id: 'id',
  activityId: 'activityId',
  requestType: 'requestType',
  title: 'title',
  description: 'description',
  requiredScopes: 'requiredScopes',
  options: 'options',
  status: 'status',
  respondedAt: 'respondedAt',
  response: 'response',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
}

// Conversation tables
export const conversations = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  title: 'title',
  titleSource: 'titleSource',
  isPublic: 'isPublic',
  messageCount: 'messageCount',
  lastMessageAt: 'lastMessageAt',
  lastMessagePreview: 'lastMessagePreview',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
}

export const conversationMessages = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  metadata: 'metadata',
  createdAt: 'createdAt',
}

export const hiddenConversations = {
  userId: 'userId',
  conversationId: 'conversationId',
  hiddenAt: 'hiddenAt',
}

// Organization members table
export const organizationMembers = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  role: 'role',
  isDeleted: 'isDeleted',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}
