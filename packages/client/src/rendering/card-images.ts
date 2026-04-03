const CARD_BACK_URL = 'https://cards.scryfall.io/large/back/6/0/60e97c28-0ece-4fcd-b1b4-caf1ce0dd84e.jpg';

export function getCardImageUrl(
  imageUris: Readonly<Record<string, string>> | null,
  size: 'small' | 'normal' | 'large' = 'normal',
): string {
  if (!imageUris) return CARD_BACK_URL;
  return imageUris[size] ?? imageUris['normal'] ?? CARD_BACK_URL;
}

export function getCardBackUrl(): string {
  return CARD_BACK_URL;
}
