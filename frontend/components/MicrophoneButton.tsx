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
                    "w-20 h-20 rounded-full flex items-center justify-center relative z-10 transition-all duration-500 overflow-hidden",
                    disabled ? "opacity-30 cursor-not-allowed grayscale" : "cursor-pointer",
                    isRecording
                        ? "bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]"
                        : "bg-black border border-white/5 hover:shadow-[0_0_34px_rgba(251,191,36,0.22)] hover:border-everlast-gold/50"
                )}
            >
                {/* Background Shimmer/Glow */}
                <div className={clsx(
                    "absolute inset-0 transition-opacity duration-500",
                    isRecording ? "opacity-100" : "opacity-0 group-hover:opacity-20 bg-everlast-gold"
                )} />

                {/* Metallic Gold Ring (Not recording) */}
                {!isRecording && (
                    <div className="absolute inset-[2px] rounded-full bg-everlast-bg z-0" />
                )}

                {/* Pulse/Breathe Effect when Recording */}
                {isRecording && (
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.1, 0.3]
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-red-400"
                    />
                )}

                {/* Icon */}
                <div className={clsx(
                    "relative z-20 transition-all duration-500",
                    isRecording ? "text-white scale-110" : "text-everlast-gold group-hover:scale-110"
                )}>
                    {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </div>
            </motion.button>

            {/* Label */}
            <div className="mt-4 text-center">
                <span className={clsx(
                    "text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-500",
                    isRecording ? "text-red-500 animate-pulse" : "text-gray-600 group-hover:text-gray-400"
                )}>
                    {label}
                </span>
            </div>
        </div>
    )
}
