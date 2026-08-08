import { createSignal, onCleanup } from 'solid-js';

export type EmojiSelection = {
  selectedKeys: () => Set<string>;
  isSelected: (key: string) => boolean;
  isPainting: () => boolean;
  selectedCountOf: (keys: string[]) => number;
  select: (keys: string[]) => void;
  deselect: (keys: string[]) => void;
  toggleAll: (keys: string[]) => void;
  clear: () => void;
  /** starts a drag which paints every emoji the pointer passes over */
  handlePointerDown: (key: string, ev: PointerEvent) => void;
  handlePointerEnter: (key: string) => void;
  handleClick: (key: string) => void;
};

/**
 * Holds which emojis are selected and lets the user paint a range of them by dragging.
 * Dragging keeps the mode decided by the emoji it started on, so that going back and forth
 * over the same emoji does not flip it repeatedly.
 */
const useEmojiSelection = (): EmojiSelection => {
  const [selectedKeys, setSelectedKeys] = createSignal<Set<string>>(new Set());
  const [paintTo, setPaintTo] = createSignal<boolean | null>(null);

  // a mouse drag already applied the change, so the click which follows must not undo it
  let paintedByPointer = false;

  const isSelected = (key: string) => selectedKeys().has(key);

  const apply = (keys: string[], selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      keys.forEach((key) => {
        if (selected) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const stopPainting = () => setPaintTo(null);
  window.addEventListener('pointerup', stopPainting);
  window.addEventListener('pointercancel', stopPainting);
  onCleanup(() => {
    window.removeEventListener('pointerup', stopPainting);
    window.removeEventListener('pointercancel', stopPainting);
  });

  return {
    selectedKeys,
    isSelected,
    isPainting: () => paintTo() != null,
    selectedCountOf: (keys) => keys.filter((key) => isSelected(key)).length,
    select: (keys) => apply(keys, true),
    deselect: (keys) => apply(keys, false),
    toggleAll: (keys) =>
      apply(
        keys,
        keys.some((key) => !isSelected(key)),
      ),
    clear: () => setSelectedKeys(new Set()),
    handlePointerDown: (key, ev) => {
      // touch keeps the plain tap so that the list can still be scrolled by dragging
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      const to = !isSelected(key);
      setPaintTo(to);
      apply([key], to);
      paintedByPointer = true;
    },
    handlePointerEnter: (key) => {
      const to = paintTo();
      if (to == null) return;
      apply([key], to);
    },
    handleClick: (key) => {
      if (paintedByPointer) {
        paintedByPointer = false;
        return;
      }
      apply([key], !isSelected(key));
    },
  };
};

export default useEmojiSelection;
