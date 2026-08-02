import type { CardSummary } from '@icb/contracts';
import { IcbMark, cn } from '@icb/ui';

/**
 * A card, drawn rather than photographed.
 *
 * A frozen card is desaturated and says so — the state has to be unmistakable at a glance,
 * because the whole value of a freeze button is knowing whether it took effect.
 */
export function CardFace({ card, className }: Readonly<{ card: CardSummary; className?: string }>) {
  const inactive = card.frozen || card.status !== 'active';

  return (
    <div
      className={cn(
        'relative aspect-[1.586/1] w-full max-w-[380px] overflow-hidden rounded-[var(--radius-xl)] p-6 text-white shadow-[var(--shadow-lg)]',
        card.kind === 'virtual' ? 'bg-brand-gradient' : 'bg-brand-tile',
        inactive && 'opacity-55 grayscale',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold tracking-[0.16em] text-white/70 uppercase">
            {card.kind === 'virtual' ? 'Virtual' : card.kind} card
          </p>
          <p className="mt-1 text-sm font-medium">{card.nickname ?? 'ICB card'}</p>
        </div>
        <IcbMark className="h-8 w-8 text-white/90" id={`card-${card.id}`} />
      </div>

      <p className="tabular absolute bottom-16 left-6 font-mono text-lg tracking-[0.14em]">
        •••• •••• •••• {card.panLast4}
      </p>

      <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between">
        <div>
          <p className="text-[0.55rem] tracking-[0.14em] text-white/60 uppercase">Cardholder</p>
          <p className="mt-0.5 text-xs font-medium tracking-wide uppercase">
            {card.cardholderName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.55rem] tracking-[0.14em] text-white/60 uppercase">Expires</p>
          <p className="tabular mt-0.5 font-mono text-xs">
            {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
          </p>
        </div>
      </div>

      {inactive ? (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 px-4 py-1.5 text-xs font-semibold tracking-[0.1em] uppercase backdrop-blur-sm">
          {card.frozen ? 'Frozen' : card.status}
        </span>
      ) : null}
    </div>
  );
}
