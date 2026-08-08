import { type JSX } from 'solid-js';

import Section from '@/components/modal/config/Section';
import useConfig from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { convertToEmojiConfig, simpleEmojiPackSchema } from '@/utils/emojipack';

const FileImportSection = () => {
  let fileInputRef: HTMLInputElement | undefined;

  const i18n = useTranslation();
  const { saveEmojis } = useConfig();

  const importFile = async (file: File) => {
    try {
      const data = simpleEmojiPackSchema.parse(JSON.parse(await file.text()));
      const emojis = convertToEmojiConfig(data);
      saveEmojis(emojis);
      window.alert(i18n.t('config.customEmoji.emojisImported', { count: emojis.length }));
    } catch (err) {
      const message = err instanceof Error ? `:${err.message}` : '';
      window.alert(`${i18n.t('config.customEmoji.failedToImportJSON')}${message}`);
    }
  };

  const handleChangeFile: JSX.EventHandler<HTMLInputElement, Event> = (ev) => {
    ev.preventDefault();

    const files = [...(ev.currentTarget.files ?? [])];
    // let the same file be chosen again after a failure
    ev.currentTarget.value = '';
    if (files.length !== 1) return;

    importFile(files[0]).catch((err) => console.error(err));
  };

  return (
    <Section title={i18n.t('config.customEmoji.importFromFile')}>
      <div class="flex flex-col gap-2">
        <p>{i18n.t('config.customEmoji.importFromFileDescription')}</p>
        <button
          type="button"
          class="self-end rounded-sm border border-primary p-2 font-bold text-primary"
          onClick={() => fileInputRef?.click()}
        >
          {i18n.t('config.customEmoji.chooseFile')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple={false}
          name="emojis"
          accept="application/json"
          onChange={handleChangeFile}
        />
      </div>
    </Section>
  );
};

export default FileImportSection;
