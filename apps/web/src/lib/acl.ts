/**
 * Access Control List (ACL) utilities for role-based permissions
 */

export type Role = 'admin' | 'developer' | 'viewer'
export type Action = 'read' | 'write' | 'delete' | 'admin'

interface PermissionMatrix {
  [key: string]: {
    [action in Action]: boolean
  }
}

// Define permission matrix for each role
const permissionMatrix: PermissionMatrix = {
  admin: {
    read: true,
    write: true,
    delete: true,
    admin: true,
  },
  developer: {
    read: true,
    write: true,
    delete: false,
    admin: false,
  },
  viewer: {
    read: true,
    write: false,
    delete: false,
    admin: false,
  },
}

/**
 * Check if a role has permission to perform an action
 */
export const hasPermission = (role: Role, action: Action): boolean => {
  const rolePermissions = permissionMatrix[role]
  if (!rolePermissions) {
    console.warn(`Unknown role: ${role}`)
    return false
  }
  return rolePermissions[action]
}

/**
 * Check if a role can perform multiple actions
 */
export const hasAnyPermission = (role: Role, actions: Action[]): boolean => {
  return actions.some(action => hasPermission(role, action))
}

/**
 * Check if a role can perform all actions
 */
export const hasAllPermissions = (role: Role, actions: Action[]): boolean => {
  return actions.every(action => hasPermission(role, action))
}

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: Role): Action[] => {
  const rolePermissions = permissionMatrix[role]
  if (!rolePermissions) {
    return []
  }
  
  return Object.entries(rolePermissions)
    .filter(([, hasPermission]) => hasPermission)
    .map(([action]) => action as Action)
}

/**
 * Role hierarchy - higher roles include permissions of lower roles
 */
export const roleHierarchy: Record<Role, number> = {
  viewer: 1,
  developer: 2,
  admin: 3,
}

/**
 * Check if a role is at least as high as required role
 */
export const hasRoleLevel = (userRole: Role, requiredRole: Role): boolean => {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Get the display name for a role
 */
export const getRoleDisplayName = (role: Role): string => {
  const displayNames: Record<Role, string> = {
    admin: 'Administrator',
    developer: 'Developer',
    viewer: 'Viewer',
  }
  return displayNames[role] || role
}

/**
 * Get the color scheme for a role
 */
export const getRoleColorScheme = (role: Role): { bg: string; text: string; border: string } => {
  const colorSchemes: Record<Role, { bg: string; text: string; border: string }> = {
    admin: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
    },
    developer: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
    },
    viewer: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200',
    },
  }
  return colorSchemes[role] || colorSchemes.viewer
}

/**
 * Check if user can access a specific resource
 */
export interface ResourcePermission {
  resource: string
  action: Action
  requiredRole?: Role
  customCheck?: (role: Role) => boolean
}

export const canAccessResource = (
  userRole: Role,
  permission: ResourcePermission
): boolean => {
  // Check custom validation first
  if (permission.customCheck) {
    return permission.customCheck(userRole)
  }

  // Check role level requirement
  if (permission.requiredRole) {
    if (!hasRoleLevel(userRole, permission.requiredRole)) {
      return false
    }
  }

  // Check action permission
  return hasPermission(userRole, permission.action)
}

/**
 * Predefined resource permissions
 */
export const resourcePermissions = {
  // File operations
  deleteFile: {
    resource: 'file',
    action: 'delete' as Action,
    requiredRole: 'developer' as Role,
  },
  uploadFile: {
    resource: 'file',
    action: 'write' as Action,
  },
  
  // Agent operations
  createAgent: {
    resource: 'agent',
    action: 'write' as Action,
    requiredRole: 'developer' as Role,
  },
  deleteAgent: {
    resource: 'agent',
    action: 'delete' as Action,
    requiredRole: 'admin' as Role,
  },
  
  // System operations
  systemSettings: {
    resource: 'system',
    action: 'admin' as Action,
    requiredRole: 'admin' as Role,
  },
  viewLogs: {
    resource: 'logs',
    action: 'read' as Action,
    requiredRole: 'developer' as Role,
  },
  
  // User management
  manageUsers: {
    resource: 'users',
    action: 'admin' as Action,
    requiredRole: 'admin' as Role,
  },
} as const

/**
 * Higher-order component helper for role-based rendering
 */
export const withPermission = (
  role: Role,
  permission: ResourcePermission,
  component: React.ReactNode,
  fallback?: React.ReactNode
): React.ReactNode => {
  if (canAccessResource(role, permission)) {
    return component
  }
  return fallback || null
}

/**
 * Hook-friendly permission checker
 */
export const usePermission = (role: Role) => {
  return {
    hasPermission: (action: Action) => hasPermission(role, action),
    canAccess: (permission: ResourcePermission) => canAccessResource(role, permission),
    hasRole: (requiredRole: Role) => hasRoleLevel(role, requiredRole),
    getRoleInfo: () => ({
      role,
      displayName: getRoleDisplayName(role),
      colorScheme: getRoleColorScheme(role),
      permissions: getRolePermissions(role),
    }),
  }
}