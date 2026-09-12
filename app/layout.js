import "./globals.css";

export const metadata = {
  title: "Veritas — Content Authenticity Report",
  description:
    "Upload an image or a block of text and get an evidence-based report on whether it shows signs of AI generation or manipulation."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
