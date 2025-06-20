// apps/web/src/lib/design-tokens.ts - From design guide
export const designTokens = {
  colors: {
    agents: {
      creator: {
        primary: 'hsl(271 91% 65%)',
        bg: 'hsl(270 100% 98%)',
        border: 'hsl(270 95% 90%)',
        text: 'hsl(271 91% 45%)'
      },
      keyword: {
        primary: 'hsl(142 76% 36%)',
        bg: 'hsl(142 76% 98%)',
        border: 'hsl(142 76% 85%)',
        text: 'hsl(142 76% 25%)'
      },
      analytics: {
        primary: 'hsl(217 91% 60%)',
        bg: 'hsl(217 91% 98%)',
        border: 'hsl(217 91% 85%)',
        text: 'hsl(217 91% 40%)'
      },
      custom: {
        primary: 'hsl(25 95% 53%)',
        bg: 'hsl(25 95% 98%)',
        border: 'hsl(25 95% 85%)',
        text: 'hsl(25 95% 33%)'
      }
    },
    status: {
      running: 'hsl(142 76% 36%)',
      waiting: 'hsl(45 93% 47%)',
      done: 'hsl(217 91% 60%)',
      paused: 'hsl(215 16% 47%)',
      error: 'hsl(0 84% 60%)',
      idle: 'hsl(215 16% 47%)',
      queued: 'hsl(45 93% 47%)',
      succeeded: 'hsl(142 76% 36%)',
      failed: 'hsl(0 84% 60%)'
    }
  },
  layout: {
    workspace: {
      desktop: 'grid-cols-[280px,1fr,340px]',
      tablet: 'grid-cols-[250px,1fr,300px]',
      mobile: 'grid-cols-1'
    },
    panels: {
      left: {
        width: '280px',
        minWidth: '240px',
        maxWidth: '400px'
      },
      right: {
        width: '340px',
        minWidth: '300px',
        maxWidth: '500px'
      }
    }
  },
  animations: {
    task: {
      duration: '300ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    },
    agent: {
      duration: '200ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
};

// Helper functions for applying agent colors
export function getAgentColors(type: 'creator' | 'keyword' | 'analytics' | 'custom') {
  return designTokens.colors.agents[type];
}

export function getStatusColor(status: string) {
  return designTokens.colors.status[status as keyof typeof designTokens.colors.status] || designTokens.colors.status.idle;
} 