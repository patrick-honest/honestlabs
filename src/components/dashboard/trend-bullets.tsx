import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Sentiment = "positive" | "negative" | "neutral";

interface TrendBullet {
  text: string;
  sentiment: Sentiment;
}

interface TrendBulletsProps {
  title?: string;
  bullets: TrendBullet[];
}

const sentimentConfig: Record<Sentiment, { icon: typeof CheckCircle; color: string }> = {
  positive: { icon: CheckCircle, color: "text-emerald-400" },
  negative: { icon: AlertTriangle, color: "text-red-400" },
  neutral: { icon: Info, color: "text-blue-400" },
};

export function TrendBullets({ title = "Key Trends", bullets }: TrendBulletsProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {bullets.map((bullet, i) => {
          const { icon: Icon, color } = sentimentConfig[bullet.sentiment];
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
              <span className="text-sm leading-relaxed text-slate-200">
                {bullet.text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
