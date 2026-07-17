import { describe, expect, it } from 'vitest';
import { isKeyboardOptionSelected, nextKeyboardSelection } from './selection';

describe('keyboard search selection', () => {
  it('does not show the default index as selected before arrow navigation', () => {
    expect(isKeyboardOptionSelected(false, null, 0, 0)).toBe(false);
  });

  it('hides every selected border while a note is being edited', () => {
    expect(isKeyboardOptionSelected(true, 'note-1', 1, 1)).toBe(false);
  });

  it('selects the first note on the first ArrowDown when a create row exists', () => {
    expect(nextKeyboardSelection('down', 0, 4, false, true, true)).toBe(1);
  });

  it('selects the first note on the first ArrowDown in the flat stream', () => {
    expect(nextKeyboardSelection('down', 0, 4, false, false, true)).toBe(0);
  });

  it('wraps after keyboard selection is active', () => {
    expect(nextKeyboardSelection('down', 4, 4, true, true, true)).toBe(0);
    expect(nextKeyboardSelection('up', 0, 4, true, true, true)).toBe(4);
  });
});
