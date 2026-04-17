import { ArrowRight, BookOpen, Flag } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div>
      {/* Full-bleed Hero */}
      <div className="relative w-full h-[420px] overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}hero-kitchen.png`}
          alt="Modern Kitchen"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-center px-10 lg:px-20 max-w-2xl">
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Elevate Your<br />Living Spaces.
          </h2>
          <p className="text-white/75 text-sm lg:text-base leading-relaxed max-w-md">Discover premium fixtures and finishes for your home.</p>
          <div className="flex items-center gap-2 mt-6 text-white/50 text-xs font-semibold uppercase tracking-widest">
            <ArrowRight size={13} className="text-amber-400" />
            Select a category above to start browsing
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="py-10 flex items-center justify-center gap-8">
        <a
          href="https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=3701&deploy=1&script=3701&deploy=1&whence=&siaT=1774876085696&siaWhc=%2Fapp%2Fcenter%2Fcard.nl&siaNv=sc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm hover:text-gray-700 transition-colors text-[#353b42]"
        >
          <BookOpen size={15} />
          PRD Reference
        </a>
        <span className="w-px h-4 bg-gray-200" />
        <a
          href="#"
          className="flex items-center gap-2 text-sm hover:text-gray-700 transition-colors text-[#353b42]"
        >
          <Flag size={15} />
          Report Issue
        </a>
      </div>
    </div>
  );
}
