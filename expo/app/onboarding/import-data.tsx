import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { FileSpreadsheet, PenLine, ArrowLeft, Upload, CheckCircle2, AlertTriangle } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { parseCSV, ImportRecord, ImportIssue } from "@/providers/OnboardingProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function ImportDataScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { addAnimal, activeBusinessYearId, ranch } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [parsedRecords, setParsedRecords] = useState<ImportRecord[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "text/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setFileName(file.name);

      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const text = await response.text();
        const { records, issues: parseIssues } = parseCSV(text);
        setParsedRecords(records);
        setIssues(parseIssues);
        console.log(`Parsed ${records.length} records with ${parseIssues.length} issues`);
      } else {
        const FileSystem = await import("expo-file-system");
        const content = await FileSystem.readAsStringAsync(file.uri);
        const { records, issues: parseIssues } = parseCSV(content);
        setParsedRecords(records);
        setIssues(parseIssues);
        console.log(`Parsed ${records.length} records with ${parseIssues.length} issues`);
      }

      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log("File pick error:", err);
      Alert.alert("Error", "Could not read the file. Please try a .csv file.");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedRecords.length === 0) return;
    setIsImporting(true);
    let count = 0;

    try {
      for (const record of parsedRecords) {
        const sex = (() => {
          if (record.sex) {
            const s = record.sex.toLowerCase().trim();
            if (["female", "f", "cow"].includes(s)) return "female" as const;
            if (["male", "m", "bull"].includes(s)) return "male" as const;
            if (["steer", "s"].includes(s)) return "steer" as const;
            if (["heifer", "h"].includes(s)) return "heifer" as const;
          }
          switch (record.animalType) {
            case "cow": return "female" as const;
            case "bull": return "male" as const;
            case "calf": return "female" as const;
            default: return "female" as const;
          }
        })();

        await addAnimal({
          tagId: record.tagNumber,
          name: record.name,
          species: "cattle",
          breed: record.breed || "Unknown",
          birthDate: record.birthDate || new Date().toISOString().split("T")[0],
          sex,
          notes: record.notes || "",
          status: "active",
          markedForSale: false,
          businessYearId: activeBusinessYearId,
          identityStatus: "unknown",
        });
        count++;
      }

      setImportedCount(count);
      setImportComplete(true);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log(`Successfully imported ${count} animals`);
    } catch (err) {
      console.log("Import error:", err);
      Alert.alert("Import Error", `Imported ${count} of ${parsedRecords.length} animals before an error occurred.`);
    } finally {
      setIsImporting(false);
    }
  }, [parsedRecords, addAnimal, activeBusinessYearId]);

  const handleContinue = () => {
    if (issues.length > 0) {
      router.push({
        pathname: "/onboarding/import-review",
        params: { issueCount: issues.length.toString() },
      });
    } else {
      router.push("/onboarding/guided-setup?mode=import");
    }
  };

  const handleManualEntry = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding/manual-entry");
  };

  const duplicateCount = issues.filter((i) => i.type === "duplicate").length;
  const missingCount = issues.filter((i) => i.type === "missing_tag").length;
  const unknownCount = issues.filter((i) => i.type === "unknown_type").length;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Import Data</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!importComplete ? (
            <>
              <Text style={styles.sectionLabel}>Import from File</Text>
              <Text style={styles.hint}>
                Upload a CSV file with your animal data. We'll detect columns automatically.
                Only Tag Number is required — everything else is optional.
              </Text>

              <TouchableOpacity
                style={styles.uploadArea}
                onPress={handlePickFile}
                activeOpacity={0.7}
                testID="pick-file-btn"
              >
                <View style={[styles.uploadIconBg, { backgroundColor: Colors.primary + "15" }]}>
                  <Upload size={28} color={Colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>
                  {fileName ? fileName : "Tap to select a CSV file"}
                </Text>
                <Text style={styles.uploadHint}>
                  Supports .csv files exported from Excel, Google Sheets, etc.
                </Text>
              </TouchableOpacity>

              {parsedRecords.length > 0 && (
                <View style={styles.previewSection}>
                  <View style={styles.previewHeader}>
                    <CheckCircle2 size={18} color={Colors.success} />
                    <Text style={styles.previewTitle}>
                      {parsedRecords.length} animal{parsedRecords.length !== 1 ? "s" : ""} found
                    </Text>
                  </View>

                  <View style={styles.previewGrid}>
                    {[
                      { label: "Cows", count: parsedRecords.filter((r) => r.animalType === "cow").length },
                      { label: "Calves", count: parsedRecords.filter((r) => r.animalType === "calf").length },
                      { label: "Bulls", count: parsedRecords.filter((r) => r.animalType === "bull").length },
                      { label: "Unknown", count: parsedRecords.filter((r) => r.animalType === "unknown").length },
                    ]
                      .filter((item) => item.count > 0)
                      .map((item) => (
                        <View key={item.label} style={styles.previewChip}>
                          <Text style={styles.previewChipCount}>{item.count}</Text>
                          <Text style={styles.previewChipLabel}>{item.label}</Text>
                        </View>
                      ))}
                  </View>

                  {issues.length > 0 && (
                    <View style={styles.issuesBanner}>
                      <AlertTriangle size={16} color={Colors.warning} />
                      <Text style={styles.issuesText}>
                        {issues.length} issue{issues.length !== 1 ? "s" : ""} detected
                        {duplicateCount > 0 ? ` (${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""})` : ""}
                        {missingCount > 0 ? ` (${missingCount} missing tag${missingCount !== 1 ? "s" : ""})` : ""}
                        {unknownCount > 0 ? ` (${unknownCount} unknown type${unknownCount !== 1 ? "s" : ""})` : ""}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.importBtn, isImporting && styles.importBtnDisabled]}
                    onPress={handleImport}
                    disabled={isImporting}
                    activeOpacity={0.8}
                    testID="import-btn"
                  >
                    {isImporting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.importBtnText}>
                        Import {parsedRecords.length} Animal{parsedRecords.length !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {issues.length > 0 && (
                    <Text style={styles.issueNote}>
                      Don't worry — you can fix issues after import
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.manualCard}
                onPress={handleManualEntry}
                activeOpacity={0.8}
                testID="manual-entry-btn"
              >
                <View style={[styles.manualIconBg, { backgroundColor: Colors.accent + "15" }]}>
                  <PenLine size={22} color={Colors.accent} />
                </View>
                <View style={styles.manualContent}>
                  <Text style={styles.manualTitle}>Enter Manually</Text>
                  <Text style={styles.manualDescription}>
                    Add animals one by one with just a tag number and type
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successSection}>
              <View style={[styles.successIconBg, { backgroundColor: Colors.success + "15" }]}>
                <CheckCircle2 size={48} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Import Complete!</Text>
              <Text style={styles.successDescription}>
                Successfully imported {importedCount} animal{importedCount !== 1 ? "s" : ""} into your herd.
              </Text>

              {issues.length > 0 && (
                <View style={styles.successIssues}>
                  <AlertTriangle size={16} color={Colors.warning} />
                  <Text style={styles.successIssuesText}>
                    {issues.length} record{issues.length !== 1 ? "s" : ""} need attention
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleContinue}
                activeOpacity={0.8}
                testID="continue-btn"
              >
                <Text style={styles.continueBtnText}>Continue Setup</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginBottom: 8,
      marginTop: 8,
    },
    hint: {
      fontSize: 14,
      color: Colors.textTertiary,
      lineHeight: 20,
      marginBottom: 20,
    },
    uploadArea: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: Colors.border,
      borderStyle: "dashed",
      padding: 28,
      alignItems: "center",
    },
    uploadIconBg: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    uploadTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.text,
      marginBottom: 6,
      textAlign: "center",
    },
    uploadHint: {
      fontSize: 13,
      color: Colors.textTertiary,
      textAlign: "center",
    },
    previewSection: {
      marginTop: 20,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 18,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    previewGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    previewChip: {
      backgroundColor: Colors.backgroundDark,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    previewChipCount: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    previewChipLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    issuesBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.warning + "12",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    issuesText: {
      fontSize: 13,
      color: Colors.warning,
      flex: 1,
    },
    importBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    importBtnDisabled: {
      opacity: 0.6,
    },
    importBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
    issueNote: {
      fontSize: 12,
      color: Colors.textTertiary,
      textAlign: "center",
      marginTop: 8,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 28,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: Colors.border,
    },
    dividerText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textTertiary,
    },
    manualCard: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
    },
    manualIconBg: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    manualContent: {
      flex: 1,
    },
    manualTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 3,
    },
    manualDescription: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    successSection: {
      alignItems: "center",
      paddingTop: 60,
    },
    successIconBg: {
      width: 88,
      height: 88,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: Colors.text,
      marginBottom: 10,
    },
    successDescription: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    successIssues: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.warning + "12",
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 24,
    },
    successIssuesText: {
      fontSize: 14,
      color: Colors.warning,
    },
    continueBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 48,
      alignItems: "center",
    },
    continueBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
  });
}
