// components/ProgressMonitor.js
import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from "@heroui/react"; // HeroUI Progress component

const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, x: 20, transition: { duration: 0.2, ease: "easeIn" } },
};

function ProgressMonitor({ url, progress }) {
    const isDownloading = progress.status === 'downloading';
    const isConverting = progress.status === 'converting';
    const isTranscribing = progress.status === 'transcribing'; // New
    const isQueued = progress.status === 'queued' || progress.status === 'download_completed';
    const isFailed = progress.status === 'failed';
    const isFinalized = progress.status === 'completed' || progress.status === 'skipped'; // New
    const isSkipped = progress.status === 'wamng';
    const mainProgressPercentage = progress.progress_percentage;


    let statusClasses = '';
    let textColorClass = '';
    let barClass = '';

    if (isFailed) {
        statusClasses = 'border-red-300 bg-red-100';
        textColorClass = 'text-red-700 capitalize';
        barClass = 'bg-red-400';

    } else if (isTranscribing) {
        statusClasses = 'border-purple-300 bg-purple-100';
        textColorClass = 'text-purple-700 capitalize';
        barClass = 'bg-purple-400';
    } else if (isSkipped) {
        statusClasses = 'border-amber-300 bg-amber-100';
        textColorClass = 'text-amber-700 capitalize';
        barClass = 'bg-amber-400';
    } else if (isFinalized) {
        statusClasses = 'border-teal-300 bg-teal-100';
        textColorClass = 'text-teal-700 capitalize';
        barClass = 'bg-teal-400';
    } else if (isDownloading) {
        statusClasses = 'border-blue-300 bg-blue-100';
        textColorClass = 'text-blue-700 capitalize';
        barClass = 'bg-blue-400';
    }
    else {
        statusClasses = 'border-indigo-300 bg-indigo-100';
        textColorClass = 'text-indigo-700 capitalize';
        barClass = 'bg-indigo-400';
    }

    const rawDisplayName = progress.filename || url.split('/').pop().split('?')[0];
    const displayName = decodeURIComponent(rawDisplayName);
    const trimmedUrl = url.length > 80 ? `${url.substring(0, 77)}...` : url;


    return (
        <motion.li
            className={`p-4 rounded-3xl border-2 shadow-sm ${statusClasses}`}
            variants={listItemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
        >

            <p className="block mb-4 text-2xl font-bold text-gray-900 break-words">{displayName}</p>

            {(isDownloading || isConverting || isQueued || isTranscribing || isFinalized) && (
                <>
                    <Progress
                        isIndeterminate={isQueued}
                        aria-label="Loading..."
                        value={mainProgressPercentage || 0}
                        size="lg"
                        classNames={{
                            base: "mt-1",
                            indicator: barClass,
                            value: textColorClass,
                            label: textColorClass,
                        }}
                        showValueLabel={true}
                        label={
                            progress.status
                                .split('_') // Split the string by underscores (e.g., "download_completed" -> ["download", "completed"])
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word (e.g., "download" -> "Download")
                                .join(' ') // Join the words back with spaces (e.g., ["Download", "Completed"] -> "Download Completed")
                        } />
                    <div className="flex w-full  text-xs text-gray-600 mt-2">

                        {isDownloading && (
                            <div className='font-bold flex gap-4 justify-evenly'>
                                <p>Speed: {progress.download_speed || 'N/A'}</p>
                                <p>ETA: {progress.eta || 'N/A'}</p>

                            </div>
                        )}
                    </div>
                </>
            )}

            {(isFinalized || isSkipped) && progress.output_path && (
                <div className="mt-3 pt-2  text-xs text-gray-600">
                    <span className="font-medium">Output Path: </span>
                    <span className="break-all">{progress.output_path}</span>
                </div>
            )}
            {isFailed && (
                <div className="mt-3 pt-2 border-t border-red-200 text-base font-bold text-red-600">
                    <span className="font-bold">Error: </span>
                    <span className="break-all">{progress.error_message || 'Unknown error'}</span>
                </div>
            )}
        </motion.li>
    );
}

export default ProgressMonitor;