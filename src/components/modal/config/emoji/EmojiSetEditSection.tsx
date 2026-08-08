import Section from '@/components/modal/config/Section';
import SafeLink from '@/components/utils/SafeLink';
import { useTranslation } from '@/i18n/useTranslation';

const EmoemoUrl = 'https://koteitan.github.io/emoemo/';

const EmojiSetEditSection = () => {
  const i18n = useTranslation();

  return (
    <Section title={i18n.t('config.customEmoji.editEmojiSets')}>
      <div class="flex flex-col gap-2">
        <p>{i18n.t('config.customEmoji.editEmojiSetsDescription')}</p>
        <SafeLink
          class="self-end rounded-sm border border-primary p-2 font-bold text-primary"
          href={EmoemoUrl}
        >
          {i18n.t('config.customEmoji.editOnEmoemo')}
        </SafeLink>
      </div>
    </Section>
  );
};

export default EmojiSetEditSection;
