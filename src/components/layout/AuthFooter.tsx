export function AuthFooter() {
  return (
    <footer className="mt-auto flex flex-col md:flex-row justify-between items-center text-on-surface-variant pt-8 border-t border-outline-variant">
      <span className="font-label-sm text-label-sm mb-4 md:mb-0">
        © IT4409 2025.2
      </span>
      <div className="flex items-center gap-6">
        <a
          className="font-label-sm text-label-sm hover:text-on-surface transition-colors"
          href="https://www.facebook.com/nguyenkhac.quang.5245"
          target="_blank"
          rel="noopener noreferrer"
        >
          Liên hệ
        </a>
        <button className="flex items-center gap-1 font-label-sm text-label-sm hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[16px]">
            language
          </span>
          Tiếng Việt
        </button>
      </div>
    </footer>
  );
}
