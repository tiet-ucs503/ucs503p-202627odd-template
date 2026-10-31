/** Hide integration-test listings from public browse surfaces. */
export function isAuditListing(crop: string): boolean {
  return /\baudit\b/i.test(crop);
}

export function isPublicListing(crop: string): boolean {
  return !isAuditListing(crop);
}
