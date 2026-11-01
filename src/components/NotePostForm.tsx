import { createSignal, createMemo, onCleanup, Show, For, type Component, type JSX } from 'solid-js';

import ExclamationTriangle from 'heroicons/24/outline/exclamation-triangle.svg';
import FaceSmile from 'heroicons/24/outline/face-smile.svg';
import Photo from 'heroicons/24/outline/photo.svg';
import XMark from 'heroicons/24/outline/x-mark.svg';
import PaperAirplane from 'heroicons/24/solid/paper-airplane.svg';
import uniq from 'lodash/uniq';
import { type Event as NostrEvent } from 'nostr-tools/pure';

import TextNote from '@/components/event/TextNote';
import useEmojiPicker, { type EmojiData } from '@/components/useEmojiPicker';
import UserNameDisplay from '@/components/UserDisplayName';
import useConfig from '@/core/useConfig';
import useEmojiComplete from '@/hooks/useEmojiComplete';
import { useTranslation } from '@/i18n/useTranslation';
import createTextNote, { type CreateTextNoteParams } from '@/nostr/builder/createTextNote';
import { textNote } from '@/nostr/event';
import useTextNoteMutation from '@/nostr/mutation/useTextNoteMutation';
import useUploadFilesMutation, {
  type UseUploadFilesMutationResult,
} from '@/nostr/mutation/useUploadFilesMutation';
import parseTextNote, { type ParsedTextNote } from '@/nostr/parseTextNote';
import usePubkey from '@/nostr/usePubkey';
import { getErrorMessage } from '@/utils/error';
import { placeholderOf, placeholderRegex, replacePlaceholders } from '@/utils/mediaPlaceholder';
// import usePersistStatus from '@/hooks/usePersistStatus';

type NotePostFormProps = {
  replyTo?: NostrEvent;
  mode?: 'normal' | 'reply';
  closable?: boolean;
  onClose: () => void;
  onPost?: () => void;
  textAreaRef?: (textAreaRef: HTMLTextAreaElement) => void;
};

type Attachment = {
  file: File;
  previewUrl: string;
  // set once uploaded, so that a retry does not upload it again
  url?: string;
};

type MediaKind = 'image' | 'video';

const mediaKindOf = (file: File): MediaKind => (file.type.startsWith('video/') ? 'video' : 'image');

const extract = (parsed: ParsedTextNote) => {
  const hashtags: string[] = [];
  const pubkeyReferences: string[] = [];
  const eventReferences: string[] = [];
  const urlReferences: string[] = [];
  const emojis: string[] = [];

  parsed.forEach((node) => {
    if (node.type === 'URL') {
      urlReferences.push(node.content);
    } else if (node.type === 'HashTag') {
      hashtags.push(node.tagName);
    } else if (node.type === 'Bech32Entity') {
      if (node.data.type === 'npub') {
        pubkeyReferences.push(node.data.data);
      } else if (node.data.type === 'note') {
        eventReferences.push(node.data.data);
      } else if (node.data.type === 'nevent') {
        eventReferences.push(node.data.data.id);
      }
      // TODO nevent can contain an event not only textnote (kind:1).
      // In my understanding, it is not allowed to include other kinds of events in `tags`.
      // It is needed to verify that the kind of the event is 1.
    } else if (node.type === 'CustomEmoji' && !emojis.includes(node.shortcode)) {
      emojis.push(node.shortcode);
    }
  });

  return {
    hashtags,
    urlReferences,
    pubkeyReferences,
    eventReferences,
    emojis,
  };
};

const format = (parsed: ParsedTextNote) => {
  const content: string[] = [];
  parsed.forEach((node) => {
    if (node.type === 'Bech32Entity' && !node.isNIP19) {
      content.push(`nostr:${node.content}`);
    } else {
      content.push(node.content);
    }
  });
  return content.join('');
};

const NotePostForm: Component<NotePostFormProps> = (props) => {
  const i18n = useTranslation();

  let textAreaRef: HTMLTextAreaElement | undefined;
  let contentWarningReasonRef: HTMLInputElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const { elementRef: emojiTextAreaRef } = useEmojiComplete();
  const [text, setText] = createSignal<string>('');
  const [contentWarning, setContentWarning] = createSignal(false);
  const [contentWarningReason, setContentWarningReason] = createSignal('');
  const [imetaTags, setImetaTags] = createSignal<Record<string, string[]>>({});
  const [lastUsedHashTags, setLastUsedHashTags] = createSignal<string[]>([]);
  // files attached but not posted yet, keyed by the label in their placeholder
  const [attachments, setAttachments] = createSignal<Record<string, Attachment>>({});
  // labels are never reused in a draft, so a placeholder cut and pasted back keeps its file
  let lastNumbers: Record<MediaKind, number> = { image: 0, video: 0 };

  // replaces the selection (or inserts at the caret) and moves the caret after the inserted text.
  // surrounds it with spaces unless already separated
  const insertTextAtCursor = (s: string) => {
    const current = text();
    const start = textAreaRef?.selectionStart ?? current.length;
    const end = textAreaRef?.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const leading = before === '' || /\s$/.test(before) ? '' : ' ';
    const trailing = after === '' || /^\s/.test(after) ? '' : ' ';
    const inserted = `${leading}${s}${trailing}`;
    setText(`${before}${inserted}${after}`);
    const caret = before.length + inserted.length;
    textAreaRef?.setSelectionRange(caret, caret);
  };

  const revokeAttachments = () => {
    Object.values(attachments()).forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  };

  onCleanup(revokeAttachments);

  const resetText = () => {
    revokeAttachments();
    setAttachments({});
    lastNumbers = { image: 0, video: 0 };
    setText(
      lastUsedHashTags()
        .map((e) => ` #${e}`)
        .join(''),
    );
    setContentWarningReason('');
    setContentWarning(false);
    setImetaTags({});
  };

  const close = () => {
    textAreaRef?.blur();
    resetText();
    props.onClose();
  };

  const placeholder = (mode: NotePostFormProps['mode']) => {
    switch (mode) {
      case 'reply':
        return i18n.t('posting.placeholderReply');
      case 'normal':
      default:
        return i18n.t('posting.placeholder');
    }
  };

  const { getEmoji } = useConfig();
  // const { persistStatus, didAgreeToToS, agreeToToS } = usePersistStatus();
  const getPubkey = usePubkey();

  const replyTo = () => props.replyTo && textNote(props.replyTo);
  const mode = () => props.mode ?? 'normal';

  const { publishTextNote } = useTextNoteMutation();

  const resizeTextArea = () => {
    if (textAreaRef == null) return;
    textAreaRef.style.height = 'auto';
    textAreaRef.style.height = `${textAreaRef.scrollHeight}px`;
  };

  const uploadFilesMutation = useUploadFilesMutation(() => ({}));

  const nextLabel = (kind: MediaKind) => {
    lastNumbers[kind] += 1;
    while (text().includes(placeholderOf(`${kind}${lastNumbers[kind]}`))) {
      lastNumbers[kind] += 1;
    }
    return `${kind}${lastNumbers[kind]}`;
  };

  // files are uploaded on submit; until then a placeholder stands for each of them
  const attachFiles = (files: File[]) => {
    const added: Record<string, Attachment> = {};
    files.forEach((file) => {
      added[nextLabel(mediaKindOf(file))] = { file, previewUrl: URL.createObjectURL(file) };
    });
    setAttachments((current) => ({ ...current, ...added }));
    insertTextAtCursor(Object.keys(added).map(placeholderOf).join(' '));
    resizeTextArea();
  };

  const usedAttachments = (): [string, Attachment][] =>
    uniq([...text().matchAll(placeholderRegex)].map((match) => match[1])).flatMap(
      (label): [string, Attachment][] => {
        const attachment = attachments()[label];
        return attachment != null ? [[label, attachment]] : [];
      },
    );

  const uploadAttachments = async (): Promise<boolean> => {
    const pending = usedAttachments().filter(([, { url }]) => url == null);
    if (pending.length === 0) return true;

    let result: UseUploadFilesMutationResult;
    try {
      result = await uploadFilesMutation.mutateAsync(pending.map(([, { file }]) => file));
    } catch (err) {
      window.alert(getErrorMessage(err));
      return false;
    }

    const uploadedUrls = new Map(result.uploadedFiles);
    setAttachments((current) =>
      Object.fromEntries(
        Object.entries(current).map(([label, attachment]) => [
          label,
          { ...attachment, url: attachment.url ?? uploadedUrls.get(attachment.file) },
        ]),
      ),
    );
    setImetaTags((current) => ({ ...current, ...result.uploadedImetaTags }));

    if (result.failed.length > 0) {
      const filenames = result.failed.map(([f, reason]) => `${f.name}: ${reason}`).join('\n');
      window.alert(i18n.t('posting.failedToUploadFile', { filenames }));
      return false;
    }
    return true;
  };

  const taggedPubkeysWithoutMe = createMemo(() => {
    const p = getPubkey();
    return (
      replyTo()
        ?.taggedPubkeys()
        ?.filter((pubkey) => pubkey !== p) ?? []
    );
  });

  const notifyPubkeys = createMemo(() => {
    if (props.replyTo == null) return [];
    return uniq([
      // 返信先を先頭に
      props.replyTo.pubkey,
      // その他の返信先
      ...taggedPubkeysWithoutMe(),
    ]);
  });

  const buildEmojiTags = (emojis: string[]): string[][] => {
    const emojiTags: string[][] = [];

    emojis.forEach((shortcode) => {
      const emoji = getEmoji(shortcode);
      if (emoji != null) {
        emojiTags.push(['emoji', shortcode, emoji.url]);
      }
    });

    return emojiTags;
  };

  const buildTextNoteParams = (pubkey: string, content: string): CreateTextNoteParams => {
    const parsed = parseTextNote(content);
    const { hashtags, urlReferences, pubkeyReferences, eventReferences, emojis } = extract(parsed);
    const formattedContent = format(parsed);
    const emojiTags = buildEmojiTags(emojis);
    const usedImetaTags = Object.entries(imetaTags())
      .filter(([url]) => urlReferences.includes(url))
      .map(([, imetaTag]) => imetaTag);

    let textNoteParams: CreateTextNoteParams = {
      pubkey,
      content: formattedContent,
      notifyPubkeys: pubkeyReferences,
      mentionEventIds: eventReferences,
      hashtags,
      urls: urlReferences,
      tags: [...emojiTags, ...usedImetaTags],
    };

    if (replyTo() != null) {
      textNoteParams = {
        ...textNoteParams,
        notifyPubkeys: uniq([
          ...notifyPubkeys(),
          ...pubkeyReferences, // 本文中の公開鍵（npub)
        ]),
        rootEventId: replyTo()?.rootEvent()?.id ?? replyTo()?.replyingToEvent()?.id,
        replyEventId: replyTo()?.id,
      };
    }

    if (contentWarning()) {
      textNoteParams = {
        ...textNoteParams,
        contentWarning: contentWarningReason(),
      };
    }

    return textNoteParams;
  };

  const submit = async () => {
    if (text().length === 0 || uploadFilesMutation.isPending) return;

    if (/nsec1[0-9a-zA-Z]+|ncryptosec[0-9a-zA-Z]+|nokakoi:[0-9a-fA-F]+/.test(text())) {
      window.alert(i18n.t('posting.forbiddenToIncludeNsec'));
      return;
    }

    const pubkey = getPubkey();
    if (pubkey == null) {
      console.error('pubkey is not available');
      return;
    }

    // keeps the form open until the upload succeeds; on failure the text and files stay
    if (!(await uploadAttachments())) return;

    const uploaded = attachments();
    const content = replacePlaceholders(text(), (label) => uploaded[label]?.url);
    const textNoteParams = buildTextNoteParams(pubkey, content);
    setLastUsedHashTags(textNoteParams.hashtags ?? []);

    publishTextNote(textNoteParams).catch((err) => {
      window.alert(getErrorMessage(err));
    });
    resetText();
    props.onPost?.();
    close();
  };

  const previewEvent = createMemo((): NostrEvent | undefined => {
    const pubkey = getPubkey();
    if (pubkey == null || text().trim().length === 0) return undefined;
    return { ...createTextNote(buildTextNoteParams(pubkey, text())), id: '', sig: '' };
  });

  const previewMedia = createMemo(() =>
    Object.fromEntries(
      Object.entries(attachments())
        .filter(([, { file }]) => /^(image|video)\//.test(file.type))
        .map(([label, { file, previewUrl }]) => [
          placeholderOf(label),
          { type: mediaKindOf(file), url: previewUrl },
        ]),
    ),
  );

  const handleInput: JSX.EventHandler<HTMLTextAreaElement, InputEvent> = (ev) => {
    setText(ev.currentTarget.value);
    resizeTextArea();
  };

  const handleEmojiSelect = (emoji: EmojiData) => {
    insertTextAtCursor(emoji.native ?? `:${emoji.id}:`);
    textAreaRef?.focus();
  };

  const handleSubmit: JSX.EventHandler<HTMLFormElement, Event> = (ev) => {
    ev.preventDefault();
    submit().catch((err) => console.error(err));
  };

  const handleKeyDown: JSX.EventHandlerUnion<HTMLTextAreaElement, KeyboardEvent> = (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      submit().catch((err) => console.error(err));
    } else if (ev.key === 'Escape' && !uploadFilesMutation.isPending) {
      textAreaRef?.blur();
      close();
    }
  };

  /*
    const ensureUploaderAgreement = (): boolean => true;
    if (didAgreeToToS('nostrBuild')) return true;

    window.alert(
      '画像アップローダーの利用規約をお読みください。\n（新しいタブで利用規約を開きます）',
    );
    openLink(uploaders.nostrBuild.tos);
    const didAgree = window.confirm('同意する場合はOKをクリックしてください。');

    if (didAgree) {
      agreeToToS('nostrBuild');
    }

    return didAgree;
     */
  const handleChangeFile: JSX.EventHandler<HTMLInputElement, Event> = (ev) => {
    ev.preventDefault();
    if (uploadFilesMutation.isPending) return;
    // if (!ensureUploaderAgreement()) return;

    const { files } = ev.currentTarget;
    if (files == null || files.length === 0) return;

    attachFiles([...files]);

    ev.currentTarget.value = '';
  };

  const handleDrop: JSX.EventHandler<HTMLTextAreaElement, DragEvent> = (ev) => {
    ev.preventDefault();
    if (uploadFilesMutation.isPending) return;
    // if (!ensureUploaderAgreement()) return;

    const files = ev?.dataTransfer?.files;
    if (files == null || files.length === 0) return;

    attachFiles([...files]);
  };

  const handlePaste: JSX.EventHandler<HTMLTextAreaElement, ClipboardEvent> = (ev) => {
    if (uploadFilesMutation.isPending) return;

    const items = ev?.clipboardData?.items;
    if (items == null || items.length === 0) return;

    const files: File[] = [];
    Array.from(items).forEach((item) => {
      if (item.kind === 'file') {
        ev.preventDefault();
        const file = item.getAsFile();
        if (file == null) return;
        files.push(file);
      }
    });
    if (files.length === 0) return;
    // if (!ensureUploaderAgreement()) return;

    attachFiles(files);
  };

  const handleDragOver: JSX.EventHandler<HTMLTextAreaElement, DragEvent> = (ev) => {
    ev.preventDefault();
  };

  const submitDisabled = () => text().trim().length === 0 || uploadFilesMutation.isPending;

  const fileUploadDisabled = () => uploadFilesMutation.isPending;

  const emojiPickerPopup = useEmojiPicker(() => ({
    customEmojis: true,
    onEmojiSelect: handleEmojiSelect,
  }));

  return (
    <div class="p-1">
      <Show when={props.replyTo != null}>
        <div>
          {i18n.t('posting.replyToPre')}
          <For each={notifyPubkeys()}>
            {(pubkey, index) => (
              <>
                <UserNameDisplay pubkey={pubkey} />
                <Show when={index() !== notifyPubkeys().length - 1}> と </Show>
              </>
            )}
          </For>
          {i18n.t('posting.replyToPost')}
        </div>
      </Show>
      <form class="flex flex-col gap-1" onSubmit={handleSubmit}>
        <Show when={contentWarning()}>
          <input
            ref={contentWarningReasonRef}
            type="text"
            class="rounded-md border border-border bg-bg ring-border placeholder:text-fg-secondary focus:border-border focus:ring-primary"
            placeholder={i18n.t('posting.contentWarningReason')}
            maxLength={32}
            onInput={(ev) => setContentWarningReason(ev.currentTarget.value)}
            value={contentWarningReason()}
          />
        </Show>
        <textarea
          ref={(el) => {
            textAreaRef = el;
            props.textAreaRef?.(el);
            emojiTextAreaRef(el);
          }}
          name="text"
          class="scrollbar max-h-[40vh] min-h-16 overflow-y-auto rounded-md border border-border bg-bg wrap-break-word whitespace-pre-wrap ring-border placeholder:text-fg-secondary focus:border-border focus:ring-primary"
          rows={4}
          placeholder={placeholder(mode())}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
          readOnly={uploadFilesMutation.isPending}
          value={text()}
        />
        <div class="flex items-end justify-end gap-1">
          <Show when={mode() === 'reply' || props.closable}>
            <button
              class="flex items-center"
              classList={{
                'h-9': mode() === 'normal',
                'w-9': mode() === 'normal',
                'h-8': mode() === 'reply',
                'w-8': mode() === 'reply',
              }}
              type="button"
              aria-label={i18n.t('posting.close')}
              title={i18n.t('posting.close')}
              disabled={uploadFilesMutation.isPending}
              onClick={() => close()}
            >
              <span class="inline-block size-5 text-fg-secondary/70">
                <XMark />
              </span>
            </button>
          </Show>
          <span class="flex-1" />
          <Show when={uploadFilesMutation.isPending}>
            <span class="self-center text-xs text-fg-secondary">{i18n.t('posting.sending')}</span>
          </Show>
          <button
            ref={emojiPickerPopup.targetRef}
            class="inline-block rounded-sm bg-primary text-primary-fg"
            classList={{
              'h-9': mode() === 'normal',
              'w-9': mode() === 'normal',
              'p-2': mode() === 'normal',
              'h-7': mode() === 'reply',
              'w-7': mode() === 'reply',
              'p-[6px]': mode() === 'reply',
            }}
            type="button"
            aria-label={i18n.t('posting.emojiPicker')}
            title={i18n.t('posting.emojiPicker')}
            onClick={() => emojiPickerPopup.open()}
          >
            <FaceSmile />
          </button>
          {emojiPickerPopup.popup()}
          <button
            class="rounded-sm text-primary-fg"
            classList={{
              'bg-primary': !contentWarning(),
              'bg-primary-hover': contentWarning(),
              'h-9': mode() === 'normal',
              'w-9': mode() === 'normal',
              'p-2': mode() === 'normal',
              'h-7': mode() === 'reply',
              'w-7': mode() === 'reply',
              'p-[6px]': mode() === 'reply',
            }}
            type="button"
            aria-label={i18n.t('posting.contentWarning')}
            title={i18n.t('posting.contentWarning')}
            onClick={() => {
              setContentWarning((e) => !e);
              contentWarningReasonRef?.focus();
            }}
          >
            <ExclamationTriangle />
          </button>
          <button
            class="rounded-sm text-primary-fg"
            classList={{
              'bg-primary-disabled': fileUploadDisabled(),
              'bg-primary': !fileUploadDisabled(),
              'h-9': mode() === 'normal',
              'w-9': mode() === 'normal',
              'p-2': mode() === 'normal',
              'h-7': mode() === 'reply',
              'w-7': mode() === 'reply',
              'p-[6px]': mode() === 'reply',
            }}
            type="button"
            title={i18n.t('posting.uploadImage')}
            aria-label={i18n.t('posting.uploadImage')}
            disabled={fileUploadDisabled()}
            onClick={() => fileInputRef?.click()}
          >
            <Photo />
          </button>
          <button
            class="rounded-sm p-2 text-primary-fg"
            classList={{
              'bg-primary-disabled': submitDisabled(),
              'bg-primary': !submitDisabled(),
              'h-9': mode() === 'normal',
              'w-9': mode() === 'normal',
              'h-7': mode() === 'reply',
              'w-7': mode() === 'reply',
            }}
            type="submit"
            aria-label={i18n.t('posting.submit')}
            title={i18n.t('posting.submit')}
            disabled={submitDisabled()}
          >
            <PaperAirplane />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          name="image"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
          onChange={handleChangeFile}
        />
      </form>
      <Show when={previewEvent()}>
        {(event) => (
          <div
            class="rounded-md border border-border p-1"
            classList={{ 'mt-9': mode() === 'normal', 'mt-7': mode() === 'reply' }}
          >
            <TextNote event={event()} actions={false} localMedia={previewMedia()} />
          </div>
        )}
      </Show>
    </div>
  );
};

export default NotePostForm;
