// lib/toast.js
'use client';

import { toast as sonnerToast } from 'sonner';
import ToastComponent from '@/components/toast'; // Adjust path as needed

/**
 * @typedef {Object} CustomToastProps
 * @property {string} title - The title of the toast.
 * @property {string} description - The description text of the toast.
 * @property {'success'|'error'|'warning'|'info'|'default'} [type='default'] - The type of toast to style its appearance.
 * @property {string|React.ComponentType<any>} [icon] - An icon (emoji string or React component) to display.
 *
 * @param {CustomToastProps} props - The props for your custom toast.
 */
export function toast(props) {
  return sonnerToast.custom((id) => (
    <ToastComponent
      id={id} // Sonner provides the ID automatically
      title={props.title}
      description={props.description}
      type={props.type} // Pass the new type prop
      icon={props.icon} // Pass the new icon prop
      // 'button' prop is no longer passed
    />
  ));
}