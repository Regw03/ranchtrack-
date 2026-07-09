import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Check,
  X,
  ChevronDown,
  Crown,
  Zap,
  Star,
} from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useSubscription, SubscriptionTier } from "@/providers/SubscriptionProvider";
import { PurchasesPackage } from "react-native-purchases";

type BillingPeriod = "monthly" | "annual";

interface PlanFeature {
  label: string;
  tiers: SubscriptionTier[];
}

const FEATURES: PlanFeature[] = [
  { label: "Unlimited animals", tiers: ["pro", "plus"] },
  { label: "Unlimited processing groups", tiers: ["pro", "plus"] },
  { label: "Unlimited calving records", tiers: ["pro", "plus"] },
  { label: "Health & weight tracking", tiers: ["free", "pro", "plus"] },
  { label: "Team sharing (5 members)", tiers: ["pro"] },
  { label: "Team sharing (unlimited)", tiers: ["plus"] },
  { label: "Cloud sync & backup", tiers: ["pro", "plus"] },
  { label: "Priority support", tiers: ["plus"] },
  { label: "Custom branding", tiers: ["plus"] },
];

const TIER_CONFIG: Record<
  SubscriptionTier,
  { name: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }
> = {
  free: {
    name: "Free",
    color: "#6A6A6A",
    bgColor: "#1E1E1E",
    borderColor: "#2E2E2E",
    icon: <Check size={18} color="#6A6A6A" />,
  },
  pro: {
    name: "Ranch Pro",
    color: "#14603A",
    bgColor: "#0E2A1A",
    borderColor: "#14603A",
    icon: <Crown size={18} color="#5FAF7B" />,
  },
  plus: {
    name: "Ranch Plus",
    color: "#2D7A9C",
    bgColor: "#0D1F2D",
    borderColor: "#2D7A9C",
    icon: <Star size={18} color="#4DA8CC" />,
  },
};

interface PlanCardProps {
  tier: SubscriptionTier;
  currentTier: SubscriptionTier;
  billing: BillingPeriod;
  monthlyPrice: string;
  annualPrice: string;
  pkg?: PurchasesPackage | null;
  onPurchase: (pkg: PurchasesPackage) => void;
  isPurchasing: boolean;
}

function PlanCard({
  tier,
  currentTier,
  billing,
  monthlyPrice,
  annualPrice,
  pkg,
  onPurchase,
  isPurchasing,
}: PlanCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const config = TIER_CONFIG[tier];
  const isCurrent = currentTier === tier;
  const price = billing === "annual" ? annualPrice : monthlyPrice;

  return (
    <View
      style={[
        styles.planCard,
        {
          borderColor: config.borderColor,
          backgroundColor: config.bgColor,
        },
        tier === "pro" && styles.planCardHighlighted,
      ]}
    >
      {tier === "pro" && (
        <View style={styles.recommendedBadge}>
          <Star size={10} color="#FFFFFF" />
          <Text style={styles.recommendedText}>RECOMMENDED</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <View style={styles.planNameRow}>
          {config.icon}
          <Text style={[styles.planName, { color: config.color }]}>
            {config.name}
          </Text>
        </View>
        <Text style={styles.planPrice}>
          <Text style={styles.planPriceValue}>{price}</Text>
          {tier !== "free" && (
            <Text style={styles.planPricePeriod}>
              /{billing === "monthly" ? "mo" : "yr"}
            </Text>
          )}
        </Text>
      </View>

      <View style={styles.featureList}>
        {FEATURES.map((feat) => {
          const included = feat.tiers.includes(tier);
          return (
            <View key={feat.label} style={styles.featureRow}>
              {included ? (
                <Check size={14} color={config.color} />
              ) : (
                <X size={14} color={Colors.textTertiary} />
              )}
              <Text
                style={[
                  styles.featureText,
                  !included && styles.featureTextDisabled,
                ]}
              >
                {feat.label}
              </Text>
            </View>
          );
        })}
      </View>

      {isCurrent ? (
        <View style={[styles.currentPlanBtn, { backgroundColor: config.color + "25", borderColor: config.color + "40" }]}>
          <Check size={16} color={config.color} />
          <Text style={[styles.currentPlanText, { color: config.color }]}>Current Plan</Text>
        </View>
      ) : tier === "free" ? (
        <View style={[styles.currentPlanBtn, { backgroundColor: config.color + "20", borderColor: config.color + "30" }]}>
          <Text style={[styles.currentPlanText, { color: config.color }]}>Included</Text>
        </View>
      ) : pkg ? (
        <TouchableOpacity
          style={[styles.purchaseBtn, { backgroundColor: config.color }]}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (pkg) onPurchase(pkg);
          }}
          activeOpacity={0.85}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.purchaseBtnText}>
              {currentTier === "free"
                ? `Try ${billing === "annual" ? "Annual" : "Monthly"} Free`
                : `Upgrade to ${config.name}`}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={[styles.purchaseBtn, styles.purchaseBtnDisabled]}>
          <Text style={styles.purchaseBtnText}>Unavailable</Text>
        </View>
      )}
    </View>
  );
}

export default function PaywallScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const {
    tier,
    ready,
    proOfferings,
    plusOfferings,
    purchasePackage,
    refreshCustomerInfo,
    setHasTestPurchased,
    restorePurchases,
    isPurchasing,
  } = useSubscription();

  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  const proMonthly = proOfferings?.monthly;
  const proAnnual = proOfferings?.annual;
  const plusMonthly = plusOfferings?.monthly;
  const plusAnnual = plusOfferings?.annual;

  const proMonthlyPrice = proMonthly?.product?.priceString ?? "$10.00";
  const proAnnualPrice = proAnnual?.product?.priceString ?? "$84.00";
  const plusMonthlyPrice = plusMonthly?.product?.priceString ?? "$22.00";
  const plusAnnualPrice = plusAnnual?.product?.priceString ?? "$185.00";

  const activeProPkg = billing === "annual" ? proAnnual : proMonthly;
  const activePlusPkg = billing === "annual" ? plusAnnual : plusMonthly;

  const handlePurchase = useCallback(
    async (pkg: PurchasesPackage | null | undefined) => {
      if (!pkg) {
        Alert.alert("Not Available", "This plan is not available right now. Please try again later.");
        return;
      }
      const info = await purchasePackage(pkg);
      if (info) {
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Force refresh customer info to pick up new entitlements
        await refreshCustomerInfo();
        // Determine tier from package identifier for test store compatibility
        const pkgId = pkg.identifier;
        if (pkgId.toLowerCase().includes("plus")) {
          setHasTestPurchased("plus");
        } else {
          setHasTestPurchased("pro");
        }
        Alert.alert(
          "Welcome! 🎉",
          "Your subscription is now active. Enjoy full access to RanchTrack!",
          [{ text: "Let's Go", onPress: () => router.back() }]
        );
      }
    },
    [purchasePackage, refreshCustomerInfo, router, setHasTestPurchased],
  );

  const handleRestore = useCallback(async () => {
    await restorePurchases();
  }, [restorePurchases]);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={22} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏜️</Text>
        <Text style={styles.headerTitle}>RanchTrack Pro</Text>
        <Text style={styles.headerSubtitle}>
          Unlock the full power of your ranch. Start with a 30-day free trial.
        </Text>
      </View>

      {/* Billing toggle */}
      <View style={styles.toggleWrap}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            billing === "monthly" && styles.toggleOptionActive,
          ]}
          onPress={() => setBilling("monthly")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              billing === "monthly" && styles.toggleTextActive,
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            billing === "annual" && styles.toggleOptionActive,
          ]}
          onPress={() => setBilling("annual")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              billing === "annual" && styles.toggleTextActive,
            ]}
          >
            Annual
          </Text>
        </TouchableOpacity>
        {billing === "annual" && (
          <View style={styles.savingsPill}>
            <Text style={styles.savingsText}>Save 30%</Text>
          </View>
        )}
      </View>

      {/* Plan cards */}
      <View style={styles.plansContainer}>
        <PlanCard
          tier="free"
          currentTier={tier}
          billing={billing}
          monthlyPrice="Free"
          annualPrice="Free"
          onPurchase={() => {}}
          isPurchasing={false}
        />
        <PlanCard
          tier="pro"
          currentTier={tier}
          billing={billing}
          monthlyPrice={proMonthlyPrice}
          annualPrice={proAnnualPrice}
          pkg={activeProPkg}
          onPurchase={handlePurchase}
          isPurchasing={isPurchasing}
        />
        <PlanCard
          tier="plus"
          currentTier={tier}
          billing={billing}
          monthlyPrice={plusMonthlyPrice}
          annualPrice={plusAnnualPrice}
          pkg={activePlusPkg}
          onPurchase={handlePurchase}
          isPurchasing={isPurchasing}
        />
      </View>

      {/* Restore */}
      <TouchableOpacity
        style={styles.restoreBtn}
        onPress={handleRestore}
        activeOpacity={0.7}
      >
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>

      {/* Legal */}
      <Text style={styles.legalText}>
        Payment will be charged to your Apple ID account at confirmation of
        purchase. Subscription automatically renews unless auto-renew is turned
        off at least 24 hours before the end of the current period. Manage
        subscriptions in your App Store account settings. Free trial available
        for new subscribers only.
      </Text>
      <View style={styles.legalLinks}>
        <Text style={styles.legalLink}>Terms of Service</Text>
        <Text style={styles.legalDivider}>|</Text>
        <Text style={styles.legalLink}>Privacy Policy</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingBottom: 60,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: Colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtn: {
      position: "absolute",
      top: 20,
      right: 20,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    headerIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 21,
      paddingHorizontal: 16,
    },
    toggleWrap: {
      flexDirection: "row",
      marginHorizontal: 20,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 4,
      marginBottom: 24,
      position: "relative",
    },
    toggleOption: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 11,
    },
    toggleOptionActive: {
      backgroundColor: Colors.primary,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.textSecondary,
    },
    toggleTextActive: {
      color: Colors.textInverse,
    },
    savingsPill: {
      position: "absolute",
      top: -14,
      right: 12,
      backgroundColor: Colors.success,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    savingsText: {
      fontSize: 11,
      fontWeight: "800" as const,
      color: "#FFFFFF",
    },
    plansContainer: {
      paddingHorizontal: 16,
      gap: 14,
    },
    planCard: {
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 20,
      position: "relative",
    },
    planCardHighlighted: {
      borderWidth: 2,
    },
    recommendedBadge: {
      position: "absolute",
      top: -12,
      alignSelf: "center",
      backgroundColor: Colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    recommendedText: {
      fontSize: 10,
      fontWeight: "800" as const,
      color: "#FFFFFF",
      letterSpacing: 1,
    },
    planHeader: {
      marginBottom: 16,
    },
    planNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    planName: {
      fontSize: 20,
      fontWeight: "800" as const,
    },
    planPrice: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    planPriceValue: {
      fontSize: 32,
      fontWeight: "800" as const,
      color: Colors.text,
    },
    planPricePeriod: {
      fontSize: 15,
      color: Colors.textSecondary,
      marginLeft: 2,
    },
    featureList: {
      gap: 10,
      marginBottom: 20,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    featureText: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: "500" as const,
    },
    featureTextDisabled: {
      color: Colors.textTertiary,
    },
    currentPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
      borderWidth: 1,
    },
    currentPlanText: {
      fontSize: 15,
      fontWeight: "700" as const,
    },
    purchaseBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    purchaseBtnDisabled: {
      backgroundColor: Colors.textTertiary,
      opacity: 0.5,
    },
    purchaseBtnText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: "#FFFFFF",
    },
    restoreBtn: {
      alignSelf: "center",
      marginTop: 20,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    restoreText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: Colors.primary,
    },
    legalText: {
      fontSize: 11,
      color: Colors.textTertiary,
      textAlign: "center",
      marginTop: 24,
      marginHorizontal: 32,
      lineHeight: 16,
    },
    legalLinks: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
    },
    legalLink: {
      fontSize: 11,
      color: Colors.primary,
      fontWeight: "600" as const,
    },
    legalDivider: {
      fontSize: 11,
      color: Colors.textTertiary,
    },
  });
