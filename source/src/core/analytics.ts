export const analyticsPurposes = ['optional_analytics', 'aekr_marketing', 'onsite_personalized_ads', 'external_ad_audiences', 'partner_intro', 'audience_licensing'] as const;
export type AnalyticsPurpose = typeof analyticsPurposes[number];
export const analyticsCategories = ['automation', 'marketing', 'development', 'time_tracking', 'integration'] as const;
export const analyticsEvents = ['public_product_viewed', 'pricing_viewed', 'public_integration_viewed', 'commercial_interest_selected', 'offer_viewed', 'offer_clicked', 'partner_intro_requested'] as const;
export type AnalyticsConfiguration = {
  schema_version: 1; source_id: 'marker-owner-production'; product: 'marker'; environment: 'production';
  version: number; issued_at: string; expires_at: string; enabled: boolean;
  events: string[]; fields: string[]; purposes: string[]; retention_days: number;
  destinations: string[]; restriction_reason: string | null;
};
export type AnalyticsOverview = {
  console_url: string; source_id: 'marker-owner-production';
  status: 'not_configured' | 'unavailable' | 'paused' | 'active' | 'confirmation_pending';
  desired_version: number | null; applied_version: number | null;
  configuration: AnalyticsConfiguration | null;
};
export type AnalyticsPreference = { purpose: AnalyticsPurpose; status: 'granted' | 'denied' | 'withdrawn' | 'expired'; permission_ref: string; categories: string[]; recipients: string[]; gpc: boolean; expires_at: string | null };
export function isCurrentAnalyticsGrant(preference: AnalyticsPreference | undefined, now = Date.now()) {
  return preference?.status === 'granted' && !!preference.expires_at && Date.parse(preference.expires_at) > now;
}
export type AnalyticsAudience = { audience_id: string; version: number; eligible_count: number; as_of: string; mode: 'demo' | 'production' };
