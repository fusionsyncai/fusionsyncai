export default function OutreachLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-6xl">{children}</div>;
}
