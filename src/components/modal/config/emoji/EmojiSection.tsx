import { createMemo, createSignal, For, type JSX } from 'solid-js';

import SelectableEmoji from '@/components/modal/config/emoji/SelectableEmoji';
import useEmojiSelection from '@/components/modal/config/emoji/useEmojiSelection';
import Section from '@/components/modal/config/Section';
import useConfig from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { HttpUrlRegex } from '@/utils/regex';

const EmojiSection = () => {
  const i18n = useTranslation();
  const { config, saveEmoji, removeEmojis } = useConfig();

  const [shortcodeInput, setShortcodeInput] = createSignal('');
  const [urlInput, setUrlInput] = createSignal('');

  const selection = useEmojiSelection();

  // the shortcode is unique in the config, so it identifies an emoji by itself here
  const emojis = createMemo(() => Object.values(config().customEmojis));
  const shortcodes = () => emojis().map(({ shortcode }) => shortcode);

  const handleClickSaveEmoji: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (ev) => {
    ev.preventDefault();
    if (shortcodeInput().length === 0 || urlInput().length === 0) return;
    saveEmoji({ shortcode: shortcodeInput(), url: urlInput() });
    setShortcodeInput('');
    setUrlInput('');
  };

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
    <Section title={i18n.t('config.customEmoji.customEmoji')}>
      <form class="flex flex-col gap-2" onSubmit={handleClickSaveEmoji}>
        <label class="flex flex-1 items-center gap-1">
          <div class="w-9">{i18n.t('config.customEmoji.shortcode')}</div>
          <input
            class="flex-1 rounded-md border-border bg-bg placeholder:text-fg-secondary focus:border-border focus:ring-primary"
            type="text"
            name="shortcode"
            placeholder="smiley"
            value={shortcodeInput()}
            pattern="^[\\w-]+$"
            required
            onChange={(ev) => setShortcodeInput(ev.currentTarget.value)}
          />
        </label>
        <label class="flex flex-1 items-center gap-1">
          <div class="w-9">{i18n.t('config.customEmoji.url')}</div>
          <input
            class="flex-1 rounded-md border-border bg-bg placeholder:text-fg-secondary focus:border-border focus:ring-primary"
            type="text"
            name="url"
            value={urlInput()}
            placeholder="https://example.com/smiley.png"
            pattern={HttpUrlRegex}
            required
            onChange={(ev) => setUrlInput(ev.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          class="w-24 self-end rounded-sm bg-primary p-2 font-bold text-primary-fg"
        >
          {i18n.t('config.customEmoji.addEmoji')}
        </button>
      </form>

      <div class="mt-4 flex items-center gap-2 border-t border-border pt-2">
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

export default EmojiSection;
