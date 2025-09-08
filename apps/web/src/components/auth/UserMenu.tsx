'use client'

import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from './AuthProvider'
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  Bell,
  HelpCircle,
  Building2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useUIStore } from '@/stores/ui-store'

export const UserMenu: React.FC = () => {
  const { user, signOut, status } = useAuth()
  const BrandSelector = dynamic(async () => (await import('../brands/BrandSelector')).BrandSelector, { ssr: false })
  const leftPanelVisible = useUIStore(state => state.leftPanelVisible)
  const leftPanelCollapsed = useUIStore(state => state.leftPanelCollapsed)
  const rightPanelVisible = useUIStore(state => state.rightPanelVisible)
  const toggleLeftPanelCollapsed = useUIStore(state => state.toggleLeftPanelCollapsed)
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel)

  if (status === 'loading' || !user) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    )
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'User'
  const avatarUrl = null

  

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Avatar className="h-8 w-8">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="rounded-full" />
            ) : (
              <div className="flex items-center justify-center h-full w-full bg-blue-600 text-white text-sm font-medium rounded-full">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Avatar>
          
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="rounded-full" />
                ) : (
                  <div className="flex items-center justify-center h-full w-full bg-blue-600 text-white text-sm font-medium rounded-full">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Avatar>
              <div>
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />

        {/* Brand selection inside user menu */}
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>Brand</span>
          </div>
          <BrandSelector />
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Pane visibility controls */}
        <DropdownMenuItem onClick={toggleLeftPanelCollapsed}>
          {leftPanelCollapsed ? 'Show Navigator' : 'Hide Navigator'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { if (!rightPanelVisible) toggleRightPanel(); else toggleRightPanel(); }}>
          {rightPanelVisible ? 'Hide Activity' : 'Show Activity'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <Bell className="mr-2 h-4 w-4" />
          Notifications
        </DropdownMenuItem>
        
        
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help & Support
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          className="text-red-600"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}