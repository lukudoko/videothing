// hooks/useScraper.js
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { HiCheck, HiMinusCircle } from "react-icons/hi";


export const useScraper = () => {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapedLinks, setScrapedLinks] = useState([]);
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [message, setMessage] = useState('');
    const [isLoadingScrape, setIsLoadingScrape] = useState(false);

    const handleScrape = async () => {
        if (!scrapeUrl) {
            toast({
                title: 'URL Required',
                description: result.message || "Please enter a URL to scrape!",
                type: 'warning', // This will apply green styling
                icon: HiMinusCircle, // A simple emoji icon
            });


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
                toast({
                    title: 'Scrape Successful!',
                    description: data.message || `Found ${videosWithFilenames.length} episodes.`,
                    type: 'success',
                    icon: HiCheck,
                });


            } else {
                toast({
                    title: 'Scrape Error',
                    description: `Error scraping: ${data.detail || 'Unknown error'}`,
                    type: 'warning', // This will apply green styling
                    icon: HiMinusCircle, // A simple emoji icon
                });

            }
        } catch (error) {

            toast({
                title: 'Network Error',
                description: `Could not connect to backend: ${error.message}`,
                type: 'warning', // This will apply green styling
                icon: HiMinusCircle, // A simple emoji icon
            });


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