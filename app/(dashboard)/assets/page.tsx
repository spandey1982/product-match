import type { Metadata } from "next";
import Link from "next/link";
import { Users, Wand2, ChevronRight, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Assets | Mentis" };

/**
 * Assets — the home for reusable creative resources that outlast any single
 * product. Today: Model Studio (AI Casting Signature Models) and Design Studio
 * (fabric-to-design). Backdrops + Scenic remain in Settings for now and will
 * migrate here in a later pass.
 */
interface AssetCard {
  href: string;
  title: string;
  description: string;
  Icon: typeof Users;
  accent: string;
}

const CARDS: readonly AssetCard[] = [
  {
    href: "/assets/model-studio",
    title: "Model Studio",
    description:
      "Curate Signature Models — save a face and appearance brief you can reuse across catalogue generations.",
    Icon: Users,
    accent: "from-indigo-500 to-purple-600",
  },
  {
    href: "/fashion-designer",
    title: "Design Studio",
    description:
      "Design garments from raw fabric and references — flat sketches, structured briefs, catalogue-ready assets.",
    Icon: Wand2,
    accent: "from-fuchsia-500 to-purple-600",
  },
];

export default function AssetsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          Assets
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Reusable creative resources — models, designs, and more, ready to
          apply to any catalogue.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, title, description, Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className="group relative rounded-2xl border border-gray-100 bg-white p-5 hover:border-indigo-200 hover:shadow-md transition-all"
          >
            <div
              className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-3`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
