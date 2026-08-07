import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings,
  Shield,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { colors } from "@footconnect/ui";

const ICONS = {
  bell: Bell,
  calendar: Calendar,
  "chevron-right": ChevronRight,
  clock: Clock,
  "log-out": LogOut,
  "map-pin": MapPin,
  plus: Plus,
  search: Search,
  settings: Settings,
  shield: Shield,
  "trending-up": TrendingUp,
  trophy: Trophy,
  user: User,
  users: Users,
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
