import { CalculationProjectProvider } from "@/lib/store/CalculationProjectProvider";

/** Scopes the shared active-Project state to every calculation module (重量計算/換気計算/耐震計算/他計算) so it persists across tabs but never leaks outside `/calculations`. */
export default function CalculationsLayout({ children }: { children: React.ReactNode }) {
  return <CalculationProjectProvider>{children}</CalculationProjectProvider>;
}
