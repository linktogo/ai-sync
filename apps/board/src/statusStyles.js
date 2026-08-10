// apps/board/src/statusStyles.js
export const STATUS_STYLES = {
  todo: {
    label: 'To do',
    pill: 'bg-slate-600',
    border: 'border-slate-600',
    chip: 'bg-slate-100 text-slate-600',
  },
  inprogress: {
    label: 'In progress',
    pill: 'bg-blue-600',
    border: 'border-blue-600',
    chip: 'bg-blue-50 text-blue-700',
  },
  question: {
    label: 'Question',
    pill: 'bg-amber-600',
    border: 'border-amber-600',
    chip: 'bg-amber-50 text-amber-700',
    ring: 'ring-2 ring-amber-300',
  },
  done: {
    label: 'Done',
    pill: 'bg-emerald-600',
    border: 'border-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700',
  },
};

export const STATUS_ORDER = ['todo', 'inprogress', 'question', 'done'];
