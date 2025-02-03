import React, { forwardRef, PropsWithChildren, ReactElement } from 'react';
import './modular.less';
import { useHandleGestures } from '../../hooks/useHandleGestures';

export const ModularScreen: React.FC<{
  children: ReactElement<
    unknown,
    typeof ModularLeft | typeof ModularRight | typeof ModularFooter
  >[];
}> = ({ children }) => <div className="modular-screen">{children}</div>;

interface ModularSectionProps extends PropsWithChildren {
  style?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >['style'];
}

export const ModularLeft = forwardRef<HTMLDivElement, ModularSectionProps>(
  (props, ref) => <div ref={ref} {...props} className="modular-left" />
);

export const ModularRight = forwardRef<HTMLDivElement, ModularSectionProps>(
  (props, ref) => <div ref={ref} {...props} className="modular-right" />
);

export const ModularFooter = forwardRef<HTMLDivElement, ModularSectionProps>(
  (props, ref) => <div ref={ref} {...props} className="modular-footer" />
);

export function ModularRightOptions<
  T extends readonly { id: string; label: string }[]
>({
  options,
  value,
  onValueChange
}: {
  options: T;
  value: T[number]['id'];
  onValueChange: (value: T[number]['id']) => void;
}) {
  const handleTurn = (delta: -1 | 1) => {
    const currentIndex = options.findIndex(({ id }) => id === value);
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < options.length) {
      onValueChange(options[newIndex].id);
    }
  };
  useHandleGestures({
    left: () => {
      handleTurn(-1);
    },
    right: () => {
      handleTurn(1);
    }
  });

  return (
    <div className="modular-options">
      {options.map(({ id, label }) => (
        <div
          key={id}
          className={`settings-item ${value === id ? 'active-setting' : ''}`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
