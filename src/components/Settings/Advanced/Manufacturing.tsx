import { useEffect, useMemo, useState } from 'react';
import { SettingsItem } from '../../../types';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  useManufacturingSchema,
  useUpdateManufacturingSettings
} from '../../../hooks/useManufacturing';
import { updateManufacturingSettings } from '../../../api/api';
import { ManufacturingSettings } from '@meticulous-home/espresso-api/dist';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../styles/utils/mixins';
import { LoadingScreen } from '../../LoadingScreen/LoadingScreen';

/**
 * "Technically, we won't reach this component if the option to access it from 'Advanced Settings' is not displayed,
 * which means that the manufacturing mode is "disabled".
 */

export const Manufacturing = () => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  //I manage a local state to keep track of the manufacturing mode configuration status on the machine,
  //since the endpoint I query from my custom hook using React Query does not provide that information.
  const [manufacturing, setManufacturing] = useState<ManufacturingSettings>({
    enabled: true,
    first_normal_boot: false,
    skip_stage: false
  });
  const [isManufacturingConfigLoading, setIsManufacturingConfigLoading] =
    useState(true);

  const {
    data: manufacturingSettings,
    isSuccess: isManufacturingSuccess,
    isLoading: manufacturingSchemaLoading
  } = useManufacturingSchema();

  const mutateManufacturingSettings =
    useUpdateManufacturingSettings(setManufacturing);

  /**
   * Although semantically incorrect, for now it is the mechanism that provides the information I need.
   * When using the GET method on /api/v1/manufacturing, I obtain the elements to display, but if I make modifications with POST, the GET response from that endpoint no longer reflects those changes.
   *  */
  useEffect(() => {
    (async () => {
      const data = await updateManufacturingSettings({});
      if ('enabled' in data) {
        setManufacturing(data);
        setIsManufacturingConfigLoading(false);
      } else {
        console.error('Failed to fetch manufacturing settings:', data);
        setIsManufacturingConfigLoading(false);
      }
    })();
  }, []);

  const updatedSettings = useMemo(() => {
    if (!manufacturingSettings && !isManufacturingSuccess)
      return [] as SettingsItem[];

    const manufacturingFormatted: SettingsItem[] =
      isManufacturingSuccess && manufacturingSettings
        ? manufacturingSettings.Elements.map((element) => {
            return {
              key: element.key,
              label: `${element.label}: ${manufacturing[element.key as keyof ManufacturingSettings] ? 'ENABLED' : 'DISABLED'}`,
              visible: true
            };
          })
        : [];
    return [
      ...manufacturingFormatted,
      {
        key: 'back',
        label: 'Back',
        visible: true
      }
    ];
  }, [manufacturingSettings, isManufacturingSuccess, manufacturing]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, updatedSettings.length - 1)
        );
      },
      pressDown() {
        const activeItem = updatedSettings[activeIndex].key;
        console.log('activeItem', activeItem);
        switch (activeItem) {
          //case for enable/disable manufacturing mode
          case 'enabled':
            mutateManufacturingSettings.mutate({
              enabled: !manufacturing.enabled
            });
            break;
          case 'skip_stage':
            mutateManufacturingSettings.mutate({
              skip_stage: !manufacturing.skip_stage
            });
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          default:
            break;
        }
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  if (isManufacturingConfigLoading || manufacturingSchemaLoading) {
    return <LoadingScreen />;
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {updatedSettings.map((option) => (
            <Styled.Option key={option.key}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {updatedSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
              >
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
