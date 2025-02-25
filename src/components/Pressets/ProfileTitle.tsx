import { useAppSelector } from '../store/hooks';
import { styled } from 'styled-components';

const PressetsTitle = styled.div<{ $scroll: boolean }>`
  height: 22px;
  display: flex;
  flex-direction: column;
  padding-top: 1.5px;
  transition: transform 0.15s ease-in-out;
  transform: ${({ $scroll }) =>
    $scroll ? 'translateY(-22.5px)' : 'translateY(0)'};
`;

export const getProfileTitle = () => <ProfileTitle />;

export const ProfileTitle = () => {
  const presets = useAppSelector((state) => state.presets);

  return (
    <PressetsTitle $scroll={presets.option != 'PRESSETS'}>
      <span>Catalog</span>
      <span>{presets.activePreset.name}</span>
    </PressetsTitle>
  );
};
