export const QrImage = ({
  src,
  size,
  description,
  style
}: {
  src: string;
  size: number;
  description?: string | undefined;
  style?: React.CSSProperties | undefined;
}) => {
  if (!src) {
    src =
      'https://www.shutterstock.com/image-vector/sample-qr-code-260nw-1712468050.jpg';
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        ...style
      }}
    >
      <img
        width={size}
        height={size}
        src={src}
        alt="qr-image"
        style={{ display: 'block' }}
      />
      {description && (
        <span
          style={{
            paddingTop: '5px',
            fontSize: '16px'
          }}
        >
          {description}
        </span>
      )}
    </div>
  );
};
