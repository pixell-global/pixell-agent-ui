'use client'
import { Agent } from '@/stores/agent-store'
import { getAgentColors, getStatusColor } from '@/lib/design-tokens'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface AgentCardProps {
  agent: Agent
  isSelected: boolean
  onSelect: () => void
}

export function AgentCard({ agent, isSelected, onSelect }: AgentCardProps) {
  const agentColors = getAgentColors(agent.type)
  const statusColor = getStatusColor(agent.status)

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback 
              style={{ 
                backgroundColor: agentColors.bg,
                color: agentColors.text,
                border: `1px solid ${agentColors.border}`
              }}
            >
              {agent.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm truncate">{agent.name}</h3>
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{
                  backgroundColor: agentColors.bg,
                  color: agentColors.text,
                  borderColor: agentColors.border
                }}
              >
                {agent.type}
              </Badge>
            </div>
            
            {agent.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{
                  color: statusColor,
                  borderColor: statusColor
                }}
              >
                {agent.status}
              </Badge>
              
              <span className="text-xs text-muted-foreground">
                {new Date(agent.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 