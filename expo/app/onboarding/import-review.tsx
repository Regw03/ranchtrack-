import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Copy } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function ImportReviewScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { issueCount } = useLocalSearchParams<{ issueCount?: string }>();
  const { activeAnimals } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const unknownAnimals = useMemo(
    () => activeAnimals.filter((a) => a.identityStatus === "unknown"),
    [activeAnimals],
  );

  const missingBreed = useMemo(
    () => activeAnimals.filter((a) => !a.breed || a.breed === "Unknown"),
    [activeAnimals],
  );

  const issues = parseInt(issueCount ?? "0", 10);

  const handleContinue = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/guided-setup?mode=import");
  };

  const cards = [
    {
      show: unknownAnimals.length > 0,
      icon: <Clock size={20} color={Colors.warning} />,
      iconBg: Colors.warning + "15",
      title: `${unknownAnimals.length} animal${unknownAnimals.length !== 1 ? "s" : ""} with unknown identity`,
      description: "These records were imported but may need verification. You can update them anytime from the animal detail screen.",
    },
    {
      show: missingBreed.length > 0,
      icon: <AlertTriangle size={20} color={Colors.accent} />,
      iconBg: Colors.accent + "15",
      title: `${missingBreed.length} animal${missingBreed.length !== 1 ? "s" : ""} missing breed`,
      description: "Breed was not specified during import. You can add breed information later.",
    },
    {
      show: issues > 0,
      icon: <Copy size={20} color={Colors.error} />,
      iconBg: Colors.error + "15",
      title: `${issues} import issue${issues !== 1 ? "s" : ""} flagged`,
      description: "Some records had duplicate tags, missing data, or unrecognized types. These animals were still imported — review them at your own pace.",
    },
  ].filter((c) => c.show);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={[styles.headerIconBg, { backgroundColor: Colors.success + "15" }]}>
              <CheckCircle2 size={40} color={Colors.success} />
            </View>
            <Text style={styles.headerTitle}>Data Imported</Text>
            <Text style={styles.headerSubtitle}>
              {activeAnimals.length} animal{activeAnimals.length !== 1 ? "s" : ""} in your herd
            </Text>
          </View>

          {cards.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Needs Attention</Text>
              <Text style={styles.sectionHint}>
                These aren't blockers — just things to clean up when you have time.
              </Text>

              {cards.map((card, index) => (
                <View key={index} style={styles.issueCard}>
                  <View style={[styles.issueIconBg, { backgroundColor: card.iconBg }]}>
                    {card.icon}
                  </View>
                  <View style={styles.issueContent}>
                    <Text style={styles.issueTitle}>{card.title}</Text>
                    <Text style={styles.issueDescription}>{card.description}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.allGood}>
              <CheckCircle2 size={24} color={Colors.success} />
              <Text style={styles.allGoodText}>All records look good!</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.8}
            testID="continue-setup-btn"
          >
            <Text style={styles.continueBtnText}>Continue Setup</Text>
            <ArrowRight size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    header: {
      alignItems: "center",
      paddingTop: 40,
      paddingBottom: 32,
    },
    headerIconBg: {
      width: 80,
      height: 80,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: Colors.text,
      marginBottom: 6,
    },
    headerSubtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 13,
      color: Colors.textTertiary,
      lineHeight: 19,
      marginBottom: 16,
    },
    issueCard: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      flexDirection: "row",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    issueIconBg: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    issueContent: {
      flex: 1,
    },
    issueTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 4,
    },
    issueDescription: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 19,
    },
    allGood: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: Colors.success + "12",
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    allGoodText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.success,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    continueBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    continueBtnText: {
      fontSize: 17,
      fontWeight: "700",
      color: "#fff",
    },
  });
}
