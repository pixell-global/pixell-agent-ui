import { and, eq, desc, isNull, notInArray, sql, like, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import {
  conversations,
  conversationMessages,
  hiddenConversations,
  Conversation,
  NewConversation,
  ConversationMessage,
  NewConversationMessage,
  ConversationMessageMetadata,
} from '../schema'
import { BaseRepository } from './base'

export interface ListConversationsOptions {
  search?: string
  limit?: number
  offset?: number
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[]
}

export class ConversationsRepo extends BaseRepository {
  // =========================================================================
  // CREATE
  // =========================================================================

  async create(userId: string, title?: string): Promise<Conversation> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()
    const id = randomUUID()

    const newConversation: NewConversation = {
      id,
      orgId,
      userId,
      title: title || null,
      titleSource: title ? 'user' : 'auto',
      isPublic: true,
      messageCount: 0,
    }

    await db.insert(conversations).values(newConversation)

    const [created] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)

    return created
  }

  // =========================================================================
  // READ
  // =========================================================================

  async getById(id: string): Promise<Conversation | null> {
    const db = await getDb()
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
      .limit(1)

    return conversation || null
  }

  async getWithMessages(id: string, userId: string): Promise<ConversationWithMessages | null> {
    const conversation = await this.getById(id)
    if (!conversation) return null

    // Check access: owner or (public AND same org)
    const orgId = await this.getOrgContext(userId)
    const isOwner = conversation.userId === userId
    const canAccess = isOwner || (conversation.isPublic && conversation.orgId === orgId)

    if (!canAccess) return null

    const messages = await this.getMessages(id)
    return { ...conversation, messages }
  }

  async listByUser(
    userId: string,
    options: ListConversationsOptions = {}
  ): Promise<Conversation[]> {
    const { search, limit = 50, offset = 0 } = options
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    let query = db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.userId, userId),
          isNull(conversations.deletedAt),
          search
            ? or(
                like(conversations.title, `%${search}%`),
                like(conversations.lastMessagePreview, `%${search}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(limit)
      .offset(offset)

    return query
  }

  async listOrgPublic(
    userId: string,
    options: ListConversationsOptions = {}
  ): Promise<Conversation[]> {
    const { search, limit = 50, offset = 0 } = options
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    // Get hidden conversation IDs for this user
    const hiddenIds = await this.getHiddenIds(userId)

    let conditions = [
      eq(conversations.orgId, orgId),
      eq(conversations.isPublic, true),
      sql`${conversations.userId} != ${userId}`, // Exclude user's own conversations
      isNull(conversations.deletedAt),
    ]

    // Exclude hidden conversations
    if (hiddenIds.length > 0) {
      conditions.push(notInArray(conversations.id, hiddenIds))
    }

    // Add search condition
    if (search) {
      conditions.push(
        or(
          like(conversations.title, `%${search}%`),
          like(conversations.lastMessagePreview, `%${search}%`)
        )!
      )
    }

    return db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(limit)
      .offset(offset)
  }

  async getHiddenIds(userId: string): Promise<string[]> {
    const db = await getDb()
    const hidden = await db
      .select({ conversationId: hiddenConversations.conversationId })
      .from(hiddenConversations)
      .where(eq(hiddenConversations.userId, userId))

    return hidden.map((h) => h.conversationId)
  }

  // =========================================================================
  // UPDATE
  // =========================================================================

  async update(
    id: string,
    userId: string,
    updates: {
      title?: string
      isPublic?: boolean
    }
  ): Promise<Conversation | null> {
    const conversation = await this.getById(id)
    if (!conversation) return null

    // Only owner can update
    if (conversation.userId !== userId) return null

    const db = await getDb()
    const updateData: Partial<NewConversation> = {}

    if (updates.title !== undefined) {
      updateData.title = updates.title
      updateData.titleSource = 'user'
    }

    if (updates.isPublic !== undefined) {
      updateData.isPublic = updates.isPublic
    }

    await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, id))

    return this.getById(id)
  }

  async updateTitle(id: string, title: string, source: 'auto' | 'user' = 'auto'): Promise<void> {
    const db = await getDb()
    await db
      .update(conversations)
      .set({ title, titleSource: source })
      .where(eq(conversations.id, id))
  }

  // =========================================================================
  // DELETE
  // =========================================================================

  async softDelete(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getById(id)
    if (!conversation) return false

    // Only owner can delete, and only private conversations
    if (conversation.userId !== userId) return false
    if (conversation.isPublic) return false

    const db = await getDb()
    await db
      .update(conversations)
      .set({ deletedAt: new Date() })
      .where(eq(conversations.id, id))

    return true
  }

  // =========================================================================
  // HIDE/UNHIDE (for org public conversations)
  // =========================================================================

  async hideConversation(userId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.getById(conversationId)
    if (!conversation) return false

    // Can only hide public conversations that user doesn't own
    if (!conversation.isPublic) return false
    if (conversation.userId === userId) return false

    // Check user is in same org
    const orgId = await this.getOrgContext(userId)
    if (conversation.orgId !== orgId) return false

    const db = await getDb()
    try {
      await db.insert(hiddenConversations).values({
        userId,
        conversationId,
      })
      return true
    } catch {
      // Already hidden (duplicate key)
      return true
    }
  }

  async unhideConversation(userId: string, conversationId: string): Promise<boolean> {
    const db = await getDb()
    await db
      .delete(hiddenConversations)
      .where(
        and(
          eq(hiddenConversations.userId, userId),
          eq(hiddenConversations.conversationId, conversationId)
        )
      )
    return true
  }

  // =========================================================================
  // MESSAGES
  // =========================================================================

  async addMessage(
    conversationId: string,
    message: {
      role: 'user' | 'assistant' | 'system'
      content: string
      metadata?: ConversationMessageMetadata
    }
  ): Promise<ConversationMessage> {
    const db = await getDb()
    const id = randomUUID()

    const newMessage: NewConversationMessage = {
      id,
      conversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata || null,
    }

    await db.insert(conversationMessages).values(newMessage)

    // Update conversation stats
    await this.updateStats(conversationId, message.content)

    const [created] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.id, id))
      .limit(1)

    return created
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const db = await getDb()
    return db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt)
  }

  async getMessageCount(conversationId: string): Promise<number> {
    const db = await getDb()
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))

    return result?.count || 0
  }

  // =========================================================================
  // STATS
  // =========================================================================

  private async updateStats(conversationId: string, lastMessageContent: string): Promise<void> {
    const db = await getDb()
    const messageCount = await this.getMessageCount(conversationId)
    const preview = lastMessageContent.slice(0, 500)

    await db
      .update(conversations)
      .set({
        messageCount,
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      })
      .where(eq(conversations.id, conversationId))
  }

  // =========================================================================
  // TITLE GENERATION HELPERS
  // =========================================================================

  async needsTitleGeneration(conversationId: string): Promise<boolean> {
    const conversation = await this.getById(conversationId)
    if (!conversation) return false

    // Only generate if:
    // 1. No title yet
    // 2. Title source is 'auto' (user hasn't manually set one)
    // 3. At least 3 messages
    return (
      !conversation.title &&
      conversation.titleSource === 'auto' &&
      conversation.messageCount >= 3
    )
  }

  async getFirstMessages(conversationId: string, count: number = 3): Promise<ConversationMessage[]> {
    const db = await getDb()
    return db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt)
      .limit(count)
  }
}
