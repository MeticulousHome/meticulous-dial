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
  x: DynamicValue;
  y: DynamicValue;
  width: DynamicValue;
  height: DynamicValue;
  rotation?: DynamicValue;
  anchorX?: DynamicValue;
  anchorY?: DynamicValue;
  scaleX?: DynamicValue;
  scaleY?: DynamicValue;
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
  strings: Record<string, string>;
  booleans: Record<string, boolean>;
}

export interface IdleLayerBase {
  id: string;
  type: string;
  name?: string;
  transform: IdleTransform;
  visible?: boolean | { binding: IdleBinding } | IdleCondition;
  opacity?: DynamicValue;
  locked?: boolean;
  blendMode?: DynamicValue;
}

export type IdleLayer =
  | IdleGroupLayer
  | IdleShapeLayer
  | IdleTextLayer
  | IdleImageLayer
  | IdleTickRingLayer
  | IdleAnalogHandLayer
  | IdlePivotCapLayer
  | IdleDigitalTimeLayer
  | IdleProgressArcLayer
  | IdleLottieLayer;

export interface IdleGroupLayer extends IdleLayerBase {
  type: 'group';
  clip?: DynamicValue;
  children: IdleLayer[];
}

export interface IdleShapeLayer extends IdleLayerBase {
  type: 'shape';
  shape: DynamicValue;
  fill?: DynamicValue;
  stroke?: DynamicValue;
  strokeWidth?: DynamicValue;
  cornerRadius?: DynamicValue;
}

export interface IdleFont {
  family: DynamicValue;
  asset?: string;
  size: DynamicValue;
  weight?: DynamicValue;
  style?: DynamicValue;
  align?: DynamicValue;
  lineHeight?: DynamicValue;
  tabularNumbers?: DynamicValue;
}

export interface IdleTextLayer extends IdleLayerBase {
  type: 'text';
  text: DynamicValue;
  font: IdleFont;
  color: DynamicValue;
  verticalAlign?: DynamicValue;
  wrap?: DynamicValue;
  maxLines?: DynamicValue;
}

export interface IdleImageLayer extends IdleLayerBase {
  type: 'image';
  asset: string;
  fit?: DynamicValue;
  variants?: { when: IdleCondition; asset: string }[];
}

export interface IdleTickRingLayer extends IdleLayerBase {
  type: 'tickRing';
  count: DynamicValue;
  radius: DynamicValue;
  startAngle?: DynamicValue;
  hourTicksOnly?: DynamicValue;
  styles: {
    every: DynamicValue;
    offset?: DynamicValue;
    width: DynamicValue;
    length: DynamicValue;
    color: DynamicValue;
    radiusOffset?: DynamicValue;
    rounded?: DynamicValue;
  }[];
}

export interface IdleAnalogHandLayer extends IdleLayerBase {
  type: 'analogHand';
  pivot: { x: DynamicValue; y: DynamicValue };
  distanceFromCenter: DynamicValue;
  timeUnit: DynamicValue;
  rotation: DynamicValue;
  length: DynamicValue;
  width: DynamicValue;
  tailLength?: DynamicValue;
  shape: DynamicValue;
  color?: DynamicValue;
  asset?: string;
  smooth?: DynamicValue;
}

export interface IdlePivotCapLayer extends IdleLayerBase {
  type: 'pivotCap';
  diameter: DynamicValue;
  color: DynamicValue;
  borderColor?: DynamicValue;
  borderWidth?: DynamicValue;
}

export type IdleDigitalTimeTemplate =
  | 'HH:mm'
  | 'HH:mm:ss'
  | 'mm:ss'
  | 'mm'
  | 'HH'
  | 'ss'
  | 'hh:mm a'
  | 'hh:mm:ss a'
  | 'stackedHM';

export type IdleHourMode = 'locale' | '12' | '24';

export interface IdleDigitalTimeLayer extends IdleLayerBase {
  type: 'digitalTime';
  template: DynamicValue;
  hourMode: DynamicValue;
  font: IdleFont;
  color: DynamicValue;
  middayFont?: IdleFont;
  middayColor?: DynamicValue;
  separatorBlink?: DynamicValue;
}

export interface IdleProgressArcLayer extends IdleLayerBase {
  type: 'progressArc';
  value: DynamicValue;
  minimum: DynamicValue;
  maximum: DynamicValue;
  startAngle: DynamicValue;
  sweepAngle: DynamicValue;
  strokeWidth: DynamicValue;
  color: DynamicValue;
  trackColor?: DynamicValue;
  rounded?: DynamicValue;
}

export interface IdleLottieLayer extends IdleLayerBase {
  type: 'lottie';
  asset: string;
  autoplay?: DynamicValue;
  loop?: DynamicValue;
  speed?: DynamicValue;
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
