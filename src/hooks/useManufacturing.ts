import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getManufacturingSchema,
  updateManufacturingSettings
} from '../api/api';
import { ManufacturingSettings } from '@meticulous-home/espresso-api/dist';

const MANUFACTURING_SCHEMA_QUERY_KEY = 'manufacturing-schema';

export function useManufacturingSchema() {
  return useQuery({
    queryKey: [MANUFACTURING_SCHEMA_QUERY_KEY],
    queryFn: getManufacturingSchema,
    retry: false
  });
}

export function useUpdateManufacturingSettings(
  onSuccessUpdateEnabled: (data: ManufacturingSettings) => void
) {
  return useMutation({
    mutationFn: (newSettings: Partial<ManufacturingSettings>) =>
      updateManufacturingSettings(newSettings),
    onSuccess: onSuccessUpdateEnabled,
    onError: (error) => {
      console.error('Failed to update manufacturing settings', error);
    }
  });
}
