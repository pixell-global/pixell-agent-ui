'use client'

import React, { useState } from 'react'
import { HelpCircle, Send, X, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  ClarificationNeeded,
  ClarificationResponse,
  Question,
  Answer
} from '@pixell/protocols'

interface ClarificationCardProps {
  clarification: ClarificationNeeded
  onRespond: (response: ClarificationResponse) => void
  onDismiss?: () => void
  isSubmitting?: boolean
  className?: string
}

export function ClarificationCard({
  clarification,
  onRespond,
  onDismiss,
  isSubmitting = false,
  className = ''
}: ClarificationCardProps) {
  const [answers, setAnswers] = useState<Map<string, Answer['value']>>(new Map())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const updateAnswer = (questionId: string, value: Answer['value']) => {
    setAnswers(prev => new Map(prev.set(questionId, value)))
    // Clear error when user provides an answer
    if (errors.has(questionId)) {
      setErrors(prev => {
        const newErrors = new Map(prev)
        newErrors.delete(questionId)
        return newErrors
      })
    }
  }

  const handleSubmit = () => {
    // Validate required questions
    const newErrors = new Map<string, string>()
    clarification.questions.forEach(q => {
      const answer = answers.get(q.questionId)
      if (!answer || (typeof answer === 'string' && !answer.trim())) {
        newErrors.set(q.questionId, 'This question requires an answer')
      }
    })

    if (newErrors.size > 0) {
      setErrors(newErrors)
      return
    }

    // Build response
    const response: ClarificationResponse = {
      type: 'clarification_response',
      clarificationId: clarification.clarificationId,
      answers: Array.from(answers.entries()).map(([questionId, value]) => ({
        questionId,
        value,
      })),
    }

    onRespond(response)
  }

  const renderQuestion = (question: Question) => {
    const currentValue = answers.get(question.questionId)
    const error = errors.get(question.questionId)

    switch (question.questionType) {
      case 'single_choice':
        return (
          <div className="space-y-2">
            {question.options?.map(option => (
              <label
                key={option.id}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${currentValue === option.id
                    ? 'border-purple-500/50 bg-purple-500/20'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }
                `}
              >
                <input
                  type="radio"
                  name={question.questionId}
                  value={option.id}
                  checked={currentValue === option.id}
                  onChange={(e) => updateAnswer(question.questionId, e.target.value)}
                  className="mt-0.5 h-4 w-4 text-purple-500 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-white/90">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-white/50 mt-0.5">{option.description}</div>
                  )}
                </div>
              </label>
            ))}
            {question.allowFreeText && (
              <div className="mt-2">
                <Input
                  placeholder={question.placeholder || 'Or enter a custom answer...'}
                  value={typeof currentValue === 'string' && !question.options?.find(o => o.id === currentValue) ? currentValue : ''}
                  onChange={(e) => updateAnswer(question.questionId, e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        )

      case 'multiple_choice':
        const selectedValues = Array.isArray(currentValue) ? currentValue : []
        return (
          <div className="space-y-2">
            {question.options?.map(option => (
              <label
                key={option.id}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${selectedValues.includes(option.id)
                    ? 'border-purple-500/50 bg-purple-500/20'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }
                `}
              >
                <input
                  type="checkbox"
                  value={option.id}
                  checked={selectedValues.includes(option.id)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option.id]
                      : selectedValues.filter(v => v !== option.id)
                    updateAnswer(question.questionId, newValues)
                  }}
                  className="mt-0.5 h-4 w-4 text-purple-500 focus:ring-purple-500 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-white/90">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-white/50 mt-0.5">{option.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )

      case 'free_text':
        return (
          <Textarea
            placeholder={question.placeholder || 'Enter your answer...'}
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(e) => updateAnswer(question.questionId, e.target.value)}
            className="min-h-[80px] text-sm"
          />
        )

      case 'yes_no':
        return (
          <div className="flex gap-3">
            <Button
              type="button"
              variant={currentValue === 'yes' ? 'default' : 'outline'}
              onClick={() => updateAnswer(question.questionId, 'yes')}
              className={`flex-1 ${currentValue === 'yes' ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={currentValue === 'no' ? 'default' : 'outline'}
              onClick={() => updateAnswer(question.questionId, 'no')}
              className={`flex-1 ${currentValue === 'no' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              No
            </Button>
          </div>
        )

      case 'numeric_range':
        return (
          <div className="space-y-2">
            <Input
              type="number"
              min={question.min}
              max={question.max}
              step={question.step}
              placeholder={question.placeholder || `Enter a number${question.min !== undefined ? ` (min: ${question.min})` : ''}${question.max !== undefined ? ` (max: ${question.max})` : ''}`}
              value={typeof currentValue === 'number' ? currentValue : ''}
              onChange={(e) => updateAnswer(question.questionId, parseFloat(e.target.value))}
              className="text-sm"
            />
            {question.min !== undefined && question.max !== undefined && (
              <input
                type="range"
                min={question.min}
                max={question.max}
                step={question.step || 1}
                value={typeof currentValue === 'number' ? currentValue : question.min}
                onChange={(e) => updateAnswer(question.questionId, parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            )}
          </div>
        )

      default:
        return (
          <Input
            placeholder={question.placeholder || 'Enter your answer...'}
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(e) => updateAnswer(question.questionId, e.target.value)}
            className="text-sm"
          />
        )
    }
  }

  return (
    <Card className={`border-purple-500/30 bg-purple-500/10 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <HelpCircle size={20} className="text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white/90">Clarification Needed</CardTitle>
              {clarification.message && (
                <p className="text-sm text-white/60 mt-1">{clarification.message}</p>
              )}
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0 text-white/40 hover:text-white/80"
            >
              <X size={16} />
            </Button>
          )}
        </div>
        {clarification.context && (
          <p className="text-xs text-white/50 mt-2 bg-white/10 p-2 rounded-lg">
            Context: {clarification.context}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {clarification.questions.map((question, index) => (
          <div key={question.questionId} className="space-y-2">
            <div className="flex items-center gap-2">
              {question.header && (
                <Badge variant="outline" className="text-xs">
                  {question.header}
                </Badge>
              )}
              <span className="text-sm font-medium text-white/90">
                {question.question}
              </span>
            </div>
            {renderQuestion(question)}
            {errors.get(question.questionId) && (
              <p className="text-xs text-red-400">{errors.get(question.questionId)}</p>
            )}
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-2">
        {onDismiss && (
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={isSubmitting}
          >
            Skip
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-purple-500 hover:bg-purple-600 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="mr-2" />
              Submit Answers
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
