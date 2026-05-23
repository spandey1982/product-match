import Link from "next/link";
import { Sparkles, Package, Zap, Target, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white">ProductMatch</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-indigo-200 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/signup" className="text-sm bg-white text-indigo-700 font-semibold px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors">
            Get started
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 rounded-full px-4 py-1.5 mb-8">
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
          <span className="text-xs text-indigo-200 font-medium">AI-Powered Merchandising Intelligence</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
          Smart product matching
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
            for fashion retailers
          </span>
        </h1>

        <p className="text-lg text-indigo-200/80 max-w-xl mb-10 leading-relaxed">
          Upload your catalog. Select any product. Instantly see coordinated matching recommendations with AI-powered explanations.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25">
            Try the demo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/20 transition-colors">
            Start free
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-16">
          {[
            { icon: Package, label: "50+ product catalog" },
            { icon: Zap, label: "Instant matching" },
            { icon: Target, label: "Explainable AI" },
            { icon: Sparkles, label: "Color harmony engine" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
              <Icon className="h-3.5 w-3.5 text-indigo-300" />
              <span className="text-xs text-indigo-200 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-indigo-300/50">
        Built for fashion retailers · AI Merchandising Platform
      </footer>
    </div>
  );
}
