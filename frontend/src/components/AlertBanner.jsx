import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function AlertBanner({ notification, onClose }) {
  if (!notification) return null;

  const { type, message, detail, isIdempotent } = notification;

  const colorStyles = {
    success: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200',
    idempotent: 'bg-sky-950/80 border-sky-500/50 text-sky-200',
    error: 'bg-rose-950/80 border-rose-500/50 text-rose-200',
    warning: 'bg-amber-950/80 border-amber-500/50 text-amber-200',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
    idempotent: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
  };

  const activeType = isIdempotent ? 'idempotent' : type || 'info';

  return (
    <div
      className={`border rounded-xl p-4 shadow-lg backdrop-blur-md mb-6 flex items-start justify-between gap-3 transition-all animate-fadeIn ${
        colorStyles[activeType] || colorStyles.success
      }`}
    >
      <div className="flex items-start space-x-3">
        {icons[activeType]}
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <span>{message}</span>
            {isIdempotent && (
              <span className="bg-sky-500/30 text-sky-300 text-xs px-2 py-0.5 rounded-full border border-sky-400/40">
                Idempotent Response
              </span>
            )}
          </div>
          {detail && <div className="text-xs opacity-85 mt-1">{detail}</div>}
        </div>
      </div>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
