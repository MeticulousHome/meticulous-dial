export const QrImage = ({ src }: { src: string }) => {
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
        marginTop: '160px',
        marginBottom: '40px'
      }}
    >
      <img
        width={200}
        height={200}
        src={src}
        alt="qr-image"
        style={{ display: 'block' }}
      />
      <span
        style={{
          fontSize: '12px'
        }}
      >
        Scan with meticulous App to connect to machine
      </span>
    </div>
  );
};
