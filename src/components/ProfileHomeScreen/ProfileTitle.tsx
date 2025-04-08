import { useProfileContext } from '../../context/ProfileContext';
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
export const getActiveProfilesTitle = () => <TitleProfiles />;

export const TitleProfiles = () => {
  const { localHoverState, localProfile } = useProfileContext();
  return (
    <PressetsTitle $scroll={localHoverState}>
      <span>Catalog</span>
      <span>{localProfile?.name || ''}</span>
    </PressetsTitle>
  );
};
