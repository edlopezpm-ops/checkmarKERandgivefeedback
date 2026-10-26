export const SERVICE_POLICY = {
  termsVersion: '2026-10-25.1',
  privacyNoticeVersion: '2026-10-24.1',
  cookiesNoticeVersion: '2026-10-24.1',
  purposeVersion: 'marker-service-access-v1',
} as const;

export const servicePolicyAcknowledgement = () => ({
  ...SERVICE_POLICY,
  termsAccepted: true,
  privacyNoticeAcknowledged: true,
  cookiesNoticeAcknowledged: true,
});
