import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings as SettingsIcon } from 'lucide-react'
import { clsx } from 'clsx'

interface SettingsDrawerProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
}

export default function SettingsDrawer({ isOpen, onClose, children }: SettingsDrawerProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-80 bg-everlast-surface border-l border-white/10 p-6 z-50 shadow-2xl flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2 text-everlast-text-main">
                                <SettingsIcon className="w-5 h-5 text-everlast-secondary" />
                                <h2 className="text-lg font-bold tracking-wide">EINSTELLUNGEN</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
