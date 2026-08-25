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
import { computeAnalogRotation, formatDigitalTime } from './clock';
import type {
  IdleAnalogHandLayer,
  IdleDataContext,
  IdleDigitalTimeLayer,
  IdleFont,
  IdleImageLayer,
  IdleLayer,
  IdleLottieLayer,
  IdleScreenDefinition,
  IdleScreenDocument,
  IdleTransform
} from './types';

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
        objectFit: layer.fit ?? 'contain',
        width: layer.transform.width,
        height: layer.transform.height
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
  const startAngle = layer.startAngle ?? -90;
  return (
    <div style={baseStyle(layer, context)}>
      {Array.from({ length: layer.count }).map((_, index) => {
        const style = selectTickStyle(layer.styles, index);
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
        const tickRadius = radius + (style.radiusOffset ?? 0);
        const angle = startAngle + (index * 360) / layer.count;
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
              borderRadius: style.rounded ? width : 0,
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
  const rotation =
    layer.timeUnit === 'custom'
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
          layer.timeUnit,
          layer.smooth !== false
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
        transformOrigin: '240px 240px',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 240 - width / 2,
          top: 240 - length,
          width,
          height: length + tailLength,
          background: color,
          borderRadius: layer.shape === 'rounded' ? width : 0
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
  const value = formatDigitalTime(context.now, layer.template, layer.hourMode);
  const color = asColor(
    resolveDynamicValue(layer.color, context.data, context.screen.tokens),
    '#ffffff'
  );
  const midpointColor = asColor(
    resolveDynamicValue(layer.middayColor, context.data, context.screen.tokens),
    color
  );

  if (layer.template === 'stackedHM') {
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
    layer.minimum
  );
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
    Math.max(0, (value - layer.minimum) / (layer.maximum - layer.minimum || 1))
  );
  const radius = Math.max(
    0,
    Math.min(layer.transform.width, layer.transform.height) / 2 -
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
        strokeLinecap={layer.rounded === false ? 'butt' : 'round'}
        strokeDasharray={`${circumference * normalized} ${circumference}`}
        transform={`rotate(${layer.startAngle} 240 240)`}
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
        loop: layer.loop ?? true,
        autoplay: layer.autoplay ?? true
      });
      animation.current.setSpeed(layer.speed ?? 1);
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
  const transform = layer.transform;
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
      layer.type === 'group' && layer.clip !== 'none' ? 'hidden' : undefined,
    borderRadius:
      layer.type === 'group' && layer.clip === 'circle' ? '50%' : undefined,
    transform: transformString(transform),
    transformOrigin: `${(transform.anchorX ?? 0.5) * 100}% ${(transform.anchorY ?? 0.5) * 100}%`,
    mixBlendMode: layer.blendMode ?? 'normal',
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
  return {
    ...baseStyle(layer, context),
    background:
      layer.shape === 'line'
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
      layer.shape === 'circle'
        ? '50%'
        : layer.shape === 'roundedRectangle'
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
  return {
    ...baseStyle(layer, context),
    ...fontStyle(layer.font, context),
    color,
    display: 'flex',
    alignItems:
      layer.verticalAlign === 'bottom'
        ? 'flex-end'
        : layer.verticalAlign === 'top'
          ? 'flex-start'
          : 'center',
    justifyContent:
      layer.font.align === 'right'
        ? 'flex-end'
        : layer.font.align === 'left'
          ? 'flex-start'
          : 'center',
    whiteSpace: layer.wrap === 'none' ? 'nowrap' : 'normal',
    overflow: 'hidden',
    textAlign: layer.font.align ?? 'left'
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
    fontWeight: font.weight,
    fontStyle: font.style,
    lineHeight: font.lineHeight,
    fontVariantNumeric: font.tabularNumbers ? 'tabular-nums' : undefined,
    textAlign: font.align ?? 'left'
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

function selectTickStyle<T extends { every: number; offset?: number }>(
  styles: T[],
  index: number
): T {
  return styles.reduce((selected, style) => {
    return (index - (style.offset ?? 0)) % style.every === 0 ? style : selected;
  }, styles[0]);
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

function transformString(transform: IdleTransform): string | undefined {
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
