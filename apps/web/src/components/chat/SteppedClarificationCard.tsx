'use client'

import React, { useState, useCallback } from 'react'
import { HelpCircle, ChevronRight, ChevronLeft, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type {
  ClarificationNeeded,
  ClarificationResponse,
  Question,
  Answer
} from '@pixell/protocols'

interface SteppedClarificationCardProps {
  clarification: ClarificationNeeded
  onRespond: (response: ClarificationResponse) => void
  onDismiss?: () => void
  isSubmitting?: boolean
  className?: string
}

export function SteppedClarificationCard({
  clarification,
  onRespond,
  onDismiss,
  isSubmitting = false,
  className = ''
}: SteppedClarificationCardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Map<string, Answer['value']>>(new Map())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const questions = clarification.questions
  const totalSteps = questions.length
  const currentQuestion = questions[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100

  const updateAnswer = useCallback((questionId: string, value: Answer['value']) => {
    setAnswers(prev => new Map(prev.set(questionId, value)))
    // Clear error when user provides an answer
    if (errors.has(questionId)) {
      setErrors(prev => {
        const newErrors = new Map(prev)
        newErrors.delete(questionId)
        return newErrors
      })
    }
  }, [errors])

  const validateCurrentQuestion = useCallback(() => {
    const answer = answers.get(currentQuestion.questionId)
    if (!answer || (typeof answer === 'string' && !answer.trim()) || (Array.isArray(answer) && answer.length === 0)) {
      setErrors(prev => new Map(prev.set(currentQuestion.questionId, 'Please select or enter an answer')))
      return false
    }
    return true
  }, [answers, currentQuestion])

  const handleNext = useCallback(() => {
    if (!validateCurrentQuestion()) return

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, totalSteps, validateCurrentQuestion])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleSubmit = useCallback(() => {
    if (!validateCurrentQuestion()) return

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
  }, [answers, clarification.clarificationId, onRespond, validateCurrentQuestion])

  const renderQuestion = (question: Question) => {
    const currentValue = answers.get(question.questionId)
    const error = errors.get(question.questionId)

    switch (question.questionType) {
      case 'single_choice':
        return (
          <div className="space-y-1">
            {question.options?.map(option => (
              <label
                key={option.id}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                  ${currentValue === option.id
                    ? 'border-purple-500/50 bg-purple-500/20'
                    : 'border-white/10 hover:border-purple-500/30 hover:bg-white/5'
                  }
                `}
              >
                <input
                  type="radio"
                  name={question.questionId}
                  value={option.id}
                  checked={currentValue === option.id}
                  onChange={(e) => updateAnswer(question.questionId, e.target.value)}
                  className="h-3 w-3 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-white/90">{option.label}</span>
              </label>
            ))}
            {question.allowFreeText && (
              <Input
                placeholder={question.placeholder || 'Or enter custom...'}
                value={typeof currentValue === 'string' && !question.options?.find(o => o.id === currentValue) ? currentValue : ''}
                onChange={(e) => updateAnswer(question.questionId, e.target.value)}
                className="text-xs h-7 mt-1"
              />
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )

      case 'multiple_choice':
        const selectedValues = Array.isArray(currentValue) ? currentValue : []
        return (
          <div className="space-y-1">
            {question.options?.map(option => (
              <label
                key={option.id}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                  ${selectedValues.includes(option.id)
                    ? 'border-purple-500/50 bg-purple-500/20'
                    : 'border-white/10 hover:border-purple-500/30 hover:bg-white/5'
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
                  className="h-3 w-3 text-purple-500 focus:ring-purple-500 rounded"
                />
                <span className="text-white/90">{option.label}</span>
              </label>
            ))}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )

      case 'free_text':
        return (
          <div>
            <Textarea
              placeholder={question.placeholder || 'Enter your answer...'}
              value={typeof currentValue === 'string' ? currentValue : ''}
              onChange={(e) => updateAnswer(question.questionId, e.target.value)}
              className="min-h-[60px] text-sm"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )

      case 'yes_no':
        return (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={currentValue === 'yes' ? 'default' : 'outline'}
              onClick={() => updateAnswer(question.questionId, 'yes')}
              className={`flex-1 h-8 text-sm ${currentValue === 'yes' ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={currentValue === 'no' ? 'default' : 'outline'}
              onClick={() => updateAnswer(question.questionId, 'no')}
              className={`flex-1 h-8 text-sm ${currentValue === 'no' ? 'bg-red-600 hover:bg-red-700' : ''}`}
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
              placeholder={question.placeholder || `Enter a number`}
              value={typeof currentValue === 'number' ? currentValue : ''}
              onChange={(e) => updateAnswer(question.questionId, parseFloat(e.target.value))}
              className="text-sm h-8"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )

      default:
        return (
          <div>
            <Input
              placeholder={question.placeholder || 'Enter your answer...'}
              value={typeof currentValue === 'string' ? currentValue : ''}
              onChange={(e) => updateAnswer(question.questionId, e.target.value)}
              className="text-sm h-8"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )
    }
  }

  const isLastStep = currentStep === totalSteps - 1
  const isFirstStep = currentStep === 0

  return (
    <Card className={`border-purple-500/30 bg-purple-500/10 shadow-lg max-w-md ${className}`}>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-white/90">Step {currentStep + 1}/{totalSteps}</span>
          </div>
          <Badge variant="outline" className="text-purple-400 border-purple-500/30 text-xs px-1.5 py-0">
            {Math.round(progress)}%
          </Badge>
        </div>
        <Progress value={progress} className="h-1 mt-1" />
      </CardHeader>

      <CardContent className="py-2 px-3 space-y-2">
        {currentQuestion.header && (
          <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs px-1.5 py-0">
            {currentQuestion.header}
          </Badge>
        )}
        <p className="text-sm text-white/90">{currentQuestion.question}</p>
        {renderQuestion(currentQuestion)}
      </CardContent>

      <CardFooter className="flex justify-between gap-2 py-2 px-3 border-t border-white/10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={isFirstStep || isSubmitting}
          className="h-7 text-xs px-2"
        >
          <ChevronLeft size={14} />
          Back
        </Button>

        <div className="flex gap-1">
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="h-7 text-xs text-white/50 px-2"
            >
              Skip
            </Button>
          )}

          {isLastStep ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-purple-500 hover:bg-purple-600 text-white h-7 text-xs px-2"
            >
              {isSubmitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={12} className="mr-1" />
                  Submit
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={isSubmitting}
              className="bg-purple-500 hover:bg-purple-600 text-white h-7 text-xs px-2"
            >
              Next
              <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
