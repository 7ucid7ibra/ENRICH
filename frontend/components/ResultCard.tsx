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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
            className={twMerge(
                'relative glass-panel rounded-2xl p-6 flex flex-col border border-white/5 bg-white/[0.01] shadow-xl group overflow-hidden',
                className
            )}
        >
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />

            <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-[1px] bg-everlast-gold/30" />
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] font-sans">
                    {title}
                </h3>
            </div>

            <div className="relative z-10 text-everlast-text-main leading-relaxed">
                {children}
            </div>
        </motion.div>
    )
}
