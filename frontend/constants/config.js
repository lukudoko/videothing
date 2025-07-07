export const AVAILABLE_SUBDIRS = [
    "TV Shows",
    "Movies"
];

export const sectionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } }
};


export const FILENAME_RULES = {
  maxLength: 255,
  forbiddenChars: /[\\/:"*?<>|]/g,
  forbiddenNames: ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
};