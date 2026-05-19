import { getCustomers } from '../api/customers';

export async function syncCustomers() {
  const resp = await getCustomers();
  console.log('sync custoemrs, ', resp);
  return resp;
}
