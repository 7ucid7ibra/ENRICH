import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { clsx } from 'clsx'

interface MicrophoneButtonProps {
    isRecording: boolean
    onClick: () => void
    disabled?: boolean
    label: string
}

export default function MicrophoneButton({ isRecording, onClick, disabled, label }: MicrophoneButtonProps) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group flex flex-col items-center">
            {/* Button Container */}
            <motion.button
                onClick={onClick}
                disabled={disabled}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                whileHover={{ scale: disabled ? 1 : 1.05 }}
                whileTap={{ scale: disabled ? 1 : 0.95 }}
                className={clsx(
                    "w-24 h-24 rounded-full flex items-center justify-center relative z-10 transition-all duration-300",
                    disabled ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer",
                    isRecording ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]" : "bg-everlast-surface border border-white/10 hover:border-everlast-primary/50 shadow-xl"
                )}
            >
                {/* Pulse Effect when Recording */}
                {isRecording && (
                    <motion.div
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-red-500"
                    />
                )}

                {/* Icon */}
                <div className={clsx("relative z-20 transition-colors", isRecording ? "text-white" : "text-everlast-secondary")}>
                    {isRecording ? (
                        <MicOff className="w-10 h-10" />
                    ) : (
                        <Mic className="w-10 h-10" />
                    )}
                </div>
            </motion.button>

            {/* Label */}
            <div className="mt-6 text-center">
                <span className={clsx(
                    "text-xs font-medium tracking-widest uppercase transition-colors duration-300",
                    isRecording ? "text-red-500 animate-pulse" : "text-gray-500"
                )}>
                    {label}
                </span>
            </div>
        </div>
    )
}
