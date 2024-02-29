export const QrImage = ({ src }: { src: string }) => {
  if (!src) {
    src =
      'https://www.shutterstock.com/image-vector/sample-qr-code-260nw-1712468050.jpg';
  }

  return (
    <img
      width={140}
      height={140}
      src={src}
      alt="qr-image"
      style={{ marginTop: '70px' }}
    />
  );
};
