import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, Tab } from '@heroui/react';
import ScrapingSection from '@/components/scraper';
import LinkSelectionSection from '@/components/links';
import DownloadQueueSection from '@/components/downloads';
import ProgressList from '@/components/progresslist';
import FileBrowserPage from '@/components/files';
import { useScraper } from '@/hooks/useScraper';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { batchDownload } from '@/utils/downloadService';
import { initiateTranscription } from '@/utils/transcriptionService';
import { AVAILABLE_SUBDIRS, FILENAME_RULES, sectionVariants } from '@/constants/config';
import Head from 'next/head'


export default function Home() {
    const [activeTab, setActiveTab] = useState('queue');
    const [downloadPath, setDownloadPath] = useState(AVAILABLE_SUBDIRS[0] || '');
    const [subfolderName, setSubfolderName] = useState('');
    const [isLoadingDownload, setIsLoadingDownload] = useState(false);

    const {
        scrapeUrl,
        setScrapeUrl,
        scrapedLinks,
        selectedUrls,
        setSelectedUrls,
        message,
        isLoadingScrape,
        handleScrape,
        handleSelectToggle,
        handleSelectAll,
        handleDeselectAll
    } = useScraper();

    const {
        downloadProgress,
        setDownloadProgress,
        allDownloadsCompleted,
        setAllDownloadsCompleted,
        initialDownloadsQueued,
        handleClearProgress
    } = useDownloadManager();


    const handleBatchDownload = async () => {
        const resultTab = await batchDownload(
            selectedUrls,
            scrapedLinks,
            downloadPath,
            subfolderName,
            setDownloadProgress,
            setAllDownloadsCompleted,
            initialDownloadsQueued,
            setSelectedUrls,
            setIsLoadingDownload
        );
        if (resultTab) {
            setActiveTab(resultTab);
        }
    };


    const handleTranscription = async (filePath, fileName) => {
        const resultTab = await initiateTranscription(filePath, fileName);
        if (resultTab) {
            setActiveTab(resultTab);
        }

    };




    return (
        <div className="pt-16 md:pt-24 p-4 md:p-10 max-w-4xl mx-auto font-sans text-gray-800">
            <Head>
                <title>Japanese Show Downloader</title>
            </Head>
            <p className="text-3xl md:text-5xl font-extrabold text-center mb-6 md:mb-10 px-2">
                Japanese Show Downloader
            </p>
            <div className='flex justify-center mb-4'>
                <Tabs
                    selectedKey={activeTab}
                    onSelectionChange={setActiveTab}
                    aria-label="Downloader options"
                    size='md'
                    variant='bordered'
                    color='primary'
                    className="w-full max-w-md"
                    classNames={{
                        cursor: "bg-indigo-400",
                        tabList: "w-full",
                        tab: "flex-1 min-w-0", // Ensures tabs take equal width and handle overflow
                    }}
                >
                    <Tab key="queue" title="Queue" />
                    <Tab key="progress" title="Progress" />
                    <Tab key="files" title="Files" />
                </Tabs>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'queue' && (
                    <motion.div
                        key="queue-tab-content"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={sectionVariants}
                        className="bg-white p-4 md:p-8 mt-4 md:mt-6 rounded-2xl md:rounded-3xl shadow-lg mb-6 md:mb-8 border border-gray-200"
                    >
                        <ScrapingSection
                            scrapeUrl={scrapeUrl}
                            setScrapeUrl={setScrapeUrl}
                            handleScrape={handleScrape}
                            isLoadingScrape={isLoadingScrape}
                            message={message}
                        />

                        {scrapedLinks.length > 0 && (
                            <>
                                <LinkSelectionSection
                                    scrapedLinks={scrapedLinks}
                                    selectedUrls={selectedUrls}
                                    handleSelectToggle={handleSelectToggle}
                                    handleSelectAll={handleSelectAll}
                                    handleDeselectAll={handleDeselectAll}
                                    sectionVariants={sectionVariants}
                                />
                                <DownloadQueueSection
                                    selectedUrls={selectedUrls}
                                    downloadPath={downloadPath}
                                    setDownloadPath={setDownloadPath}
                                    subfolderName={subfolderName}
                                    setSubfolderName={setSubfolderName}
                                    handleBatchDownload={handleBatchDownload}
                                    isLoadingDownload={isLoadingDownload}
                                    availableSubdirs={AVAILABLE_SUBDIRS}
                                />
                            </>
                        )}
                    </motion.div>
                )}

                {activeTab === 'progress' && (
                    <motion.div
                        key="progress-tab-content"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={sectionVariants}
                        className="bg-white p-4 md:p-8 mt-4 md:mt-6 rounded-2xl md:rounded-3xl shadow-lg mb-6 md:mb-8 border border-gray-200"
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
                        exit="exit"
                        variants={sectionVariants}
                        className="bg-white p-4 md:p-8 mt-4 md:mt-6 rounded-2xl md:rounded-3xl shadow-lg mb-6 md:mb-8 border border-gray-200"
                    >
                        <FileBrowserPage
                            filenamerules={FILENAME_RULES}
                            handleTranscription={handleTranscription}
                            sectionVariants={sectionVariants}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}