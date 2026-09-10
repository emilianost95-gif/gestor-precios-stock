import { Info, Sparkles } from 'lucide-react';
import { CopilotDataTable } from './CopilotDataTable';
import { ActionPreviewCard } from './ActionPreviewCard';
import type { CopilotMessage } from '@/services/copilot';

interface CopilotMessageBubbleProps {
  message: CopilotMessage;
  onFollowUp: (question: string) => void;
  onApplyAction: (messageId: string) => void;
  onDismissAction: (messageId: string) => void;
}

export function CopilotMessageBubble({
  message,
  onFollowUp,
  onApplyAction,
  onDismissAction,
}: CopilotMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-sm text-white">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
          {message.notice && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {message.notice}
            </p>
          )}

          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {message.content}
          </p>

          {message.bullets && message.bullets.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {message.bullets.map((bullet, index) =>
                bullet === '' ? (
                  <li key={index} className="h-1" aria-hidden />
                ) : (
                  <li
                    key={index}
                    className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    <span className="min-w-0">{bullet}</span>
                  </li>
                ),
              )}
            </ul>
          )}

          {message.table && <CopilotDataTable table={message.table} />}

          {message.preview && (
            <ActionPreviewCard
              preview={message.preview}
              state={message.actionState ?? 'pendiente'}
              onApply={() => onApplyAction(message.id)}
              onDismiss={() => onDismissAction(message.id)}
            />
          )}
        </div>

        {message.followUps && message.followUps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.followUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => onFollowUp(followUp)}
                className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-600 dark:hover:text-brand-300"
              >
                {followUp}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
