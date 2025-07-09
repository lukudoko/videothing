import { toast } from '@/lib/toast'; // Your custom toast
import { HiCheck, HiMinusCircle, HiInformationCircle } from "react-icons/hi"; // Added HiInformationCircle

export const batchDownload = async (
    selectedUrls,
    scrapedLinks,
    downloadPath,
    subfolderName,
    setDownloadProgress,
    setAllDownloadsCompleted,
    initialDownloadsQueued,
    setSelectedUrls,
    setIsLoadingDownload
) => {
    if (selectedUrls.length === 0) {
        toast({
            title: 'No Videos Selected',
            description: "Please select at least one video to download!",
            type: 'warning',
            icon: HiMinusCircle,
        });
        return;
    }
    if (!downloadPath) {
        toast({
            title: 'Category Missing',
            description: "Please select a download category!",
            type: 'warning',
            icon: HiMinusCircle,
        });
        return;
    }
    setIsLoadingDownload(true);
    let successfulQueues = 0;
    let failedQueues = 0;

    setAllDownloadsCompleted(false);
    initialDownloadsQueued.current = selectedUrls.length;

    const selectedVideoDetails = scrapedLinks.filter(link => selectedUrls.includes(link.url));

    // Initialize progress state
    const currentProgress = {};
    for (const videoDetail of selectedVideoDetails) {
        currentProgress[videoDetail.url] = {
            filename: videoDetail.filename,
            status: "queued",
            progress_percentage: 0,
            message: "Queueing..."
        };
    }
    setDownloadProgress(prev => ({ ...prev, ...currentProgress }));

    // Queue downloads
    for (const videoDetail of selectedVideoDetails) {
        const fullDownloadPath = subfolderName ? `${downloadPath}/${subfolderName}` : downloadPath;
        try {
            const response = await fetch(`/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: videoDetail.url,
                    path: fullDownloadPath,
                    title: videoDetail.filename
                }),
            });

            if (response.ok) {
                successfulQueues++;
            } else {
                failedQueues++;
                const errorData = await response.json();
                console.error(`Failed to queue ${videoDetail.url}: ${errorData.detail || response.statusText}`);
                setDownloadProgress(prev => ({
                    ...prev,
                    [videoDetail.url]: {
                        ...prev[videoDetail.url],
                        status: "failed",
                        message: errorData.detail || "Failed to queue."
                    }
                }));
                // Use your custom toast for individual queue failures
                toast({
                    title: "Queue Failed",
                    description: `Failed to queue ${videoDetail.filename.substring(0, 30)}...: ${errorData.detail || 'Unknown error'}`,
                    type: 'error',
                    icon: HiMinusCircle,
                });
            }
        } catch (error) {
            failedQueues++;
            console.error(`Network error queuing ${videoDetail.url}: ${error.message}`);
            setDownloadProgress(prev => ({
                ...prev,
                [videoDetail.url]: {
                    ...prev[videoDetail.url],
                    status: "failed",
                    message: `Network error: ${error.message}`
                }
            }));
            // Use your custom toast for network errors during queueing
            toast({
                title: "Network Error",
                description: `Network error queuing ${videoDetail.filename.substring(0, 30)}...: ${error.message}`,
                type: 'error',
                icon: HiMinusCircle,
            });
        }
    }

    // Show final completion toast - using your custom toast
    if (failedQueues === 0) {
        toast({
            title: "All Queued!",
            description: `Successfully queued ${successfulQueues} episodes for download!`,
            type: 'success',
            icon: HiCheck,
        });
    } else if (successfulQueues > 0) {
        toast({
            title: "Partial Queue",
            description: `Queued ${successfulQueues} for download, ${failedQueues} failed.`,
            type: 'warning',
            icon: HiMinusCircle,
        });
    } else {
        toast({
            title: "Queue Failed",
            description: `All ${failedQueues} episode downloads failed to queue.`,
            type: 'error',
            icon: HiMinusCircle,
        });
    }

    setSelectedUrls([]);
    setIsLoadingDownload(false);
    return 'progress'; // Return the tab to switch to
};