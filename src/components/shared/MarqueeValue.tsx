import Marquee from 'react-fast-marquee';

interface Props {
  enabled: boolean;
  val: string;
  len?: number;
}

export const marqueeIfNeeded = ({ enabled, val, len = 18 }: Props) => {
  if (enabled && val.length > len)
    return (
      <Marquee
        delay={0.6}
        style={{
          fontSize: `${val.length > 14 ? '18px' : undefined}`
        }}
      >
        {val}
      </Marquee>
    );
  return <>{val}</>;
};
