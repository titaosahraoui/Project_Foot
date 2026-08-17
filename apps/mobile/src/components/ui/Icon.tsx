import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Award,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit,
  Info,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { colors } from "@footconnect/ui";

const ICONS = {
  "alert-triangle": AlertTriangle,
  archive: Archive,
  "arrow-right": ArrowRight,
  award: Award,
  bell: Bell,
  calendar: Calendar,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  clock: Clock,
  edit: Edit,
  info: Info,
  "log-out": LogOut,
  "map-pin": MapPin,
  plus: Plus,
  "refresh-cw": RefreshCw,
  search: Search,
  settings: Settings,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  sliders: SlidersHorizontal,
  "sliders-horizontal": SlidersHorizontal,
  star: Star,
  "trash-2": Trash2,
  "trending-up": TrendingUp,
  trophy: Trophy,
  user: User,
  "user-check": UserCheck,
  "user-minus": UserMinus,
  "user-plus": UserPlus,
  users: Users,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = colors.textPrimary,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
