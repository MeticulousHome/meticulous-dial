interface ProfileImageProps {
  borderColor?: string;
  image?: string;
}

const staticImage = 'assets/images/profile-default.png';

const borderExample = '#A56751';

export const ProfileImage = ({ image, borderColor }: ProfileImageProps) => {
  return (
    <img
      src={image || staticImage}
      alt="image-profile"
      width="164"
      height="164"
      className="profile-image"
      style={{ border: `7px solid ${borderColor || borderExample}` }}
    />
  );
};
