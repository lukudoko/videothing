import { toast } from "sonner";

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
        toast.warning("Please select at least one video to download.", { title: "No Videos Selected" });
        return;
    }
    if (!downloadPath) {
        toast.warning("Please select a download category.", { title: "Category Missing" });
        return;
    }

    toast.info(`Queueing ${selectedUrls.length} downloads...`, { title: "Downloads Queued" });
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
                toast.error(`Failed to queue ${videoDetail.filename.substring(0, 30)}...: ${errorData.detail || 'Unknown error'}`, { title: "Queue Failed" });
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
            toast.error(`Network error queuing ${videoDetail.filename.substring(0, 30)}...: ${error.message}`, { title: "Network Error" });
        }
    }

    // Show completion toast
    if (failedQueues === 0) {
        toast.success(`Successfully queued all ${successfulQueues} downloads.`, { title: "All Queued!" });
    } else if (successfulQueues > 0) {
        toast.warning(`Queued ${successfulQueues} downloads, ${failedQueues} failed.`, { title: "Partial Queue" });
    } else {
        toast.error(`All ${failedQueues} downloads failed to queue.`, { title: "Queue Failed" });
    }

    setSelectedUrls([]);
    setIsLoadingDownload(false);
    return 'progress'; // Return the tab to switch to
};