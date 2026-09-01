export const AVATAR_CROP_SIZE = 272;
export const AVATAR_OUTPUT_SIZE = 512;

export type AvatarOffset = { x: number; y: number };

export function clampAvatarOffset(
  offset: AvatarOffset,
  image: { width: number; height: number },
  zoom: number,
) {
  const scale = Math.max(
    AVATAR_CROP_SIZE / image.width,
    AVATAR_CROP_SIZE / image.height,
  ) * zoom;
  const maxX = Math.max(0, (image.width * scale - AVATAR_CROP_SIZE) / 2);
  const maxY = Math.max(0, (image.height * scale - AVATAR_CROP_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}
