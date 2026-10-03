import * as path from 'path';
import * as fs from 'fs';

export function ztteam_getStorageRoot(): string {
  return process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
}

export function ztteam_getReelsPath(...subpaths: string[]): string {
  return path.join(ztteam_getStorageRoot(), 'reels', ...subpaths);
}

export function ztteam_getImagesPath(...subpaths: string[]): string {
  return path.join(ztteam_getStorageRoot(), 'images', ...subpaths);
}

export function ztteam_getTemplatesPath(...subpaths: string[]): string {
  return path.join(ztteam_getStorageRoot(), 'templates', ...subpaths);
}

export function ztteam_getYoutubePath(...subpaths: string[]): string {
  return path.join(ztteam_getStorageRoot(), 'youtube', ...subpaths);
}

export function ztteam_ensureStorageDirs(): void {
  const root = ztteam_getStorageRoot();
  const dirs = [
    root,
    path.join(root, 'reels'),
    path.join(root, 'images'),
    path.join(root, 'templates'),
    path.join(root, 'youtube'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
