import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  const widths = { sm: 420, md: 540, lg: 700, xl: 900 };
  const descId = `modal-desc-${title?.replace(/\s+/g, '-').toLowerCase() || 'dialog'}`;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <Dialog.Content
            className={cn('animate-fade-up', className)}
            aria-describedby={descId}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-hi)',
              borderRadius: 16,
              padding: 28,
              width: '100%',
              maxWidth: widths[size],
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto',
            }}
          >
            {/* Visually hidden description for screen readers */}
            <span id={descId} style={{ display: 'none' }}>{title} dialog</span>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20, paddingBottom: 14,
              borderBottom: '1px solid var(--border)',
            }}>
              <Dialog.Title style={{
                fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'var(--text)',
              }}>
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--muted)', cursor: 'pointer',
                    fontSize: 18, padding: '4px 8px',
                    borderRadius: 6, lineHeight: 1,
                    transition: 'color 0.15s',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalButtons({ children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', gap: 10,
      marginTop: 20, paddingTop: 14,
      borderTop: '1px solid var(--border)',
    }}>
      {children}
    </div>
  );
}
