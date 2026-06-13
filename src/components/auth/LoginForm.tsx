"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiRequestError } from "@/lib/api";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(username, password);
      // login() handles redirect internally
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng nhập thất bại, vui lòng kiểm tra lại thông tin.");
      }
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="px-4 py-2 bg-red-100 text-red-600 rounded-md text-sm font-medium">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label className="block font-label-bold text-label-bold text-on-surface px-4">
          Email hoặc Tên đăng nhập
        </label>
        <input
          name="username"
          className="w-full px-6 py-4 rounded-full border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-outline"
          placeholder="name@company.com"
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-2 relative">
        <label className="block font-label-bold text-label-bold text-on-surface px-4">
          Mật khẩu
        </label>
        <div className="relative">
          <input
            name="password"
            className="w-full px-6 py-4 rounded-full border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-outline"
            placeholder="••••••••"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="absolute right-6 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface"
            type="button"
            onClick={() => setShowPassword(!showPassword)}
          >
            <span className="material-symbols-outlined">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full text-white py-4 px-8 rounded-full font-label-bold text-label-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98] transition-all group disabled:opacity-70"
        style={{ backgroundColor: "#b9d9eb", color: "rgb(29, 27, 32)" }}
      >
        <span>{isLoading ? "Đang xử lý..." : "Đăng nhập"}</span>
        {!isLoading && (
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        )}
      </button>
    </form>
  );
}
