import './globals.css';

export const metadata = {
  title: 'Panel SAEZ&NAVES Media Group',
  description: 'Gestión de artículos generados por IA',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
