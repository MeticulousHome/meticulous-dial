interface ProfileImageProps {
  borderColor: string;
  image: string;
}

export const ProfileImage = ({ image, borderColor }: ProfileImageProps) => {
  return (
    <img
      src={image}
      alt="image-profile"
      width="171"
      height="171"
      className="profile-image"
      style={{ border: `6px solid ${borderColor}` }}
    />
  );
};
