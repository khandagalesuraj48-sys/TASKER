import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 p-2.5 rounded-xl ${
            variant === 'danger'
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              : variant === 'warning'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-primary/15 text-primary'
          }`}
        >
          {variant === 'danger' ? (
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : variant === 'warning' ? (
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Info className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

