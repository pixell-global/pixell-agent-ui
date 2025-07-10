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
  HelpCircle 
} from 'lucide-react'

export const UserMenu: React.FC = () => {
  const { user, signOut, loading } = useAuth()

  if (loading || !user) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    )
  }

  // Get user role from metadata or default to 'developer'
  const userRole = user.user_metadata?.role || 'developer'
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const avatarUrl = user.user_metadata?.avatar_url

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'developer':
        return 'bg-blue-100 text-blue-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

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
          <div className="ml-2 hidden md:block text-left">
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
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
            <Badge 
              variant="outline" 
              className={`text-xs w-fit ${getRoleColor(userRole)}`}
            >
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </Badge>
          </div>
        </DropdownMenuLabel>
        
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
        
        {userRole === 'admin' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
            </DropdownMenuItem>
          </>
        )}
        
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