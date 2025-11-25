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
