import React from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface ResultCardProps {
    title: string
    children: React.ReactNode
    className?: string
    delay?: number
}

export default function ResultCard({ title, children, className, delay = 0 }: ResultCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className={twMerge(
                'glass-panel rounded-xl p-6 flex flex-col',
                className
            )}
        >
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {title}
            </h3>
            <div className="text-everlast-text-main text-sm leading-relaxed">
                {children}
            </div>
        </motion.div>
    )
}
