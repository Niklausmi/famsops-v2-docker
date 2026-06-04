import { cn } from '../../lib/utils';

export function Field({ label, children, className }) {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 10,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 5,
        }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn('field-input', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn('field-input', className)}
      style={{ resize: 'vertical', minHeight: 80, ...props.style }}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn('field-input', className)}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%235a6070' d='M5 6L0 0h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 30,
        ...props.style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}
