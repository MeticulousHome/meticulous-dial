import { useQuery } from '@tanstack/react-query';
import { getManufacturingMenuItems } from '../api/api';
import { SettingsItem } from '../types';

const MANUFACTURING_ITEMS_QUERY_KEY = 'manufacturing-items';

export const useManufacturingItems = () => {
  return useQuery<SettingsItem[]>({
    queryKey: [MANUFACTURING_ITEMS_QUERY_KEY],
    queryFn: async () => {
      const { Elements } = await getManufacturingMenuItems();

      return Elements.map((menuItem) => {
        return {
          key: menuItem.key,
          label: `${menuItem.label}: UNSET`
          /* getLabel: (settings) =>
            `${settings[menuItem.key as keyof ManufacturingSettings] ? 'ENABLED' : 'DISABLED'}`, */
        };
      });
    }
  });
};
