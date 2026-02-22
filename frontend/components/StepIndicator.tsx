import React from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface StepIndicatorProps {
    currentStep: 'record' | 'transcribe' | 'enrich'
    labels: {
        record: string
        transcribe: string
        enrich: string
    }
    onStepClick?: (step: 'record' | 'transcribe' | 'enrich') => void
    clickableSteps?: Array<'record' | 'transcribe' | 'enrich'>
}

export default function StepIndicator({ currentStep, labels, onStepClick, clickableSteps = [] }: StepIndicatorProps) {
    const steps = [
        { id: 'record', label: labels.record },
        { id: 'transcribe', label: labels.transcribe },
        { id: 'enrich', label: labels.enrich },
    ] as const

    const getCurrentIndex = () => steps.findIndex((s) => s.id === currentStep)
    const currentIndex = getCurrentIndex()

    return (
        <div className="flex items-center gap-8 py-2">
            {steps.map((step, index) => {
                const isActive = index === currentIndex
                const isCompleted = index < currentIndex
                const isClickable = clickableSteps.includes(step.id)

                return (
                    <div key={step.id} className="flex items-center gap-8">
                        <div className="flex flex-col items-start gap-1">
                            <motion.div
                                animate={{
                                    color: isActive ? '#fbbf24' : isCompleted ? '#ffffff' : '#4b5563',
                                    opacity: isActive || isCompleted ? 1 : 0.4
                                }}
                                className={twMerge(clsx(
                                    "text-[10px] font-bold tracking-[0.2em] uppercase transition-all",
                                    isClickable && "cursor-pointer hover:opacity-100"
                                ))}
                                onClick={() => {
                                    if (isClickable && onStepClick) {
                                        onStepClick(step.id)
                                    }
                                }}
                            >
                                {step.label}
                            </motion.div>
                            {isActive && (
                                <motion.div
                                    layoutId="step-underline"
                                    className="h-0.5 w-full bg-everlast-gold"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                />
                            )}
                        </div>
                        {index < steps.length - 1 && (
                            <div className="w-12 h-px bg-white/5" />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
