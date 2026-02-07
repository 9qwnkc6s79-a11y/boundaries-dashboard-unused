import type { VercelRequest, VercelResponse } from '@vercel/node';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_126144970';
const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface AdInsight {
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  objective: string;
  insights?: { data: AdInsight[] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!META_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Meta access token not configured' });
  }

  const { period = '7d' } = req.query;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  
  switch (period) {
    case '1d':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const dateRange = {
    since: startDate.toISOString().split('T')[0],
    until: endDate.toISOString().split('T')[0],
  };

  try {
    // Fetch account-level insights
    const insightsUrl = `${META_API_BASE}/${META_AD_ACCOUNT_ID}/insights?` + new URLSearchParams({
      access_token: META_ACCESS_TOKEN,
      fields: 'spend,impressions,clicks,reach,cpc,cpm,ctr,actions',
      time_range: JSON.stringify(dateRange),
      level: 'account',
    });

    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (insightsData.error) {
      console.error('Meta API Error:', insightsData.error);
      return res.status(400).json({ 
        error: 'Meta API error', 
        details: insightsData.error.message 
      });
    }

    // Fetch campaigns with their insights
    const campaignsUrl = `${META_API_BASE}/${META_AD_ACCOUNT_ID}/campaigns?` + new URLSearchParams({
      access_token: META_ACCESS_TOKEN,
      fields: 'id,name,status,objective,insights{spend,impressions,clicks,ctr,cpc}',
      time_range: JSON.stringify(dateRange),
      limit: '50',
    });

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    // Process insights
    const accountInsights = insightsData.data?.[0] || {};
    
    // Calculate conversions from actions
    const conversions = accountInsights.actions?.reduce((sum: number, action: { action_type: string; value: string }) => {
      if (['purchase', 'lead', 'complete_registration', 'add_to_cart'].includes(action.action_type)) {
        return sum + parseInt(action.value, 10);
      }
      return sum;
    }, 0) || 0;

    // Calculate ROAS if we have purchase value
    const purchaseValue = accountInsights.actions?.find(
      (a: { action_type: string }) => a.action_type === 'purchase'
    )?.value || 0;
    const spend = parseFloat(accountInsights.spend || '0');
    const roas = spend > 0 ? (parseFloat(String(purchaseValue)) / spend) : 0;

    // Format response
    const response = {
      period: period,
      dateRange,
      summary: {
        spend: parseFloat(accountInsights.spend || '0'),
        impressions: parseInt(accountInsights.impressions || '0', 10),
        clicks: parseInt(accountInsights.clicks || '0', 10),
        reach: parseInt(accountInsights.reach || '0', 10),
        cpc: parseFloat(accountInsights.cpc || '0'),
        cpm: parseFloat(accountInsights.cpm || '0'),
        ctr: parseFloat(accountInsights.ctr || '0'),
        conversions,
        roas: Math.round(roas * 100) / 100,
      },
      campaigns: (campaignsData.data || []).map((campaign: CampaignData) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        metrics: campaign.insights?.data?.[0] ? {
          spend: parseFloat(campaign.insights.data[0].spend || '0'),
          impressions: parseInt(campaign.insights.data[0].impressions || '0', 10),
          clicks: parseInt(campaign.insights.data[0].clicks || '0', 10),
          ctr: parseFloat(campaign.insights.data[0].ctr || '0'),
          cpc: parseFloat(campaign.insights.data[0].cpc || '0'),
        } : null,
      })),
      fetchedAt: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Meta Ads API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Meta Ads data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
