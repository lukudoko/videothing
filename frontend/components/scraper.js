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
            <p className="text-3xl font-bold text-gray-800 mb-4 pb-3">
                Scrape Episodes
            </p>

            {/* Wrap the input and button in a form */}
            <form onSubmit={handleSubmit} className="flex gap-4 mb-5 items-center">
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
                        input: "text-lg",
                        inputWrapper: "border-gray-300 data-[hover=true]:border-blue-400 data-[focus=true]:border-blue-500"
                    }}
                    className="flex-grow"
                />
                <Button
                    type="submit" // Set type to "submit" for the button
                    // onPress={handleScrape} // No longer directly calling handleScrape here
                    isDisabled={isLoadingScrape || !scrapeUrl}
                    isLoading={isLoadingScrape}
                    color="primary"
                    variant="bordered"
                    size="lg"
                    radius="xl"
                    className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400 min-w-[120px]"
                >
                    {isLoadingScrape ? 'Scraping...' : 'Scrape!'}
                </Button>
            </form>

            {message && (
                <div
                    className={`p-4 rounded-lg border-l-4 mb-5 ${message.includes('Error')
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                        }`}
                    role="alert"
                >
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            {message.includes('Error') ? (
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium">
                                {message.includes('Error') ? 'Error!' : 'Success!'}
                            </p>
                            <p className="text-sm mt-1">{message}</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ScrapingSection;