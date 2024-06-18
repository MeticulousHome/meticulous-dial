interface Props {
  enabled: boolean;
  val: string;
  len?: number;
}

export const marqueeIfNeeded = ({ enabled, val, len = 24 }: Props) => {
  if (enabled && val.length > len) {
    return <span className="animate-marquee">{val}</span>;
  }

  return val;
};
