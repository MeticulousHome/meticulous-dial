import { useAppSelector } from '../store/hooks';
import { styled } from 'styled-components';

const PressetsTitle = styled.div<{ $scroll: boolean }>`
  height: 22px;
  display: flex;
  flex-direction: column;
  padding-top: 1.5px;

  transition: transform 0.3s ease-in-out;
  transform: ${({ $scroll }) =>
    $scroll ? 'translateY(-100%)' : 'translateY(0)'};
`;

export const getProfilesTitle = () => <TitleProfiles />;

export const TitleProfiles = () => {
  // FIXME Remove this legacy code
  const presets = useAppSelector((state) => state.presets);

  return (
    <PressetsTitle $scroll={presets.profileFocused}>
      <span>Catalog</span>
      <span>{presets.activePreset.name}</span>
    </PressetsTitle>
  );
};
