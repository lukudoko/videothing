import React from 'react';
import { Input, Button } from "@heroui/react";


function ScrapingSection({ scrapeUrl, setScrapeUrl, handleScrape, isLoadingScrape, message }) {

    // New handler for form submission
    const handleSubmit = (event) => {
        event.preventDefault(); // Prevent default browser form submission (page reload)
        handleScrape(); // Call your existing scrape handler
    };

return (
    <>
        <p className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 pb-3">
            Scrape Episodes
        </p>
        {/* Wrap the input and button in a form */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-5 sm:items-center">
            <Input
                type="url"
                placeholder="Enter URL to scrape"
                value={scrapeUrl}
                onValueChange={setScrapeUrl}
                variant="bordered"
                size="lg"
                radius="md"
                isDisabled={isLoadingScrape}
                classNames={{
                    input: "text-base sm:text-lg",
                    inputWrapper: "border-gray-300 data-[hover=true]:border-blue-400 data-[focus=true]:border-blue-500"
                }}
                className="flex-grow"
            />
            <Button
                type="submit"
                isDisabled={isLoadingScrape || !scrapeUrl}
                isLoading={isLoadingScrape}
                color="primary"
                variant="bordered"
                size="lg"
                radius="xl"
                className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400 w-full sm:w-auto sm:min-w-[120px]"
            >
                {isLoadingScrape ? 'Scraping...' : 'Scrape!'}
            </Button>
        </form>
    </>
);
}

export default ScrapingSection;