import { REACTION_OPTIONS, type ReactionType } from '@/types';
import { ReactionIcon } from './Icons';

interface Props {
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
}

export function ReactionPicker({ onSelect, onClose }: Props) {
  return (
    <div className="reaction-picker glass" onMouseLeave={onClose}>
      {REACTION_OPTIONS.map((r) => (
        <button
          key={r.type}
          className="reaction-btn"
          title={r.label}
          onClick={() => { onSelect(r.type); onClose(); }}
        >
          <ReactionIcon type={r.type} size={20} />
        </button>
      ))}
    </div>
  );
}
