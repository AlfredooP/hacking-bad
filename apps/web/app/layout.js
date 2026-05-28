import "./globals.css";

export const metadata = {
  title: "BIN NEXT",
  description: "Gestión inteligente de contenedores",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
