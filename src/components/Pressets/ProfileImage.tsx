interface ProfileImageProps {
  borderColor: string;
  image: string;
}

export const ProfileImage = ({ image, borderColor }: ProfileImageProps) => {
  return (
    <img
      src={image}
      alt="image-profile"
      width="164"
      height="164"
      className="profile-image"
      style={{ border: `7px solid ${borderColor}` }}
    />
  );
};
