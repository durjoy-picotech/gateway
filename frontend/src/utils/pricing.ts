import { FeePolicy, FeeBreakdown, ProviderCost, PricingRequest, PricingResponse } from '../types/pricing';
import { CurrencyFormatter } from './currency';
import { FxEngine } from './routing';

export class PricingEngine {
  private static feePolicies: Map<string, FeePolicy[]> = new Map();
  private static providerCosts: Map<string, ProviderCost> = new Map();

  static setFeePolicies(policies: FeePolicy[]) {
    this.feePolicies.clear();
    
    // Group policies by scope for cascade lookup
    policies.forEach(policy => {
      const key = `${policy.scope_type}:${policy.scope_id}`;
      const existing = this.feePolicies.get(key) || [];
      existing.push(policy);
      this.feePolicies.set(key, existing);
    });
  }

  static setProviderCosts(costs: ProviderCost[]) {
    this.providerCosts.clear();
    costs.forEach(cost => {
      const key = `${cost.provider_alias}:${cost.channel_type}`;
      this.providerCosts.set(key, cost);
    });
  }

  static async calculatePricing(request: PricingRequest): Promise<PricingResponse> {
    const { amount, currency, channel_type, provider_alias, merchant_id } = request;

    // Get fee cascade for this merchant
    const feeCascade = await this.getFeeCascade(merchant_id, channel_type, provider_alias);
    
    // Calculate merchant fee using cascade
    const merchantFeeResult = this.calculateMerchantFee(amount, currency, feeCascade);
    
    // Get provider cost
    const providerCostResult = await this.calculateProviderCost(
      amount, 
      currency, 
      provider_alias, 
      channel_type
    );

    // Calculate profit
    const profit = merchantFeeResult.total_fee - providerCostResult.converted_cost;
    const profitMargin = (profit / merchantFeeResult.total_fee) * 100;

    // Create fee breakdown
    const feeBreakdown: FeeBreakdown = {
      fee_id: `fb_${Date.now()}`,
      transaction_id: '', // Will be set when transaction is created
      provider_cost_native: providerCostResult.native_cost,
      provider_cost_currency: providerCostResult.native_currency,
      provider_cost_converted: providerCostResult.converted_cost,
      merchant_fee: merchantFeeResult.total_fee,
      fee_currency: currency,
      profit: profit,
      profit_currency: currency,
      fx_rate_used: providerCostResult.fx_rate,
      rounding_mode: 'BANKERS',
      scale: 6,
      calculation_details: {
        base_amount: amount,
        percentage_fee: merchantFeeResult.percentage_fee,
        fixed_fee: merchantFeeResult.fixed_fee,
        min_cap_applied: merchantFeeResult.min_cap_applied,
        max_cap_applied: merchantFeeResult.max_cap_applied,
        markup_levels: merchantFeeResult.markup_levels,
        provider_costs: {
          native_amount: providerCostResult.native_cost,
          native_currency: providerCostResult.native_currency,
          fx_rate: providerCostResult.fx_rate,
          converted_amount: providerCostResult.converted_cost,
          converted_currency: currency
        }
      },
      created_at: new Date().toISOString()
    };

    return {
      fee_breakdown: feeBreakdown,
      total_cost: merchantFeeResult.total_fee,
      profit_margin: profitMargin,
      effective_rate: (merchantFeeResult.total_fee / amount) * 100
    };
  }

  private static async getFeeCascade(
    merchantId: string, 
    channelType: string, 
    providerAlias: string
  ): Promise<FeePolicy[]> {
    const cascade: FeePolicy[] = [];
    
    // In a real implementation, you would look up the merchant's hierarchy
    // For demo purposes, we'll use hardcoded relationships
    const merchantHierarchy = {
      merchant_id: merchantId,
      agent_id: 'agt_001',
      partner_id: 'ptr_001'
    };

    // System level (SUPER_ADMIN)
    const systemPolicies = this.feePolicies.get('SUPER_ADMIN:system') || [];
    cascade.push(...systemPolicies.filter(p => 
      this.policyMatches(p, channelType, providerAlias)
    ));

    // Partner level
    if (merchantHierarchy.partner_id) {
      const partnerPolicies = this.feePolicies.get(`PARTNER:${merchantHierarchy.partner_id}`) || [];
      cascade.push(...partnerPolicies.filter(p => 
        this.policyMatches(p, channelType, providerAlias)
      ));
    }

    // Agent level
    if (merchantHierarchy.agent_id) {
      const agentPolicies = this.feePolicies.get(`AGENT:${merchantHierarchy.agent_id}`) || [];
      cascade.push(...agentPolicies.filter(p => 
        this.policyMatches(p, channelType, providerAlias)
      ));
    }

    // Merchant level
    const merchantPolicies = this.feePolicies.get(`MERCHANT:${merchantId}`) || [];
    cascade.push(...merchantPolicies.filter(p => 
      this.policyMatches(p, channelType, providerAlias)
    ));

    return cascade;
  }

  private static policyMatches(
    policy: FeePolicy, 
    channelType: string, 
    providerAlias: string
  ): boolean {
    if (policy.channel_type && policy.channel_type !== channelType) return false;
    if (policy.provider_alias && policy.provider_alias !== providerAlias) return false;
    return true;
  }

  private static calculateMerchantFee(
    amount: number, 
    currency: string, 
    policies: FeePolicy[]
  ) {
    let totalPercentage = 0;
    let totalFixed = 0;
    let minCap = 0;
    let maxCap = Number.MAX_VALUE;
    const markupLevels: any[] = [];
    let hasOverride = false;

    // Apply fee cascade
    for (const policy of policies) {
      if (policy.override_lower_levels) {
        // Reset and use only this policy
        totalPercentage = policy.percentage;
        totalFixed = policy.fixed_amount;
        minCap = policy.min_cap;
        maxCap = policy.max_cap;
        markupLevels.length = 0;
        markupLevels.push({
          level: policy.scope_type,
          scope_id: policy.scope_id,
          percentage: policy.percentage,
          fixed: policy.fixed_amount,
          currency: policy.currency
        });
        hasOverride = true;
        break; // Stop processing further policies
      } else if (!hasOverride) {
        // Add to existing fees
        totalPercentage += policy.percentage;
        totalFixed += policy.fixed_amount;
        minCap = Math.max(minCap, policy.min_cap);
        maxCap = Math.min(maxCap, policy.max_cap);
        markupLevels.push({
          level: policy.scope_type,
          scope_id: policy.scope_id,
          percentage: policy.percentage,
          fixed: policy.fixed_amount,
          currency: policy.currency
        });
      }
    }

    const percentageFee = (amount * totalPercentage) / 100;
    let totalFee = percentageFee + totalFixed;

    // Apply caps
    const minCapApplied = totalFee < minCap;
    const maxCapApplied = totalFee > maxCap;
    
    if (minCapApplied) totalFee = minCap;
    if (maxCapApplied) totalFee = maxCap;

    // Round using Banker's rounding
    totalFee = CurrencyFormatter.roundAmount(totalFee, 6, 'BANKERS');

    return {
      total_fee: totalFee,
      percentage_fee: percentageFee,
      fixed_fee: totalFixed,
      min_cap_applied: minCapApplied,
      max_cap_applied: maxCapApplied,
      markup_levels: markupLevels
    };
  }

  private static async calculateProviderCost(
    amount: number,
    currency: string,
    providerAlias: string,
    channelType: string
  ) {
    const costKey = `${providerAlias}:${channelType}`;
    const providerCost = this.providerCosts.get(costKey);
    
    if (!providerCost) {
      throw new Error(`No cost configuration found for ${providerAlias}:${channelType}`);
    }

    // Calculate native cost
    const percentageCost = (amount * providerCost.percentage) / 100;
    const nativeCost = percentageCost + providerCost.fixed_amount;
    
    // Convert to transaction currency if different
    let convertedCost = nativeCost;
    let fxRate = 1.0;
    
    if (providerCost.currency !== currency) {
      const fxResult = await FxEngine.convertCurrency(
        nativeCost,
        providerCost.currency,
        currency,
        'SUPER_ADMIN',
        'system'
      );
      convertedCost = fxResult.convertedAmount;
      fxRate = fxResult.finalRate;
    }

    return {
      native_cost: CurrencyFormatter.roundAmount(nativeCost, 6, 'BANKERS'),
      native_currency: providerCost.currency,
      converted_cost: CurrencyFormatter.roundAmount(convertedCost, 6, 'BANKERS'),
      fx_rate: fxRate
    };
  }

  static calculateProfitMargin(feeBreakdown: FeeBreakdown): number {
    if (feeBreakdown.merchant_fee === 0) return 0;
    return (feeBreakdown.profit / feeBreakdown.merchant_fee) * 100;
  }

  static getEffectiveRate(amount: number, fee: number): number {
    if (amount === 0) return 0;
    return (fee / amount) * 100;
  }

  static formatFeeBreakdown(breakdown: FeeBreakdown): string {
    const details = breakdown.calculation_details;
    let summary = `Base: ${CurrencyFormatter.formatMoney(details.base_amount, breakdown.fee_currency).display_amount}\n`;
    
    details.markup_levels.forEach(level => {
      const levelFee = (details.base_amount * level.percentage / 100) + level.fixed;
      summary += `${level.level}: ${CurrencyFormatter.formatMoney(levelFee, level.currency).display_amount}\n`;
    });
    
    summary += `Total Fee: ${CurrencyFormatter.formatMoney(breakdown.merchant_fee, breakdown.fee_currency).display_amount}\n`;
    summary += `Provider Cost: ${CurrencyFormatter.formatMoney(breakdown.provider_cost_converted, breakdown.fee_currency).display_amount}\n`;
    summary += `Profit: ${CurrencyFormatter.formatMoney(breakdown.profit, breakdown.profit_currency).display_amount}`;
    
    return summary;
  }
}

// Utility functions for fee calculations
export const calculateFeePercentage = (amount: number, percentage: number): number => {
  return CurrencyFormatter.roundAmount((amount * percentage) / 100, 6, 'BANKERS');
};

export const applyFeeCaps = (fee: number, minCap: number, maxCap: number): {
  adjustedFee: number;
  minCapApplied: boolean;
  maxCapApplied: boolean;
} => {
  let adjustedFee = fee;
  let minCapApplied = false;
  let maxCapApplied = false;

  if (fee < minCap) {
    adjustedFee = minCap;
    minCapApplied = true;
  } else if (fee > maxCap) {
    adjustedFee = maxCap;
    maxCapApplied = true;
  }

  return {
    adjustedFee: CurrencyFormatter.roundAmount(adjustedFee, 6, 'BANKERS'),
    minCapApplied,
    maxCapApplied
  };
};