'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { History, Search, X, Lock, Globe, MoreVertical, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useHistoryStore,
  selectMyConversations,
  selectOrgConversations,
  selectActiveTab,
  selectSearchQuery,
  selectIsLoading,
  Conversation,
  HistoryTab,
} from '@/stores/history-store'
import { useChatStore } from '@/stores/chat-store'
import { useTabStore } from '@/stores/tab-store'

interface HistoryPaneProps {
  className?: string
}

export const HistoryPane: React.FC<HistoryPaneProps> = ({ className }) => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // History store
  const myConversations = useHistoryStore(selectMyConversations)
  const orgConversations = useHistoryStore(selectOrgConversations)
  const activeTab = useHistoryStore(selectActiveTab)
  const searchQuery = useHistoryStore(selectSearchQuery)
  const isLoading = useHistoryStore(selectIsLoading)
  const {
    setActiveTab,
    setSearchQuery,
    fetchMyConversations,
    fetchOrgConversations,
    renameConversation,
    deleteConversation,
    hideConversation,
    makePublic,
    makePrivate,
  } = useHistoryStore()

  // Chat store
  const { loadConversation, clearMessages } = useChatStore()

  // Tab store
  const { updateTabConversation, updateTabTitle, getActiveTab } = useTabStore()

  // Fetch conversations on mount
  useEffect(() => {
    fetchMyConversations()
    fetchOrgConversations()
  }, [fetchMyConversations, fetchOrgConversations])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'my-chats') {
        fetchMyConversations(searchQuery, true)
      } else {
        fetchOrgConversations(searchQuery, true)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, activeTab, fetchMyConversations, fetchOrgConversations])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as HistoryTab)
  }

  const handleConversationClick = useCallback(
    async (conversation: Conversation) => {
      const currentTab = getActiveTab()
      if (currentTab && currentTab.type === 'chat') {
        // Load conversation into current tab
        updateTabConversation(currentTab.id, conversation.id)
        updateTabTitle(currentTab.id, conversation.title || 'Chat')
        await loadConversation(conversation.id)
      }
    },
    [getActiveTab, updateTabConversation, updateTabTitle, loadConversation]
  )

  const handleRename = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setRenameValue(conversation.title || '')
    setRenameDialogOpen(true)
  }

  const handleRenameConfirm = async () => {
    if (selectedConversation && renameValue.trim()) {
      try {
        await renameConversation(selectedConversation.id, renameValue.trim())
      } catch (err) {
        console.error('Failed to rename:', err)
      }
    }
    setRenameDialogOpen(false)
    setSelectedConversation(null)
    setRenameValue('')
  }

  const handleDelete = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedConversation) {
      try {
        await deleteConversation(selectedConversation.id)
      } catch (err) {
        console.error('Failed to delete:', err)
      }
    }
    setDeleteDialogOpen(false)
    setSelectedConversation(null)
  }

  const handleHide = async (conversation: Conversation) => {
    try {
      await hideConversation(conversation.id)
    } catch (err) {
      console.error('Failed to hide:', err)
    }
  }

  const handleMakePublic = async (conversation: Conversation) => {
    try {
      await makePublic(conversation.id)
    } catch (err) {
      console.error('Failed to make public:', err)
    }
  }

  const handleMakePrivate = async (conversation: Conversation) => {
    try {
      await makePrivate(conversation.id)
    } catch (err) {
      console.error('Failed to make private:', err)
    }
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const conversations = activeTab === 'my-chats' ? myConversations : orgConversations

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 32px)' }}>
          <TabsTrigger value="my-chats" className="text-xs">
            My Chats
            {myConversations.length > 0 && (
              <span className="ml-1 text-muted-foreground">({myConversations.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="organization" className="text-xs">
            Organization
            {orgConversations.length > 0 && (
              <span className="ml-1 text-muted-foreground">({orgConversations.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Conversation Lists */}
        <TabsContent value="my-chats" className="flex-1 overflow-y-auto m-0">
          <ConversationList
            conversations={myConversations}
            isLoading={isLoading}
            isOwner={true}
            searchQuery={searchQuery}
            formatTime={formatTime}
            onConversationClick={handleConversationClick}
            onRename={handleRename}
            onDelete={handleDelete}
            onMakePublic={handleMakePublic}
            onMakePrivate={handleMakePrivate}
          />
        </TabsContent>

        <TabsContent value="organization" className="flex-1 overflow-y-auto m-0">
          <ConversationList
            conversations={orgConversations}
            isLoading={isLoading}
            isOwner={false}
            searchQuery={searchQuery}
            formatTime={formatTime}
            onConversationClick={handleConversationClick}
            onHide={handleHide}
          />
        </TabsContent>
      </Tabs>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Enter a new name for this conversation.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Conversation name"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedConversation?.title || 'this conversation'}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Conversation List Component
interface ConversationListProps {
  conversations: Conversation[]
  isLoading: boolean
  isOwner: boolean
  searchQuery: string
  formatTime: (timestamp: string | null) => string
  onConversationClick: (conversation: Conversation) => void
  onRename?: (conversation: Conversation) => void
  onDelete?: (conversation: Conversation) => void
  onHide?: (conversation: Conversation) => void
  onMakePublic?: (conversation: Conversation) => void
  onMakePrivate?: (conversation: Conversation) => void
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  isLoading,
  isOwner,
  searchQuery,
  formatTime,
  onConversationClick,
  onRename,
  onDelete,
  onHide,
  onMakePublic,
  onMakePrivate,
}) => {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-lg border animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-full mb-3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">
          {searchQuery
            ? 'No conversations found'
            : isOwner
            ? 'No conversation history'
            : 'No organization conversations'}
        </p>
        <p className="text-xs">
          {searchQuery
            ? 'Try adjusting your search terms'
            : isOwner
            ? 'Start a conversation to see it here'
            : 'Public conversations from your team will appear here'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className="group p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
          onClick={() => onConversationClick(conversation)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {conversation.isPublic ? (
                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <h4 className="text-sm font-medium truncate">
                {conversation.title || 'Untitled conversation'}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTime(conversation.lastMessageAt || conversation.createdAt)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {isOwner && onRename && (
                    <DropdownMenuItem onClick={() => onRename(conversation)}>
                      Rename
                    </DropdownMenuItem>
                  )}
                  {isOwner && conversation.isPublic && onMakePrivate && (
                    <DropdownMenuItem onClick={() => onMakePrivate(conversation)}>
                      Make Private
                    </DropdownMenuItem>
                  )}
                  {isOwner && !conversation.isPublic && onMakePublic && (
                    <DropdownMenuItem onClick={() => onMakePublic(conversation)}>
                      Make Public
                    </DropdownMenuItem>
                  )}
                  {!isOwner && onHide && (
                    <DropdownMenuItem onClick={() => onHide(conversation)}>
                      Hide from list
                    </DropdownMenuItem>
                  )}
                  {isOwner && !conversation.isPublic && onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete(conversation)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {conversation.lastMessagePreview || 'No messages yet'}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
