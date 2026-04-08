import { forwardRef, PropsWithChildren, ReactElement } from 'react';
import './modular.less';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { styled } from 'styled-components';

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

export const ModularFooterText = styled.div`
  font-family: var(--multilingual-fonts-mono);
  font-size: 20px;
  font-weight: normal;
  line-height: 1;
  letter-spacing: -0.02em;
  text-align: center;
`;

export const ModularFooterTime = styled.div`
  font-family: var(--multilingual-fonts-mono);
  font-size: 40px;
  font-weight: 300;
  line-height: 1;
  letter-spacing: -0.02em;
  text-align: center;
`;

export function ModularRightOptions<
  T extends readonly { id: string; label: string }[]
>({
  options,
  value,
  onValueChange,
  shouldIgnoreGesture
}: {
  options: T;
  value: T[number]['id'];
  onValueChange: (value: T[number]['id']) => void;
  shouldIgnoreGesture?: boolean;
}) {
  const handleTurn = (delta: -1 | 1) => {
    const currentIndex = options.findIndex(({ id }) => id === value);
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < options.length) {
      onValueChange(options[newIndex].id);
    }
  };
  useHandleGestures(
    {
      left: () => {
        handleTurn(-1);
      },
      right: () => {
        handleTurn(1);
      }
    },
    shouldIgnoreGesture
  );

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
