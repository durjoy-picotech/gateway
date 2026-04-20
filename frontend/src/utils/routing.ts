import { RoutingStrategy, ProviderHealth, FeePolicy, FxPolicy } from '../types/channels';
import { CurrencyFormatter } from './currency';

export class RoutingEngine {
  private static providerHealth: Map<string, ProviderHealth> = new Map();
  private static routingStrategies: Map<string, RoutingStrategy> = new Map();

  static setProviderHealth(health: ProviderHealth[]) {
    this.providerHealth.clear();
    health.forEach(h => this.providerHealth.set(h.provider_alias, h));
  }

  static setRoutingStrategies(strategies: RoutingStrategy[]) {
    this.routingStrategies.clear();
    strategies.forEach(s => this.routingStrategies.set(s.strategy_id, s));
  }

  static async routeTransaction(
    amount: number,
    currency: string,
    channelType: string,
    merchantId: string,
    strategyId?: string
  ): Promise<{
    selectedProvider: string;
    routingReason: string;
    alternativeProviders: string[];
    estimatedCost: number;
    strategy: RoutingStrategy;
  }> {
    // Find applicable routing strategy
    const strategy = strategyId 
      ? this.routingStrategies.get(strategyId)
      : this.findBestStrategy(merchantId, channelType);

    if (!strategy) {
      throw new Error('No routing strategy found');
    }

    const availableProviders = this.getAvailableProviders(strategy, amount);
    
    if (availableProviders.length === 0) {
      throw new Error('No available providers for routing');
    }

    let selectedProvider: string;
    let routingReason: string;
    let estimatedCost: number;

    switch (strategy.type) {
      case 'PRIORITY':
        const result = this.routeByPriority(availableProviders, amount);
        selectedProvider = result.provider;
        routingReason = `Priority routing: ${result.reason}`;
        estimatedCost = result.cost;
        break;

      case 'WEIGHTED':
        const weightedResult = this.routeByWeight(availableProviders);
        selectedProvider = weightedResult.provider;
        routingReason = `Weighted routing: ${weightedResult.reason}`;
        estimatedCost = weightedResult.cost;
        break;

      case 'CHEAPEST':
        const cheapestResult = this.routeByCost(availableProviders, amount);
        selectedProvider = cheapestResult.provider;
        routingReason = `Cost optimization: ${cheapestResult.reason}`;
        estimatedCost = cheapestResult.cost;
        break;

      case 'FASTEST':
        const fastestResult = this.routeBySpeed(availableProviders);
        selectedProvider = fastestResult.provider;
        routingReason = `Speed optimization: ${fastestResult.reason}`;
        estimatedCost = fastestResult.cost;
        break;

      case 'FAILOVER':
        const failoverResult = this.routeWithFailover(availableProviders, amount);
        selectedProvider = failoverResult.provider;
        routingReason = `Failover routing: ${failoverResult.reason}`;
        estimatedCost = failoverResult.cost;
        break;

      default:
        throw new Error(`Unsupported routing strategy: ${strategy.type}`);
    }

    const alternativeProviders = availableProviders
      .filter(p => p.provider_alias !== selectedProvider)
      .map(p => p.provider_alias);

    return {
      selectedProvider,
      routingReason,
      alternativeProviders,
      estimatedCost,
      strategy
    };
  }

  private static findBestStrategy(merchantId: string, channelType: string): RoutingStrategy | undefined {
    // Find the most specific strategy for the merchant
    const strategies = Array.from(this.routingStrategies.values());
    
    // Priority: MERCHANT > AGENT > PARTNER > SUPER_ADMIN
    const merchantStrategy = strategies.find(s => 
      s.scope_type === 'MERCHANT' && s.scope_id === merchantId
    );
    if (merchantStrategy) return merchantStrategy;

    // For demo, return first available strategy
    return strategies[0];
  }

  private static getAvailableProviders(strategy: RoutingStrategy, amount: number) {
    return (strategy.config.providers || []).filter(provider => {
      const health = this.providerHealth.get(provider.provider_alias);
      
      // Check health status
      if (!health || health.health_status === 'DOWN' || health.circuit_breaker_open) {
        return false;
      }

      // Check amount limits
      if (provider.min_amount && amount < provider.min_amount) return false;
      if (provider.max_amount && amount > provider.max_amount) return false;

      // Check quota
      if (health.quota_remaining <= 0) return false;

      return true;
    });
  }

  private static routeByPriority(providers: any[], amount: number) {
    const sorted = providers.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    const selected = sorted[0];
    
    return {
      provider: selected.provider_alias,
      reason: `Highest priority provider (${selected.priority || 'default'})`,
      cost: this.estimateCost(selected.provider_alias, amount)
    };
  }

  private static routeByWeight(providers: any[]) {
    const totalWeight = providers.reduce((sum, p) => sum + (p.weight || 0), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const provider of providers) {
      currentWeight += provider.weight || 0;
      if (random <= currentWeight) {
        return {
          provider: provider.provider_alias,
          reason: `Weighted selection (${provider.weight}/${totalWeight})`,
          cost: this.estimateCost(provider.provider_alias, 100)
        };
      }
    }
    
    return {
      provider: providers[0].provider_alias,
      reason: 'Fallback selection',
      cost: this.estimateCost(providers[0].provider_alias, 100)
    };
  }

  private static routeByCost(providers: any[], amount: number) {
    const costsWithProviders = providers.map(provider => ({
      provider: provider.provider_alias,
      cost: this.estimateCost(provider.provider_alias, amount)
    }));

    const cheapest = costsWithProviders.reduce((min, current) => 
      current.cost < min.cost ? current : min
    );

    return {
      provider: cheapest.provider,
      reason: `Lowest cost ($${cheapest.cost.toFixed(2)})`,
      cost: cheapest.cost
    };
  }

  private static routeBySpeed(providers: any[]) {
    const fastest = providers.reduce((min, current) => {
      const currentHealth = this.providerHealth.get(current.provider_alias);
      const minHealth = this.providerHealth.get(min.provider_alias);
      
      if (!currentHealth) return min;
      if (!minHealth) return current;
      
      return currentHealth.avg_response_time < minHealth.avg_response_time ? current : min;
    });

    const health = this.providerHealth.get(fastest.provider_alias);
    
    return {
      provider: fastest.provider_alias,
      reason: `Fastest response time (${health?.avg_response_time}ms)`,
      cost: this.estimateCost(fastest.provider_alias, 100)
    };
  }

  private static routeWithFailover(providers: any[], amount: number) {
    // Try providers in order until one is available
    for (const provider of providers) {
      const health = this.providerHealth.get(provider.provider_alias);
      if (health && health.health_status === 'HEALTHY' && !health.circuit_breaker_open) {
        return {
          provider: provider.provider_alias,
          reason: 'Primary provider available',
          cost: this.estimateCost(provider.provider_alias, amount)
        };
      }
    }

    // Fallback to degraded providers
    const degraded = providers.find(p => {
      const health = this.providerHealth.get(p.provider_alias);
      return health && health.health_status === 'DEGRADED';
    });

    if (degraded) {
      return {
        provider: degraded.provider_alias,
        reason: 'Failover to degraded provider',
        cost: this.estimateCost(degraded.provider_alias, amount)
      };
    }

    throw new Error('No providers available for failover');
  }

  private static estimateCost(providerAlias: string, amount: number): number {
    // Simplified cost estimation - in real implementation, this would use fee policies
    const baseCosts: Record<string, { percentage: number; fixed: number }> = {
      'stripe_main': { percentage: 2.9, fixed: 0.30 },
      'adyen_eu': { percentage: 2.6, fixed: 0.25 },
      'paypal_exp': { percentage: 3.4, fixed: 0.35 },
      'square_pos': { percentage: 2.75, fixed: 0.15 }
    };

    const cost = baseCosts[providerAlias] || { percentage: 3.0, fixed: 0.30 };
    return (amount * cost.percentage / 100) + cost.fixed;
  }
}

export class FxEngine {
  private static fxPolicies: Map<string, FxPolicy> = new Map();
  private static fxSnapshots: Map<string, any> = new Map();

  static setFxPolicies(policies: FxPolicy[]) {
    this.fxPolicies.clear();
    policies.forEach(p => this.fxPolicies.set(`${p.scope_type}:${p.scope_id}`, p));
  }

  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    scopeType: string,
    scopeId: string
  ): Promise<{
    convertedAmount: number;
    fxSnapshot: any;
    marginEarned: number;
    rawRate: number;
    finalRate: number;
  }> {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        fxSnapshot: null,
        marginEarned: 0,
        rawRate: 1.0,
        finalRate: 1.0
      };
    }

    const policy = this.findApplicablePolicy(scopeType, scopeId);
    const rawRate = await this.getRawRate(fromCurrency, toCurrency);
    
    // Apply markup and spread
    const markup = rawRate * (policy.markup_bps / 10000);
    const finalRate = rawRate + markup + policy.fixed_spread;
    
    // Round using specified rounding mode
    const convertedAmount = CurrencyFormatter.roundAmount(
      amount * finalRate, 
      6, 
      policy.rounding_mode
    );

    const marginEarned = amount * (markup + policy.fixed_spread);

    const fxSnapshot = {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      raw_rate: rawRate,
      final_rate: finalRate,
      markup_bps: policy.markup_bps,
      fixed_spread: policy.fixed_spread,
      rounding_mode: policy.rounding_mode,
      created_at: new Date().toISOString()
    };

    return {
      convertedAmount,
      fxSnapshot,
      marginEarned,
      rawRate,
      finalRate
    };
  }

  private static findApplicablePolicy(scopeType: string, scopeId: string): FxPolicy {
    // Try to find specific policy, fallback to system default
    const specificPolicy = this.fxPolicies.get(`${scopeType}:${scopeId}`);
    if (specificPolicy) return specificPolicy;

    const systemPolicy = this.fxPolicies.get('SUPER_ADMIN:system');
    if (systemPolicy) return systemPolicy;

    // Default policy
    return {
      policy_id: 'default',
      scope_type: 'SUPER_ADMIN',
      scope_id: 'system',
      markup_bps: 50,
      fixed_spread: 0.001,
      rounding_mode: 'BANKERS',
      staleness_cap_minutes: 60,
      weekend_mode: 'FREEZE',
      enabled_sources: [],
      fallback_source: '',
      created_at: new Date().toISOString()
    };
  }

  private static async getRawRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Simplified rate lookup - in real implementation, this would query external APIs
    const rates: Record<string, number> = {
      'USD:EUR': 0.925847,
      'EUR:USD': 1.080234,
      'USD:GBP': 0.789456,
      'GBP:USD': 1.267845,
      'BTC:USD': 42567.891234,
      'USD:BTC': 0.000023456,
      'USDT:USD': 0.999876,
      'USD:USDT': 1.000124
    };

    const pair = `${fromCurrency}:${toCurrency}`;
    return rates[pair] || 1.0;
  }
}

export class PricingEngine {
  private static feePolicies: Map<string, FeePolicy[]> = new Map();

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

  static async calculateFee(
    amount: number,
    currency: string,
    channelType: string,
    providerAlias: string,
    merchantId: string
  ): Promise<any> {
    const applicablePolicies = this.getFeeCascade(merchantId, channelType, providerAlias);
    
    let totalPercentage = 0;
    let totalFixed = 0;
    let minCap = 0;
    let maxCap = Number.MAX_VALUE;
    const markupLevels: any[] = [];

    // Apply fee cascade
    for (const policy of applicablePolicies) {
      if (policy.override_lower_levels) {
        // Reset and use only this policy
        totalPercentage = policy.percentage;
        totalFixed = policy.fixed_amount;
        minCap = policy.min_cap;
        maxCap = policy.max_cap;
        markupLevels.length = 0;
        markupLevels.push({
          level: policy.scope_type,
          percentage: policy.percentage,
          fixed: policy.fixed_amount
        });
      } else {
        // Add to existing fees
        totalPercentage += policy.percentage;
        totalFixed += policy.fixed_amount;
        minCap = Math.max(minCap, policy.min_cap);
        maxCap = Math.min(maxCap, policy.max_cap);
        markupLevels.push({
          level: policy.scope_type,
          percentage: policy.percentage,
          fixed: policy.fixed_amount
        });
      }
    }

    const percentageFee = (amount * totalPercentage) / 100;
    let merchantFee = percentageFee + totalFixed;

    // Apply caps
    const minCapApplied = merchantFee < minCap;
    const maxCapApplied = merchantFee > maxCap;
    
    if (minCapApplied) merchantFee = minCap;
    if (maxCapApplied) merchantFee = maxCap;

    // Estimate provider cost (simplified)
    const providerCost = this.estimateProviderCost(amount, providerAlias);
    const profit = merchantFee - providerCost;

    return {
      fee_id: `fb_${Date.now()}`,
      transaction_id: '',
      provider_cost_native: providerCost,
      provider_cost_currency: currency,
      provider_cost_converted: providerCost,
      merchant_fee: merchantFee,
      fee_currency: currency,
      profit: profit,
      profit_currency: currency,
      fx_rate_used: 1.0,
      rounding_mode: 'BANKERS',
      scale: 6,
      calculation_details: {
        base_amount: amount,
        percentage_fee: percentageFee,
        fixed_fee: totalFixed,
        min_cap_applied: minCapApplied,
        max_cap_applied: maxCapApplied,
        markup_levels: markupLevels
      },
      created_at: new Date().toISOString()
    };
  }

  private static getFeeCascade(merchantId: string, channelType: string, providerAlias: string): FeePolicy[] {
    const cascade: FeePolicy[] = [];
    
    // System level
    const systemPolicies = this.feePolicies.get('SUPER_ADMIN:system') || [];
    cascade.push(...systemPolicies.filter(p => 
      (!p.channel_type || p.channel_type === channelType) &&
      (!p.provider_alias || p.provider_alias === providerAlias)
    ));

    // Partner level (simplified - would need merchant->agent->partner lookup)
    const partnerPolicies = this.feePolicies.get('PARTNER:ptr_001') || [];
    cascade.push(...partnerPolicies.filter(p => 
      (!p.channel_type || p.channel_type === channelType) &&
      (!p.provider_alias || p.provider_alias === providerAlias)
    ));

    // Agent level
    const agentPolicies = this.feePolicies.get('AGENT:agt_001') || [];
    cascade.push(...agentPolicies.filter(p => 
      (!p.channel_type || p.channel_type === channelType) &&
      (!p.provider_alias || p.provider_alias === providerAlias)
    ));

    // Merchant level
    const merchantPolicies = this.feePolicies.get(`MERCHANT:${merchantId}`) || [];
    cascade.push(...merchantPolicies.filter(p => 
      (!p.channel_type || p.channel_type === channelType) &&
      (!p.provider_alias || p.provider_alias === providerAlias)
    ));

    return cascade;
  }

  private static estimateProviderCost(amount: number, providerAlias: string): number {
    const providerCosts: Record<string, { percentage: number; fixed: number }> = {
      'stripe_main': { percentage: 2.4, fixed: 0.25 },
      'adyen_eu': { percentage: 2.2, fixed: 0.20 },
      'paypal_exp': { percentage: 2.8, fixed: 0.30 }
    };

    const cost = providerCosts[providerAlias] || { percentage: 2.5, fixed: 0.25 };
    return (amount * cost.percentage / 100) + cost.fixed;
  }
}