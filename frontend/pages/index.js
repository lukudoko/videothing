import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, Tab } from '@heroui/react';
import { toast } from "sonner";
import ScrapingSection from '@/components/scraper';
import LinkSelectionSection from '@/components/links';
import DownloadQueueSection from '@/components/downloads';
import ProgressList from '@/components/progresslist';
import FileBrowserPage from '@/components/files'; // New: Placeholder for embedding file browser


const AVAILABLE_SUBDIRS = [
    "TV Shows",
    "Movies"
];

const sectionVariants = {
    hidden: { opacity: 0, y: 10 }, // Added slight y offset for better transition feel
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } } // Added exit animation
};

export default function Home() {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapedLinks, setScrapedLinks] = useState([]);
    const [downloadPath, setDownloadPath] = useState(AVAILABLE_SUBDIRS[0] || '');
    const [subfolderName, setSubfolderName] = useState('');
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [message, setMessage] = useState(''); // For scrape success/error message (though replaced by toast now)
    const [downloadProgress, setDownloadProgress] = useState({});
    const [isLoadingScrape, setIsLoadingScrape] = useState(false);
    const [isLoadingDownload, setIsLoadingDownload] = useState(false);
    const [allDownloadsCompleted, setAllDownloadsCompleted] = useState(false);

    const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'progress' or 'files' or 'whisper'

    const clearedProgressUrls = useRef(new Set());
    const initialDownloadsQueued = useRef(0);

    const handleScrape = async () => {
        if (!scrapeUrl) {
            toast.warning("Please enter a URL to scrape.", { title: "Input Required" });
            return;
        }
        setMessage('');
        setScrapedLinks([]);
        setSelectedUrls([]);
        setIsLoadingScrape(true);

        try {
            const response = await fetch(`/api/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: scrapeUrl }),
            });
            const data = await response.json();

            if (response.ok) {
                const videosWithFilenames = data.videos.map(video => ({
                    url: video.url,
                    filename: video.filename || video.url.split('/').pop().split('?')[0]
                }));
                setScrapedLinks(videosWithFilenames || []);
                toast.success(`Scraped ${videosWithFilenames.length} links.`, { title: "Scrape Successful" });
            } else {
                toast.error(`Error scraping: ${data.detail || 'Unknown error'}`, { title: "Scrape Error" });
            }
        } catch (error) {
            toast.error(`Could not connect to backend: ${error.message}`, { title: "Network Error" });
        } finally {
            setIsLoadingScrape(false);
        }
    };

    const handleSelectToggle = (url) => {
        setSelectedUrls((prevSelected) =>
            prevSelected.includes(url)
                ? prevSelected.filter((u) => u !== url)
                : [...prevSelected, url]
        );
    };

    const handleSelectAll = () => {
        setSelectedUrls(scrapedLinks.map(link => link.url));
    };

    const handleDeselectAll = () => {
        setSelectedUrls([]);
    };

    const handleBatchDownload = async () => {
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

        const currentProgress = { ...downloadProgress };
        const selectedVideoDetails = scrapedLinks.filter(link => selectedUrls.includes(link.url));

        for (const videoDetail of selectedVideoDetails) {
            currentProgress[videoDetail.url] = {
                filename: videoDetail.filename,
                status: "queued",
                progress_percentage: 0,
                message: "Queueing..."
            };
        }
        setDownloadProgress(currentProgress);

        for (const videoDetail of selectedVideoDetails) {
            const fullDownloadPath = subfolderName ? `${downloadPath}/${subfolderName}` : downloadPath;
            try {
                const response = await fetch(`/api/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: videoDetail.url,
                        path: fullDownloadPath,
                        title: videoDetail.filename // <--- ADD THIS LINE
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

        if (failedQueues === 0) {
            toast.success(`Successfully queued all ${successfulQueues} downloads.`, { title: "All Queued!" });
        } else if (successfulQueues > 0) {
            toast.warning(`Queued ${successfulQueues} downloads, ${failedQueues} failed.`, { title: "Partial Queue" });
        } else {
            toast.error(`All ${failedQueues} downloads failed to queue.`, { title: "Queue Failed" });
        }

        setSelectedUrls([]);
        setIsLoadingDownload(false);
        setActiveTab('progress'); // Switch to progress tab after queuing
    };

    const handleClearProgress = () => {
        const newClearedUrls = new Set(clearedProgressUrls.current);
        Object.entries(downloadProgress).forEach(([url, progress]) => {
            if (['completed', 'converted', 'failed', 'skipped'].includes(progress.status)) {
                newClearedUrls.add(url);
            }
        });
        clearedProgressUrls.current = newClearedUrls;
        setDownloadProgress(prev => {
            const filtered = {};
            for (const url in prev) {
                if (!clearedProgressUrls.current.has(url)) {
                    filtered[url] = prev[url];
                }
            }
            return filtered;
        });
        toast.info("Completed and failed tasks have been removed from the list.", { title: "Progress Cleared" });
    };

    // --- Progress Polling ---
    useEffect(() => {
        let intervalId;
        const fetchProgress = async () => {
            try {
                const response = await fetch(`api/progress`);
                if (response.ok) {
                    const data = await response.json();
                    const filteredData = {};
                    let completedCount = 0;

                    for (const url in data) {
                        if (!clearedProgressUrls.current.has(url)) {
                            filteredData[url] = data[url];
                            if (['completed', 'converted', 'failed', 'skipped'].includes(data[url].status)) {
                                completedCount++;
                            }
                        }
                    }
                    setDownloadProgress(filteredData);

                    // Check if all initially queued downloads are now completed/failed/skipped
                    const currentlyTrackedQueued = Object.values(downloadProgress).filter(
                        p => ['queued', 'downloading', 'converting'].includes(p.status)
                    ).length;

                    if (initialDownloadsQueued.current > 0 && currentlyTrackedQueued === 0 && !allDownloadsCompleted) {
                        // This condition is tricky. A better check is if all 'initialDownloadsQueued' URLs
                        // are now in a final state within 'downloadProgress'.
                        const initialUrlsFinalized = Object.entries(downloadProgress).filter(([url, progress]) =>
                            Array.from(selectedUrls).includes(url) && ['completed', 'converted', 'failed', 'skipped'].includes(progress.status)
                        ).length;

                        if (initialUrlsFinalized === initialDownloadsQueued.current) {
                            toast.success("All downloads/conversions are complete!", { title: "Tasks Finished" });
                            setAllDownloadsCompleted(true);
                            initialDownloadsQueued.current = 0; // Reset for next batch
                        }
                    }
                } else {
                    console.error('Failed to fetch progress:', response.statusText);
                }
            } catch (error) {
                console.error('Error fetching progress:', error);
            }
        };

        // Poll every 2 seconds
        intervalId = setInterval(fetchProgress, 2000);
        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, [initialDownloadsQueued, allDownloadsCompleted, downloadProgress]); // Depend on relevant states for re-run

    return (
        <div className="pt-24 p-10 max-w-4xl mx-auto font-sans text-gray-800">
            <p className="text-5xl font-extrabold text-center mb-10">
                Japanese Show Downloader
            </p>
            <div className='flex  justify-center'>
                <Tabs
                    selectedKey={activeTab}
                    onSelectionChange={setActiveTab}
                    aria-label="Downloader options"
                    size='lg'
                    variant='bordered'
                    color='primary'
                    classNames={{
                        cursor: "bg-indigo-400",
                    }}
                >
                    <Tab key="queue" title="Queue Videos" />
                    <Tab key="progress" title="Progress" />
                    <Tab key="files" title="File Browser" />
                </Tabs>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'queue' && (
                    <motion.div
                        key="queue-tab-content"
                        initial="hidden"
                        animate="visible"
                        exit="exit" // Use the exit variant
                        variants={sectionVariants}
                        className="bg-white p-8 mt-6 rounded-3xl shadow-lg mb-8 border border-gray-200"
                    >
                        <ScrapingSection
                            scrapeUrl={scrapeUrl}
                            setScrapeUrl={setScrapeUrl}
                            handleScrape={handleScrape}
                            isLoadingScrape={isLoadingScrape}
                            message={message} // Consider if 'message' state is still needed with toasts
                        />

                        {scrapedLinks.length > 0 && (
                            <>
                                <LinkSelectionSection
                                    scrapedLinks={scrapedLinks}
                                    selectedUrls={selectedUrls}
                                    handleSelectToggle={handleSelectToggle}
                                    handleSelectAll={handleSelectAll}
                                    handleDeselectAll={handleDeselectAll}
                                />
                                <DownloadQueueSection
                                    selectedUrls={selectedUrls}
                                    downloadPath={downloadPath}
                                    setDownloadPath={setDownloadPath}
                                    subfolderName={subfolderName}
                                    setSubfolderName={setSubfolderName}
                                    handleBatchDownload={handleBatchDownload}
                                    isLoadingDownload={isLoadingDownload}
                                    availableSubdirs={AVAILABLE_SUBDIRS} // Pass this down if used in DownloadQueueSection
                                />
                            </>
                        )}
                        {/* --- End conditional rendering --- */}
                    </motion.div>
                )}

                {activeTab === 'progress' && (
                    <motion.div
                        key="progress-tab-content"
                        initial="hidden"
                        animate="visible"
                        exit="exit" // Use the exit variant
                        variants={sectionVariants}
                        className="bg-white p-8 mt-6 rounded-3xl shadow-lg mb-8 border border-gray-200" // Added common styling
                    >
                        <ProgressList
                            downloadProgress={downloadProgress}
                            handleClearProgress={handleClearProgress}
                        />
                    </motion.div>
                )}



                {activeTab === 'files' && (
                    <motion.div
                        key="files-tab-content"
                        initial="hidden"
                        animate="visible"
                        exit="exit" // Use the exit variant
                        variants={sectionVariants}
                        className="bg-white p-8 mt-6 rounded-3xl shadow-lg mb-8 border border-gray-200" // Added common styling
                    >
                        <FileBrowserPage />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}