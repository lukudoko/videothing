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
    const isDownloadActive = progress.status === 'downloading';
    const isConverting = progress.status === 'converting';
    const isFailed = progress.status === 'failed';
    const isCompleted = progress.status === 'completed';
    const isConverted = progress.status === 'converted';
    const isSkipped = progress.status === 'skipped';

    const mainProgressPercentage = isConverting ? progress.conversion_percentage : progress.progress_percentage;

    let statusClasses = '';
    let progressColor = '';
    let textColorClass = '';

    if (isFailed) {
        statusClasses = 'border-red-300 bg-red-100';
        progressColor = 'danger';
        textColorClass = 'text-red-700';
    } else if (isConverted) {
        statusClasses = 'border-green-300 bg-green-100';
        progressColor = 'success';
        textColorClass = 'text-green-700';
    } else if (isSkipped) {
        statusClasses = 'border-amber-300 bg-amber-100';
        progressColor = 'warning';
        textColorClass = 'text-amber-700';
    } else if (isCompleted) {
        statusClasses = 'border-green-300 bg-green-100';
        progressColor = 'success';
        textColorClass = 'text-green-700';
    } else { // active, queued
        statusClasses = 'border-indigo-300 bg-indigo-100';
        progressColor = 'primary';
        textColorClass = 'text-indigo-700';
    }

    const rawDisplayName = progress.filename || url.split('/').pop().split('?')[0];
    const displayName = decodeURIComponent(rawDisplayName);
    const trimmedUrl = url.length > 80 ? `${url.substring(0, 77)}...` : url;
 

    return (
        <motion.li
            className={`p-4 rounded-2xl shadow-sm ${statusClasses}`}
            variants={listItemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
        >
            <strong className="block mb-4 text-2xl font-bold text-gray-900 break-words">{displayName}</strong>

            <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold text-base mb-2 ${textColorClass}`}>
                    {progress.message}
                </span>
                {(isDownloadActive || isConverting) && (
                    <svg
                        className="animate-spin ml-2 h-5 w-5 text-current"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                )}
            </div>

            {(isDownloadActive || isConverting || isCompleted || isConverted) && (
                <>
                    <Progress
                        value={mainProgressPercentage || 0}
                        color={progressColor}
                        size="lg"
                        className="mt-1"
                        showValueLabel={false}
                    />
                    <div className="flex w-full  text-xs text-gray-600 mt-2">

                        {isDownloadActive && (
                            <div className='font-bold flex gap-4 justify-evenly'>
                                <p>Speed: {progress.download_speed || 'N/A'}</p>
                                <p>ETA: {progress.eta || 'N/A'}</p>

                            </div>
                        )}
                    </div>
                </>
            )}

            {(isCompleted || isConverted || isSkipped) && progress.output_path && (
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