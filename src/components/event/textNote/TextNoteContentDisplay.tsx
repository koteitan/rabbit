import { createMemo, For } from 'solid-js';

import escapeRegExp from 'lodash/escapeRegExp';
import * as Kind from 'nostr-tools/kinds';

import EventDisplayById from '@/components/event/EventDisplayById';
// import ParameterizedReplaceableEventDisplayById from '@/components/event/ParameterizedReplaceableEventDisplayById';
import AudioDisplay from '@/components/event/textNote/AudioDisplay';
import ImageDisplay from '@/components/event/textNote/ImageDisplay';
import MentionedEventDisplay from '@/components/event/textNote/MentionedEventDisplay';
import MentionedUserDisplay from '@/components/event/textNote/MentionedUserDisplay';
import PreviewedLink from '@/components/event/textNote/PreviewedLink';
import VideoDisplay from '@/components/event/textNote/VideoDisplay';
import EventLink from '@/components/EventLink';
import useEmojiPopup from '@/components/useEmojiPopup';
import SafeLink from '@/components/utils/SafeLink';
import { createRelaysColumn, createSearchColumn } from '@/core/column';
import useConfig from '@/core/useConfig';
import { useRequestCommand } from '@/hooks/useCommandBus';
import {
  type ParsedTextNoteResolvedNode,
  type ParsedTextNoteResolved,
} from '@/nostr/parseTextNote';
import reuseUnchangedItems from '@/utils/reuseUnchangedItems';
import { isImageUrl, isVideoUrl, isAudioUrl, isWebSocketUrl, isSafeUrl } from '@/utils/url';

export type LocalMedia = {
  type: 'image' | 'video';
  url: string;
};

export type TextNoteContentDisplayProps = {
  parsed: ParsedTextNoteResolved;
  embedding: boolean;
  initialHidden?: boolean;
  // maps a placeholder in the text to local media shown in its place
  localMedia?: Record<string, LocalMedia>;
};

const splitByPlaceholders = (text: string, placeholders: string[]): string[] => {
  if (placeholders.length === 0) return [text];
  const pattern = new RegExp(`(${placeholders.map(escapeRegExp).join('|')})`, 'g');
  return text.split(pattern).filter((part) => part !== '');
};

const TextNoteContentDisplay = (props: TextNoteContentDisplayProps) => {
  const { config, saveColumn } = useConfig();

  const request = useRequestCommand();

  const addHashTagColumn = (query: string) => {
    saveColumn(createSearchColumn({ query }));
    request({ command: 'moveToLastColumn' }).catch((err) => console.error(err));
  };

  const addRelayColumn = (url: string) => {
    saveColumn(createRelaysColumn({ name: url, relayUrls: [url] }));
    request({ command: 'moveToLastColumn' }).catch((err) => console.error(err));
  };

  // the post preview gives a new array for every keystroke. Placeholders become their own nodes
  // and unchanged nodes are reused, so that their cards, images and videos are not created again.
  const nodes = createMemo<ParsedTextNoteResolved>((prev) => {
    const placeholders = Object.keys(props.localMedia ?? {});
    const split = props.parsed.flatMap((node): ParsedTextNoteResolved => {
      if (node.type !== 'PlainText') return [node];
      return splitByPlaceholders(node.content, placeholders).map((content) => ({
        type: 'PlainText',
        content,
      }));
    });
    return reuseUnchangedItems(prev, split);
  }, []);

  // an own property only: text such as `constructor` would be found on the prototype
  const localMediaOf = (text: string): LocalMedia | undefined =>
    props.localMedia != null && Object.hasOwn(props.localMedia, text)
      ? props.localMedia[text]
      : undefined;

  return (
    <For each={nodes()}>
      {(item: ParsedTextNoteResolvedNode) => {
        if (item.type === 'PlainText') {
          const media = localMediaOf(item.content);
          if (media == null) return <span>{item.content}</span>;
          if (media.type === 'video') {
            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                class="my-2 block max-h-64 max-w-full rounded-sm object-contain shadow-sm"
                src={media.url}
                controls
              />
            );
          }
          return (
            <img
              class="my-2 block max-h-64 max-w-full rounded-sm object-contain shadow-sm"
              src={media.url}
              alt={item.content}
            />
          );
        }
        if (item.type === 'URL') {
          const initialHidden = () =>
            !config().showMedia || !props.embedding || (props.initialHidden ?? false);

          if (!isSafeUrl(item.content)) {
            return <SafeLink class="text-link underline" href={item.content} />;
          }

          if (isImageUrl(item.content)) {
            return <ImageDisplay url={item.content} initialHidden={initialHidden()} />;
          }
          if (isVideoUrl(item.content)) {
            return <VideoDisplay url={item.content} initialHidden={initialHidden()} />;
          }
          if (isAudioUrl(item.content)) {
            return <AudioDisplay url={item.content} initialHidden={initialHidden()} />;
          }
          if (isWebSocketUrl(item.content)) {
            return (
              <button
                class="text-link underline select-text"
                onClick={() => addRelayColumn(item.content)}
              >
                {item.content}
              </button>
            );
          }
          return <PreviewedLink url={item.content} initialHidden={initialHidden()} />;
        }
        if (item.type === 'TagReferenceResolved') {
          if (item.reference == null) {
            return <span>{item.content}</span>;
          }
          if (item.reference.type === 'MentionedUser') {
            return <MentionedUserDisplay pubkey={item.reference.pubkey} />;
          }
          if (item.reference.type === 'MentionedEvent') {
            if (props.embedding) {
              return <MentionedEventDisplay mentionedEvent={item.reference} />;
            }
            return <EventLink eventId={item.reference.eventId} />;
          }
        }
        if (item.type === 'Bech32Entity') {
          if (item.data.type === 'note' && props.embedding) {
            return (
              <div class="my-1 rounded-sm border border-border p-1">
                <EventDisplayById
                  eventId={item.data.data}
                  actions={false}
                  embedding={false}
                  ensureKinds={[Kind.ShortTextNote]}
                />
              </div>
            );
          }
          if (item.data.type === 'nevent' && props.embedding) {
            return (
              <div class="my-1 rounded-sm border border-border p-1">
                <EventDisplayById eventId={item.data.data.id} actions={false} embedding={false} />
              </div>
            );
          }
          if (item.data.type === 'npub') {
            return <MentionedUserDisplay pubkey={item.data.data} />;
          }
          if (item.data.type === 'nprofile') {
            return <MentionedUserDisplay pubkey={item.data.data.pubkey} />;
          }
          return <span class="text-link underline">{item.content}</span>;
        }
        if (item.type === 'HashTag') {
          return (
            <button
              class="text-link underline select-text"
              onClick={() => addHashTagColumn(item.content)}
            >
              {item.content}
            </button>
          );
        }
        if (item.type === 'CustomEmojiResolved') {
          const { url, shortcode, content } = item;
          if (url == null) return <span>{item.content}</span>;
          // const { imageRef, canvas } = useImageAnimation({ initialPlaying: false });
          const { emojiRef, popup } = useEmojiPopup(() => ({
            emoji: { type: 'CustomEmoji', url, shortcode },
          }));

          return (
            <>
              {popup()}
              <img
                ref={emojiRef}
                class="inline-block h-8 max-w-32"
                src={url}
                alt={content}
                title={shortcode}
              />
            </>
          );
        }
        console.error('Not all ParsedTextNoteNodes are covered', item);
        return null;
      }}
    </For>
  );
};

export default TextNoteContentDisplay;
