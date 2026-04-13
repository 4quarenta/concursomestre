export interface SavedCard {
  id: string;
  brand?: string;
  last_four_digits?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  is_default?: number | boolean;
  locked_by_recurring?: number | boolean;
}

export interface SavedCardsListResult {
  success: boolean;
  cards: SavedCard[];
  removed_stale_cards: number;
}
