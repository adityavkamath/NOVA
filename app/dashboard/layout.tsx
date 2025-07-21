// layout.tsx
"use client";
import Sidebar from "@/components/Sidebar";
import React, { useState } from "react";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isCollapsed={collapsed} setIsCollapsed={setCollapsed} />
      
      <main
        className={`
          transition-all duration-300 ease-in-out
          ${collapsed ? "ml-16" : "ml-64"}
          flex-1 flex items-center justify-center
        `}
      >
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
