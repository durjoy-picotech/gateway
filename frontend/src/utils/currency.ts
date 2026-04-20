import { Currency, MoneyAmount, RoundingMode, PrecisionMode } from '../types/currency';

export class CurrencyFormatter {
  private static currencies: Map<string, Currency> = new Map();
  private static precisionMode: PrecisionMode = 'DISPLAY';

  static setCurrencies(currencies: Currency[]) {
    this.currencies.clear();
    currencies.forEach(currency => {
      this.currencies.set(currency.code, currency);
    });
  }

  static setPrecisionMode(mode: PrecisionMode) {
    this.precisionMode = mode;
  }

  static getPrecisionMode(): PrecisionMode {
    return this.precisionMode;
  }

  static getCurrency(code: string): Currency | undefined {
    return this.currencies.get(code);
  }

  static formatMoney(
    amount: number | string,
    currencyCode: string,
    options?: {
      precision?: number;
      showSymbol?: boolean;
      showCode?: boolean;
      roundingMode?: RoundingMode;
    }
  ): MoneyAmount {
    if (!currencyCode) {
      throw new Error(`Currency code is required`);
    }
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    // Convert string to number if needed
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Handle invalid amounts
    if (isNaN(numericAmount)) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const precision = options?.precision ?? (this.precisionMode === 'FULL' ? 6 : 2);
    const roundingMode = options?.roundingMode ?? 'BANKERS';

    const roundedAmount = this.roundAmount(numericAmount, precision, roundingMode);
    const displayAmount = this.formatDisplayAmount(roundedAmount, currency, precision, options);

    return {
      amount: roundedAmount,
      currency: currencyCode,
      precision,
      display_amount: displayAmount,
      raw_amount: numericAmount.toFixed(6)
    };
  }

  private static roundAmount(amount: number | string, precision: number, mode: RoundingMode): number {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(numericAmount)) {
      throw new Error(`Invalid amount for rounding: ${amount}`);
    }

    const factor = Math.pow(10, precision);

    switch (mode) {
      case 'BANKERS':
        return this.bankersRounding(numericAmount, factor);
      case 'HALF_UP':
        return Math.round(numericAmount * factor) / factor;
      case 'HALF_DOWN':
        return Math.floor(numericAmount * factor + 0.5) / factor;
      case 'TRUNCATE':
        return Math.trunc(numericAmount * factor) / factor;
      default:
        return this.bankersRounding(numericAmount, factor);
    }
  }

  private static bankersRounding(amount: number, factor: number): number {
    const scaled = amount * factor;
    const integer = Math.floor(scaled);
    const fraction = scaled - integer;
    
    if (fraction < 0.5) {
      return integer / factor;
    } else if (fraction > 0.5) {
      return (integer + 1) / factor;
    } else {
      // Exactly 0.5 - round to even
      return (integer % 2 === 0 ? integer : integer + 1) / factor;
    }
  }

  private static formatDisplayAmount(
    amount: number, 
    currency: Currency, 
    precision: number,
    options?: {
      showSymbol?: boolean;
      showCode?: boolean;
    }
  ): string {
    const formatted = amount.toFixed(precision);
    const showSymbol = options?.showSymbol ?? true;
    const showCode = options?.showCode ?? false;
    
    if (showSymbol && currency.symbol) {
      return `${currency.symbol}${formatted}`;
    } else if (showCode) {
      return `${formatted} ${currency.code}`;
    } else {
      return formatted;
    }
  }

  static convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRate: number,
    roundingMode: RoundingMode = 'BANKERS'
  ): MoneyAmount {
    const convertedAmount = amount * exchangeRate;
    return this.formatMoney(convertedAmount, toCurrency, { roundingMode });
  }

  static calculateFee(
    baseAmount: number,
    feePercentage: number,
    fixedFee: number,
    currency: string,
    roundingMode: RoundingMode = 'BANKERS'
  ): MoneyAmount {
    const percentageFee = (baseAmount * feePercentage) / 100;
    const totalFee = percentageFee + fixedFee;
    return this.formatMoney(totalFee, currency, { roundingMode });
  }

  static addAmounts(amounts: MoneyAmount[]): MoneyAmount {
    if (amounts.length === 0) {
      throw new Error('Cannot add empty amounts array');
    }

    const currency = amounts[0].currency;
    if (!amounts.every(a => a.currency === currency)) {
      throw new Error('All amounts must be in the same currency');
    }

    const total = amounts.reduce((sum, amount) => sum + amount.amount, 0);
    return this.formatMoney(total, currency);
  }

  static subtractAmounts(minuend: MoneyAmount, subtrahend: MoneyAmount): MoneyAmount {
    if (minuend.currency !== subtrahend.currency) {
      throw new Error('Cannot subtract amounts in different currencies');
    }

    const result = minuend.amount - subtrahend.amount;
    return this.formatMoney(result, minuend.currency);
  }
}

export const formatCurrency = (
  amount: number | string,
  currency: string,
  options?: {
    precision?: number;
    showSymbol?: boolean;
    showCode?: boolean;
  }
): string => {
  return CurrencyFormatter.formatMoney(amount, currency, options).display_amount;
};

export const parseMoneyInput = (input: string, currency: string): number => {
  // Remove currency symbols and codes
  const cleaned = input.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed)) {
    throw new Error('Invalid money input');
  }
  
  return parsed;
};