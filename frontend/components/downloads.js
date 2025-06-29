import React from 'react';
import { Input, Button, Select, SelectItem } from "@heroui/react";

const AVAILABLE_SUBDIRS = [
    "TV Shows",
    "Movies"
];

function DownloadQueueSection({ selectedUrls, downloadPath, setDownloadPath, subfolderName, setSubfolderName, handleBatchDownload, isLoadingDownload }) {
    return (
        <div className="mt-8 pt-6 border-t-2 border-gray-100">
            <p className="text-2xl font-bold text-gray-800  pb-2">
                Downloads
            </p>

            <p className="mb-4 text-gray-700 pb-4">
                <strong className="text-indigo-400">{selectedUrls.length} videos</strong> selected for download
            </p>

            <div className="flex flex-row justify-center items-end gap-4 mb-5">

                <div className='w-32'>
                    <Select
                        placeholder="Select a category"
                        selectedKeys={downloadPath ? [downloadPath] : []}
                        onSelectionChange={(keys) => {
                            const selectedKey = Array.from(keys)[0];
                            setDownloadPath(selectedKey || '');
                        }}
                        isDisabled={isLoadingDownload}
                        variant="bordered"
                        size="lg"
                        label="Category"
                        isRequired='true'
                        labelPlacement='outside'
                        radius="md"
                        classNames={{
                            trigger: "border-gray-300 data-[hover=true]:border-blue-400 data-[focus=true]:border-blue-500",
                            value: "text-gray-900",
                            selectorIcon: "text-indigo-400"
                        }}
                    >
                        {AVAILABLE_SUBDIRS.map((dir) => (
                            <SelectItem key={dir} value={dir} textValue={dir}>
                                {dir}
                            </SelectItem>
                        ))}
                    </Select>
                </div>


                <div className='w-64'>
                    <Input
                        type="text"
                        placeholder="e.g., Gaki no Tsukai"
                        value={subfolderName}
                        onValueChange={setSubfolderName}
                        variant="bordered"
                        size="lg"
                        label="Subfolder (optional)"
                        labelPlacement='outside'
                        radius="md"
                        isDisabled={isLoadingDownload}
                        classNames={{
                            input: "text-base",
                            inputWrapper: "border-gray-300 data-[hover=true]:border-blue-400 data-[focus=true]:border-blue-500"
                        }}
                    />
                </div>
                <Button
                    onPress={handleBatchDownload}
                    isDisabled={selectedUrls.length === 0 || !downloadPath || isLoadingDownload}
                    isLoading={isLoadingDownload}
                    color="primary"
                    variant="bordered"
                    size="lg"
                    radius="md"
                    className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
                >
                    {isLoadingDownload ? 'Queueing Downloads...' : 'Start Downloads'}
                </Button>
            </div>




            {selectedUrls.length > 0 && downloadPath && (
                <div className="mt-4 p-3 bg-indigo-50 border border-grey-200 rounded-2xl">
                    <p className="text-sm text-black">
                        <strong>Download to:</strong> {downloadPath}
                        {subfolderName && ` → ${subfolderName}`}
                    </p>
                    <p className="text-sm text-indigo-600 mt-1">
                        {selectedUrls.length} video{selectedUrls.length !== 1 ? 's' : ''} will be downloaded
                    </p>
                </div>
            )}
        </div>
    );
}

export default DownloadQueueSection;