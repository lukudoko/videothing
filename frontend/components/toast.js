// components/ToastComponent.js
'use client';

import React from 'react';
import { toast as sonnerToast } from 'sonner'; // Still needed for toast.dismiss(id) if you dismiss programmatically

/**
 * A fully custom toast component that still maintains Sonner's animations and interactions.
 * @param {Object} props - The props for the Toast component.
 * @param {string|number} props.id - The unique ID of the toast, provided by Sonner (for dismiss).
 * @param {string} props.title - The title of the toast.
 * @param {string} props.description - The description text of the toast.
 * @param {'success'|'error'|'warning'|'info'|'default'} [props.type='default'] - The type of toast to style its appearance.
 * @param {string|React.ComponentType<any>} [props.icon] - An icon (emoji string or React component) to display.
 */
function ToastComponent(props) {
  // Destructure props. Note: 'button' is removed.
  const { title, description, id, type = 'default', icon: IconComponent } = props;

  // Define Tailwind classes based on the toast type
  const typeClasses = {
    success: {
      accent: 'border-l-4 border-teal-400',
      title: 'text-teal-800',
      description: 'text-teal-700',
      iconColor: 'text-teal-400',
    },
    error: {
      accent: 'border-l-4 border-red-500',
      title: 'text-red-800 dark:text-red-300',
      description: 'text-red-600 dark:text-red-400',
      iconColor: 'text-red-500',
    },
    warning: {
      accent: 'border-l-4 border-yellow-500',
      title: 'text-yellow-800 dark:text-yellow-300',
      description: 'text-yellow-600 dark:text-yellow-400',
      iconColor: 'text-yellow-500',
    },
    info: {
      accent: 'border-l-4 border-blue-500',
      title: 'text-blue-800 dark:text-blue-300',
      description: 'text-blue-600 dark:text-blue-400',
      iconColor: 'text-blue-500',
    },
    default: { // Used for 'action' or general toasts
      accent: 'border-l-4 border-indigo-400',
      title: 'text-indigo-800',
      description: 'text-indigo-500',
      iconColor: 'text-indigo-400 dark:text-gray-400',
    },
  };

  const currentTypeClasses = typeClasses[type] || typeClasses.default;

  return (
    <div className={`flex rounded-2xl bg-white  shadow-lg ring-1 ring-black/5 dark:ring-white/5 w-full min-w-sm md:max-w-[364px] items-center p-4 ${currentTypeClasses.accent}`}>
      {IconComponent && ( // Conditionally render icon if provided
        <div className={`mr-3 flex-shrink-0 ${currentTypeClasses.iconColor}`}>
          {typeof IconComponent === 'string' ? (
            // If icon is a string (e.g., emoji)
            <span className="text-xl leading-none">{IconComponent}</span>
          ) : (
            // If icon is a React component (e.g., Heroicon)
            <IconComponent className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
      )}
      {/* This div now takes all available space for title and description */}
      <div className="flex-1">
        <p className={`text-base font-medium ${currentTypeClasses.title}`}>{title}</p>
        <p className={`mt-1 text-sm ${currentTypeClasses.description}`}>{description}</p>
      </div>
      {/* The button section is removed entirely */}
    </div>
  );
}

export default ToastComponent;