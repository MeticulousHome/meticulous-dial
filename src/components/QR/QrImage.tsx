import QRCode from 'react-qr-code';

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
            fontSize: '16px',
            paddingLeft: '20px'
          }}
        >
          {description}
        </span>
      )}
    </div>
  );
};

export const QrGeneratedImage = ({
  src,
  size,
  description,
  style,
  value
}: {
  src?: string;
  size: number;
  description?: string | undefined;
  style?: React.CSSProperties | undefined;
  value?: string;
}) => {
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
      {value ? (
        <div style={{ background: 'white', padding: '16px' }}>
          <QRCode
            width={size}
            height={size}
            value={value}
            style={{ display: 'block' }}
          />
        </div>
      ) : (
        <img
          width={size}
          height={size}
          src={
            src ||
            'https://www.shutterstock.com/image-vector/sample-qr-code-260nw-1712468050.jpg'
          }
          alt="qr-image"
          style={{ display: 'block' }}
        />
      )}
      {description && (
        <span
          style={{
            paddingTop: '5px',
            fontSize: '16px',
            paddingLeft: '20px'
          }}
        >
          {description}
        </span>
      )}
    </div>
  );
};
