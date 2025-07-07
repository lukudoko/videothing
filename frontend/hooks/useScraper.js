// hooks/useScraper.js
import { useState } from 'react';
import { toast } from "sonner";

export const useScraper = () => {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapedLinks, setScrapedLinks] = useState([]);
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [message, setMessage] = useState('');
    const [isLoadingScrape, setIsLoadingScrape] = useState(false);

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

    return {
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
    };
};