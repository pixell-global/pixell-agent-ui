'use client'
import React from 'react'
import { useTabStore } from '@/stores/tab-store'
import { cn } from '@/lib/utils'
import { MessageSquare, FileText, FileCode, X, Plus } from 'lucide-react'
import type { WorkspaceTabType } from '@/stores/tab-store'

interface Props {
	className?: string
}

export const WorkspaceTabs: React.FC<Props> = ({ className }) => {
	const { tabs, activeTabId, setActiveTab, closeTab, openChatTab } = useTabStore()

	const getTabIcon = (type: WorkspaceTabType) => {
		switch (type) {
			case 'chat':
				return <MessageSquare size={12} className="flex-shrink-0" />
			case 'viewer':
				return <FileCode size={12} className="flex-shrink-0" />
			case 'editor':
			default:
				return <FileText size={12} className="flex-shrink-0" />
		}
	}

	return (
		<div className={cn('relative flex items-center h-9 bg-surface border-b border-white/10 overflow-x-auto demo-scrollbar', className)}>
			<div className="flex items-stretch">
				{tabs.map((t) => (
					<button
						key={t.id}
						onClick={() => setActiveTab(t.id)}
						className={cn(
							'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 border-b-2',
							activeTabId === t.id
								? 'text-white border-pixell-yellow bg-white/5'
								: 'text-white/50 border-transparent hover:text-white/70 hover:bg-white/[0.02]'
						)}
						title={t.path || t.title}
					>
						{getTabIcon(t.type)}
						<span>{t.title}{t.isDirty ? ' •' : ''}</span>
						<span
							className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors duration-200"
							onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}
						>
							<X size={12} />
						</span>
					</button>
				))}
				<button
					className="flex items-center justify-center px-3 text-white/40 hover:text-white/80 hover:bg-white/[0.02] transition-colors duration-200"
					onClick={() => openChatTab('Chat')}
					title="New tab"
				>
					<Plus size={14} />
				</button>
			</div>
		</div>
	)
}


