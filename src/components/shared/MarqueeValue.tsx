interface Props {
  enabled: boolean;
  val: string;
  len?: number;
}

export const marqueeIfNeeded = ({ enabled, val, len = 23 }: Props) => {
  if (enabled && val.length > len) {
    return <span className="animate">{val}</span>;
  }

  return <>{val}</>;
};
