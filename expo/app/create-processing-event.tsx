import React, { useCallback, useMemo, useState } from "react";
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 TextInput,
 ScrollView,
 KeyboardAvoidingView,
 Platform,
 Alert,
 ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { ProcessingEventType } from "@/types";

const EVENT_TYPES: { type: ProcessingEventType; label: string; description: string; emoji: string }[] = [
 { type: "vaccination", label: "Vaccination", description: "Vaccines, boosters, preventive shots", emoji: "💉" },
 { type: "preg_check", label: "Preg Check", description: "Pregnancy checking — records Bred or Open per animal", emoji: "🔬" },
 { type: "blood_test", label: "Blood Test", description: "Bangs, Trich, disease testing — handled by vet", emoji: "🩸" },
 { type: "custom", label: "Custom", description: "Any other processing event", emoji: "📋" },
];

export default function CreateProcessingEventScreen() {
 const Colors = useColors();
 const router = useRouter();
 const { groupId } = useLocalSearchParams<{ groupId: string }>();
 const { createProcessingEvent, getProcessingGroupById, processingGroups } = useProcessing();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const group = useMemo(
   () => getProcessingGroupById(groupId ?? ""),
   // eslint-disable-next-line react-hooks/exhaustive-deps
   [groupId, processingGroups],
 );

 const today = new Date().toISOString().split("T")[0];

 const [name, setName] = useState("");
 const [type, setType] = useState<ProcessingEventType>("vaccination");
 const [customTypeName, setCustomTypeName] = useState("");
 const [date, setDate] = useState(today);
 const [notes, setNotes] = useState("");
 const [isSaving, setIsSaving] = useState(false);

 const canSave =
   name.trim().length > 0 &&
   date.length >= 4 &&
   (type !== "custom" || customTypeName.trim().length > 0) &&
   !isSaving;

 const handleSave = useCallback(async () => {
   if (!canSave || !groupId) return;
   if (Platform.OS !== "web")
     void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

   setIsSaving(true);
   try {
     const event = await createProcessingEvent({
       name: name.trim(),
       type,
       customTypeName: type === "custom" ? customTypeName.trim() : undefined,
       date,
       groupId,
       notes: notes.trim() || undefined,
     });
     // Navigate to the event detail so they can start recording results
     router.replace({
       pathname: "/processing-event/[id]" as never,
       params: { id: event.id },
     });
   } catch (e) {
     Alert.alert("Error", "Could not create event. Please try again.");
     setIsSaving(false);
   }
 }, [canSave, groupId, name, type, customTypeName, date, notes, createProcessingEvent, router]);

 if (!group) {
   return (
     <View style={styles.notFound}>
       <Text style={styles.notFoundText}>Group not found</Text>
     </View>
   );
 }

 return (
   <>
     <Stack.Screen options={{ title: "New Processing Event" }} />
     <View style={styles.container}>
       <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
         <KeyboardAvoidingView
           style={styles.flex}
           behavior={Platform.OS === "ios" ? "padding" : undefined}
         >
           <ScrollView
             contentContainerStyle={styles.scrollContent}
             keyboardShouldPersistTaps="handled"
             showsVerticalScrollIndicator={false}
           >
             {/* Group badge */}
             <View style={[styles.groupBadge, { backgroundColor: group.color + "18", borderColor: group.color + "40" }]}>
               <View style={[styles.groupDot, { backgroundColor: group.color }]} />
               <Text style={[styles.groupBadgeText, { color: group.color }]}>{group.name}</Text>
             </View>

             {/* Event name */}
             <Text style={styles.label}>Event Name *</Text>
             <View style={styles.inputWrap}>
               <TextInput
                 value={name}
                 onChangeText={setName}
                 placeholder="e.g. Spring Preg Check, Fall Vaccination"
                 placeholderTextColor={Colors.textTertiary}
                 style={styles.input}
                 autoCapitalize="words"
                 returnKeyType="next"
                 maxLength={60}
               />
             </View>

             {/* Event type */}
             <Text style={styles.label}>Event Type *</Text>
             <View style={styles.typeGrid}>
               {EVENT_TYPES.map((et) => (
                 <TouchableOpacity
                   key={et.type}
                   style={[
                     styles.typeCard,
                     type === et.type && {
                       borderColor: group.color,
                       backgroundColor: group.color + "10",
                     },
                   ]}
                   onPress={() => {
                     if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                     setType(et.type);
                   }}
                   activeOpacity={0.75}
                 >
                   <Text style={styles.typeEmoji}>{et.emoji}</Text>
                   <Text style={[styles.typeLabel, type === et.type && { color: group.color }]}>
                     {et.label}
                   </Text>
                   <Text style={styles.typeDesc}>{et.description}</Text>
                 </TouchableOpacity>
               ))}
             </View>

             {/* Custom type name */}
             {type === "custom" && (
               <>
                 <Text style={styles.label}>Custom Event Name *</Text>
                 <View style={styles.inputWrap}>
                   <TextInput
                     value={customTypeName}
                     onChangeText={setCustomTypeName}
                     placeholder="e.g. Ear Tagging, Branding"
                     placeholderTextColor={Colors.textTertiary}
                     style={styles.input}
                     autoCapitalize="words"
                     maxLength={40}
                   />
                 </View>
               </>
             )}

             {/* Preg check reminder */}
             {type === "preg_check" && (
               <View style={[styles.infoBox, { backgroundColor: "#2D7A9C18", borderColor: "#2D7A9C30" }]}>
                 <Text style={[styles.infoText, { color: "#2D7A9C" }]}>
                   Each animal will be marked as Bred or Open. Results are recorded per animal in the next step.
                 </Text>
               </View>
             )}

             {/* Date */}
             <Text style={styles.label}>Date *</Text>
             <View style={styles.inputWrap}>
               <TextInput
                 value={date}
                 onChangeText={setDate}
                 placeholder="YYYY-MM-DD"
                 placeholderTextColor={Colors.textTertiary}
                 style={styles.input}
                 keyboardType="numbers-and-punctuation"
                 returnKeyType="next"
                 maxLength={10}
               />
             </View>

             {/* Notes */}
             <Text style={styles.label}>Notes (optional)</Text>
             <View style={styles.inputWrap}>
               <TextInput
                 value={notes}
                 onChangeText={setNotes}
                 placeholder="Vet name, product used, any observations..."
                 placeholderTextColor={Colors.textTertiary}
                 style={[styles.input, styles.textArea]}
                 multiline
                 numberOfLines={3}
                 textAlignVertical="top"
                 maxLength={300}
               />
             </View>

             <View style={{ height: 32 }} />
           </ScrollView>

           {/* Save button */}
           <View style={styles.bottomBar}>
             <TouchableOpacity
               style={[styles.saveBtn, { backgroundColor: canSave ? group.color : Colors.border }]}
               onPress={handleSave}
               disabled={!canSave}
               activeOpacity={0.85}
             >
               {isSaving ? (
                 <ActivityIndicator color="#fff" />
               ) : (
                 <>
                   <Check size={20} color="#fff" />
                   <Text style={styles.saveBtnText}>Create Event</Text>
                 </>
               )}
             </TouchableOpacity>
           </View>
         </KeyboardAvoidingView>
       </SafeAreaView>
     </View>
   </>
 );
}

function createStyles(Colors: ThemeColors) {
 return StyleSheet.create({
   container: { flex: 1, backgroundColor: Colors.background },
   safeArea: { flex: 1 },
   flex: { flex: 1 },
   notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
   notFoundText: { fontSize: 16, color: Colors.textSecondary },
   scrollContent: { padding: 20, paddingBottom: 8 },

   groupBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, alignSelf: "flex-start" as const, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
   groupDot: { width: 8, height: 8, borderRadius: 4 },
   groupBadgeText: { fontSize: 13, fontWeight: "700" as const },

   label: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10, marginTop: 20 },
   inputWrap: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 16 },
   input: { fontSize: 16, fontWeight: "500" as const, color: Colors.text, paddingVertical: 14 },
   textArea: { paddingTop: 14, minHeight: 90 },

   typeGrid: { gap: 10 },
   typeCard: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
   typeEmoji: { fontSize: 24, width: 36, textAlign: "center" as const },
   typeLabel: { fontSize: 15, fontWeight: "700" as const, color: Colors.text, marginBottom: 2 },
   typeDesc: { fontSize: 12, color: Colors.textTertiary, lineHeight: 16, flex: 1 },

   infoBox: { borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1 },
   infoText: { fontSize: 13, lineHeight: 20, fontWeight: "500" as const },

   bottomBar: { padding: 20, paddingTop: 8 },
   saveBtn: { borderRadius: 16, paddingVertical: 18, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10 },
   saveBtnText: { fontSize: 18, fontWeight: "800" as const, color: "#fff" },
 });
}
