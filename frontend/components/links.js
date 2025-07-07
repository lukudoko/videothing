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
            <p className="mt-5 mb-3 text-lg font-bold text-gray-700">
                {scrapedLinks.length} Episodes Found!
            </p>

            <div className="max-h-56 overflow-y-auto border-2 border-gray-100 rounded-2xl">
                <AnimatePresence>
                    {scrapedLinks.map((video, index) => (

                        <Checkbox
                            key={video.url}
                            isSelected={selectedUrls.includes(video.url)}
                            onValueChange={() => handleSelectToggle(video.url)}
                            size="md"
                            radius="md"
                            classNames={{
                                base: "inline-flex max-w-full p-6 overflow-hidden bg-content1 m-0 hover:bg-indigo-100 transition-colors duration-200",
                                wrapper: "mr-3 data-[selected=true]:before:bg-indigo-400 data-[selected=true]:after:text-white data-[hover=true]:before:bg-indigo-200",
                                icon: "text-white",
                                label: "flex-grow min-w-0"
                            }}
                        >
                            <div className="flex flex-col flex-grow min-w-0 w-full">
                                <span className="text-gray-800 font-bold break-words pr-2">
                                    {video.filename}
                                </span>
                                <span className="text-tiny text-gray-500 truncate block max-w-full overflow-hidden whitespace-nowrap text-ellipsis">
                                    {video.url}
                                </span>
                            </div>
                        </Checkbox>
                    ))}
                </AnimatePresence>
            </div>
            <div className='flex mt-8 items-center justify-between'>
                <div className="text-sm text-gray-600">
                    {selectedUrls.length} of {scrapedLinks.length} videos selected
                </div>
                <div className="flex gap-3">
                    <Button
                        onPress={handleSelectAll}
                        variant="bordered"
                        size="sm"
                        color="primary"
                        className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
                    >
                        Select All
                    </Button>
                    <Button
                        onPress={handleDeselectAll}
                        variant="bordered"
                        size="sm"
                        className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
                    >
                        Deselect All
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

export default LinkSelectionSection;