'use client'
import React from 'react'
import { useTabStore } from '@/stores/tab-store'
import { cn } from '@/lib/utils'

interface Props {
	className?: string
}

export const WorkspaceTabs: React.FC<Props> = ({ className }) => {
	const { tabs, activeTabId, setActiveTab, closeTab, openChatTab } = useTabStore()

	return (
		<div className={cn('flex items-center h-9 border-b bg-card/60 overflow-x-auto', className)}>
			<div className="flex items-stretch gap-1 px-2">
				{tabs.map((t) => (
					<button
						key={t.id}
						onClick={() => setActiveTab(t.id)}
						className={cn('px-3 h-8 rounded-t-md text-sm border-b-2', activeTabId === t.id ? 'border-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground')}
						title={t.path || t.title}
					>
						<span className="mr-2">{t.title}{t.isDirty ? ' •' : ''}</span>
						<span className="opacity-60 ml-1" onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}>×</span>
					</button>
				))}
				<button className="ml-2 text-sm px-2 opacity-80 hover:opacity-100" onClick={() => openChatTab('Chat')}>＋</button>
			</div>
		</div>
	)
}


