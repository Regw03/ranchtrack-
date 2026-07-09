declare const __DEV__: boolean;
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Alert } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesError,
} from "react-native-purchases";

const API_KEYS = {
  ios: "test_NWwXiCUJBaTPIHpQeBHLJipCIsd",
  android: "test_NWwXiCUJBaTPIHpQeBHLJipCIsd",
};

function getApiKey(): string {
  const key = Platform.select(API_KEYS);
  if (key) return key;
  // Fallback to test key in dev / unknown platform
  return "test_NWwXiCUJBaTPIHpQeBHLJipCIsd";
}

export type SubscriptionTier = "free" | "pro" | "plus";

const ENTITLEMENT_PRO = "pro";
const ENTITLEMENT_PLUS = "plus";

let isInitialized = false;

function initRevenueCatIfNeeded(): void {
  if (isInitialized) return;
  isInitialized = true;
  const apiKey = getApiKey();
  if (apiKey) {
    Purchases.configure({ apiKey });
  }
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // ─── Init & fetch customer info ──────────────────────────────────────────

  useEffect(() => {
    initRevenueCatIfNeeded();

    let cancelled = false;

    const fetchData = async () => {
      try {
        const info = await Purchases.getCustomerInfo();
        if (!cancelled) setCustomerInfo(info);
      } catch (e) {
        console.log("[SubscriptionProvider] getCustomerInfo failed", e);
      }
      try {
        const off = await Purchases.getOfferings();
        if (!cancelled) setOfferings(off);
      } catch (e) {
        console.log("[SubscriptionProvider] getOfferings failed", e);
      }
      if (!cancelled) setReady(true);
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Listen for updates ──────────────────────────────────────────────────

  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // ─── Derived state ───────────────────────────────────────────────────────

  // Track if user has made a successful purchase this session (for test store)
  const [hasTestPurchased, setHasTestPurchased] = useState<SubscriptionTier>("free");

  // DEV ONLY: tier override — automatically disabled in production builds
  const [devOverrideTier, setDevOverrideTier] = useState<SubscriptionTier | null>(null);

  const tier: SubscriptionTier = useMemo(() => {
    // DEV ONLY override — __DEV__ is false in production so this never runs in App Store builds
    if (__DEV__ && devOverrideTier !== null) return devOverrideTier;
    if (!customerInfo) return hasTestPurchased !== "free" ? hasTestPurchased : "free";
    const entitlements = customerInfo.entitlements.active;
    if (entitlements[ENTITLEMENT_PLUS]) return "plus";
    if (entitlements[ENTITLEMENT_PRO]) return "pro";
    // Fall back to test purchase state (test store doesn't grant real entitlements)
    return hasTestPurchased !== "free" ? hasTestPurchased : "free";
  }, [customerInfo, hasTestPurchased, devOverrideTier]);

  const isPro = tier === "pro" || tier === "plus";
  const isPlus = tier === "plus";
  const isFree = tier === "free";

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const requiresPro = useCallback(
    (action?: string): boolean => {
      if (isPro) return true;
      Alert.alert(
        "Ranch Pro Required",
        action
          ? `${action} requires a Ranch Pro or Plus subscription. Upgrade to unlock this feature.`
          : "This feature requires a Ranch Pro or Plus subscription.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "View Plans", onPress: () => {} },
        ],
      );
      return false;
    },
    [isPro],
  );

  // ─── Purchase ────────────────────────────────────────────────────────────

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<CustomerInfo | null> => {
      setIsPurchasing(true);
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        return info;
      } catch (e: unknown) {
        const err = e as PurchasesError;
        if (!err.userCancelled) {
          console.log("[SubscriptionProvider] purchase failed", err);
        }
        return null;
      } finally {
        setIsPurchasing(false);
      }
    },
    [],
  );

  // ─── Refresh customer info ──────────────────────────────────────────────

  const refreshCustomerInfo = useCallback(async (): Promise<void> => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
      console.log("[SubscriptionProvider] refreshCustomerInfo failed", e);
    }
  }, []);

  // ─── Restore ─────────────────────────────────────────────────────────────

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    setIsRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (e) {
      console.log("[SubscriptionProvider] restore failed", e);
      return null;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  // ─── Offerings helpers ───────────────────────────────────────────────────

  // Find packages by their exact custom identifiers in RevenueCat
  const proMonthlyPackage = useMemo(() => {
    if (!offerings) return null;
    for (const offering of Object.values(offerings.all) as import("react-native-purchases").PurchasesOffering[]) {
      const pkg = offering.availablePackages.find((p) => p.identifier === "monthly pro");
      if (pkg) return pkg;
    }
    return offerings.current?.availablePackages.find((p) => p.identifier === "monthly pro") ?? null;
  }, [offerings]);

  const proAnnualPackage = useMemo(() => {
    if (!offerings) return null;
    for (const offering of Object.values(offerings.all) as import("react-native-purchases").PurchasesOffering[]) {
      const pkg = offering.availablePackages.find((p) => p.identifier === "Yearly pro");
      if (pkg) return pkg;
    }
    return offerings.current?.availablePackages.find((p) => p.identifier === "Yearly pro") ?? null;
  }, [offerings]);

  const plusMonthlyPackage = useMemo(() => {
    if (!offerings) return null;
    for (const offering of Object.values(offerings.all) as import("react-native-purchases").PurchasesOffering[]) {
      const pkg = offering.availablePackages.find((p) => p.identifier === "monthly plus");
      if (pkg) return pkg;
    }
    return offerings.current?.availablePackages.find((p) => p.identifier === "monthly plus") ?? null;
  }, [offerings]);

  const plusAnnualPackage = useMemo(() => {
    if (!offerings) return null;
    for (const offering of Object.values(offerings.all) as import("react-native-purchases").PurchasesOffering[]) {
      const pkg = offering.availablePackages.find((p) => p.identifier === "Yearly plus");
      if (pkg) return pkg;
    }
    return offerings.current?.availablePackages.find((p) => p.identifier === "Yearly plus") ?? null;
  }, [offerings]);

  const memberAddonPackage = useMemo(() => {
    if (!offerings) return null;
    for (const offering of Object.values(offerings.all) as import("react-native-purchases").PurchasesOffering[]) {
      const pkg = offering.availablePackages.find((p) => p.identifier === "$rc_monthly");
      if (pkg) return pkg;
    }
    return null;
  }, [offerings]);

  // Keep proOfferings/plusOfferings for backward compat but they now point to our packages
  const proOfferings = useMemo(() => ({
    monthly: proMonthlyPackage,
    annual: proAnnualPackage,
  }), [proMonthlyPackage, proAnnualPackage]);

  const plusOfferings = useMemo(() => ({
    monthly: plusMonthlyPackage,
    annual: plusAnnualPackage,
  }), [plusMonthlyPackage, plusAnnualPackage]);

  return useMemo(
    () => ({
      tier,
      isPro,
      isPlus,
      isFree,
      ready,
      customerInfo,
      offerings,
      proOfferings,
      plusOfferings,
      memberAddonPackage,
      requiresPro,
      purchasePackage,
      refreshCustomerInfo,
      setHasTestPurchased,
      restorePurchases,
      isPurchasing,
      isRestoring,
    }),
    [
      tier,
      isPro,
      isPlus,
      isFree,
      ready,
      customerInfo,
      offerings,
      proOfferings,
      plusOfferings,
      memberAddonPackage,
      requiresPro,
      purchasePackage,
      refreshCustomerInfo,
      setHasTestPurchased,
      restorePurchases,
      isPurchasing,
      isRestoring,
    ],
  );
});
