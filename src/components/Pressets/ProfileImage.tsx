interface ProfileImageProps {
  borderColor?: string;
  image?: string;
}

const exampleImage =
  'https://s3-alpha-sig.figma.com/img/36d3/5d52/602d3b8648f9810dde10595f3add9e73?Expires=1709510400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=VCd3CoH0u~Keiwux2dMT5Coo7e1th1GEvG0x5SPoQHIpHu4LzkaYt7y8vA3ZU8NmPp7CVeJ0~EQYOoHfSNST-RgHU2KLQ1aqc722fxAgW9YhL2IZpliT4Zm8PDsqSuy6JQcTkgetg3sQpLqyt4tcwMHY67Ltg0r9UxY5azs~FfSnk2pf~Kqcb4fWNK~FV4yUw2muBriz37KBYZKS3wvbcbj4g3aNXp-FNHJsrk4otEjSc4eAh2Z3noe~f9j2G1CWurg90cGOZ-vQtvDz8nY2~qiZpp~Vki0uPC40uVmIOT7imgIyUi~ICaRKg03h6UIvr3jVVgppOxt7abYfLNjc6w__';

const borderExample = '#A56751';

export const ProfileImage = ({ image, borderColor }: ProfileImageProps) => {
  return (
    <img
      src={image || exampleImage}
      alt="image-profile"
      width="164"
      height="164"
      className="profile-image"
      style={{ border: `7px solid ${borderColor || borderExample}` }}
    />
  );
};
