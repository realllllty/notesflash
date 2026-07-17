import type { ImageAsset } from './types';

const IMAGE_MARKER = /^\[\[notesflash-image:([A-Za-z0-9_-]+)\]\]$/;

export type NoteContentBlock =
  | { key: string; type: 'text'; text: string }
  | { key: string; type: 'image'; image: ImageAsset };

export function imageMarker(imageId: string): string {
  return `[[notesflash-image:${imageId}]]`;
}

export function parseNoteContent(body: string, images: ImageAsset[]): NoteContentBlock[] {
  const imagesById = new Map(images.map((image) => [image.id, image]));
  const referencedImages = new Set<string>();
  const blocks: NoteContentBlock[] = [];
  const textLines: string[] = [];

  const pushText = () => {
    blocks.push({ key: crypto.randomUUID(), type: 'text', text: textLines.join('\n') });
    textLines.length = 0;
  };

  for (const line of body.split('\n')) {
    const match = line.match(IMAGE_MARKER);
    const image = match ? imagesById.get(match[1]) : undefined;
    if (!match || !image) {
      textLines.push(line);
      continue;
    }

    pushText();
    blocks.push({ key: crypto.randomUUID(), type: 'image', image });
    referencedImages.add(image.id);
  }

  pushText();

  // Notes created by older versions stored every image as a trailing attachment.
  for (const image of images) {
    if (referencedImages.has(image.id)) continue;
    blocks.push({ key: crypto.randomUUID(), type: 'image', image });
    blocks.push({ key: crypto.randomUUID(), type: 'text', text: '' });
  }

  return blocks;
}

export function serializeNoteContent(blocks: NoteContentBlock[]): string {
  return blocks
    .map((block) => (block.type === 'text' ? block.text : imageMarker(block.image.id)))
    .join('\n');
}

export function contentImages(blocks: NoteContentBlock[]): ImageAsset[] {
  return blocks.flatMap((block) => (block.type === 'image' ? [block.image] : []));
}

export function bodyWithoutImageMarkers(body: string): string {
  return body
    .split('\n')
    .filter((line) => !IMAGE_MARKER.test(line))
    .join('\n');
}
