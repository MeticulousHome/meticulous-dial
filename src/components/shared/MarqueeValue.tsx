import Marquee from 'react-fast-marquee';

export const marqueeIfNeeded = (enabled: boolean, val: string) => {
  if (enabled && val.length > 18) return <Marquee delay={0.6}>{val}</Marquee>;
  return <>{val}</>;
};
