import React, { PropsWithChildren, ReactElement } from 'react';
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

export const ModularLeft: React.FC<ModularSectionProps> = (props) => (
  <div {...props} className="modular-left" />
);

export const ModularRight: React.FC<ModularSectionProps> = (props) => (
  <div {...props} className="modular-right" />
);

export const ModularFooter: React.FC<ModularSectionProps> = (props) => (
  <div {...props} className="modular-footer" />
);
