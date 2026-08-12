import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import CheckoutChargesConfig, {
  type DeliveryMode,
  type IBranchDeliveryRule,
  type ICheckoutChargesConfig,
  type IValueSlab,
  type TaxApplyOn,
  type TaxCalculationType,
} from "@/models/CheckoutChargesConfig";
import { fromPaise, toPaise } from "@/lib/checkout/money";

export interface CheckoutChargesSettings {
  id?: string;
  version: string;
  tax: {
    enabled: boolean;
    name: string;
    code: string;
    calculationType: TaxCalculationType;
    rate: number;
    fixedAmount: number;
    applyOn: TaxApplyOn;
    taxDeliveryFee: boolean;
  };
  delivery: {
    enabled: boolean;
    mode: DeliveryMode;
    flatFee: number;
    freeDeliveryThreshold: number | null;
    minimumOrder: number;
    maximumDistanceKm: number | null;
    orderValueSlabs: IValueSlab[];
    distanceSlabs: IValueSlab[];
    branchRules: Array<{ branchId: string; fee: number; freeDeliveryThreshold: number | null }>;
  };
  currency: "INR";
}

export interface OrderTotalsInput {
  subtotal: number;
  couponDiscount?: number;
  damruDiscount?: number;
  orderType: "delivery" | "dine_in";
  branchId?: string;
  distanceKm?: number;
}

export interface OrderTotals {
  subtotal: number;
  couponDiscount: number;
  eligibleSubtotal: number;
  deliveryFee: number;
  taxAmount: number;
  damruDiscount: number;
  finalAmount: number;
  taxName: string;
  taxRate: number | null;
  taxCalculationType: TaxCalculationType | null;
  taxApplyOn: TaxApplyOn | null;
  taxDeliveryFee: boolean;
  deliveryMode: DeliveryMode | null;
  appliedDeliveryRule: string;
  freeDeliveryApplied: boolean;
  configId?: string;
  configVersion: string;
  currency: "INR";
}

export class CheckoutPricingError extends Error {
  constructor(public code: "MINIMUM_ORDER" | "DELIVERY_UNAVAILABLE" | "INVALID_TOTALS", message: string) {
    super(message);
  }
}

function finiteNonNegative(value: unknown, name: string, max = 1_000_000): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error(`${name} must be between 0 and ${max}.`);
  return fromPaise(toPaise(number));
}

function normalizeSlabs(value: unknown, name: string): IValueSlab[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be a list.`);
  const slabs = value.map((row, index) => {
    const item = row as Partial<IValueSlab>;
    const min = finiteNonNegative(item.min, `${name} row ${index + 1} minimum`);
    const max = item.max == null ? null : finiteNonNegative(item.max, `${name} row ${index + 1} maximum`);
    const fee = finiteNonNegative(item.fee, `${name} row ${index + 1} fee`);
    if (max !== null && min > max) throw new Error(`${name} row ${index + 1} minimum cannot exceed its maximum.`);
    return { min, max, fee };
  }).sort((a, b) => a.min - b.min);

  for (let index = 0; index < slabs.length; index += 1) {
    const current = slabs[index];
    if (index === 0 && current.min !== 0) throw new Error(`${name} must start at 0.`);
    if (index < slabs.length - 1) {
      if (current.max === null) throw new Error(`Only the final ${name} row may have no maximum.`);
      const next = slabs[index + 1];
      if (toPaise(next.min) !== toPaise(current.max) + 1) throw new Error(`${name} cannot contain gaps or overlaps.`);
    }
  }
  return slabs;
}

export function validateCheckoutCharges(input: unknown): CheckoutChargesSettings {
  const body = input as Partial<CheckoutChargesSettings>;
  if (!body || typeof body !== "object") throw new Error("Configuration is required.");
  const tax = body.tax as Partial<CheckoutChargesSettings["tax"]>;
  const delivery = body.delivery as Partial<CheckoutChargesSettings["delivery"]>;
  if (!tax || !delivery) throw new Error("Tax and delivery configuration are required.");

  const taxType = tax.calculationType;
  if (taxType !== "PERCENTAGE" && taxType !== "FIXED") throw new Error("Select a valid tax calculation type.");
  const applyOn = tax.applyOn;
  if (applyOn !== "MERCHANDISE_SUBTOTAL" && applyOn !== "AFTER_DISCOUNTS") throw new Error("Select a valid tax basis.");
  const mode = delivery.mode;
  if (!["FLAT", "ORDER_VALUE", "DISTANCE", "BRANCH_BASED"].includes(mode || "")) throw new Error("Select a valid delivery mode.");
  const rate = finiteNonNegative(tax.rate, "Tax rate", 100);
  const fixedAmount = finiteNonNegative(tax.fixedAmount, "Fixed tax amount");

  const branchRules = Array.isArray(delivery.branchRules) ? delivery.branchRules.map((rule, index) => {
    const branchId = String(rule.branchId || "");
    if (!mongoose.isValidObjectId(branchId)) throw new Error(`Branch rule ${index + 1} has an invalid branch.`);
    return {
      branchId,
      fee: finiteNonNegative(rule.fee, `Branch rule ${index + 1} fee`),
      freeDeliveryThreshold: rule.freeDeliveryThreshold === null || rule.freeDeliveryThreshold === undefined
        ? null : finiteNonNegative(rule.freeDeliveryThreshold, `Branch rule ${index + 1} threshold`),
    };
  }) : [];
  if (new Set(branchRules.map(rule => rule.branchId)).size !== branchRules.length) throw new Error("Each branch can have only one delivery rule.");

  return {
    version: body.version || "draft",
    tax: {
      enabled: Boolean(tax.enabled),
      name: String(tax.name || "Tax").trim().slice(0, 40),
      code: String(tax.code || "TAX").trim().toUpperCase().slice(0, 20),
      calculationType: taxType,
      rate,
      fixedAmount,
      applyOn,
      taxDeliveryFee: Boolean(tax.taxDeliveryFee),
    },
    delivery: {
      enabled: Boolean(delivery.enabled),
      mode: mode as DeliveryMode,
      flatFee: finiteNonNegative(delivery.flatFee, "Flat delivery fee"),
      freeDeliveryThreshold: delivery.freeDeliveryThreshold === null || delivery.freeDeliveryThreshold === undefined
        ? null : finiteNonNegative(delivery.freeDeliveryThreshold, "Free delivery threshold"),
      minimumOrder: finiteNonNegative(delivery.minimumOrder, "Minimum delivery order"),
      maximumDistanceKm: delivery.maximumDistanceKm === null || delivery.maximumDistanceKm === undefined
        ? null : finiteNonNegative(delivery.maximumDistanceKm, "Maximum delivery distance", 100),
      orderValueSlabs: normalizeSlabs(delivery.orderValueSlabs || [], "Order-value slabs"),
      distanceSlabs: normalizeSlabs(delivery.distanceSlabs || [], "Distance slabs"),
      branchRules,
    },
    currency: "INR",
  };
}

function plainConfig(doc: ICheckoutChargesConfig): CheckoutChargesSettings {
  return {
    id: String(doc._id),
    version: doc.updatedAt?.toISOString() || String(doc._id),
    tax: {
      enabled: doc.tax.enabled,
      name: doc.tax.name,
      code: doc.tax.code,
      calculationType: doc.tax.calculationType,
      rate: doc.tax.rate,
      fixedAmount: doc.tax.fixedAmount,
      applyOn: doc.tax.applyOn,
      taxDeliveryFee: doc.tax.taxDeliveryFee,
    },
    delivery: {
      enabled: doc.delivery.enabled,
      mode: doc.delivery.mode,
      flatFee: doc.delivery.flatFee,
      freeDeliveryThreshold: doc.delivery.freeDeliveryThreshold,
      minimumOrder: doc.delivery.minimumOrder,
      maximumDistanceKm: doc.delivery.maximumDistanceKm,
      orderValueSlabs: doc.delivery.orderValueSlabs.map(row => ({ min: row.min, max: row.max, fee: row.fee })),
      distanceSlabs: doc.delivery.distanceSlabs.map(row => ({ min: row.min, max: row.max, fee: row.fee })),
      branchRules: doc.delivery.branchRules.map((row: IBranchDeliveryRule) => ({ branchId: String(row.branchId), fee: row.fee, freeDeliveryThreshold: row.freeDeliveryThreshold })),
    },
    currency: "INR",
  };
}

export async function getCheckoutChargesConfig(): Promise<CheckoutChargesSettings> {
  await connectDB();
  const doc = await CheckoutChargesConfig.findOne().lean<ICheckoutChargesConfig>();
  if (doc) return plainConfig(doc);

  const legacy = await SiteSettings.findOne().select("taxRate freeDeliveryAbove deliveryCharge deliveryRadiusKm").lean<{
    taxRate?: number; freeDeliveryAbove?: number; deliveryCharge?: number; deliveryRadiusKm?: number;
  }>();
  return validateCheckoutCharges({
    version: "legacy-defaults",
    tax: { enabled: true, name: "GST", code: "GST", calculationType: "PERCENTAGE", rate: legacy?.taxRate ?? 5, fixedAmount: 0, applyOn: "AFTER_DISCOUNTS", taxDeliveryFee: false },
    delivery: { enabled: true, mode: "FLAT", flatFee: legacy?.deliveryCharge ?? 50, freeDeliveryThreshold: legacy?.freeDeliveryAbove ?? 500, minimumOrder: 0, maximumDistanceKm: legacy?.deliveryRadiusKm ?? 10, orderValueSlabs: [], distanceSlabs: [], branchRules: [] },
    currency: "INR",
  });
}

function findSlab(slabs: IValueSlab[], value: number): IValueSlab | undefined {
  const paise = toPaise(value);
  return slabs.find(slab => paise >= toPaise(slab.min) && (slab.max === null || paise <= toPaise(slab.max)));
}

export function calculateOrderTotals(config: CheckoutChargesSettings, input: OrderTotalsInput): OrderTotals {
  const subtotalPaise = toPaise(finiteNonNegative(input.subtotal, "Subtotal"));
  const couponPaise = Math.min(subtotalPaise, toPaise(finiteNonNegative(input.couponDiscount || 0, "Coupon discount")));
  const eligiblePaise = Math.max(0, subtotalPaise - couponPaise);
  const eligible = fromPaise(eligiblePaise);
  let deliveryPaise = 0;
  let appliedDeliveryRule = input.orderType === "dine_in" ? "DINE_IN_FREE" : "DELIVERY_DISABLED";
  let freeDeliveryApplied = false;

  if (input.orderType === "delivery" && config.delivery.enabled) {
    if (eligiblePaise < toPaise(config.delivery.minimumOrder)) {
      throw new CheckoutPricingError("MINIMUM_ORDER", `Minimum delivery order is ₹${config.delivery.minimumOrder}.`);
    }
    const globalThreshold = config.delivery.freeDeliveryThreshold;
    if (globalThreshold !== null && eligiblePaise >= toPaise(globalThreshold)) {
      appliedDeliveryRule = "FREE_DELIVERY_THRESHOLD";
      freeDeliveryApplied = true;
    } else if (config.delivery.mode === "FLAT") {
      deliveryPaise = toPaise(config.delivery.flatFee);
      appliedDeliveryRule = "FLAT";
    } else if (config.delivery.mode === "ORDER_VALUE") {
      const slab = findSlab(config.delivery.orderValueSlabs, eligible);
      if (!slab) throw new CheckoutPricingError("DELIVERY_UNAVAILABLE", "No delivery rule is available for this order value.");
      deliveryPaise = toPaise(slab.fee);
      appliedDeliveryRule = `ORDER_VALUE:${slab.min}-${slab.max ?? "UP"}`;
    } else if (config.delivery.mode === "BRANCH_BASED") {
      const rule = config.delivery.branchRules.find(row => row.branchId === input.branchId);
      if (!rule) {
        deliveryPaise = toPaise(config.delivery.flatFee);
        appliedDeliveryRule = "BRANCH_DEFAULT";
      } else if (rule.freeDeliveryThreshold !== null && eligiblePaise >= toPaise(rule.freeDeliveryThreshold)) {
        appliedDeliveryRule = `BRANCH_FREE:${rule.branchId}`;
        freeDeliveryApplied = true;
      } else {
        deliveryPaise = toPaise(rule.fee);
        appliedDeliveryRule = `BRANCH:${rule.branchId}`;
      }
    } else {
      if (!Number.isFinite(input.distanceKm)) throw new CheckoutPricingError("DELIVERY_UNAVAILABLE", "A verified delivery distance is required for this address.");
      const distance = Number(input.distanceKm);
      if (config.delivery.maximumDistanceKm !== null && distance > config.delivery.maximumDistanceKm) {
        throw new CheckoutPricingError("DELIVERY_UNAVAILABLE", `Delivery is available within ${config.delivery.maximumDistanceKm} km.`);
      }
      const slab = findSlab(config.delivery.distanceSlabs, distance);
      if (!slab) throw new CheckoutPricingError("DELIVERY_UNAVAILABLE", "Delivery is unavailable for this distance.");
      deliveryPaise = toPaise(slab.fee);
      appliedDeliveryRule = `DISTANCE:${slab.min}-${slab.max ?? "UP"}`;
    }
  }

  let taxPaise = 0;
  if (config.tax.enabled) {
    const taxBase = config.tax.applyOn === "MERCHANDISE_SUBTOTAL" ? subtotalPaise : eligiblePaise;
    const taxablePaise = taxBase + (config.tax.taxDeliveryFee ? deliveryPaise : 0);
    taxPaise = config.tax.calculationType === "FIXED"
      ? toPaise(config.tax.fixedAmount)
      : Math.round(taxablePaise * config.tax.rate / 100);
  }
  const beforeDamruPaise = eligiblePaise + deliveryPaise + taxPaise;
  const damruPaise = Math.min(beforeDamruPaise, toPaise(finiteNonNegative(input.damruDiscount || 0, "Damru discount")));
  const finalPaise = beforeDamruPaise - damruPaise;
  if (finalPaise < 0) throw new CheckoutPricingError("INVALID_TOTALS", "Final payable amount cannot be negative.");

  return {
    subtotal: fromPaise(subtotalPaise),
    couponDiscount: fromPaise(couponPaise),
    eligibleSubtotal: eligible,
    deliveryFee: fromPaise(deliveryPaise),
    taxAmount: fromPaise(taxPaise),
    damruDiscount: fromPaise(damruPaise),
    finalAmount: fromPaise(finalPaise),
    taxName: config.tax.enabled ? config.tax.name : "",
    taxRate: config.tax.enabled && config.tax.calculationType === "PERCENTAGE" ? config.tax.rate : null,
    taxCalculationType: config.tax.enabled ? config.tax.calculationType : null,
    taxApplyOn: config.tax.enabled ? config.tax.applyOn : null,
    taxDeliveryFee: config.tax.enabled && config.tax.taxDeliveryFee,
    deliveryMode: input.orderType === "delivery" && config.delivery.enabled ? config.delivery.mode : null,
    appliedDeliveryRule,
    freeDeliveryApplied,
    configId: config.id,
    configVersion: config.version,
    currency: "INR",
  };
}
