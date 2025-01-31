import React, { forwardRef, PropsWithChildren, ReactElement } from 'react';
import './modular.less';

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
