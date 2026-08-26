import { unzipSync } from 'fflate';

import { API_URL } from '../../../api/api';
import defaultManifest from '../../../../src-tauri/resources/idle-screens/default/manifest.json';
import defaultScreen from '../../../../src-tauri/resources/idle-screens/default/screen.json';
import digitalManifest from '../../../../src-tauri/resources/idle-screens/digital/manifest.json';
import digitalScreen from '../../../../src-tauri/resources/idle-screens/digital/screen.json';
import metCatManifest from '../../../../src-tauri/resources/idle-screens/metCat/manifest.json';
import metCatScreen from '../../../../src-tauri/resources/idle-screens/metCat/screen.json';
import type {
  IdleManifest,
  IdlePackageId,
  IdleScreenDefinition,
  IdleScreenDocument,
  IdleScreenMetadata
} from './types';

const BUILTIN_DEFINITIONS: IdleScreenDefinition[] = [
  makeDevDefinition(defaultManifest as unknown as IdleManifest, defaultScreen as unknown as IdleScreenDocument),
  makeDevDefinition(digitalManifest as unknown as IdleManifest, digitalScreen as unknown as IdleScreenDocument),
  makeDevDefinition(metCatManifest as unknown as IdleManifest, metCatScreen as unknown as IdleScreenDocument)
];

const metadataById = new Map<IdlePackageId, IdleScreenMetadata>();

export const LEGACY_DVD_METADATA: IdleScreenMetadata = {
  id: 'dvd',
  name: 'DVD Style',
  version: '1.0.0',
  packageHash: 'legacy',
  builtIn: true
};

export async function listIdleScreenPackages(): Promise<IdleScreenMetadata[]> {
  const response = await fetch(`${API_URL}/api/v1/idle-screens`);
  if (!response.ok) throw new Error(`idle screen list failed (${response.status})`);
  const payload = (await response.json()) as {
    screens?: Array<Omit<IdleScreenMetadata, 'builtIn'> & { valid?: boolean }>;
  };
  const custom = (payload.screens ?? [])
    .filter((screen) => screen.valid !== false)
    .map((screen): IdleScreenMetadata => ({
      id: screen.id,
      name: screen.name,
      version: screen.version,
      packageHash: screen.packageHash,
      builtIn: false
    }));
  const all = [...BUILTIN_DEFINITIONS.map(({ metadata }) => metadata), ...custom];
  all.forEach((metadata) => metadataById.set(metadata.id, metadata));
  return all;
}

export async function loadIdleScreenPackage(id: IdlePackageId): Promise<IdleScreenDefinition> {
  const builtIn = BUILTIN_DEFINITIONS.find((item) => item.metadata.id === id);
  if (builtIn) return builtIn;
  if (!id.startsWith('custom:')) throw new Error('idle screen package is unavailable');

  const response = await fetch(`${API_URL}/api/v1/idle-screens/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`idle screen bundle failed (${response.status})`);
  const bundleBytes = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(bundleBytes);
  const manifest = parseJsonFile<IdleManifest>(files, 'manifest.json');
  const screen = parseJsonFile<IdleScreenDocument>(files, 'screen.json');
  if (manifest.id !== id || screen.id !== id) {
    throw new Error('idle screen bundle ID does not match the request');
  }

  const assetUrls: Record<string, string> = {};
  try {
    for (const asset of manifest.assets) {
      if (!asset.path.startsWith('assets/') || asset.path.includes('..')) {
        throw new Error(`idle screen asset path is invalid: ${asset.id}`);
      }
      const bytes = files[asset.path];
      if (!bytes || bytes.byteLength !== asset.size) {
        throw new Error(`idle screen asset is missing or has the wrong size: ${asset.id}`);
      }
      if ((await sha256Hex(bytes)) !== asset.sha256.toLowerCase()) {
        throw new Error(`idle screen asset hash mismatch: ${asset.id}`);
      }
      const blobBytes = bytes.slice().buffer as ArrayBuffer;
      assetUrls[asset.id] = URL.createObjectURL(new Blob([blobBytes], { type: asset.mimeType }));
    }
  } catch (error) {
    Object.values(assetUrls).forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }

  const metadata = metadataById.get(id) ?? {
    id,
    name: manifest.name,
    version: manifest.version,
    packageHash: await sha256Hex(bundleBytes),
    builtIn: false
  };
  return { metadata, manifest, screen, assetUrls };
}

export function disposeIdleScreenPackage(definition: IdleScreenDefinition): void {
  Object.values(definition.assetUrls ?? {}).forEach((url) => URL.revokeObjectURL(url));
}

export function idleAssetUrl(definition: IdleScreenDefinition, assetId: string): string {
  const loadedAsset = definition.assetUrls?.[assetId];
  if (loadedAsset) return loadedAsset;
  if (definition.metadata.packageHash === 'dev') {
    if (assetId === 'wifi') return '/wifi.png';
    if (assetId === 'noWifi') return '/no-wifi.png';
    if (assetId === 'metcat') return '__builtin_metcat_lottie__';
  }
  throw new Error(`idle screen asset is unavailable: ${assetId}`);
}

function parseJsonFile<T>(files: Record<string, Uint8Array>, path: string): T {
  const bytes = files[path];
  if (!bytes) throw new Error(`idle screen bundle is missing ${path}`);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeDevDefinition(manifest: IdleManifest, screen: IdleScreenDocument): IdleScreenDefinition {
  return {
    metadata: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      packageHash: 'dev',
      builtIn: true
    },
    manifest,
    screen
  };
}
