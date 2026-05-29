import "./globals.css";

export const metadata = {
  title: "ATLAS WASTE",
  description: "Gestión inteligente de residuos — regiones, zonas, IoT e IA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
