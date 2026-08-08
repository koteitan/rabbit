import Section from '@/components/modal/config/Section';
import useConfig from '@/core/useConfig';
import { useTranslation } from '@/i18n/useTranslation';
import { convertToSimpleEmojiPack } from '@/utils/emojipack';

const FileExportSection = () => {
  const i18n = useTranslation();
  const { config } = useConfig();

  const emojis = () => Object.values(config().customEmojis);

  const handleClickExport = () => {
    const json = JSON.stringify(convertToSimpleEmojiPack(emojis()), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const dataUrl = URL.createObjectURL(blob);

    const datetime = new Date().toISOString();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `rabbit-emojis-${datetime}.json`;

    link.click();
  };

  return (
    <Section title={i18n.t('config.customEmoji.exportToFile')}>
      <div class="flex flex-col gap-2">
        <p>{i18n.t('config.customEmoji.exportToFileDescription')}</p>
        <button
          type="button"
          class="self-end rounded-sm border border-primary p-2 font-bold text-primary disabled:opacity-50"
          disabled={emojis().length === 0}
          onClick={handleClickExport}
        >
          {i18n.t('config.customEmoji.exportEmoji')}
        </button>
      </div>
    </Section>
  );
};

export default FileExportSection;
