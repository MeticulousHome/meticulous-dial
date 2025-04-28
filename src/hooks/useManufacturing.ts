import { useQuery } from '@tanstack/react-query';
import { getManufacturingSchema } from '../api/api';

const MANUFACTURING_SCHEMA_QUERY_KEY = 'manufacturing-schema';

export function useManufacturingSchema() {
  return useQuery({
    queryKey: [MANUFACTURING_SCHEMA_QUERY_KEY],
    queryFn: getManufacturingSchema,
    retry: false
  });
}
