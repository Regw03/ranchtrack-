type HealthEventType = "vaccination" | "blood_test" | "treatment" | "inspection" | "custom";

export const HEALTH_EVENT_TYPE_CONFIG: Record<
  HealthEventType,
  { label: string; color: string; icon: string }
> = {
  vaccination: { label: "Vaccination", color: "#3D8B5E", icon: "syringe" },
  blood_test: { label: "Blood Test", color: "#C44D3D", icon: "droplet" },
  treatment: { label: "Treatment", color: "#2D7A9C", icon: "pill" },
  inspection: { label: "Inspection", color: "#D4943A", icon: "clipboard" },
  custom: { label: "Custom", color: "#7B5EA7", icon: "tag" },
};
