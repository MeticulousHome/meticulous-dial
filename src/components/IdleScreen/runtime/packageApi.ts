import { invoke } from '@tauri-apps/api/core';

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
  makeDevDefinition(
    defaultManifest as unknown as IdleManifest,
    defaultScreen as unknown as IdleScreenDocument
  ),
  makeDevDefinition(
    digitalManifest as unknown as IdleManifest,
    digitalScreen as unknown as IdleScreenDocument
  ),
  makeDevDefinition(
    metCatManifest as unknown as IdleManifest,
    metCatScreen as unknown as IdleScreenDocument
  )
];

export const LEGACY_DVD_METADATA: IdleScreenMetadata = {
  id: 'dvd',
  name: 'DVD Style',
  version: '1.0.0',
  packageHash: 'legacy',
  builtIn: true
};

export function isTauriRuntime(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export async function listIdleScreenPackages(): Promise<IdleScreenMetadata[]> {
  if (!isTauriRuntime()) {
    return BUILTIN_DEFINITIONS.map((definition) => definition.metadata);
  }
  return invoke<IdleScreenMetadata[]>('list_idle_screen_packages');
}

export async function loadIdleScreenPackage(
  id: IdlePackageId
): Promise<IdleScreenDefinition> {
  if (!isTauriRuntime()) {
    const definition = BUILTIN_DEFINITIONS.find(
      (item) => item.metadata.id === id
    );
    if (!definition) {
      throw new Error('idle screen package is unavailable');
    }
    return definition;
  }
  return invoke<IdleScreenDefinition>('load_idle_screen_package', { id });
}

export function idleAssetUrl(
  definition: IdleScreenDefinition,
  assetId: string
): string {
  if (definition.metadata.packageHash === 'dev') {
    if (assetId === 'wifi') return '/wifi.png';
    if (assetId === 'noWifi') return '/no-wifi.png';
    if (assetId === 'metcat') return '__builtin_metcat_lottie__';
  }
  return `idle-asset://localhost/${encodeURIComponent(
    definition.metadata.id
  )}/${definition.metadata.packageHash}/${encodeURIComponent(assetId)}`;
}

function makeDevDefinition(
  manifest: IdleManifest,
  screen: IdleScreenDocument
): IdleScreenDefinition {
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
