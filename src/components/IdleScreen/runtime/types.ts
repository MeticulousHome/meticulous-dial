export type IdlePackageId =
  | 'default'
  | 'digital'
  | 'metCat'
  | 'dvd'
  | 'baristaBarista'
  | `custom:${string}`;

export type IdleSource =
  | 'time'
  | 'settings'
  | 'wifi'
  | 'machine'
  | 'sensors'
  | 'notifications'
  | 'osStatus'
  | 'deviceInfo'
  | 'profiles';

export interface IdleScreenMetadata {
  id: IdlePackageId;
  name: string;
  version: string;
  packageHash: string;
  builtIn: boolean;
}

export interface IdleManifestAsset {
  id: string;
  path: string;
  kind: 'image' | 'font' | 'lottie';
  mimeType:
    | 'image/png'
    | 'image/jpeg'
    | 'image/webp'
    | 'font/woff2'
    | 'application/vnd.meticulous.lottie+json';
  size: number;
  sha256: string;
}

export interface IdleManifest {
  documentType: 'meticulous-idle-manifest';
  packageFormat: 1;
  id: IdlePackageId;
  name: string;
  version: string;
  runtimeApi: 1;
  description?: string;
  author?: string;
  screen: 'screen.json';
  preview: 'preview.png';
  assets: IdleManifestAsset[];
}

export interface IdleScreenDefinition {
  metadata: IdleScreenMetadata;
  manifest: IdleManifest;
  screen: IdleScreenDocument;
  assetUrls?: Record<string, string>;
}

export type DynamicValue =
  | string
  | number
  | boolean
  | null
  | { token: string }
  | { binding: IdleBinding };

export interface IdleBinding {
  source: IdleSource;
  path: string;
  formatter?: IdleFormatter;
  fallback?: string | number | boolean | null;
}

export interface IdleFormatter {
  type:
    | 'number'
    | 'unit'
    | 'date'
    | 'time'
    | 'duration'
    | 'boolean'
    | 'enum'
    | 'truncate';
  precision?: number;
  suffix?: string;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
  trueLabel?: string;
  falseLabel?: string;
  map?: Record<string, string>;
  maxLength?: number;
}

export interface IdleCondition {
  source: IdleSource;
  path: string;
  operator:
    | 'truthy'
    | 'falsy'
    | 'present'
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte';
  value?: string | number | boolean | null;
  fallback?: boolean;
}

export interface IdleTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface IdleRuntimePolicy {
  brightness: {
    onEnter: number;
    onExit: 1;
    cycleAfterMs?: number;
    dimValue?: number;
    brightValue?: number;
    dimDurationMs?: number;
    brightDurationMs?: number;
  };
  burnInProtection: {
    enabled: boolean;
    mode: 'rotate' | 'translate' | 'none';
    durationMs: number;
    distance: number;
  };
}

export interface IdleTokens {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  numbers: Record<string, number>;
}

export interface IdleLayerBase {
  id: string;
  type: string;
  name?: string;
  transform: IdleTransform;
  visible?: boolean | { binding: IdleBinding } | IdleCondition;
  opacity?: number | { binding: IdleBinding };
  locked?: boolean;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
}

export type IdleLayer =
  | IdleGroupLayer
  | IdleShapeLayer
  | IdleTextLayer
  | IdleImageLayer
  | IdleTickRingLayer
  | IdleAnalogHandLayer
  | IdlePivotLayer
  | IdlePivotCapLayer
  | IdleDigitalTimeLayer
  | IdleProgressArcLayer
  | IdleLottieLayer;

export interface IdleGroupLayer extends IdleLayerBase {
  type: 'group';
  clip?: 'none' | 'bounds' | 'circle';
  children: IdleLayer[];
}

export interface IdleShapeLayer extends IdleLayerBase {
  type: 'shape';
  shape: 'rectangle' | 'roundedRectangle' | 'circle' | 'line';
  fill?: DynamicValue;
  stroke?: DynamicValue;
  strokeWidth?: DynamicValue;
  cornerRadius?: DynamicValue;
}

export interface IdleFont {
  family: DynamicValue;
  asset?: string;
  size: DynamicValue;
  weight?: number;
  style?: 'normal' | 'italic';
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  tabularNumbers?: boolean;
}

export interface IdleTextLayer extends IdleLayerBase {
  type: 'text';
  text: DynamicValue;
  font: IdleFont;
  color: DynamicValue;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrap?: 'none' | 'word' | 'character';
  maxLines?: number;
}

export interface IdleImageLayer extends IdleLayerBase {
  type: 'image';
  asset: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none';
  variants?: { when: IdleCondition; asset: string }[];
}

export interface IdleTickRingLayer extends IdleLayerBase {
  type: 'tickRing';
  count: number;
  radius: DynamicValue;
  startAngle?: number;
  hourTicksOnly?: boolean;
  styles: {
    every: number;
    offset?: number;
    width: DynamicValue;
    length: DynamicValue;
    color: DynamicValue;
    radiusOffset?: number;
    rounded?: boolean;
  }[];
}

export interface IdleAnalogHandLayer extends IdleLayerBase {
  type: 'analogHand';
  pivot: { mode: 'center' } | { mode: 'custom'; target: string };
  timeUnit: 'hour' | 'minute' | 'second' | 'custom';
  rotation: DynamicValue;
  length: DynamicValue;
  width: DynamicValue;
  tailLength?: DynamicValue;
  shape: 'rectangle' | 'rounded' | 'tapered' | 'needle' | 'image';
  color?: DynamicValue;
  asset?: string;
  smooth?: boolean;
}

export interface IdlePivotLayer extends IdleLayerBase {
  type: 'pivot';
  point: { x: number; y: number };
}

export interface IdlePivotCapLayer extends IdleLayerBase {
  type: 'pivotCap';
  diameter: DynamicValue;
  color: DynamicValue;
  borderColor?: DynamicValue;
  borderWidth?: DynamicValue;
}

export interface IdleDigitalTimeLayer extends IdleLayerBase {
  type: 'digitalTime';
  template: 'HH:mm' | 'HH:mm:ss' | 'hh:mm a' | 'hh:mm:ss a' | 'stackedHM';
  hourMode: 'locale' | '12' | '24';
  font: IdleFont;
  color: DynamicValue;
  middayFont?: IdleFont;
  middayColor?: DynamicValue;
  separatorBlink?: boolean;
}

export interface IdleProgressArcLayer extends IdleLayerBase {
  type: 'progressArc';
  value: DynamicValue;
  minimum: number;
  maximum: number;
  startAngle: number;
  sweepAngle: number;
  strokeWidth: DynamicValue;
  color: DynamicValue;
  trackColor?: DynamicValue;
  rounded?: boolean;
}

export interface IdleLottieLayer extends IdleLayerBase {
  type: 'lottie';
  asset: string;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  segments?: {
    name: string;
    from: number;
    to: number;
    loop?: boolean;
    playOnce?: boolean;
  }[];
}

export interface IdleScreenDocument {
  documentType: 'meticulous-idle-screen';
  schemaVersion: 2;
  runtimeApi: 1;
  id: IdlePackageId;
  name: string;
  viewport: {
    width: 480;
    height: 480;
    shape: 'circle';
    background: DynamicValue;
    overflow: 'hidden';
  };
  runtime: IdleRuntimePolicy;
  tokens: IdleTokens;
  dataSources: { id: string; source: IdleSource; refreshMs?: number }[];
  layers: IdleLayer[];
}

export interface IdleDataContext {
  time: {
    now: Date;
    timestamp: number;
    hour: number;
    minute: number;
    second: number;
  };
  settings: Record<string, unknown>;
  wifi: {
    connected: boolean;
    mode?: string;
    ssid?: string;
  };
  machine: Record<string, unknown>;
  sensors: Record<string, unknown>;
  notifications: {
    count: number;
    hasNotifications: boolean;
    motorHot: boolean;
  };
  osStatus: Record<string, unknown>;
  deviceInfo: Record<string, unknown>;
  profiles: {
    count: number;
    lastName?: string;
  };
}
