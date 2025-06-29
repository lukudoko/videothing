// pages/index.js
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// HeroUI Tabs - Correct import
import { Tabs, Tab } from '@heroui/react';

// Sonner Toast
import { toast } from "sonner";

// Imported Modular Components
import ScrapingSection from '@/components/scraper';
import LinkSelectionSection from '@/components/links';
import DownloadQueueSection from '@/components/downloads';
import ProgressList from '@/components/progresslist';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const AVAILABLE_SUBDIRS = [ // This can eventually be fetched from backend or config
    "TV Shows",
    "Movies"
];

// Framer Motion Variants (can be moved to a central config if used across many components)
const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function Home() {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapedLinks, setScrapedLinks] = useState([]);
    const [downloadPath, setDownloadPath] = useState(AVAILABLE_SUBDIRS[0] || '');
    const [subfolderName, setSubfolderName] = useState('');
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [message, setMessage] = useState(''); // For scrape success/error message
    const [downloadProgress, setDownloadProgress] = useState({});
    const [isLoadingScrape, setIsLoadingScrape] = useState(false);
    const [isLoadingDownload, setIsLoadingDownload] = useState(false);
    const [allDownloadsCompleted, setAllDownloadsCompleted] = useState(false);

    const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'progress'

    const clearedProgressUrls = useRef(new Set());
    const initialDownloadsQueued = useRef(0);

    // --- Handlers (remain in parent as they manage shared state) ---

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
            const response = await fetch(`${API_BASE_URL}/scrape`, {
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
                const response = await fetch(`${API_BASE_URL}/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: videoDetail.url, path: fullDownloadPath }),
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
        setActiveTab('progress');
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
                const response = await fetch(`${API_BASE_URL}/progress`);
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

                    if (initialDownloadsQueued.current > 0 && completedCount === initialDownloadsQueued.current && !allDownloadsCompleted) {
                        toast.success("All downloads/conversions are complete!", { title: "Tasks Finished" });
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
    }, [allDownloadsCompleted]);

   const renderTabContent = () => {
    // Condition to render content based on activeTab
    if (activeTab === 'queue') {
        return (
            <motion.div
                key="queue-tab-content"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={sectionVariants} // Ensure sectionVariants is defined in this scope
            >
                <div className="bg-white p-8 mt-6 rounded-3xl shadow-lg mb-8 border border-gray-200">
                    <ScrapingSection
                        scrapeUrl={scrapeUrl}
                        setScrapeUrl={setScrapeUrl}
                        handleScrape={handleScrape}
                        isLoadingScrape={isLoadingScrape}
                        message={message}
                    />

                    {/* --- Apply conditional rendering here --- */}
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
                            />
                        </>
                    )}
                    {/* --- End conditional rendering --- */}
                </div>
            </motion.div>
        );
    } else if (activeTab === 'progress') {
        return (
            <ProgressList
                downloadProgress={downloadProgress}
                handleClearProgress={handleClearProgress}
            />
        );
    } else if (activeTab === 'whisper') {
        return (
            <motion.div
                key="whisper-tab-content"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={sectionVariants}
                className="bg-white p-8 rounded-xl shadow-lg mb-8 border border-gray-200 text-center text-gray-600 py-10"
            >
                Coming soon!
            </motion.div>
        );
    }
    // Fallback in case activeTab is neither, though with the Tabs component this shouldn't happen
    return null;
};

    return (
        <div className="pt-24 p-10 max-w-4xl mx-auto font-sans text-gray-800">
            <p className="text-5xl font-extrabold text-left mb-10">
                Japanese Show Downloader
            </p>


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
                <Tab key="queue" title="Queue Videos">
                    <AnimatePresence mode="wait">
                        {renderTabContent()}
                    </AnimatePresence>
                </Tab>
                <Tab key="progress" title="Progress">
                    <AnimatePresence mode="wait">
                        {renderTabContent()}
                    </AnimatePresence>
                </Tab>
                <Tab key="whisper" title="Whisper Subs">
                    <AnimatePresence mode="wait">
                        Coming soon!
                    </AnimatePresence>
                </Tab>
            </Tabs>
        </div>
    );
}