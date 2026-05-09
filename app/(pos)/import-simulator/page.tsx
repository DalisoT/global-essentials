'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { Plane, Save, ArrowRight, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { ShippingTypeSelector } from '@/components/import-simulator/ShippingTypeSelector';
import { ExchangeRateInput } from '@/components/import-simulator/ExchangeRateInput';
import { CostBreakdown } from '@/components/import-simulator/CostBreakdown';
import { ProfitIndicator } from '@/components/import-simulator/ProfitIndicator';
import { AddToInventoryButton } from '@/components/import-simulator/AddToInventoryButton';
import { ShippingRecommender } from '@/components/import-simulator/ShippingRecommender';
import { ProfitabilityAdvisor } from '@/components/import-simulator/ProfitabilityAdvisor';
import { CashFlowImpact } from '@/components/import-simulator/CashFlowImpact';
import { BreakEvenCalculator } from '@/components/import-simulator/BreakEvenCalculator';
import { DemandIndicator } from '@/components/import-simulator/DemandIndicator';
import { calculateLandedCost, type CalculationResult } from '@/lib/import/calculator';
import { SHIPPING_TYPES, type ShippingTypeId } from '@/lib/import/shipping-types';
import { getShippingRates, getCustomExchangeRate, saveCustomExchangeRate } from '@/lib/actions/import-simulator';
import { getImportAdvisor } from '@/lib/actions/import-advisor';
import { fetchLiveUSDToZMW } from '@/lib/currency/rates';
import { useImportSimulatorStore } from '@/stores/import-simulator-store';
import type { ShippingRate } from '@/lib/supabase-types';
import type { ImportAdvisorOutput } from '@/lib/import/advisor-types';

function ImportSimulatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Store preferences
  const { defaultExchangeRate, calculationMode, defaultMarkupPercent, setDefaultExchangeRate, setCalculationMode, manualShippingRate, setManualShippingRate } = useImportSimulatorStore();

  // Form state
  const [productName, setProductName] = useState('');
  const [unitCostUSD, setUnitCostUSD] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weightPerUnit, setWeightPerUnit] = useState('');
  const [volumePerUnit, setVolumePerUnit] = useState('');
  const [shippingType, setShippingType] = useState<ShippingTypeId>('air_general_7days');
  const [exchangeRate, setExchangeRate] = useState(defaultExchangeRate);
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [markupPercentInput, setMarkupPercentInput] = useState(defaultMarkupPercent.toString());

  // UI state
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isRefreshingRate, setIsRefreshingRate] = useState(false);
  const [rateSource, setRateSource] = useState<'api' | 'cache' | 'fallback' | 'manual'>('manual');
  const [showProfit, setShowProfit] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(true);
  const [advisorOutput, setAdvisorOutput] = useState<ImportAdvisorOutput | null>(null);
  const [isLoadingAdvisor, setIsLoadingAdvisor] = useState(false);

  // Load rates and exchange rate on mount
  useEffect(() => {
    async function loadData() {
      console.log('[ImportSimulator] loadData started');
      const { data: rates, error } = await getShippingRates();
      console.log('[ImportSimulator] Shipping rates result:', { count: rates?.length, error });
      if (error || !rates || rates.length === 0) {
        setShippingRates([]);
      } else {
        setShippingRates(rates);
      }

      setIsRefreshingRate(true);
      try {
        const { rate, source } = await fetchLiveUSDToZMW();
        setExchangeRate(rate);
        setRateSource(source);
        setDefaultExchangeRate(rate);
      } catch (rateErr) {
        console.error('[ImportSimulator] Rate fetch error:', rateErr);
      }
      setIsRefreshingRate(false);
    }
    loadData().catch(err => console.error('[ImportSimulator] loadData error:', err));
  }, [setDefaultExchangeRate]);

  // Manual override sets source to manual
  useEffect(() => {
    setRateSource('manual');
  }, [exchangeRate]);

  const handleRefreshRate = async () => {
    setIsRefreshingRate(true);
    const { rate, source } = await fetchLiveUSDToZMW();
    setExchangeRate(rate);
    setRateSource(source);
    setDefaultExchangeRate(rate);
    setIsRefreshingRate(false);
    toast.success(`Rate updated: K${rate.toFixed(2)} (${source})`);
  };

  // Handle prefill from URL (from Add to Inventory button)
  useEffect(() => {
    const name = searchParams.get('name');
    const costPrice = searchParams.get('cost_price');
    const sellingPrice = searchParams.get('selling_price');

    if (name) setProductName(decodeURIComponent(name));
    if (costPrice) setUnitCostUSD(parseFloat(costPrice).toFixed(2));
    if (sellingPrice) {
      setSellingPriceInput(parseFloat(sellingPrice).toFixed(2));
      setCalculationMode('selling_price');
      setShowProfit(true);
    }

    if (name || costPrice || sellingPrice) {
      window.history.replaceState({}, '', '/import-simulator');
    }
  }, [searchParams, setCalculationMode]);

  // Call advisor when inputs change
  useEffect(() => {
    if (!hasRequiredFields) {
      setAdvisorOutput(null);
      return;
    }
    if (!sellingPriceInput && !markupPercentInput) {
      setAdvisorOutput(null);
      return;
    }

    let cancelled = false;
    setIsLoadingAdvisor(true);

    getImportAdvisor({
      productName,
      unitCostUSD: parseFloat(unitCostUSD),
      quantity: parseInt(quantity),
      weightPerUnitKg: parseFloat(weightPerUnit),
      volumePerUnitCBM: volumePerUnit ? parseFloat(volumePerUnit) : null,
      exchangeRate,
      sellingPriceLocal: calculationMode === 'selling_price' && sellingPriceInput ? parseFloat(sellingPriceInput) : undefined,
      markupPercent: calculationMode === 'markup' && markupPercentInput ? parseFloat(markupPercentInput) : undefined,
    }, shippingRates)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[ImportSimulator] Advisor error:', error);
        }
        setAdvisorOutput(data || null);
        setIsLoadingAdvisor(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[ImportSimulator] Advisor exception:', err);
        setIsLoadingAdvisor(false);
      });

    return () => { cancelled = true; };
  }, [productName, unitCostUSD, quantity, weightPerUnit, volumePerUnit, exchangeRate, sellingPriceInput, markupPercentInput, calculationMode, shippingRates]);

  // Calculate result
  const result = useMemo<CalculationResult | null>(() => {
    if (!unitCostUSD || !quantity || !weightPerUnit) return null;

    const input = {
      productName,
      unitCostUSD: parseFloat(unitCostUSD),
      quantity: parseInt(quantity),
      weightPerUnitKg: parseFloat(weightPerUnit),
      volumePerUnitCBM: volumePerUnit ? parseFloat(volumePerUnit) : null,
      shippingType,
      exchangeRate,
      sellingPriceLocal: calculationMode === 'selling_price' && sellingPriceInput ? parseFloat(sellingPriceInput) : undefined,
      markupPercent: calculationMode === 'markup' && markupPercentInput ? parseFloat(markupPercentInput) : undefined,
      manualShippingRate: manualShippingRate,
    };

    return calculateLandedCost(input, shippingRates);
  }, [productName, unitCostUSD, quantity, weightPerUnit, volumePerUnit, shippingType, exchangeRate, sellingPriceInput, markupPercentInput, calculationMode, shippingRates, manualShippingRate]);

  const handleSaveExchangeRate = async () => {
    setIsSavingRate(true);
    const { error } = await saveCustomExchangeRate(exchangeRate);
    setIsSavingRate(false);

    if (error) {
      toast.error('Failed to save exchange rate');
    } else {
      setDefaultExchangeRate(exchangeRate);
      toast.success('Exchange rate saved');
    }
  };

  const handleApplySuggestedPrice = (price: number) => {
    setSellingPriceInput(price.toFixed(2));
    setCalculationMode('selling_price');
    setShowProfit(true);
    toast.success('Selling price applied');
  };

  const handleSelectShipping = (methodId: ShippingTypeId) => {
    setShippingType(methodId);
    toast.info(`Switched to ${SHIPPING_TYPES.find(st => st.id === methodId)?.name || methodId}`);
  };

  const hasRequiredFields = unitCostUSD && parseFloat(unitCostUSD) > 0 && quantity && parseInt(quantity) > 0 && weightPerUnit && parseFloat(weightPerUnit) > 0;
  const hasPricing = (calculationMode === 'selling_price' && sellingPriceInput && parseFloat(sellingPriceInput) > 0) ||
    (calculationMode === 'markup' && markupPercentInput && parseFloat(markupPercentInput) > 0);

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-tactical-blue/20 flex items-center justify-center">
          <Plane className="w-5 h-5 text-tactical-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Import Simulator</h1>
          <p className="text-xs text-white/60 uppercase tracking-wider">Landed Cost Calculator</p>
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="card-tactical">
        <ExchangeRateInput
          rate={exchangeRate}
          onRateChange={setExchangeRate}
          onSaveDefault={handleSaveExchangeRate}
          onRefresh={handleRefreshRate}
          isSaving={isSavingRate}
          isRefreshing={isRefreshingRate}
          source={rateSource}
        />
      </div>

      {/* Product Details */}
      <div className="card-tactical space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">Product Details</h3>

        <div className="space-y-3">
          {/* Product Name */}
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Product Name"
            className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
          />

          {/* Unit Cost and Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Unit Cost (USD)</label>
              <input
                type="number"
                value={unitCostUSD}
                onChange={(e) => setUnitCostUSD(e.target.value)}
                placeholder="0.00"
                className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
              />
            </div>
          </div>

          {/* Weight and Volume */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Weight per Unit (kg)</label>
              <input
                type="number"
                value={weightPerUnit}
                onChange={(e) => setWeightPerUnit(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Volume per Unit (CBM) [optional]</label>
              <input
                type="number"
                value={volumePerUnit}
                onChange={(e) => setVolumePerUnit(e.target.value)}
                placeholder="0.00"
                step="0.001"
                className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Advisor Panel */}
      {hasRequiredFields && hasPricing && (
        <div className="card-tactical space-y-4">
          {/* Advisor Header */}
          <button
            onClick={() => setShowAdvisor(!showAdvisor)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-tactical-neon" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-tactical-neon">
                Smart Advisor
              </h3>
              {isLoadingAdvisor && (
                <RefreshCw className="w-3 h-3 text-tactical-neon animate-spin" />
              )}
            </div>
            {showAdvisor ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </button>

          {showAdvisor && advisorOutput && (
            <div className="space-y-4">
              {/* Shipping Recommender — always show if we have data */}
              {advisorOutput.shippingRecommendation && (
                <ShippingRecommender
                  recommendation={advisorOutput.shippingRecommendation}
                  onSelectMethod={handleSelectShipping}
                />
              )}

              {/* Profitability Advisor */}
              {advisorOutput.profitabilityAdvice && (
                <ProfitabilityAdvisor
                  advice={advisorOutput.profitabilityAdvice}
                  onApplyPrice={handleApplySuggestedPrice}
                />
              )}

              {/* Break-Even Calculator */}
              {advisorOutput.breakEven && (
                <BreakEvenCalculator result={advisorOutput.breakEven} />
              )}

              {/* Cash Flow Impact */}
              {advisorOutput.cashFlowImpact && (
                <CashFlowImpact impact={advisorOutput.cashFlowImpact} />
              )}

              {/* Demand Indicator */}
              {advisorOutput.demandAdjustment && (
                <DemandIndicator
                  adjustment={advisorOutput.demandAdjustment}
                  onSelectShipping={handleSelectShipping}
                />
              )}
            </div>
          )}

          {!showAdvisor && !isLoadingAdvisor && (
            <p className="text-xs text-white/40 text-center">
              Tap to reveal AI-powered shipping recommendations
            </p>
          )}
        </div>
      )}

      {/* Shipping Method */}
      <div className="card-tactical">
        <ShippingTypeSelector
          selected={shippingType}
          onChange={setShippingType}
          manualRate={manualShippingRate}
          onManualRateChange={setManualShippingRate}
          hasRates={shippingRates.length > 0}
        />
      </div>

      {/* Pricing */}
      <div className="card-tactical space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">Pricing</h3>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setCalculationMode('markup'); setShowProfit(false); }}
            className={cn(
              'flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all',
              calculationMode === 'markup'
                ? 'bg-tactical-blue text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            Use Markup %
          </button>
          <button
            onClick={() => { setCalculationMode('selling_price'); setShowProfit(true); }}
            className={cn(
              'flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all',
              calculationMode === 'selling_price'
                ? 'bg-tactical-blue text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            Use Selling Price
          </button>
        </div>

        {/* Input based on mode */}
        {calculationMode === 'markup' ? (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Markup Percentage</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={markupPercentInput}
                onChange={(e) => setMarkupPercentInput(e.target.value)}
                placeholder="30"
                className="flex-1 h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
              />
              <span className="h-14 flex items-center text-white/60 font-bold">%</span>
            </div>
            <button
              onClick={() => setShowProfit(true)}
              className="w-full mt-2 py-3 rounded-xl bg-tactical-slate text-white/80 font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Calculate Profit
            </button>
          </div>
        ) : (
          <div>
            <label className="text-xs text-white/40 mb-1 block">Selling Price per Unit (ZMW)</label>
            <input
              type="number"
              value={sellingPriceInput}
              onChange={(e) => setSellingPriceInput(e.target.value)}
              placeholder="0.00"
              className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
            />
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Cost Breakdown */}
          <div className="card-tactical">
            <CostBreakdown result={result} />
          </div>

          {/* Profit Indicator */}
          {showProfit && result.profitPerUnit && (
            <div className="card-tactical">
              <ProfitIndicator result={result} />
            </div>
          )}

          {/* Add to Inventory */}
          {showProfit && result.profitPerUnit && (
            <AddToInventoryButton
              productName={productName}
              result={result}
            />
          )}
        </div>
      )}

      {/* Shipping Info Footer */}
      <div className="text-center text-xs text-white/40 space-y-1">
        <p>Powered by TODAY CARGO</p>
        <p>Air: Mon & Thu | Sea: Wed & Fri</p>
      </div>
    </div>
  );
}

export default function ImportSimulatorPage() {
  return (
    <Suspense fallback={<div className="p-4 text-white/60">Loading...</div>}>
      <ImportSimulatorContent />
    </Suspense>
  );
}
