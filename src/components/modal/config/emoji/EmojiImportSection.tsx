import { createSignal, Show, type JSX } from 'solid-js';

import EmojiSetPicker from '@/components/modal/config/emoji/EmojiSetPicker';
import Section from '@/components/modal/config/Section';
import useConfig, { type CustomEmojiConfig } from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { fetchEmojiSetsOfList, type EmojiSetContent } from '@/nostr/emojiSet';
import usePubkey from '@/nostr/usePubkey';
import {
  convertToEmojiConfig,
  convertToSimpleEmojiPack,
  simpleEmojiPackSchema,
} from '@/utils/emojipack';

const EmojiImportSection = () => {
  const i18n = useTranslation();
  const { config, saveEmojis } = useConfig();
  const pubkey = usePubkey();

  const [jsonInput, setJSONInput] = createSignal('');
  const [loadingEmojiSets, setLoadingEmojiSets] = createSignal(false);
  const [emojiSets, setEmojiSets] = createSignal<EmojiSetContent[] | null>(null);

  const handleClickSaveEmoji: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (ev) => {
    ev.preventDefault();
    if (jsonInput().length === 0) return;

    try {
      const data = simpleEmojiPackSchema.parse(JSON.parse(jsonInput()));
      const emojis = convertToEmojiConfig(data);
      saveEmojis(emojis);
      setJSONInput('');
    } catch (err) {
      const message = err instanceof Error ? `:${err.message}` : '';
      window.alert(`JSONの読み込みに失敗しました${message}`);
    }
  };

  const loadEmojiSets = async () => {
    const currentPubkey = pubkey();
    if (currentPubkey == null) return;

    try {
      const fetched = await fetchEmojiSetsOfList({
        pubkey: currentPubkey,
        relayUrls: config().relayUrls,
      });

      if (fetched.length === 0) {
        window.alert(i18n.t('config.customEmoji.emojiListNotFound'));
        return;
      }

      setEmojiSets(fetched);
    } catch (err) {
      console.error('failed to load the emoji list', err);
      const message = err instanceof Error ? `:${err.message}` : '';
      window.alert(`${i18n.t('config.customEmoji.failedToImportEmojiList')}${message}`);
    }
  };

  const handleImportSelectedEmojis = (selected: CustomEmojiConfig[]) => {
    saveEmojis(selected);
    setEmojiSets(null);
    window.alert(i18n.t('config.customEmoji.emojiListImported', { count: selected.length }));
  };

  const emojis = () => Object.values(config().customEmojis);

  const handleClickExportEmoji = () => {
    const json = JSON.stringify(convertToSimpleEmojiPack(emojis()), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const dataUrl = URL.createObjectURL(blob);

    const datetime = new Date().toISOString();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `rabbit-emojis-${datetime}.json`;

    link.click();
  };

  const handleClickChooseEmojis = () => {
    if (loadingEmojiSets()) return;
    setLoadingEmojiSets(true);
    loadEmojiSets()
      .finally(() => setLoadingEmojiSets(false))
      .catch((err) => console.error(err));
  };

  return (
    <Section title={i18n.t('config.customEmoji.emojiImport')}>
      <Show
        when={emojiSets()}
        fallback={
          <>
            <p>{i18n.t('config.customEmoji.emojiImportDescription')}</p>
            <p>{i18n.t('config.customEmoji.chooseEmojisFromEmojiListDescription')}</p>
            <p>{i18n.t('config.customEmoji.exportEmojiDescription')}</p>
            <form class="flex flex-col gap-2" onSubmit={handleClickSaveEmoji}>
              <textarea
                class="flex-1 rounded-md border-border bg-bg placeholder:text-fg-secondary focus:border-border focus:ring-primary"
                name="json"
                value={jsonInput()}
                placeholder='{ "smiley": "https://example.com/smiley.png" }'
                onChange={(ev) => setJSONInput(ev.currentTarget.value)}
              />
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-sm border border-primary p-2 font-bold text-primary disabled:opacity-50"
                  disabled={pubkey() == null || loadingEmojiSets()}
                  onClick={handleClickChooseEmojis}
                >
                  {loadingEmojiSets()
                    ? i18n.t('config.customEmoji.loadingEmojiList')
                    : i18n.t('config.customEmoji.chooseEmojisFromEmojiList')}
                </button>
                <button
                  type="button"
                  class="w-24 rounded-sm border border-primary p-2 font-bold text-primary disabled:opacity-50"
                  disabled={emojis().length === 0}
                  onClick={handleClickExportEmoji}
                >
                  {i18n.t('config.customEmoji.exportEmoji')}
                </button>
                <button
                  type="submit"
                  class="w-24 rounded-sm bg-primary p-2 font-bold text-primary-fg"
                >
                  {i18n.t('config.customEmoji.importEmoji')}
                </button>
              </div>
            </form>
          </>
        }
        keyed
      >
        {(loadedEmojiSets) => (
          <EmojiSetPicker
            emojiSets={loadedEmojiSets}
            onImport={handleImportSelectedEmojis}
            onCancel={() => setEmojiSets(null)}
          />
        )}
      </Show>
    </Section>
  );
};

export default EmojiImportSection;
