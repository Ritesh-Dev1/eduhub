import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import TextBanner from "@/components/Textbanner";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Eduhub – Study notes & quizzes",
  description: "Study notes and quizzes, in one calm place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} antialiased`}>
      <head>
        <script src="https://pl32061959.profitableratecpmnetwork.com/8c/a7/99/8ca7996905f9535f70d70807c165fe07.js" />
        <script
          async
          data-cfasync="false"
          src="https://pl32061952.profitableratecpmnetwork.com/e0a941ced58f18528293f17c42f9cc54/invoke.js"
        />
        
      </head>
      <body className="min-h-full flex flex-col">
        <TextBanner />
        {children}
      </body>
    </html>
  );
}
