import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { AuthFooter } from "@/components/layout/AuthFooter";

import Image from "next/image";
import logoCamai from "@/assets/logo-camai.png";

export const metadata: Metadata = {
  title: "cam.ai — Đăng nhập",
  description: "Đăng nhập vào hệ thống quản lý camera cam.ai",
};

export default function LoginPage() {
  return (
    <main className="w-full flex flex-col md:flex-row overflow-hidden rounded-[40px] shadow-2xl bg-dark-panel max-w-[90vw] lg:max-w-[80vw] min-h-[600px] md:h-[85vh] lg:h-[80vh]">
      <AuthBanner />

      {/* Right Panel (White) */}
      <section className="w-full md:w-[55%] bg-surface-container-lowest flex flex-col p-8 md:p-12 md:rounded-l-[40px] z-10">
        {/* Top Navigation */}
        <nav className="flex justify-between items-center mb-auto">
          <Image
            alt="cam.ai Brand Logo"
            className="h-10 w-auto"
            src={logoCamai}
            height={40}
            priority
          />
        </nav>

        {/* Center Form */}
        <div className="max-w-md w-full mx-auto my-auto py-12">
          <div className="mb-10 text-center md:text-left">
            <h2 className="font-headline-md font-bold text-headline-md text-on-background mb-2">
              Đăng nhập
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Truy cập bảng điều khiển mạng video bảo mật của bạn
            </p>
          </div>

          <LoginForm />
        </div>

        <AuthFooter />
      </section>
    </main>
  );
}
