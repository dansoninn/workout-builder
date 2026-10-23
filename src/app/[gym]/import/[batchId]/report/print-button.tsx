"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** The browser's print dialog, where "Save as PDF" makes the PDF; the app's menus are left off the page. */
export function PrintButton() {
  return (
    <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon /> Print or save as PDF
    </Button>
  );
}
