'use client';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {  FILENAME_RULES } from '@/constants/config';

import { toast } from "sonner";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Tooltip,
  Breadcrumbs,
  BreadcrumbItem,
  Progress,
  Popover, PopoverTrigger, PopoverContent,
} from "@heroui/react";
import {
  HiFolder,
  HiDocument,
  HiFolderAdd,
  HiPencil,
  HiTrash,
  HiHome,
  HiArrowUp,
  HiRefresh,
  HiSortAscending,
  HiSortDescending,
  HiSearch, HiChatAlt
} from "react-icons/hi";



const sanitizeFilename = (name, isRename = false) => {
  if (!name || typeof name !== 'string') return '';

  let sanitized = name.trim();
  sanitized = sanitized.replace(FILENAME_RULES.forbiddenChars, '');
  sanitized = sanitized.replace(/\s+/g, ' ');
  if (sanitized.length > FILENAME_RULES.maxLength) {
    sanitized = sanitized.substring(0, FILENAME_RULES.maxLength);
  }
  const upperName = sanitized.toUpperCase();
  if (FILENAME_RULES.forbiddenNames.includes(upperName)) {
    sanitized = `${sanitized}_file`;
  }

  return sanitized;
};

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};




const getFileIcon = (filename, isDirectory) => {
  if (isDirectory) return <HiFolder className="w-5 h-5 text-warning" />;

  const ext = filename.split('.').pop()?.toLowerCase();
  const iconClass = "w-5 h-5";

  // You could expand this with more specific icons
  switch (ext) {
    case 'mp4':
      return <HiDocument className={`${iconClass} text-red-500`} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <HiDocument className={`${iconClass} text-green-500`} />;
    case 'txt':
    case 'md':
      return <HiDocument className={`${iconClass} text-blue-500`} />;
    default:
      return <HiDocument className={`${iconClass} text-default-400`} />;
  }
};


const useFeedback = () => {
  const [feedback, setFeedback] = useState(null);

  const showFeedback = useCallback((type, message) => {

    toast(message, {
      className: "bg-indigo-400 rounded-3xl"
    });
   
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return { feedback, showFeedback, clearFeedback };
};

const useApi = () => {
  const [loading, setLoading] = useState(false);

  const apiCall = useCallback(async (url, options = {}) => {
    setLoading(true);
    try {
      const response = await fetch(`${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  return { apiCall, loading };
};

export default function FileBrowserPage({ handleTranscription }) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToRename, setItemToRename] = useState(null);
  const [itemToSub, setItemToSub] = useState(null);
  const [newRenameName, setNewRenameName] = useState('');
  const [originalFileExtension, setOriginalFileExtension] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const { feedback, showFeedback, clearFeedback } = useFeedback();
  const { apiCall, loading } = useApi();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isNewFOpen, onOpen: onNewFOpen, onClose: onNewFClose } = useDisclosure();
  const { isOpen: isWhisperOpen, onOpen: onWhisperOpen, onClose: onWhisperClose } = useDisclosure();
  const { isOpen: isRenameOpen, onOpen: onRenameOpen, onClose: onRenameClose } = useDisclosure();


  const fetchItems = useCallback(async (path) => {
    setError(null);
    clearFeedback();

    try {
      const data = await apiCall(`/api/filesystems/list?current_path=${encodeURIComponent(path)}`);
      const filteredData = data.filter(item => !item.name.startsWith('.'));
      setItems(filteredData);
    } catch (err) {
      setError(err.message);
      showFeedback('error', `Failed to load directory: ${err.message}`);
    }
  }, [apiCall, showFeedback, clearFeedback]);


  const processedItems = useMemo(() => {
    let filtered = items;

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = items.filter(item =>
        item.name.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      // Always put directories first
      if (a.is_directory !== b.is_directory) {
        return a.is_directory ? -1 : 1;
      }

      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle different data types
      if (sortField === 'name') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      } else if (sortField === 'size') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, searchTerm, sortField, sortDirection]);

  // Effects
  useEffect(() => {
    fetchItems(currentPath);
  }, [currentPath, fetchItems]);

  useEffect(() => {
    setFilteredItems(processedItems);
  }, [processedItems]);

  // Navigation helpers
  const getBreadcrumbItems = useCallback(() => {
    if (!currentPath) return [{ name: 'Root', path: '' }];

    const segments = currentPath.split('/');
    const items = [{ name: 'Root', path: '' }];

    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      items.push({ name: segment, path });
    });

    return items;
  }, [currentPath]);

  // Event handlers
  const handleItemClick = useCallback((item) => {
    if (item.is_directory) {
      setCurrentPath(item.path);
      setSearchTerm(''); // Clear search when navigating
    } else {
      // You could implement file preview/download here
      showFeedback('info', `File: ${item.name} (${formatBytes(item.size)})`);
    }
  }, [showFeedback]);

  const handleGoUp = useCallback(() => {
    if (currentPath === '') return;

    const pathSegments = currentPath.split('/');
    const parentPath = pathSegments.slice(0, -1).join('/');
    setCurrentPath(parentPath);
    setSearchTerm('');
  }, [currentPath]);

  const handleNewF = useCallback(() => {
    onNewFOpen();
  }, [onNewFOpen]
  );





  const handleBreadcrumbClick = useCallback((index) => {
    if (index === 0) {
      setCurrentPath('');
    } else {
      const pathSegments = currentPath.split('/');
      const newPath = pathSegments.slice(0, index).join('/');
      setCurrentPath(newPath);
    }
    setSearchTerm('');
  }, [currentPath]);

  const handleSort = useCallback((field) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);



      const handleWhisper = useCallback(async () => {
        await handleTranscription(itemToSub.path, itemToSub.name); 
        onWhisperClose();
    }, [onWhisperClose, currentPath, itemToSub, handleTranscription]);
  

  const handleWhisperClick = useCallback((item) => {
    setItemToSub(item);
    onWhisperOpen();
  }, [onWhisperOpen]);





  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      showFeedback('error', 'Folder name cannot be empty.');
      return;
    }

    const sanitizedName = sanitizeFilename(trimmedName);
    if (!sanitizedName) {
      showFeedback('error', 'Invalid folder name. Please use valid characters.');
      return;
    }

    const newFolderPath = currentPath ? `${currentPath}/${sanitizedName}` : sanitizedName;

    try {
      await apiCall('/api/filesystems/create-folder', {
        method: 'POST',
        body: JSON.stringify({ new_folder_path: newFolderPath })
      });

      showFeedback('success', `Folder '${sanitizedName}' created successfully!`);
      setNewFolderName('');
      fetchItems(currentPath);
    } catch (err) {
      showFeedback('error', `Failed to create folder: ${err.message}`);
    }
    onNewFClose();
  }, [newFolderName, currentPath, apiCall, onNewFClose, showFeedback, fetchItems]);




  const handleDeleteClick = useCallback((item) => {
    setItemToDelete(item);
    onDeleteOpen();
  }, [onDeleteOpen]);




  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;

    onDeleteClose();

    try {
      await apiCall('/api/filesystems/delete', {
        method: 'DELETE',
        body: JSON.stringify({ item_path: itemToDelete.path })
      });

      showFeedback('success', `'${itemToDelete.name}' deleted successfully!`);
      setItemToDelete(null);
      fetchItems(currentPath);
    } catch (err) {
      showFeedback('error', `Failed to delete '${itemToDelete.name}': ${err.message}`);
    }
  }, [itemToDelete, apiCall, showFeedback, fetchItems, currentPath, onDeleteClose]);

  const handleRenameClick = useCallback((item) => {
    setItemToRename(item);

    let nameWithoutExtension = item.name;
    let extension = '';

    if (!item.is_directory) {
      const lastDotIndex = item.name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        nameWithoutExtension = item.name.substring(0, lastDotIndex);
        extension = item.name.substring(lastDotIndex);
      }
    }

    setNewRenameName(nameWithoutExtension);
    setOriginalFileExtension(extension);
    onRenameOpen();
  }, [onRenameOpen]);

  const confirmRename = useCallback(async () => {
    const trimmedName = newRenameName.trim();
    if (!itemToRename || !trimmedName) {
      showFeedback('error', 'New name cannot be empty.');
      return;
    }

    const sanitizedName = sanitizeFilename(trimmedName, true);
    if (!sanitizedName) {
      showFeedback('error', 'Invalid name. Please use valid characters.');
      return;
    }

    const finalNewName = itemToRename.is_directory ? sanitizedName : sanitizedName + originalFileExtension;
    const oldPathSegments = itemToRename.path.split('/');
    oldPathSegments[oldPathSegments.length - 1] = finalNewName;
    const newPath = oldPathSegments.join('/');

    onRenameClose();

    try {
      await apiCall('/api/filesystems/move', {
        method: 'POST',
        body: JSON.stringify({
          source_path: itemToRename.path,
          destination_path: newPath
        })
      });

      showFeedback('success', `'${itemToRename.name}' renamed to '${finalNewName}' successfully!`);
      setItemToRename(null);
      setNewRenameName('');
      setOriginalFileExtension('');
      fetchItems(currentPath);
    } catch (err) {
      showFeedback('error', `Failed to rename '${itemToRename.name}': ${err.message}`);
    }
  }, [itemToRename, newRenameName, originalFileExtension, apiCall, showFeedback, fetchItems, currentPath, onRenameClose]);

  // Table configuration
  const columns = [
    { name: "NAME", uid: "name", sortable: true },
    { name: "SIZE", uid: "size", sortable: true },
    { name: "ACTIONS", uid: "actions", sortable: false },
  ];




  const renderCell = useCallback((item, columnKey) => {
    switch (columnKey) {
      case "name":
        return (
          <div
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => handleItemClick(item)}
          >
            {getFileIcon(item.name, item.is_directory)}
            <span className={item.is_directory ? 'text-primary font-medium' : ''}>
              {item.name}
            </span>
          </div>
        );
      case "size":
        return (
          <span className="text-small text-default-400">
            {!item.is_directory ? formatBytes(item.size) : '—'}
          </span>
        );
      case "actions":
        return (
          <div className="flex items-center gap-1">

            {item.name.split('.').pop()?.toLowerCase() === "mp4" && (
              <Tooltip content="Generate Subs">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => handleWhisperClick(item)}
                  isDisabled={loading}
                >
                  <HiChatAlt className="w-4 text-indigo-400 h-4" />

                </Button>
              </Tooltip>
            )}
            <Tooltip content="Rename">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="warning"
                onPress={() => handleRenameClick(item)}
                isDisabled={loading}
              >
                <HiPencil className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onPress={() => handleDeleteClick(item)}
                isDisabled={loading}
              >
                <HiTrash className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        );
      default:
        return null;
    }
  }, [loading, handleItemClick, handleRenameClick, handleWhisperClick, handleDeleteClick]);

  return (
    <>
      <div className='flex justify-between'>
        <p className="text-3xl font-bold text-gray-800 mb-4 pb-3">
          Files
        </p>
        <Button
          isIconOnly
          variant="light"
          onPress={() => fetchItems(currentPath)}
          isDisabled={loading}
        >
          <HiRefresh className="w-5 h-5" />
        </Button>
      </div>


      {feedback && (
        <Chip
          color={feedback.type === 'success' ? 'success' : feedback.type === 'error' ? 'danger' : 'primary'}
          variant="flat"
          size="lg"
          className="self-center"
          onClose={clearFeedback}
        >
          {feedback.message}
        </Chip>
      )}

      <div className="flex justify-between mb-6">
        <div className="gap-2 items-center flex-row flex">
          {/* Outer container to control the space */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: currentPath !== "" ? 40 : 0 }} // Animate outer div's width
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          // Optional: If you want a slight delay before the space collapses
          // exit={{ width: 0, transition: { delay: 0.1 } }}
          >
            <AnimatePresence>
              {currentPath !== "" && (
                <motion.div
                  key="go-up"
                  initial={{ opacity: 0 }} // Only animate opacity for the inner button
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                  <Button
                    isIconOnly
                    color="primary"
                    variant="bordered"
                    radius="lg"
                    onPress={handleGoUp}
                    isDisabled={loading}
                    className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
                    aria-label="Go up one level"
                    style={{ width: '40px', height: '40px' }} // Explicitly set button size to prevent reflow
                  >
                    <HiArrowUp className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <Breadcrumbs
            itemsAfterCollapse={2}
            itemsBeforeCollapse={1}
            maxItems={3}
            size="lg"
            underline="hover"
            variant="bordered"
            radius="lg"
            classNames={{
              list: "flex-grow border-indigo-400",
            }}
            itemClasses={{
              item: "text-indigo-700/60 data-[current=true]:text-indigo-700",
              separator: "text-indigo-700/40",
            }}
          >
            {getBreadcrumbItems().map((item, index) => (
              <BreadcrumbItem
                key={index}
                onPress={() => handleBreadcrumbClick(index)}
                className="cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  {index === 0 && <HiHome className="w-4 h-4" />}
                  {item.name}
                </span>
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
        </div>
        <div className='gap-2 items-center  flex-row flex'>

          <Popover offset={10}
            shouldCloseOnScroll={false}
            classNames={{
              content: [
                "py-3 px-4",
                "bg-white border-1 rounded-3xl",
              ],
            }}

            placement="bottom-end">
            <PopoverTrigger>

              <Button
                isIconOnly
                color="primary"
                variant="bordered"
                radius='lg'
                isDisabled={loading}
                className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
                aria-label="Search for files"
              >
                <HiSearch className="w-4 h-4" />

              </Button>
            </PopoverTrigger>
            <PopoverContent>

              <Input
                placeholder="Search files..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                startContent={<HiSearch className="w-4 h-4" />}
                className="items-center "
                isClearable
                onClear={() => setSearchTerm('')}
              />
            </PopoverContent>
          </Popover>


          <Button
            isIconOnly
            color="primary"
            variant="bordered"
            radius='lg'
            onPress={handleNewF}
            isDisabled={loading}
            className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
            aria-label="Go up one level"
          >
            <HiFolderAdd className="w-4 h-4" />
          </Button>
        </div>
      </div>



      <div>
        {loading && (
          <Progress
            size="sm"
            isIndeterminate
            className="mb-4"
            aria-label="Loading..."
            classNames={{
              indicator: "bg-indigo-400",
            }}
          />
        )}

        {error ? (

          <div className="text-center py-8">
            <p className='text-lg py-4 font-bold text-red-400'>Error: {error}</p>
            <Button
              className="border-indigo-400 text-indigo-700 hover:text-white hover:bg-indigo-400"
              variant="bordered"
              startContent={<HiRefresh className="w-3 h-3" />}
              size='sm'
              onPress={() => fetchItems(currentPath)}
            >
              Retry
            </Button>
          </div>

        ) : filteredItems.length === 0 && !loading ? (

          <div className="text-center py-8 text-default-400">
            {searchTerm ? `No items match "${searchTerm}"` : "This directory is empty."}
          </div>

        ) : (
          <Table
            aria-label="File browser table"
            removeWrapper
            selectionMode="single"
            classNames={{
              wrapper: "min-h-[400px]",

            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  align={column.uid === "actions" ? "center" : "start"}
                  className={
                    column.uid === "name" ? "w-9/12" :
                      column.uid === "size" ? "w-2/12" :
                        "w-1/12"
                  }
                >
                  <div
                    className={`flex items-center gap-1 ${column.sortable ? 'cursor-pointer hover:text-primary' : ''}`}
                    onClick={column.sortable ? () => handleSort(column.uid) : undefined}
                  >
                    {column.name}
                    {column.sortable && sortField === column.uid && (
                      sortDirection === 'asc' ?
                        <HiSortAscending className="w-4 h-4" /> :
                        <HiSortDescending className="w-4 h-4" />
                    )}
                  </div>
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={filteredItems}>
              {(item) => (
                <TableRow key={item.path}>
                  {(columnKey) => (
                    <TableCell>
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                      >
                        {renderCell(item, columnKey)}
                      </motion.div>
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}



        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Confirm Deletion</ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to delete <strong className="text-primary">{itemToDelete?.name}</strong>?
                  </p>
                  {itemToDelete?.is_directory && (
                    <Chip color="danger" variant="flat">
                      This will delete the folder and all its contents!
                    </Chip>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button color="default" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button color="danger" onPress={confirmDelete}>
                    Delete
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>


        {/* New Folder Modal */}
        <Modal isOpen={isNewFOpen} onClose={onNewFClose}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create a Folder</ModalHeader>
                <ModalBody>
                  <Input
                    placeholder="New folder name"
                    value={newFolderName}
                    onValueChange={setNewFolderName}
                    isDisabled={loading}
                    className="flex-grow"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />


                </ModalBody>
                <ModalFooter>

                  <Button color="default" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    startContent={<HiFolderAdd className="w-4 h-4" />}
                    onPress={handleCreateFolder}
                    isDisabled={loading || !newFolderName.trim()}
                  >
                    Create
                  </Button>
                </ModalFooter>

              </>
            )}
          </ModalContent>
        </Modal>



        {/* Whisper Subs Modal */}
        <Modal isOpen={isWhisperOpen} onClose={onWhisperClose}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Generate Subs</ModalHeader>
                <ModalBody>
                  <p>
                    Do you want to generate subtitles for <strong>{itemToSub?.name}</strong> with Whisper?
                  </p>

                </ModalBody>
                <ModalFooter>

                  <Button color="default" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    startContent={<HiChatAlt className="w-4 h-4" />}
                    onPress={handleWhisper}
                    isDisabled={loading || !itemToSub?.name}
                  >
                    Sub
                  </Button>
                </ModalFooter>

              </>
            )}
          </ModalContent>
        </Modal>


        {/* Rename Modal */}
        <Modal isOpen={isRenameOpen} onClose={onRenameClose}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Rename Item</ModalHeader>
                <ModalBody>
                  <p className="mb-4">
                    Renaming: <strong className="text-primary">{itemToRename?.name}</strong>
                  </p>
                  <Input
                    label="New name"
                    placeholder="Enter new name"
                    value={newRenameName}
                    onValueChange={setNewRenameName}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                  />
                  {originalFileExtension && (
                    <p className="text-small text-default-400 mt-2">
                      Extension <code className="bg-default-100 px-1 py-0.5 rounded">{originalFileExtension}</code> will be preserved
                    </p>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button
                    color="default"
                    variant="light"
                    onPress={() => {
                      onClose();
                      setNewRenameName('');
                      setOriginalFileExtension('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    onPress={confirmRename}
                    isDisabled={!newRenameName.trim()}
                  >
                    Rename
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </>
  );
}