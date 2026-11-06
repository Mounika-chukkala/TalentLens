
import {
  Activity,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Users,
  ScanSearch,
} from "lucide-react";

export const recruiterNavigation = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    to: "/overview",
  },
  {
    id: "requisitions",
    label: "Requisitions",
    icon: BriefcaseBusiness,
    to: "/requisitions",
  },
  {
    id: "candidates",
    label: "Candidates",
    icon: Users,
    to: "/candidates",
  },
  {
    id: "screenings",
    label: "AI Resume Screening",
    icon: ScanSearch,
    to: "/screenings",
  },
  {
    id: "pipeline",
    label: "Hiring pipeline",
    icon: Activity,
    to: "/pipeline",
  },
  {
    id: "client-reviews",
    label: "Client reviews",
    icon: FileText,
    to: "/client-reviews",
  },
];

export const clientNavigation = [
  {
    id: "submissions",
    label: "Candidate submissions",
    icon: Users,
    to: "/client/submissions",
  },
  {
    id: "requisitions",
    label: "Requisitions",
    icon: BriefcaseBusiness,
    to: "/client/requisitions",
  },
];
