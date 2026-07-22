export interface CustomerAddress {
  id: string;
  label?: string;
  line1: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface CustomerAccount {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Account/address mutations for the signed-in customer — data now lives in
 * Postgres (Customer/CustomerAddress), scoped by the session cookie
 * server-side. These are thin fetch wrappers; the pages that use them
 * server-fetch the initial data themselves (see app/rent/account,
 * app/rent/addresses) and call these only to persist changes.
 */
export async function updateCustomerAccount(account: {
  name: string;
  email?: string;
}): Promise<CustomerAccount> {
  const res = await fetch("/api/customer/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save account details");
  return data.customer as CustomerAccount;
}

export async function createCustomerAddress(
  address: Omit<CustomerAddress, "id" | "isDefault">
): Promise<CustomerAddress> {
  const res = await fetch("/api/customer/addresses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save address");
  return data.address as CustomerAddress;
}

export async function updateCustomerAddress(
  id: string,
  patch: Partial<Omit<CustomerAddress, "id">>
): Promise<CustomerAddress> {
  const res = await fetch(`/api/customer/addresses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not update address");
  return data.address as CustomerAddress;
}

export async function deleteCustomerAddress(id: string): Promise<void> {
  const res = await fetch(`/api/customer/addresses/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not delete address");
  }
}

export async function setDefaultAddress(id: string): Promise<void> {
  await updateCustomerAddress(id, { isDefault: true });
}
