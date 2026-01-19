import React from 'react'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="relative min-h-screen bg-everlast-bg text-everlast-text-main flex flex-col items-center">
            {/* Background Elements */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-50 rounded-t-[100%] pointer-events-none fixed" />

            {/* Vertical Light Lines */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-white/5 fixed" />
            <div className="absolute right-8 top-0 bottom-0 w-px bg-white/5 fixed" />

            {/* Content Area */}
            <main className="relative z-10 w-full max-w-7xl min-h-screen flex flex-col p-8">
                {children}
            </main>
        </div>
    )
}
