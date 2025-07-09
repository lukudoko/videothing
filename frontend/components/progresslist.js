// components/ProgressList.js
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@heroui/react"; // HeroUI Button
import ProgressMonitor from './progressmonitor'; // Import the individual item component

function ProgressList({ downloadProgress, handleClearProgress }) {
    const hasProgress = Object.keys(downloadProgress).length > 0;

    return (
        <>
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                <p className="text-3xl font-bold text-gray-800 dark:text-white">
                    Tasks
                </p>

                {hasProgress && (
                    <div className="mb-4 md:mb-0"> {/* Remove bottom margin on medium+ screens */}
                        <Button
                            onPress={handleClearProgress}
                            variant="bordered"
                            size="sm"
                            className="border-indigo-400 text-indigo-700 hover:text-red-400 hover:border-red-400 dark:border-indigo-400 dark:text-indigo-400 dark:hover:text-red-400 dark:hover:border-red-400"
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
                        className="text-center text-gray-500 py-4 dark:text-gray-400"
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