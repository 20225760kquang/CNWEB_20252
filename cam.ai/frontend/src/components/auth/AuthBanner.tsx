import Image from "next/image";
import heroDashboard from "@/assets/hero-dashboard-preview.png";

export function AuthBanner() {
  return (
    <section className="hidden md:flex relative w-[45%] flex-col items-center justify-center p-8 lg:p-12 overflow-hidden">
      {/* Background Depth Elements */}
      <div className="concentric-rings"></div>
      <div className="absolute inset-0 circles-overlay"></div>
      {/* Content */}
      <div className="relative z-10 text-center space-y-4 lg:space-y-6 flex flex-col justify-center h-full">
        <div className="space-y-2">
          <p className="font-label-bold text-label-bold text-outline-variant opacity-80 uppercase tracking-widest">
            Giải pháp giám sát camera hỗ trợ bởi AI dành cho bạn.
          </p>
          <h1 className="font-headline-md font-bold text-headline-md text-surface-container-lowest tracking-tight">
            Quản lý camera của bạn
          </h1>
        </div>
        <div className="mt-4 lg:mt-8 relative flex-1 min-h-0 flex flex-col justify-center">
          <div className="glass-effect p-4 rounded-lg shadow-2xl transform hover:scale-105 transition-transform duration-500">
            <Image
              alt="Dashboard screenshot"
              className="rounded w-full max-h-[50vh] lg:max-h-[60vh] object-contain border border-white/10"
              src={heroDashboard}
              placeholder="blur"
              priority
            />
          </div>
          {/* Abstract Accents */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-[80px] rounded-full"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent-orange/10 blur-[80px] rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
