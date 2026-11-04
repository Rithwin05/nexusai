import { BarChart3, Database, GraduationCap, LayoutDashboard, MessageSquareText, Search, Sliders, Sparkles } from "lucide-react";

export const NAV = [
  { name: "Overview", icon: LayoutDashboard, to: "/app", end: true, id: "overview" },
  { name: "Knowledge Base", icon: Database, to: "/app/knowledge", id: "knowledge" },
  { name: "AI Research Chat", icon: MessageSquareText, to: "/app/chat", id: "chat" },
  { name: "Semantic Search", icon: Search, to: "/app/search", id: "search" },
  { name: "Intelligence Studio", icon: Sparkles, to: "/app/studio", id: "studio" },
  { name: "Research Intelligence", icon: GraduationCap, to: "/app/research", id: "research" },
  { name: "Analytics & Evaluation", icon: BarChart3, to: "/app/analytics", id: "analytics" },
  { name: "Settings", icon: Sliders, to: "/app/settings", id: "settings" },
];
