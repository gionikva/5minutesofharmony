import React from "react";
import Navbar from "./Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-16">
        {children}
      </main>

      <footer className="mt-8 border-t bg-white">
        <div className="container mx-auto px-4 py-3 text-sm text-gray-600">
          Built with ❤️
        </div>
      </footer>
    </div>
  );
}
