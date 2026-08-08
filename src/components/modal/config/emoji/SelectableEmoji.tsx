import { Show, type Component } from 'solid-js';

import { type EmojiSelection } from '@/components/modal/config/emoji/useEmojiSelection';
import useEmojiPopup from '@/components/useEmojiPopup';
import LazyLoad from '@/components/utils/LazyLoad';

export type SelectableEmojiProps = {
  emojiKey: string;
  shortcode: string;
  url: string;
  note?: string;
  selection: EmojiSelection;
};

const SelectableEmoji: Component<SelectableEmojiProps> = (props) => {
  // hovering (or long pressing on touch) enlarges the emoji, while clicking toggles the
  // selection. The click goes through useEmojiPopup so that a long press does not toggle too.
  const { emojiRef, popup } = useEmojiPopup(() => ({
    emoji: { type: 'CustomEmoji', shortcode: props.shortcode, url: props.url },
    onClick: () => props.selection.handleClick(props.emojiKey),
    disabled: props.selection.isPainting(),
  }));

  return (
    <li class="min-w-0 basis-1/3 p-1 sm:basis-1/4">
      <button
        ref={emojiRef}
        type="button"
        class="flex w-full flex-col items-center gap-1 rounded-sm border p-1 select-none"
        classList={{
          'border-primary bg-primary/10': props.selection.isSelected(props.emojiKey),
          'border-transparent hover:bg-bg-tertiary/20': !props.selection.isSelected(props.emojiKey),
        }}
        onPointerDown={(ev) => props.selection.handlePointerDown(props.emojiKey, ev)}
        onPointerEnter={() => props.selection.handlePointerEnter(props.emojiKey)}
      >
        <LazyLoad fallback={<div class="size-8" />}>
          {() => (
            <div class="flex h-8 max-w-8 items-center">
              <img class="object-contain" src={props.url} alt={props.shortcode} draggable={false} />
            </div>
          )}
        </LazyLoad>
        <div class="w-full truncate text-xs text-fg-secondary">{props.shortcode}</div>
        <Show when={props.note}>
          <div class="w-full truncate text-xs text-fg-secondary">{props.note}</div>
        </Show>
      </button>
      {popup()}
    </li>
  );
};

export default SelectableEmoji;
