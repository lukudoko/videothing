// components/ui/custom-toast.jsx
'use client'; // This directive is important for Next.js Client Components

import React from 'react';
import { toast as sonnerToast } from 'sonner';

/**
 * Your custom Toast React component.
 * This is where you apply all your Tailwind CSS styling.
 *
 * @param {object} props
 * @param {string | number} [props.id] - The ID provided by Sonner for dismissal.
 * @param {string} props.message - The main message for the toast.
 * @param {object} [props.actionButton] - Optional action button details.
 * @param {string} props.actionButton.label - Label for the action button.
 * @param {function} props.actionButton.onClick - Click handler for the action button.
 */
function CustomToast({ id, message, actionButton }) {
  return (
    // This div is the main container for your custom toast.
    // Apply your desired styling here.
    <div className="flex items-center justify-between rounded-lg bg-indigo-400 text-white shadow-lg p-4 w-full md:max-w-[364px]">
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {actionButton && (
        <div className="ml-4 flex-shrink-0">
          <button
            className="rounded-md bg-indigo-500 hover:bg-indigo-600 px-3 py-1 text-sm font-semibold text-white focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
            onClick={() => {
              actionButton.onClick();
              if (id) {
                sonnerToast.dismiss(id); // Dismiss the toast when the action button is clicked
              }
            }}
          >
            {actionButton.label}
          </button>
        </div>
      )}
      {/* Optional: Add a close button if desired */}
      {/* <button
        className="ml-2 p-1 rounded-full text-white/70 hover:text-white"
        onClick={() => { if (id) sonnerToast.dismiss(id); }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button> */}
    </div>
  );
}

/**
 * Abstracted toast function for easier use.
 * This function will call Sonner's custom toast method with your component.
 *
 * @param {object} toastProps - Properties for your custom toast.
 * @param {string} toastProps.message - The main message.
 * @param {object} [toastProps.actionButton] - Optional action button details.
 * @param {string} toastProps.actionButton.label - Label for the action button.
 * @param {function} toastProps.actionButton.onClick - Click handler.
 */
export function showCustomToast(toastProps) {
  return sonnerToast.custom((id) => (
    <CustomToast
      id={id} // Sonner provides the ID, pass it to your component if needed for dismissal
      message={toastProps.message}
      actionButton={toastProps.actionButton}
      // Pass any other props you define in CustomToast
    />
  ));
}

// Optional: Export the component itself if you ever need to render it directly
// export { CustomToast };