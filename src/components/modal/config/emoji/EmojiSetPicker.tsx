import { createMemo, createSignal, For, Show, type Component } from 'solid-js';

import Check from 'heroicons/24/outline/check.svg';
import ChevronDown from 'heroicons/24/outline/chevron-down.svg';
import ChevronUp from 'heroicons/24/outline/chevron-up.svg';
import Minus from 'heroicons/24/outline/minus.svg';

import SelectableEmoji from '@/components/modal/config/emoji/SelectableEmoji';
import useEmojiSelection from '@/components/modal/config/emoji/useEmojiSelection';
import useConfig, { type CustomEmojiConfig } from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { type EmojiSetContent } from '@/nostr/emojiSet';

export type EmojiSetPickerProps = {
  emojiSets: EmojiSetContent[];
  onImport: (emojis: CustomEmojiConfig[]) => void;
  onCancel: () => void;
};

// An emoji is identified by its emoji set as well, because the same shortcode can appear in
// more than one emoji set.
const emojiKey = (emojiSetId: string, shortcode: string) => `${emojiSetId}::${shortcode}`;

const keysOf = (emojiSet: EmojiSetContent) =>
  emojiSet.emojis.map(({ shortcode }) => emojiKey(emojiSet.id, shortcode));

const CheckBox: Component<{ state: 'checked' | 'indeterminate' | 'unchecked' }> = (props) => (
  <span
    class="flex size-5 shrink-0 items-center justify-center rounded-sm border"
    classList={{
      'border-primary bg-primary text-primary-fg': props.state !== 'unchecked',
      'border-border': props.state === 'unchecked',
    }}
  >
    <Show when={props.state === 'checked'}>
      <span class="inline-block size-4">
        <Check />
      </span>
    </Show>
    <Show when={props.state === 'indeterminate'}>
      <span class="inline-block size-4">
        <Minus />
      </span>
    </Show>
  </span>
);

const EmojiSetPicker: Component<EmojiSetPickerProps> = (props) => {
  const i18n = useTranslation();
  const { config } = useConfig();

  const selection = useEmojiSelection();
  const [openedSetIds, setOpenedSetIds] = createSignal<Set<string>>(new Set());

  const allKeys = createMemo(() => props.emojiSets.flatMap(keysOf));

  const isRegistered = (shortcode: string) => config().customEmojis[shortcode] != null;

  const toggleOpened = (emojiSetId: string) => {
    setOpenedSetIds((current) => {
      const next = new Set(current);
      if (!next.delete(emojiSetId)) next.add(emojiSetId);
      return next;
    });
  };

  const checkBoxStateOf = (emojiSet: EmojiSetContent) => {
    const count = selection.selectedCountOf(keysOf(emojiSet));
    if (count === 0) return 'unchecked';
    if (count === emojiSet.emojis.length) return 'checked';
    return 'indeterminate';
  };

  const selectedEmojis = (): CustomEmojiConfig[] =>
    props.emojiSets.flatMap(({ id, emojis }) =>
      emojis.filter(({ shortcode }) => selection.isSelected(emojiKey(id, shortcode))),
    );

  // the last one wins on saveEmojis, so warn before it silently happens
  const duplicatedShortcodes = createMemo(() => {
    const counts = new Map<string, number>();
    selectedEmojis().forEach(({ shortcode }) => {
      counts.set(shortcode, (counts.get(shortcode) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([shortcode]) => shortcode);
  });

  return (
    <div class="flex flex-col gap-2">
      <p>{i18n.t('config.customEmoji.chooseEmojisDescription')}</p>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-sm border border-primary px-2 py-1 text-sm font-bold text-primary"
          onClick={() => selection.select(allKeys())}
        >
          {i18n.t('config.customEmoji.selectAll')}
        </button>
        <button
          type="button"
          class="rounded-sm border border-primary px-2 py-1 text-sm font-bold text-primary"
          onClick={() => selection.clear()}
        >
          {i18n.t('config.customEmoji.deselectAll')}
        </button>
        <div class="flex-1 text-end text-sm text-fg-secondary">
          {i18n.t('config.customEmoji.numberOfSelectedEmojis', {
            count: selection.selectedKeys().size,
            total: allKeys().length,
          })}
        </div>
      </div>

      <ul class="scrollbar flex max-h-[50vh] flex-col divide-y divide-border overflow-y-auto rounded-sm border border-border">
        <For each={props.emojiSets}>
          {(emojiSet) => (
            <li>
              <div class="flex items-center gap-2 p-2">
                <button
                  type="button"
                  class="shrink-0"
                  aria-label={i18n.t('config.customEmoji.selectAll')}
                  onClick={() => selection.toggleAll(keysOf(emojiSet))}
                >
                  <CheckBox state={checkBoxStateOf(emojiSet)} />
                </button>
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 text-start"
                  onClick={() => toggleOpened(emojiSet.id)}
                >
                  <span class="min-w-0 flex-1 truncate">
                    {emojiSet.title ?? i18n.t('config.customEmoji.emojisInEmojiList')}
                  </span>
                  <span class="shrink-0 text-sm text-fg-secondary">
                    {selection.selectedCountOf(keysOf(emojiSet))}/{emojiSet.emojis.length}
                  </span>
                  <span class="inline-block size-4 shrink-0">
                    <Show when={openedSetIds().has(emojiSet.id)} fallback={<ChevronDown />}>
                      <ChevronUp />
                    </Show>
                  </span>
                </button>
              </div>
              <Show when={openedSetIds().has(emojiSet.id)}>
                <ul class="flex flex-wrap border-t border-border">
                  <For each={emojiSet.emojis}>
                    {({ shortcode, url }) => (
                      <SelectableEmoji
                        emojiKey={emojiKey(emojiSet.id, shortcode)}
                        shortcode={shortcode}
                        url={url}
                        note={
                          isRegistered(shortcode)
                            ? i18n.t('config.customEmoji.alreadyRegistered')
                            : undefined
                        }
                        selection={selection}
                      />
                    )}
                  </For>
                </ul>
              </Show>
            </li>
          )}
        </For>
      </ul>

      <Show when={duplicatedShortcodes().length > 0}>
        <p class="text-danger">
          {i18n.t('config.customEmoji.duplicatedShortcodes', {
            shortcodes: duplicatedShortcodes().join(', '),
          })}
        </p>
      </Show>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-sm border border-primary p-2 font-bold text-primary"
          onClick={() => props.onCancel()}
        >
          {i18n.t('config.customEmoji.cancel')}
        </button>
        <button
          type="button"
          class="rounded-sm bg-primary p-2 font-bold text-primary-fg disabled:opacity-50"
          disabled={selection.selectedKeys().size === 0}
          onClick={() => props.onImport(selectedEmojis())}
        >
          {i18n.t('config.customEmoji.addSelectedEmojis', { count: selection.selectedKeys().size })}
        </button>
      </div>
    </div>
  );
};

export default EmojiSetPicker;
