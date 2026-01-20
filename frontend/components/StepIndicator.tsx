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
}

export default function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
    const steps = [
        { id: 'record', label: labels.record },
        { id: 'transcribe', label: labels.transcribe },
        { id: 'enrich', label: labels.enrich },
    ]

    const getCurrentIndex = () => steps.findIndex((s) => s.id === currentStep)
    const currentIndex = getCurrentIndex()

    return (
        <div className="flex items-center gap-8 py-2">
            {steps.map((step, index) => {
                const isActive = index === currentIndex
                const isCompleted = index < currentIndex

                return (
                    <div key={step.id} className="flex items-center gap-8">
                        <div className="flex flex-col items-start gap-1">
                            <motion.div
                                animate={{
                                    color: isActive ? '#fbbf24' : isCompleted ? '#ffffff' : '#4b5563',
                                    opacity: isActive || isCompleted ? 1 : 0.4
                                }}
                                className="text-[10px] font-bold tracking-[0.2em] uppercase transition-all"
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
