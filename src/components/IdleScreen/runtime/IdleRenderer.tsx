import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import Lottie, { AnimationItem } from 'lottie-web';

import MetCat from '../MetCat.json';
import { idleAssetUrl } from './packageApi';
import {
  resolveCondition,
  resolveDynamicValue,
  useIdleDataContext
} from './data';
import { computeAnalogRotation, formatDigitalTime, radialHandBounds } from './clock';
import type {
  IdleAnalogHandLayer,
  IdleDataContext,
  IdleDigitalTimeTemplate,
  IdleDigitalTimeLayer,
  DynamicValue,
  IdleFont,
  IdleImageLayer,
  IdleLayer,
  IdleLottieLayer,
  IdleScreenDefinition,
  IdleScreenDocument,
  IdleTransform,
  IdleHourMode
} from './types';

interface ResolvedTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
  scaleX: number;
  scaleY: number;
}

interface RenderContext {
  definition: IdleScreenDefinition;
  screen: IdleScreenDocument;
  data: IdleDataContext;
  now: Date;
}

export function IdleRenderer({
  definition,
  now
}: {
  definition: IdleScreenDefinition;
  now: Date;
}): JSX.Element {
  const screen = definition.screen;
  const data = useIdleDataContext(screen, now);
  const background = asColor(
    resolveDynamicValue(screen.viewport.background, data, screen.tokens),
    '#000000'
  );
  const context = { definition, screen, data, now };

  return (
    <div
      style={{
        width: 480,
        height: 480,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '50%',
        background
      }}
    >
      {screen.layers.map((layer) => renderLayer(layer, context))}
    </div>
  );
}

function renderLayer(
  layer: IdleLayer,
  context: RenderContext
): JSX.Element | null {
  if (!isVisible(layer, context)) return null;
  switch (layer.type) {
    case 'group':
      return (
        <div key={layer.id} style={baseStyle(layer, context)}>
          {layer.children.map((child) => renderLayer(child, context))}
        </div>
      );
    case 'shape':
      return <div key={layer.id} style={shapeStyle(layer, context)} />;
    case 'text':
      return (
        <div key={layer.id} style={textStyle(layer, context)}>
          {asText(
            resolveDynamicValue(layer.text, context.data, context.screen.tokens)
          )}
        </div>
      );
    case 'image':
      return <ImageLayer key={layer.id} layer={layer} context={context} />;
    case 'tickRing':
      return <TickRing key={layer.id} layer={layer} context={context} />;
    case 'analogHand':
      return <AnalogHand key={layer.id} layer={layer} context={context} />;
    case 'pivotCap':
      return <div key={layer.id} style={pivotStyle(layer, context)} />;
    case 'digitalTime':
      return <DigitalTime key={layer.id} layer={layer} context={context} />;
    case 'progressArc':
      return <ProgressArc key={layer.id} layer={layer} context={context} />;
    case 'lottie':
      return <LottieLayer key={layer.id} layer={layer} context={context} />;
  }
}

function ImageLayer({
  layer,
  context
}: {
  layer: IdleImageLayer;
  context: RenderContext;
}): JSX.Element {
  const variant = layer.variants?.find((item) =>
    resolveCondition(item.when, context.data)
  );
  const assetId = variant?.asset ?? layer.asset;
  return (
    <img
      alt=""
      src={idleAssetUrl(context.definition, assetId)}
      style={{
        ...baseStyle(layer, context),
        objectFit: asImageFit(resolve(layer.fit, context), 'contain')
      }}
    />
  );
}

function TickRing({
  layer,
  context
}: {
  layer: Extract<IdleLayer, { type: 'tickRing' }>;
  context: RenderContext;
}): JSX.Element {
  const radius = asNumber(
    resolveDynamicValue(layer.radius, context.data, context.screen.tokens),
    0
  );
  const startAngle = asNumber(resolve(layer.startAngle, context), -90);
  const hourTicksOnly = asBoolean(resolve(layer.hourTicksOnly, context), false);
  const count = hourTicksOnly
    ? 12
    : Math.max(1, Math.round(asNumber(resolve(layer.count, context), 60)));
  return (
    <div style={baseStyle(layer, context)}>
      {Array.from({ length: count }).map((_, index) => {
        const style = hourTicksOnly
          ? layer.styles[layer.styles.length - 1]
          : selectTickStyle(layer.styles, index, context);
        if (!style) return null;
        const width = asNumber(
          resolveDynamicValue(style.width, context.data, context.screen.tokens),
          1
        );
        const length = asNumber(
          resolveDynamicValue(
            style.length,
            context.data,
            context.screen.tokens
          ),
          1
        );
        const color = asColor(
          resolveDynamicValue(style.color, context.data, context.screen.tokens),
          '#ffffff'
        );
        const tickRadius = radius + asNumber(resolve(style.radiusOffset, context), 0);
        const angle = startAngle + (index * 360) / count;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 240 - width / 2,
              top: 240 - tickRadius,
              width,
              height: length,
              background: color,
              borderRadius: asBoolean(resolve(style.rounded, context), false) ? width : 0,
              transformOrigin: `${width / 2}px ${tickRadius}px`,
              transform: `rotate(${angle}deg)`
            }}
          />
        );
      })}
    </div>
  );
}

function AnalogHand({
  layer,
  context
}: {
  layer: IdleAnalogHandLayer;
  context: RenderContext;
}): JSX.Element {
  const width = asNumber(
    resolveDynamicValue(layer.width, context.data, context.screen.tokens),
    1
  );
  const length = asNumber(
    resolveDynamicValue(layer.length, context.data, context.screen.tokens),
    1
  );
  const tailLength = asNumber(
    resolveDynamicValue(layer.tailLength, context.data, context.screen.tokens),
    0
  );
  const color = asColor(
    resolveDynamicValue(layer.color, context.data, context.screen.tokens),
    '#ffffff'
  );
  const timeUnit = asHandUnit(resolve(layer.timeUnit, context));
  const smooth = asBoolean(resolve(layer.smooth, context), true);
  const rotation =
    timeUnit === 'custom'
      ? asNumber(
          resolveDynamicValue(
            layer.rotation,
            context.data,
            context.screen.tokens
          ),
          0
        )
      : computeAnalogRotation(
          context.now,
          timeUnit,
          smooth
        );
  const pivot = {
    x: asNumber(resolve(layer.pivot.x, context), 240),
    y: asNumber(resolve(layer.pivot.y, context), 240)
  };
  const distanceFromCenter = Math.max(
    0,
    Math.min(480, asNumber(resolve(layer.distanceFromCenter, context), 0))
  );
  const shape = asText(resolve(layer.shape, context));
  const bounds = radialHandBounds(
    pivot.x,
    pivot.y,
    length,
    width,
    tailLength,
    distanceFromCenter
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 480,
        height: 480,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${pivot.x}px ${pivot.y}px`,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          background: color,
          borderRadius: shape === 'rounded' ? width : 0
        }}
      />
    </div>
  );
}

function DigitalTime({
  layer,
  context
}: {
  layer: IdleDigitalTimeLayer;
  context: RenderContext;
}): JSX.Element {
  const template = asTimeTemplate(resolve(layer.template, context));
  const hourMode = asHourMode(resolve(layer.hourMode, context));
  const value = formatDigitalTime(context.now, template, hourMode);
  const color = asColor(
    resolveDynamicValue(layer.color, context.data, context.screen.tokens),
    '#ffffff'
  );
  const midpointColor = asColor(
    resolveDynamicValue(layer.middayColor, context.data, context.screen.tokens),
    color
  );

  if (template === 'stackedHM') {
    const [hours, minutes, midday] = value.split('\n');
    return (
      <div
        style={{
          ...baseStyle(layer, context),
          ...fontStyle(layer.font, context),
          color
        }}
      >
        <div>{hours}</div>
        <div>{minutes}</div>
        {midday && (
          <div
            style={{
              ...fontStyle(layer.middayFont ?? layer.font, context),
              color: midpointColor
            }}
          >
            {midday}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        ...baseStyle(layer, context),
        ...fontStyle(layer.font, context),
        color
      }}
    >
      {value}
    </div>
  );
}

function ProgressArc({
  layer,
  context
}: {
  layer: Extract<IdleLayer, { type: 'progressArc' }>;
  context: RenderContext;
}): JSX.Element {
  const value = asNumber(
    resolveDynamicValue(layer.value, context.data, context.screen.tokens),
    0
  );
  const minimum = asNumber(resolve(layer.minimum, context), 0);
  const maximum = asNumber(resolve(layer.maximum, context), 1);
  const startAngle = asNumber(resolve(layer.startAngle, context), -90);
  const strokeWidth = asNumber(
    resolveDynamicValue(layer.strokeWidth, context.data, context.screen.tokens),
    1
  );
  const color = asColor(
    resolveDynamicValue(layer.color, context.data, context.screen.tokens),
    '#ffffff'
  );
  const trackColor = asColor(
    resolveDynamicValue(layer.trackColor, context.data, context.screen.tokens),
    'transparent'
  );
  const normalized = Math.min(
    1,
    Math.max(0, (value - minimum) / (maximum - minimum || 1))
  );
  const transform = resolvedTransform(layer.transform, context);
  const radius = Math.max(
    0,
    Math.min(transform.width, transform.height) / 2 -
      strokeWidth / 2
  );
  const circumference = 2 * Math.PI * radius;
  return (
    <svg style={baseStyle(layer, context)} viewBox="0 0 480 480">
      <circle
        cx="240"
        cy="240"
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="240"
        cy="240"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap={asBoolean(resolve(layer.rounded, context), true) ? 'round' : 'butt'}
        strokeDasharray={`${circumference * normalized} ${circumference}`}
        transform={`rotate(${startAngle} 240 240)`}
      />
    </svg>
  );
}

function LottieLayer({
  layer,
  context
}: {
  layer: IdleLottieLayer;
  context: RenderContext;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const animation = useRef<AnimationItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const url = idleAssetUrl(context.definition, layer.asset);
      const animationData =
        url === '__builtin_metcat_lottie__' ? MetCat : await fetchLottie(url);
      if (cancelled || !ref.current || containsLottieExpression(animationData))
        return;
      animation.current = Lottie.loadAnimation({
        container: ref.current,
        animationData,
        renderer: 'svg',
        loop: asBoolean(resolve(layer.loop, context), true),
        autoplay: asBoolean(resolve(layer.autoplay, context), true)
      });
      animation.current.setSpeed(asNumber(resolve(layer.speed, context), 1));
      const [intro, loop] = layer.segments ?? [];
      if (intro && loop) {
        animation.current.playSegments(
          [
            [intro.from, intro.to],
            [loop.from, loop.to]
          ],
          true
        );
        animation.current.addEventListener('segmentStart', () => {
          animation.current?.setSegment(loop.from, loop.to);
          if (animation.current) animation.current.loop = loop.loop ?? true;
        });
      }
    };
    load();
    return () => {
      cancelled = true;
      animation.current?.destroy();
      animation.current = null;
    };
  }, [context.definition.metadata.packageHash, layer]);

  return <div ref={ref} style={baseStyle(layer, context)} />;
}

function baseStyle(layer: IdleLayer, context: RenderContext): CSSProperties {
  const transform = resolvedTransform(layer.transform, context);
  const opacity = asNumber(
    resolveDynamicValue(layer.opacity, context.data, context.screen.tokens),
    1
  );
  return {
    position: 'absolute',
    left: transform.x,
    top: transform.y,
    width: transform.width,
    height: transform.height,
    opacity,
    overflow:
      layer.type === 'group' && asText(resolve(layer.clip, context)) !== 'none'
        ? 'hidden'
        : undefined,
    borderRadius:
      layer.type === 'group' && asText(resolve(layer.clip, context)) === 'circle'
        ? '50%'
        : undefined,
    transform: transformString(transform),
    transformOrigin: `${(transform.anchorX ?? 0.5) * 100}% ${(transform.anchorY ?? 0.5) * 100}%`,
    mixBlendMode: asBlendMode(resolve(layer.blendMode, context)),
    pointerEvents: 'none'
  };
}

function shapeStyle(
  layer: Extract<IdleLayer, { type: 'shape' }>,
  context: RenderContext
): CSSProperties {
  const strokeWidth = asNumber(
    resolveDynamicValue(layer.strokeWidth, context.data, context.screen.tokens),
    0
  );
  const shape = asText(resolve(layer.shape, context));
  return {
    ...baseStyle(layer, context),
    background:
      shape === 'line'
        ? undefined
        : asColor(
            resolveDynamicValue(
              layer.fill,
              context.data,
              context.screen.tokens
            ),
            'transparent'
          ),
    border:
      layer.stroke || strokeWidth
        ? `${strokeWidth}px solid ${asColor(resolveDynamicValue(layer.stroke, context.data, context.screen.tokens), 'transparent')}`
        : undefined,
    borderRadius:
      shape === 'circle'
        ? '50%'
        : shape === 'roundedRectangle'
          ? asNumber(
              resolveDynamicValue(
                layer.cornerRadius,
                context.data,
                context.screen.tokens
              ),
              0
            )
          : 0
  };
}

function textStyle(
  layer: Extract<IdleLayer, { type: 'text' }>,
  context: RenderContext
): CSSProperties {
  const color = asColor(
    resolveDynamicValue(layer.color, context.data, context.screen.tokens),
    '#ffffff'
  );
  const verticalAlign = asText(resolve(layer.verticalAlign, context));
  const wrap = asText(resolve(layer.wrap, context));
  const align = asTextAlign(resolve(layer.font.align, context));
  return {
    ...baseStyle(layer, context),
    ...fontStyle(layer.font, context),
    color,
    display: 'flex',
    alignItems:
      verticalAlign === 'bottom'
        ? 'flex-end'
        : verticalAlign === 'top'
          ? 'flex-start'
          : 'center',
    justifyContent:
      align === 'right'
        ? 'flex-end'
        : align === 'left'
          ? 'flex-start'
          : 'center',
    whiteSpace: wrap === 'none' ? 'nowrap' : 'normal',
    overflow: 'hidden',
    textAlign: align
  };
}

function fontStyle(font: IdleFont, context: RenderContext): CSSProperties {
  return {
    fontFamily: asText(
      resolveDynamicValue(font.family, context.data, context.screen.tokens)
    ),
    fontSize: asNumber(
      resolveDynamicValue(font.size, context.data, context.screen.tokens),
      16
    ),
    fontWeight: asNumber(resolve(font.weight, context), 400),
    fontStyle: asFontStyle(resolve(font.style, context)),
    lineHeight: asNumber(resolve(font.lineHeight, context), 1),
    fontVariantNumeric: asBoolean(resolve(font.tabularNumbers, context), false)
      ? 'tabular-nums'
      : undefined,
    textAlign: asTextAlign(resolve(font.align, context))
  };
}

function pivotStyle(
  layer: Extract<IdleLayer, { type: 'pivotCap' }>,
  context: RenderContext
): CSSProperties {
  const diameter = asNumber(
    resolveDynamicValue(layer.diameter, context.data, context.screen.tokens),
    1
  );
  const borderWidth = asNumber(
    resolveDynamicValue(layer.borderWidth, context.data, context.screen.tokens),
    0
  );
  return {
    ...baseStyle(layer, context),
    width: diameter,
    height: diameter,
    borderRadius: '50%',
    background: asColor(
      resolveDynamicValue(layer.color, context.data, context.screen.tokens),
      '#ffffff'
    ),
    border: borderWidth
      ? `${borderWidth}px solid ${asColor(resolveDynamicValue(layer.borderColor, context.data, context.screen.tokens), '#ffffff')}`
      : undefined
  };
}

function selectTickStyle<T extends { every: DynamicValue; offset?: DynamicValue }>(
  styles: T[],
  index: number,
  context: RenderContext
): T {
  return styles.reduce((selected, style) => {
    const every = Math.max(1, Math.round(asNumber(resolve(style.every, context), 1)));
    const offset = Math.round(asNumber(resolve(style.offset, context), 0));
    return (index - offset) % every === 0 ? style : selected;
  }, styles[0]);
}

function resolve(value: DynamicValue | undefined, context: RenderContext): unknown {
  return resolveDynamicValue(value, context.data, context.screen.tokens);
}

function resolvedTransform(
  transform: IdleTransform,
  context: RenderContext
): ResolvedTransform {
  return {
    x: asNumber(resolve(transform.x, context), 0),
    y: asNumber(resolve(transform.y, context), 0),
    width: Math.max(1, asNumber(resolve(transform.width, context), 1)),
    height: Math.max(1, asNumber(resolve(transform.height, context), 1)),
    rotation: asNumber(resolve(transform.rotation, context), 0),
    anchorX: asNumber(resolve(transform.anchorX, context), 0.5),
    anchorY: asNumber(resolve(transform.anchorY, context), 0.5),
    scaleX: asNumber(resolve(transform.scaleX, context), 1),
    scaleY: asNumber(resolve(transform.scaleY, context), 1)
  };
}

function isVisible(layer: IdleLayer, context: RenderContext): boolean {
  const visible = layer.visible;
  if (visible == null) return true;
  if (typeof visible === 'boolean') return visible;
  if ('operator' in visible) return resolveCondition(visible, context.data);
  return Boolean(
    resolveDynamicValue(visible, context.data, context.screen.tokens)
  );
}

function transformString(transform: ResolvedTransform): string | undefined {
  const parts = [];
  if (transform.rotation) parts.push(`rotate(${transform.rotation}deg)`);
  if (transform.scaleX != null || transform.scaleY != null) {
    parts.push(`scale(${transform.scaleX ?? 1}, ${transform.scaleY ?? 1})`);
  }
  return parts.join(' ') || undefined;
}

function asNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return value == null ? fallback : Boolean(value);
}

function asTextAlign(value: unknown): 'left' | 'center' | 'right' {
  return value === 'right' || value === 'center' ? value : 'left';
}

function asFontStyle(value: unknown): 'normal' | 'italic' {
  return value === 'italic' ? 'italic' : 'normal';
}

function asBlendMode(value: unknown): CSSProperties['mixBlendMode'] {
  return value === 'multiply' || value === 'screen' || value === 'overlay'
    ? value
    : 'normal';
}

function asImageFit(value: unknown, fallback: CSSProperties['objectFit']): CSSProperties['objectFit'] {
  return value === 'cover' || value === 'fill' || value === 'none' || value === 'contain'
    ? value
    : fallback;
}

function asHandUnit(value: unknown): 'hour' | 'minute' | 'second' | 'custom' {
  return value === 'hour' || value === 'second' || value === 'custom'
    ? value
    : 'minute';
}

function asHourMode(value: unknown): IdleHourMode {
  return value === '12' || value === '24' ? value : 'locale';
}

function asTimeTemplate(value: unknown): IdleDigitalTimeTemplate {
  return value === 'HH:mm:ss' || value === 'mm:ss' || value === 'mm' ||
    value === 'HH' || value === 'ss' || value === 'hh:mm a' ||
    value === 'hh:mm:ss a' || value === 'stackedHM'
    ? value
    : 'HH:mm';
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback;
}

async function fetchLottie(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('failed to fetch lottie asset');
  return response.json();
}

function containsLottieExpression(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsLottieExpression);
  return Object.entries(value).some(([key, entry]) => {
    if ((key === 'x' || key === 'expr') && typeof entry === 'string')
      return true;
    return containsLottieExpression(entry);
  });
}
