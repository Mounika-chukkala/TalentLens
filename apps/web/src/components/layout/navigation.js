import {
  Activity,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Users,
  ScanSearch,
} from "lucide-react";

export const recruiterNavigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "requisitions", label: "Requisitions", icon: BriefcaseBusiness },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "screenings", label: "AI Resume Screening", icon: ScanSearch },
  { id: "pipeline", label: "Hiring pipeline", icon: Activity },
  { id: "client-reviews", label: "Client reviews", icon: FileText },
];
export const clientNavigation = [
  { id: "submissions", label: "Candidate submissions", icon: Users },
  { id: "requisitions", label: "Requisitions", icon: BriefcaseBusiness },
];