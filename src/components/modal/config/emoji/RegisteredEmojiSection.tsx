import { createMemo, For } from 'solid-js';

import SelectableEmoji from '@/components/modal/config/emoji/SelectableEmoji';
import useEmojiSelection from '@/components/modal/config/emoji/useEmojiSelection';
import Section from '@/components/modal/config/Section';
import useConfig from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';

const RegisteredEmojiSection = () => {
  const i18n = useTranslation();
  const { config, removeEmojis } = useConfig();

  const selection = useEmojiSelection();

  // the shortcode is unique in the config, so it identifies an emoji by itself here
  const emojis = createMemo(() => Object.values(config().customEmojis));
  const shortcodes = () => emojis().map(({ shortcode }) => shortcode);

  const handleClickRemoveSelected = () => {
    const selected = shortcodes().filter((shortcode) => selection.isSelected(shortcode));
    if (selected.length === 0) return;
    if (
      !window.confirm(i18n.t('config.customEmoji.confirmRemoveEmojis', { count: selected.length }))
    )
      return;

    removeEmojis(selected);
    selection.clear();
  };

  return (
    <Section title={i18n.t('config.customEmoji.registeredEmojis')}>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-sm border border-primary px-2 py-1 text-sm font-bold text-primary"
          onClick={() => selection.select(shortcodes())}
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
            total: emojis().length,
          })}
        </div>
      </div>

      <ul class="scrollbar flex max-h-[40vh] min-h-64 flex-wrap overflow-y-auto">
        <For each={emojis()}>
          {({ shortcode, url }) => (
            <SelectableEmoji
              emojiKey={shortcode}
              shortcode={shortcode}
              url={url}
              selection={selection}
            />
          )}
        </For>
      </ul>

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-sm border border-danger p-2 font-bold text-danger disabled:opacity-50"
          disabled={selection.selectedKeys().size === 0}
          onClick={handleClickRemoveSelected}
        >
          {i18n.t('config.customEmoji.removeSelectedEmojis', {
            count: selection.selectedKeys().size,
          })}
        </button>
      </div>
    </Section>
  );
};

export default RegisteredEmojiSection;
