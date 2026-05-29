export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 md:p-8 bg-[#f8f9fa]">
      {children}
    </div>
  );
}
