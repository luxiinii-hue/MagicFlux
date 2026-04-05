import { useState } from 'react';
import type { FC } from 'react';
import type { CardData, CardInstance } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './PromptOverlay.module.css';

interface PromptData {
  readonly promptId: string;
  readonly promptType: string;
  readonly description: string;
  readonly options: unknown;
  readonly minSelections: number;
  readonly maxSelections: number;
}

interface PromptOverlayProps {
  readonly prompt: PromptData;
  readonly cardInstances: Readonly<Record<string, CardInstance>>;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly onRespond: (promptId: string, selection: unknown) => void;
}

/**
 * Displays engine prompts to the player and sends responses.
 *
 * Handles:
 * - searchLibrary: show cards from library to pick one
 * - scry: show top N cards, choose which go to bottom
 * - chooseCard: show cards to choose (Thoughtseize, discard)
 * - chooseMode: show text options (counter-unless-pay, modal spells)
 * - orderCards: drag to reorder (future)
 */
export const PromptOverlay: FC<PromptOverlayProps> = ({
  prompt,
  cardInstances,
  cardDataMap,
  onRespond,
}) => {
  const [selected, setSelected] = useState<string[]>([]);

  const options = prompt.options as readonly string[];
  const isCardPrompt = prompt.promptType === 'searchLibrary' ||
    prompt.promptType === 'scry' ||
    prompt.promptType === 'chooseCard';
  const isModePrompt = prompt.promptType === 'chooseMode' || prompt.promptType === 'orderCards';

  const toggleCard = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= prompt.maxSelections) return prev;
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (prompt.promptType === 'searchLibrary') {
      // Single selection — send the card ID or null
      onRespond(prompt.promptId, selected[0] ?? null);
    } else if (prompt.promptType === 'scry') {
      // Selected cards go to bottom, unselected stay on top
      onRespond(prompt.promptId, selected);
    } else if (prompt.promptType === 'chooseCard') {
      onRespond(prompt.promptId, selected);
    } else if (prompt.promptType === 'chooseMode') {
      onRespond(prompt.promptId, selected[0] ?? null);
    } else {
      onRespond(prompt.promptId, selected);
    }
    setSelected([]);
  };

  const handleSkip = () => {
    // For optional prompts (search: "you may" → select nothing)
    onRespond(prompt.promptId, prompt.promptType === 'scry' ? [] : null);
    setSelected([]);
  };

  const canConfirm = selected.length >= prompt.minSelections && selected.length <= prompt.maxSelections;

  // Determine the confirm button label based on prompt type
  let confirmLabel = 'Confirm';
  if (prompt.promptType === 'scry') {
    confirmLabel = selected.length === 0 ? 'Keep all on top' : `Put ${selected.length} on bottom`;
  } else if (prompt.promptType === 'searchLibrary') {
    confirmLabel = selected.length > 0 ? 'Choose this card' : 'Fail to find';
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.title}>{prompt.description}</div>

        {prompt.promptType === 'scry' && (
          <div className={styles.hint}>Click cards to send to the bottom of your library</div>
        )}

        {isCardPrompt && (
          <div className={styles.cardGrid}>
            {options.map((id) => {
              const card = cardInstances[id];
              const cardData = card ? cardDataMap[card.cardDataId] : undefined;
              const imageUrl = cardData ? getCardImageUrl(cardData.imageUris, 'normal') : getCardImageUrl(null);
              const isSelected = selected.includes(id);

              return (
                <div
                  key={id}
                  className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                  onClick={() => toggleCard(id)}
                >
                  <img
                    className={styles.cardImage}
                    src={imageUrl}
                    alt={card?.cardDataId ?? id}
                  />
                  {isSelected && (
                    <div className={styles.selectedBadge}>
                      {prompt.promptType === 'scry' ? '↓' : selected.indexOf(id) + 1}
                    </div>
                  )}
                  <div className={styles.cardName}>{card?.cardDataId ?? 'Unknown'}</div>
                </div>
              );
            })}
          </div>
        )}

        {isModePrompt && (
          <div className={styles.modeList}>
            {options.map((option, i) => (
              <button
                key={i}
                className={`${styles.modeButton} ${selected.includes(option) ? styles.modeSelected : ''}`}
                onClick={() => setSelected([option])}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        <div className={styles.buttons}>
          {prompt.minSelections === 0 && (
            <button className={styles.skipButton} onClick={handleSkip}>
              {prompt.promptType === 'searchLibrary' ? 'Fail to find' : 'Skip'}
            </button>
          )}
          <button
            className={styles.confirmButton}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
