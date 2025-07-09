import { useState, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import { HiCheck, HiMinusCircle } from "react-icons/hi";

export const useDownloadManager = () => {
    const [downloadProgress, setDownloadProgress] = useState({});
    const [allDownloadsCompleted, setAllDownloadsCompleted] = useState(false);
    const clearedProgressUrls = useRef(new Set());
    const initialDownloadsQueued = useRef(0);

    const handleClearProgress = async () => {
        try {
            const response = await fetch('/api/clear_progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to clear progress on server');
            }

            const result = await response.json();

            setDownloadProgress(prev => {
                const filtered = {};
                for (const url in prev) {
                    const progress = prev[url];
                    if (!['completed', 'converted', 'failed', 'skipped'].includes(progress.status)) {
                        filtered[url] = progress;
                    }
                }
                return filtered;
            });

            clearedProgressUrls.current = new Set();


            toast({
                title: 'Progress Cleared!',
                description: result.message || "Completed and failed tasks have been removed from the list.",
                type: 'success', 
                icon: HiCheck, 
            });


        } catch (error) {
            console.error('Error clearing progress:', error);
            toast({
                title: 'Error!',
                description: "Failed to clear progress. Please try again.",
                type: 'error', // This will apply green styling
                icon: HiMinusCircle, // A simple emoji icon
            });
        }
    };

    // Progress polling effect
    useEffect(() => {
        let intervalId;
        const fetchProgress = async () => {
            try {
                const response = await fetch(`api/progress`);
                if (response.ok) {
                    const data = await response.json();
                    const filteredData = {};

                    for (const url in data) {
                        if (!clearedProgressUrls.current.has(url)) {
                            filteredData[url] = data[url];
                        }
                    }
                    setDownloadProgress(filteredData);

                    const currentlyTrackedQueued = Object.values(downloadProgress).filter(
                        p => ['queued', 'downloading', 'converting'].includes(p.status)
                    ).length;

                    if (initialDownloadsQueued.current > 0 && currentlyTrackedQueued === 0 && !allDownloadsCompleted) {

                        toast({
                            title: 'Tasks Finished',
                            description:  "All downloads are complete!",
                            type: 'success', // This will apply green styling
                            icon: HiCheck, // A simple emoji icon
                        });
                        setAllDownloadsCompleted(true);
                        initialDownloadsQueued.current = 0;
                    }
                } else {
                    console.error('Failed to fetch progress:', response.statusText);
                }
            } catch (error) {
                console.error('Error fetching progress:', error);
            }
        };

        intervalId = setInterval(fetchProgress, 2000);
        return () => clearInterval(intervalId);
    }, [initialDownloadsQueued, allDownloadsCompleted, downloadProgress]);

    return {
        downloadProgress,
        setDownloadProgress,
        allDownloadsCompleted,
        setAllDownloadsCompleted,
        clearedProgressUrls,
        initialDownloadsQueued,
        handleClearProgress
    };
};