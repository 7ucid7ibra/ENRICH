import React from 'react'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="relative min-h-screen bg-everlast-bg text-everlast-text-main flex flex-col items-center selection:bg-everlast-gold/30 selection:text-white">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-everlast-gold/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-everlast-silver/5 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')] opacity-[0.03] pointer-events-none" />
            </div>

            {/* Structured Background Elements */}
            <div className="fixed inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-everlast-bg/50 to-transparent opacity-80 pointer-events-none" />

            {/* Refined Vertical Lines */}
            <div className="fixed left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
            <div className="fixed right-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />

            {/* Content Area */}
            <main className="relative z-10 w-full max-w-[1600px] min-h-screen flex flex-col px-12 py-8">
                {children}
            </main>
        </div>
    )
}
