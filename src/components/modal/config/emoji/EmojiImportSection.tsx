import { createSignal, type JSX } from 'solid-js';

import Section from '@/components/modal/config/Section';
import useConfig from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { fetchEmojiListEmojis } from '@/nostr/emojiSet';
import usePubkey from '@/nostr/usePubkey';
import { convertToEmojiConfig, simpleEmojiPackSchema } from '@/utils/emojipack';

const EmojiImportSection = () => {
  const i18n = useTranslation();
  const { config, saveEmojis } = useConfig();
  const pubkey = usePubkey();

  const [jsonInput, setJSONInput] = createSignal('');
  const [importingEmojiList, setImportingEmojiList] = createSignal(false);

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

  const importEmojiList = async () => {
    const currentPubkey = pubkey();
    if (currentPubkey == null) return;

    try {
      const { emojis, emojiSetCount } = await fetchEmojiListEmojis({
        pubkey: currentPubkey,
        relayUrls: config().relayUrls,
      });

      if (emojis.length === 0) {
        window.alert(i18n.t('config.customEmoji.emojiListNotFound'));
        return;
      }

      saveEmojis(emojis);
      window.alert(
        i18n.t('config.customEmoji.emojiListImported', { count: emojis.length, emojiSetCount }),
      );
    } catch (err) {
      console.error('failed to import the emoji list', err);
      const message = err instanceof Error ? `:${err.message}` : '';
      window.alert(`${i18n.t('config.customEmoji.failedToImportEmojiList')}${message}`);
    }
  };

  const handleClickImportEmojiList = () => {
    if (importingEmojiList()) return;
    setImportingEmojiList(true);
    importEmojiList()
      .finally(() => setImportingEmojiList(false))
      .catch((err) => console.error(err));
  };

  return (
    <Section title={i18n.t('config.customEmoji.emojiImport')}>
      <p>{i18n.t('config.customEmoji.emojiImportDescription')}</p>
      <p>{i18n.t('config.customEmoji.importEmojiListDescription')}</p>
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
            disabled={pubkey() == null || importingEmojiList()}
            onClick={handleClickImportEmojiList}
          >
            {importingEmojiList()
              ? i18n.t('config.customEmoji.importingEmojiList')
              : i18n.t('config.customEmoji.importEmojiList')}
          </button>
          <button type="submit" class="w-24 rounded-sm bg-primary p-2 font-bold text-primary-fg">
            {i18n.t('config.customEmoji.importEmoji')}
          </button>
        </div>
      </form>
    </Section>
  );
};

export default EmojiImportSection;
