import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import { Toaster } from "sonner";
import "./globals.css";

const appearance = {
  theme: dark,
  variables: {
    colorPrimary: "#67E8F9",
    colorPrimaryForeground: "#080B12",
    colorBackground: "#0E1420",
    colorForeground: "#F1F5F9",
    colorInput: "#111B2A",
    colorInputForeground: "#F1F5F9",
    colorBorder: "#202C3D",
    fontFamily: "Manrope, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  captcha: { theme: "dark" },
};

export const metadata = {
  title: "NEXUS AI - The Intelligent Knowledge Operating System",
  description: "Transform disconnected documents into searchable, contextual, actionable intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={appearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      <html lang="en" className="dark">
        <body className="bg-[#080B12] text-slate-100 antialiased">
          <ReactQueryProvider>
            {children}
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#0E1420",
                  border: "1px solid #202C3D",
                  color: "#F1F5F9",
                },
              }}
            />
          </ReactQueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

