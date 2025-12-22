'use client'

import React, { useState } from 'react'
import {
  Search,
  Hash,
  Users,
  MapPin,
  TrendingUp,
  X,
  Plus,
  Check,
  Pencil,
  Play,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface SearchPlan {
  type: 'search_plan'
  planId: string
  agentId: string
  agentUrl?: string
  userIntent: string
  userAnswers?: Record<string, any>
  searchKeywords: string[]
  hashtags: string[]
  followerMin: number
  followerMax: number
  location?: string
  minEngagement: number
  message: string
}

export interface SearchPlanResponse {
  type: 'search_plan_response'
  planId: string
  approved: boolean
  editedKeywords?: string[]
  editedFilters?: {
    followerMin?: number
    followerMax?: number
    location?: string
    minEngagement?: number
    hashtags?: string[]
  }
}

interface SearchPlanCardProps {
  plan: SearchPlan
  onApprove: (response: SearchPlanResponse) => void
  onReject: (response: SearchPlanResponse) => void
  isSubmitting?: boolean
  className?: string
}

export function SearchPlanCard({
  plan,
  onApprove,
  onReject,
  isSubmitting = false,
  className = ''
}: SearchPlanCardProps) {
  // Editable state
  const [isEditing, setIsEditing] = useState(false)
  const [keywords, setKeywords] = useState<string[]>(plan.searchKeywords)
  const [hashtags, setHashtags] = useState<string[]>(plan.hashtags)
  const [followerMin, setFollowerMin] = useState(plan.followerMin)
  const [followerMax, setFollowerMax] = useState(plan.followerMax)
  const [location, setLocation] = useState(plan.location || '')
  const [minEngagement, setMinEngagement] = useState(plan.minEngagement)

  // New keyword/hashtag input
  const [newKeyword, setNewKeyword] = useState('')
  const [newHashtag, setNewHashtag] = useState('')

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  const handleAddHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, '')
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag])
      setNewHashtag('')
    }
  }

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag))
  }

  const hasChanges = () => {
    return (
      JSON.stringify(keywords) !== JSON.stringify(plan.searchKeywords) ||
      JSON.stringify(hashtags) !== JSON.stringify(plan.hashtags) ||
      followerMin !== plan.followerMin ||
      followerMax !== plan.followerMax ||
      location !== (plan.location || '') ||
      minEngagement !== plan.minEngagement
    )
  }

  const handleApprove = () => {
    const response: SearchPlanResponse = {
      type: 'search_plan_response',
      planId: plan.planId,
      approved: true,
    }

    // Include edits if any changes were made
    if (hasChanges()) {
      response.editedKeywords = keywords
      response.editedFilters = {
        followerMin,
        followerMax,
        location: location || undefined,
        minEngagement,
        hashtags,
      }
    }

    onApprove(response)
  }

  const handleReject = () => {
    onReject({
      type: 'search_plan_response',
      planId: plan.planId,
      approved: false,
    })
  }

  return (
    <Card className={`border-blue-200 bg-gradient-to-br from-blue-50 to-white ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Search size={20} className="text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Search Plan</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{plan.message}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className={isEditing ? 'bg-blue-100' : ''}
          >
            <Pencil size={14} className="mr-1" />
            {isEditing ? 'Done Editing' : 'Edit'}
          </Button>
        </div>

        {/* User Intent */}
        <div className="mt-3 p-2 bg-gray-100 rounded text-sm text-gray-700">
          <span className="font-medium">Your request:</span> {plan.userIntent}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Keywords */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Search size={14} />
            Search Keywords
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center gap-1"
              >
                {keyword}
                {isEditing && (
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </Badge>
            ))}
            {isEditing && (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  className="h-7 w-32 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddKeyword}
                  className="h-7 w-7 p-0"
                >
                  <Plus size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Hash size={14} />
            Hashtags
          </div>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-purple-200 text-purple-700 flex items-center gap-1"
              >
                #{tag}
                {isEditing && (
                  <button
                    onClick={() => handleRemoveHashtag(tag)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </Badge>
            ))}
            {hashtags.length === 0 && !isEditing && (
              <span className="text-sm text-gray-400">No specific hashtags</span>
            )}
            {isEditing && (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  placeholder="#hashtag"
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
                  className="h-7 w-32 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddHashtag}
                  className="h-7 w-7 p-0"
                >
                  <Plus size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Follower Range */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users size={14} />
              Follower Range
            </div>
            <span className="text-sm text-blue-600 font-medium">
              {formatNumber(followerMin)} - {formatNumber(followerMax)}
            </span>
          </div>
          {isEditing ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Min</label>
                  <Input
                    type="number"
                    value={followerMin}
                    onChange={(e) => setFollowerMin(parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Max</label>
                  <Input
                    type="number"
                    value={followerMax}
                    onChange={(e) => setFollowerMax(parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                style={{
                  marginLeft: `${(followerMin / 1000000) * 100}%`,
                  width: `${((followerMax - followerMin) / 1000000) * 100}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MapPin size={14} />
            Location
          </div>
          {isEditing ? (
            <Input
              type="text"
              placeholder="Any location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-8 text-sm"
            />
          ) : (
            <span className="text-sm text-gray-600">
              {location || 'Any location'}
            </span>
          )}
        </div>

        {/* Min Engagement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TrendingUp size={14} />
              Min Engagement Rate
            </div>
            <span className="text-sm text-green-600 font-medium">
              {(minEngagement * 100).toFixed(1)}%
            </span>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={(minEngagement * 100).toFixed(1)}
                onChange={(e) => setMinEngagement(parseFloat(e.target.value) / 100 || 0)}
                min={0}
                max={20}
                step={0.5}
                className="h-8 w-24 text-sm"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          ) : (
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{ width: `${minEngagement * 500}%` }}
              />
            </div>
          )}
        </div>

        {/* Changes indicator */}
        {hasChanges() && (
          <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
            <Pencil size={14} />
            <span>You have unsaved modifications</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button
          variant="outline"
          onClick={handleReject}
          disabled={isSubmitting}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <X size={16} className="mr-1" />
          Cancel
        </Button>
        <Button
          onClick={handleApprove}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="mr-1 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Play size={16} className="mr-1" />
              {hasChanges() ? 'Approve with Edits' : 'Approve & Search'}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
