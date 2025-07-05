// components/ProgressList.js
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@heroui/react"; // HeroUI Button
import ProgressMonitor from './progressmonitor'; // Import the individual item component

function ProgressList({ downloadProgress, handleClearProgress }) {
    const hasProgress = Object.keys(downloadProgress).length > 0;

    return (
        <>
            <div className='flex gap-4 justify-between'>
            <p className="text-3xl font-bold text-gray-800 mb-6 ">
                Tasks
            </p>
            
            {hasProgress && (
                <div className="mb-4 text-right">
                    <Button
                        onPress={handleClearProgress}
                        variant="bordered"
                        size="sm"
                        className="border-indigo-400 text-indigo-700 hover:text-red-400 hover:border-red-400"
                    >
                        Clear Completed
                    </Button>
                </div>
            )}
            </div>
            
            <AnimatePresence>
                {!hasProgress ? (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-gray-500 py-4"
                    >
                        No active or recent tasks :D
                    </motion.p>
                ) : (
                    <ul className="list-none p-0 mt-5 space-y-4">
                        <AnimatePresence mode="popLayout">
                            {Object.entries(downloadProgress)
                                .sort(([, a], [, b]) => b.timestamp - a.timestamp) // Sort by most recent first
                                .map(([url, progress]) => (
                                    <ProgressMonitor key={url} url={url} progress={progress} />
                                ))}
                        </AnimatePresence>
                    </ul>
                )}
            </AnimatePresence>
        </>
    );
}

export default ProgressList;