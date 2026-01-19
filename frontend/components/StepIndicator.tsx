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
        <div className="flex items-center justify-center space-x-4 py-4">
            {steps.map((step, index) => {
                const isActive = index === currentIndex
                const isCompleted = index < currentIndex

                return (
                    <div key={step.id} className="flex items-center">
                        <motion.div
                            initial={false}
                            animate={{
                                color: isActive || isCompleted ? '#fbbf24' : '#6b7280',
                                scale: isActive ? 1.05 : 1,
                            }}
                            className={twMerge(
                                'text-sm font-medium tracking-wide uppercase',
                                isActive ? 'text-everlast-secondary drop-shadow-md' : 'text-gray-500'
                            )}
                        >
                            {step.label}
                        </motion.div>
                        {index < steps.length - 1 && (
                            <div className="mx-3 h-px w-8 bg-white/10" />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
