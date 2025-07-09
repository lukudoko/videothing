// components/LinkSelectionSection.js
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Checkbox } from "@heroui/react";

function LinkSelectionSection({ scrapedLinks, sectionVariants, selectedUrls, handleSelectToggle, handleSelectAll, handleDeselectAll }) {
    if (scrapedLinks.length === 0) {
        return null; // Don't render if no links are scraped
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sectionVariants}
            className="overflow-hidden"
        >
            <p className="mt-5 mb-3 text-base sm:text-lg font-bold text-gray-700">
                {scrapedLinks.length} Episodes Found!
            </p>
            <div className="max-h-56 sm:max-h-64 overflow-y-auto border-2 border-gray-100 rounded-2xl">
                <AnimatePresence>
                    {scrapedLinks.map((video, index) => (
                        <Checkbox
                            key={video.url}
                            isSelected={selectedUrls.includes(video.url)}
                            onValueChange={() => handleSelectToggle(video.url)}
                            size="md"
                            radius="md"
                            classNames={{
                                base: "inline-flex max-w-full p-4 sm:p-6 overflow-hidden bg-content1 m-0 hover:bg-indigo-100 transition-colors duration-200",
                                wrapper: "mr-2 sm:mr-3 data-[selected=true]:before:bg-indigo-400 data-[selected=true]:after:text-white data-[hover=true]:before:bg-indigo-200",
                                icon: "text-white",
                                label: "flex-grow min-w-0"
                            }}
                        >
                            <div className="flex flex-col flex-grow min-w-0 w-full">
                                <span className="text-sm sm:text-base text-gray-800 font-bold break-words pr-2 leading-tight">
                                    {video.filename}
                                </span>
                                <span className="text-xs sm:text-tiny text-gray-500 truncate block max-w-full overflow-hidden whitespace-nowrap text-ellipsis mt-1">
                                    {video.url}
                                </span>
                            </div>
                        </Checkbox>
                    ))}
                </AnimatePresence>
            </div>
            <div className='flex flex-col sm:flex-row mt-6 sm:mt-8 gap-3 sm:gap-0 sm:items-center sm:justify-between'>
                <div className="text-sm text-gray-600 order-2 sm:order-1 text-center sm:text-left">
                    {selectedUrls.length} of {scrapedLinks.length} videos selected
                </div>
                <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
                    <Button
                        onPress={handleSelectAll}
                        variant="bordered"
                        size="sm"
                        color="primary"
                        className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400 flex-1 sm:flex-none"
                    >
                        Select All
                    </Button>
                    <Button
                        onPress={handleDeselectAll}
                        variant="bordered"
                        size="sm"
                        className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400 flex-1 sm:flex-none"
                    >
                        Deselect All
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

export default LinkSelectionSection;