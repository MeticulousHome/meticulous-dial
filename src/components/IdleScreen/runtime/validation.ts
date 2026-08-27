import Ajv from 'ajv/dist/2020';

import schema from '../../../../src-tauri/resources/idle-screen-schema/idle-screen.schema.json';
import type {
  IdleLayer,
  IdleManifest,
  IdleScreenDefinition,
  IdleScreenDocument
} from './types';

const SCREEN_LAYER_TYPES = new Set([
  'group',
  'shape',
  'text',
  'image',
  'tickRing',
  'analogHand',
  'pivotCap',
  'digitalTime',
  'progressArc',
  'lottie'
]);

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

ajv.addSchema(schema);
const validateScreenSchema = ajv.getSchema(`${schema.$id}#/$defs/screen`);
if (!validateScreenSchema) {
  throw new Error('idle screen schema definition is unavailable');
}

export function validateIdleScreenDefinition(
  definition: IdleScreenDefinition
): IdleScreenDocument {
  const { manifest, screen } = definition;
  if (!validateScreenSchema(screen)) {
    const details = ajv.errorsText(validateScreenSchema.errors, {
      separator: '; '
    });
    throw new Error(`idle screen schema validation failed: ${details}`);
  }
  validateScreenSemantics(manifest, screen);
  return screen;
}

export function validateScreenSemantics(
  manifest: IdleManifest,
  screen: IdleScreenDocument
): void {
  if (manifest.id !== screen.id) {
    throw new Error('idle screen id does not match manifest id');
  }
  if (manifest.runtimeApi !== screen.runtimeApi) {
    throw new Error('idle screen runtime API does not match manifest');
  }

  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const ids = new Set<string>();
  forEachLayer(screen.layers, (layer) => {
    if (ids.has(layer.id)) {
      throw new Error(`duplicate idle layer id: ${layer.id}`);
    }
    ids.add(layer.id);
    if (!SCREEN_LAYER_TYPES.has(layer.type)) {
      throw new Error(`unsupported idle layer type: ${layer.type}`);
    }
    validateLayerAssets(layer, assets);
  });
}

export function forEachLayer(
  layers: IdleLayer[],
  callback: (layer: IdleLayer) => void
): void {
  for (const layer of layers) {
    callback(layer);
    if (layer.type === 'group') {
      forEachLayer(layer.children, callback);
    }
  }
}

function validateLayerAssets(
  layer: IdleLayer,
  assets: Map<string, IdleManifest['assets'][number]>
): void {
  if (layer.type === 'image') {
    requireAsset(assets, layer.asset, 'image');
    layer.variants?.forEach((variant) =>
      requireAsset(assets, variant.asset, 'image')
    );
  }
  if (layer.type === 'analogHand' && layer.shape === 'image') {
    if (!layer.asset)
      throw new Error(`analog hand ${layer.id} is missing image asset`);
    requireAsset(assets, layer.asset, 'image');
  }
  if (layer.type === 'lottie') {
    requireAsset(assets, layer.asset, 'lottie');
  }
  if ('font' in layer && layer.font.asset) {
    requireAsset(assets, layer.font.asset, 'font');
  }
  if (layer.type === 'digitalTime') {
    if (layer.middayFont?.asset)
      requireAsset(assets, layer.middayFont.asset, 'font');
  }
}

function requireAsset(
  assets: Map<string, IdleManifest['assets'][number]>,
  id: string,
  kind: IdleManifest['assets'][number]['kind']
): void {
  const asset = assets.get(id);
  if (!asset || asset.kind !== kind) {
    throw new Error(`idle asset ${id} is missing or has the wrong kind`);
  }
}
