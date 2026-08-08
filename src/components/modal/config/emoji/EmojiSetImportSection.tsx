import { createSignal, Show } from 'solid-js';

import EmojiSetPicker from '@/components/modal/config/emoji/EmojiSetPicker';
import Section from '@/components/modal/config/Section';
import useConfig, { type CustomEmojiConfig } from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { fetchEmojiSetsOfList, type EmojiSetContent } from '@/nostr/emojiSet';
import usePubkey from '@/nostr/usePubkey';

const EmojiSetImportSection = () => {
  const i18n = useTranslation();
  const { config, saveEmojis } = useConfig();
  const pubkey = usePubkey();

  const [loading, setLoading] = createSignal(false);
  const [emojiSets, setEmojiSets] = createSignal<EmojiSetContent[] | null>(null);

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

  const handleClickLoad = () => {
    if (loading()) return;
    setLoading(true);
    loadEmojiSets()
      .finally(() => setLoading(false))
      .catch((err) => console.error(err));
  };

  const handleImportSelected = (selected: CustomEmojiConfig[]) => {
    saveEmojis(selected);
    setEmojiSets(null);
    window.alert(i18n.t('config.customEmoji.emojiListImported', { count: selected.length }));
  };

  return (
    <Section title={i18n.t('config.customEmoji.importFromEmojiSets')}>
      <Show
        when={emojiSets()}
        fallback={
          <div class="flex flex-col gap-2">
            <p>{i18n.t('config.customEmoji.importFromEmojiSetsDescription')}</p>
            <button
              type="button"
              class="self-end rounded-sm border border-primary p-2 font-bold text-primary disabled:opacity-50"
              disabled={pubkey() == null || loading()}
              onClick={handleClickLoad}
            >
              {loading()
                ? i18n.t('config.customEmoji.loadingEmojiSets')
                : i18n.t('config.customEmoji.loadEmojiSets')}
            </button>
          </div>
        }
      >
        {/* not keyed, so that a reload replaces the emoji sets without losing the selection */}
        {(loadedEmojiSets) => (
          <EmojiSetPicker
            emojiSets={loadedEmojiSets()}
            reloading={loading()}
            onReload={handleClickLoad}
            onImport={handleImportSelected}
            onCancel={() => setEmojiSets(null)}
          />
        )}
      </Show>
    </Section>
  );
};

export default EmojiSetImportSection;
