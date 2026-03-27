import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20">
      <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-8">
        <AlertTriangle className="w-12 h-12 text-destructive" />
      </div>
      
      <h1 className="text-6xl font-display font-bold text-primary mb-4 uppercase tracking-tighter">
        404
      </h1>
      
      <h2 className="text-2xl font-bold text-foreground mb-4">
        Page Not Found
      </h2>
      
      <p className="text-muted-foreground mb-10 max-w-md text-lg leading-relaxed">
        The page you are looking for doesn't exist, has been removed, or is temporarily unavailable.
      </p>
      
      <Link 
        href="/"
        className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/25 hover:bg-accent hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 uppercase tracking-wider"
      >
        <Home size={20} />
        Return to Home
      </Link>
    </div>
  );
}
