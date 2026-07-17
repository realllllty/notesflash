export function nextKeyboardSelection(
  direction: 'up' | 'down',
  currentIndex: number,
  maximumIndex: number,
  selectionVisible: boolean,
  hasCreateRow: boolean,
  hasVisibleHits: boolean
): number {
  if (!selectionVisible) {
    if (direction === 'up') return maximumIndex;
    return hasCreateRow && hasVisibleHits ? 1 : 0;
  }

  if (direction === 'down') return currentIndex >= maximumIndex ? 0 : currentIndex + 1;
  return currentIndex <= 0 ? maximumIndex : currentIndex - 1;
}

export function isKeyboardOptionSelected(
  selectionVisible: boolean,
  editingId: string | null,
  selectedIndex: number,
  optionIndex: number
): boolean {
  return selectionVisible && editingId === null && selectedIndex === optionIndex;
}
